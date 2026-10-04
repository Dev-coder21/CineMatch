import { useEffect, useRef, useState } from "react";
import { STATS } from "../cinematch/data.js";

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Running SMPTE-style timecode, written straight to the DOM. */
export function Timecode({ className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const pad = (n) => String(n).padStart(2, "0");
    const tick = (now) => {
      const t = (now - t0) / 1000;
      const f = Math.floor((t % 1) * 24);
      if (ref.current) {
        ref.current.textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(f)}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <span ref={ref} className={`bc-timecode ${className}`}>00:00:00:00</span>;
}

/* Colour bars and a tear, once per visit, before the broadcast cuts in. */
export function BootCard() {
  const [phase, setPhase] = useState(() => {
    if (reduceMotion()) return "gone";
    try {
      if (sessionStorage.getItem("cm-boot")) return "gone";
    } catch { /* storage may be blocked */ }
    return "bars";
  });
  useEffect(() => {
    if (phase === "gone") return undefined;
    try { sessionStorage.setItem("cm-boot", "1"); } catch { /* ignore */ }
    const a = setTimeout(() => setPhase("tear"), 1100);
    const b = setTimeout(() => setPhase("gone"), 1550);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [phase]);
  if (phase === "gone") return null;
  return (
    <div className={`bc-boot is-${phase}`} onClick={() => setPhase("gone")} aria-hidden="true">
      <div className="bc-boot__bars">
        {["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"].map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </div>
      <div className="bc-boot__castellations">
        {["#0000c0", "#131313", "#c000c0", "#131313", "#00c0c0", "#131313", "#c0c0c0"].map((c, i) => (
          <i key={i} style={{ background: c }} />
        ))}
      </div>
      <div className="bc-boot__id">
        <strong>CineMatch</strong>
        <span>Channel 01 — stand by</span>
      </div>
    </div>
  );
}

/* Analogue static for "no signal" and "tuning" states. */
export function Static({ className = "", intensity = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const x = c.getContext("2d");
    const W = 160, H = 100;
    c.width = W; c.height = H;
    const img = x.createImageData(W, H);
    let raf, last = 0, roll = 0;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 42) return;
      last = now;
      roll = (roll + 3) % H;
      for (let i = 0; i < W * H; i++) {
        const row = (i / W) | 0;
        const band = Math.abs(row - roll) < 6 ? 60 : 0;
        const v = Math.min(255, (Math.random() * 200 + band) * intensity);
        img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    };
    if (reduceMotion()) draw(1e9); else raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [intensity]);
  return <canvas ref={ref} className={`bc-static ${className}`} aria-hidden="true" />;
}

/*
 * The rating matrix, shrunk: every cell stands in for ~4,000 viewer–film pairs.
 * Pink cells are ratings people actually gave; "Run ALS" fills the empty ones
 * with predictions over 20 iterations (an illustration, not the live model).
 */
const COLS = 96, ROWS = 56;
export function SparsityMatrix() {
  const canvasRef = useRef(null);
  const [iter, setIter] = useState(0);
  const [running, setRunning] = useState(false);
  const cells = useRef(null);
  const iterRef = useRef(0);

  if (!cells.current) {
    let s = 0x9e3779b9;
    const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const rowBias = Array.from({ length: ROWS }, () => 0.25 + r() * 1.5);
    const colBias = Array.from({ length: COLS }, (_, i) => 1.9 * Math.exp(-i / 30) + 0.2);
    cells.current = Array.from({ length: COLS * ROWS }, (_, i) => {
      const row = (i / COLS) | 0, col = i % COLS;
      const p = (1 - STATS.sparsity / 100) * rowBias[row] * colBias[col];
      return { seen: r() < p, rating: 1 + Math.floor(r() * r() * 5 + r() * 2.2) % 5, reveal: r(), guess: r() };
    });
  }

  const paint = (k) => {
    const c = canvasRef.current;
    if (!c) return;
    const box = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    /* resizing a canvas reallocates it, so only do that when the size changed */
    const w = Math.round(box.width * dpr), h = Math.round(box.height * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext("2d");
    const cw = c.width / COLS, ch = c.height / ROWS;
    const filled = 1 - Math.pow(1 - 0.17, k);
    x.clearRect(0, 0, c.width, c.height);
    cells.current.forEach((cell, i) => {
      const cx = (i % COLS) * cw, cy = ((i / COLS) | 0) * ch;
      const s = Math.max(1, Math.min(cw, ch) * 0.62);
      if (cell.seen) {
        x.fillStyle = `rgba(255,47,109,${0.45 + cell.rating * 0.11})`;
        x.fillRect(cx + (cw - s) / 2, cy + (ch - s) / 2, s, s);
      } else if (k > 0 && cell.reveal < filled) {
        x.fillStyle = `rgba(0,230,255,${0.12 + cell.guess * 0.5 * Math.min(1, k / 8)})`;
        const g = s * 0.7;
        x.fillRect(cx + (cw - g) / 2, cy + (ch - g) / 2, g, g);
      } else {
        x.fillStyle = "rgba(242,242,248,0.07)";
        x.fillRect(cx + cw / 2 - 0.5 * dpr, cy + ch / 2 - 0.5 * dpr, dpr, dpr);
      }
    });
  };

  useEffect(() => {
    paint(iterRef.current);
    const on = () => paint(iterRef.current);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const run = () => {
    if (running) return;
    setRunning(true);
    let k = 0;
    const step = () => {
      k += 1;
      iterRef.current = k;
      setIter(k);
      paint(k);
      if (k < STATS.iterations) setTimeout(step, reduceMotion() ? 0 : 280);
      else setRunning(false);
    };
    step();
  };
  const reset = () => { iterRef.current = 0; setIter(0); paint(0); };

  const rmse = iter === 0 ? null : STATS.rmse + 0.46 * Math.exp(-(iter - 1) / 3.2) * (iter < STATS.iterations ? 1 : 0);

  return (
    <figure className="bc-matrix" data-reveal="right">
      <div className="bc-matrix__frame">
        <canvas ref={canvasRef} className="bc-matrix__canvas" role="img"
          aria-label="Grid of viewer–film pairs. About 4% are filled with real ratings; running ALS fills the rest with predictions." />
        <span className="bc-matrix__axis bc-matrix__axis--x">3,883 films</span>
        <span className="bc-matrix__axis bc-matrix__axis--y">6,040 viewers</span>
      </div>
      <figcaption className="bc-matrix__controls">
        <button type="button" className="bc-btn bc-btn--cyan" onClick={iter >= STATS.iterations ? reset : run} disabled={running}>
          <span>{running ? "Running ALS…" : iter >= STATS.iterations ? "Reset the matrix" : "Run ALS"}</span>
        </button>
        <dl className="bc-matrix__readout">
          <div><dt>Iteration</dt><dd>{String(iter).padStart(2, "0")} / {STATS.iterations}</dd></div>
          <div><dt>Test RMSE</dt><dd>{rmse == null ? "—" : rmse.toFixed(4)}</dd></div>
        </dl>
        <p className="bc-matrix__legend">
          <span><i className="is-seen" /> rating someone gave</span>
          <span><i className="is-guess" /> rating the model predicts</span>
        </p>
      </figcaption>
    </figure>
  );
}
