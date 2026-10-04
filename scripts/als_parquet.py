"""
A tiny, dependency-free Parquet reader for the two tables Spark's ALSModel
saves (userFactors / itemFactors: id INT, features ARRAY<FLOAT>), so the
trained model can be used without Spark or pyarrow.

Supports what Spark writes for these files: Thrift compact metadata, Snappy
or uncompressed pages, data page v1/v2, PLAIN and dictionary encodings, and
the definition/repetition levels of a nested list column.
"""
import glob
import os
import struct


# --------------------------------------------------------------- thrift compact
class _Thrift:
    def __init__(self, buf, pos=0):
        self.b, self.p = buf, pos

    def byte(self):
        v = self.b[self.p]
        self.p += 1
        return v

    def varint(self):
        shift = result = 0
        while True:
            c = self.byte()
            result |= (c & 0x7F) << shift
            if not c & 0x80:
                return result
            shift += 7

    def zigzag(self):
        n = self.varint()
        return (n >> 1) ^ -(n & 1)

    def value(self, t):
        if t == 1:
            return True
        if t == 2:
            return False
        if t == 3:
            v = self.byte()
            return v - 256 if v > 127 else v
        if t in (4, 5, 6):
            return self.zigzag()
        if t == 7:
            v = struct.unpack_from("<d", self.b, self.p)[0]
            self.p += 8
            return v
        if t == 8:
            n = self.varint()
            v = bytes(self.b[self.p:self.p + n])
            self.p += n
            return v
        if t in (9, 10):
            h = self.byte()
            size, et = h >> 4, h & 0x0F
            if size == 15:
                size = self.varint()
            if et in (1, 2):
                return [self.byte() == 1 for _ in range(size)]
            return [self.value(et) for _ in range(size)]
        if t == 11:
            size = self.varint()
            if not size:
                return {}
            kv = self.byte()
            return {self.value(kv >> 4): self.value(kv & 0x0F) for _ in range(size)}
        if t == 12:
            return self.struct()
        raise ValueError(f"unknown thrift type {t}")

    def struct(self):
        out, last = {}, 0
        while True:
            h = self.byte()
            if h == 0:
                return out
            delta, t = h >> 4, h & 0x0F
            fid = last + delta if delta else self.zigzag()
            out[fid] = self.value(t)
            last = fid


# --------------------------------------------------------------- snappy
def _snappy(src):
    r = _Thrift(src)
    n = r.varint()
    out = bytearray()
    p = r.p
    while p < len(src):
        tag = src[p]; p += 1
        kind = tag & 3
        if kind == 0:
            ln = (tag >> 2) + 1
            if ln > 60:
                extra = ln - 60
                ln = int.from_bytes(src[p:p + extra], "little") + 1
                p += extra
            out += src[p:p + ln]; p += ln
            continue
        if kind == 1:
            ln = ((tag >> 2) & 7) + 4
            off = ((tag >> 5) << 8) | src[p]; p += 1
        elif kind == 2:
            ln = (tag >> 2) + 1
            off = int.from_bytes(src[p:p + 2], "little"); p += 2
        else:
            ln = (tag >> 2) + 1
            off = int.from_bytes(src[p:p + 4], "little"); p += 4
        start = len(out) - off
        for i in range(ln):
            out.append(out[start + i])
    assert len(out) == n, "snappy length mismatch"
    return bytes(out)


# --------------------------------------------------------------- levels / values
def _rle_hybrid(buf, pos, end, width, count):
    out = []
    t = _Thrift(buf, pos)
    nbytes = (width + 7) // 8
    while len(out) < count and t.p < end:
        h = t.varint()
        if h & 1:
            groups = h >> 1
            n = groups * 8
            data = int.from_bytes(buf[t.p:t.p + groups * width], "little")
            t.p += groups * width
            mask = (1 << width) - 1
            out.extend((data >> (i * width)) & mask for i in range(n))
        else:
            run = h >> 1
            v = int.from_bytes(buf[t.p:t.p + nbytes], "little") if nbytes else 0
            t.p += nbytes
            out.extend([v] * run)
    return out[:count]


def _levels_v1(buf, pos, max_level, count):
    if max_level == 0:
        return [0] * count, pos
    ln = struct.unpack_from("<I", buf, pos)[0]
    vals = _rle_hybrid(buf, pos + 4, pos + 4 + ln, max_level.bit_length(), count)
    return vals, pos + 4 + ln


_FMT = {1: ("<i", 4), 2: ("<q", 8), 4: ("<f", 4), 5: ("<d", 8)}


def _plain(buf, pos, ptype, n):
    fmt, size = _FMT[ptype]
    return list(struct.unpack_from(f"<{n}{fmt[1]}", buf, pos)), pos + n * size


def _values(buf, pos, end, enc, ptype, n, dictionary):
    if enc == 0:
        return _plain(buf, pos, ptype, n)[0]
    if enc in (2, 8):
        width = buf[pos]
        idx = _rle_hybrid(buf, pos + 1, end, width, n)
        return [dictionary[i] for i in idx]
    raise ValueError(f"unsupported encoding {enc}")


# --------------------------------------------------------------- columns
def _leaf_levels(schema):
    """Walk the flattened schema and return {leaf name path: (type, max_def, max_rep)}."""
    leaves = {}

    def walk(i, path, d, r):
        el = schema[i]
        rep = el.get(3, 0)
        d2 = d + (rep != 0)
        r2 = r + (rep == 2)
        name = el[4].decode()
        kids = el.get(5, 0)
        i += 1
        if not kids:
            leaves[".".join(path + [name])] = (el.get(1), d2, r2)
            return i
        for _ in range(kids):
            i = walk(i, path + [name], d2, r2)
        return i

    i, root_kids = 1, schema[0].get(5, 0)
    for _ in range(root_kids):
        i = walk(i, [], 0, 0)
    return leaves


def _read_column(buf, meta, ptype, max_def, max_rep):
    codec = meta.get(4, 0)
    total = meta[5]
    pos = meta.get(11) or meta[9]
    dictionary, defs, reps, vals = None, [], [], []
    seen = 0
    while seen < total:
        t = _Thrift(buf, pos)
        header = t.struct()
        body_start = t.p
        csize = header[3]
        body = buf[body_start:body_start + csize]
        pos = body_start + csize
        ptype_page = header[1]
        if ptype_page == 2:  # dictionary
            raw = _snappy(body) if codec == 1 else body
            dictionary = _plain(raw, 0, ptype, header[7][1])[0]
            continue
        if ptype_page == 0:  # data page v1
            raw = _snappy(body) if codec == 1 else body
            n = header[5][1]
            r, p = _levels_v1(raw, 0, max_rep, n)
            d, p = _levels_v1(raw, p, max_def, n)
            nn = sum(1 for x in d if x == max_def)
            vals += _values(raw, p, len(raw), header[5][2], ptype, nn, dictionary)
        elif ptype_page == 3:  # data page v2
            h = header[8]
            n, rl, dl = h[1], h.get(6, 0), h.get(5, 0)
            r = _rle_hybrid(body, 0, rl, max_rep.bit_length(), n) if max_rep else [0] * n
            d = _rle_hybrid(body, rl, rl + dl, max_def.bit_length(), n) if max_def else [0] * n
            rest = body[rl + dl:]
            if codec == 1 and h.get(7, True):
                rest = _snappy(rest)
            nn = sum(1 for x in d if x == max_def)
            vals += _values(rest, 0, len(rest), h[4], ptype, nn, dictionary)
        else:
            continue
        reps += r
        defs += d
        seen += n
    return defs, reps, vals


def read_factors(directory):
    """Return {id: [10 floats]} from a Spark ALS userFactors/itemFactors folder."""
    factors = {}
    for path in sorted(glob.glob(os.path.join(directory, "part-*.parquet"))):
        buf = open(path, "rb").read()
        assert buf[:4] == b"PAR1" and buf[-4:] == b"PAR1", f"not parquet: {path}"
        flen = struct.unpack_from("<I", buf, len(buf) - 8)[0]
        meta = _Thrift(buf, len(buf) - 8 - flen).struct()
        leaves = _leaf_levels(meta[2])
        for rg in meta.get(4, []):
            cols = {}
            for cc in rg[1]:
                cm = cc[3]
                name = ".".join(x.decode() for x in cm[3])
                ptype, md, mr = leaves[name]
                cols[name.split(".")[0]] = _read_column(buf, cm, ptype, md, mr)
            ids = cols["id"][2]
            defs, reps, vals = cols["features"]
            rows, cur, vi = [], None, 0
            md = max(defs) if defs else 0
            for d, r in zip(defs, reps):
                if r == 0:
                    cur = []
                    rows.append(cur)
                if d == md:
                    cur.append(vals[vi]); vi += 1
            for i, feats in zip(ids, rows):
                factors[i] = feats
    return factors
