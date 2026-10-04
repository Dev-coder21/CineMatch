/*
 * Poster and lobby-card art as SVG data URIs, for films that have no TMDB
 * poster yet. These are images (not DOM), so they can be handed to the
 * Filmstrip and Orb documents, which run in their own sandboxed frames.
 */

const PALETTES = [
  { bg: "#0b0b12", accent: "#ff2f6d", ink: "#f2f2f8", sub: "rgba(242,242,248,.62)" },
  { bg: "#ff2f6d", accent: "#0b0b12", ink: "#0b0b12", sub: "rgba(11,11,18,.7)" },
  { bg: "#f2f2f8", accent: "#ff2f6d", ink: "#0b0b12", sub: "rgba(11,11,18,.6)" },
  { bg: "#141a2e", accent: "#00e6ff", ink: "#f2f2f8", sub: "rgba(242,242,248,.62)" },
  { bg: "#00e6ff", accent: "#0b0b12", ink: "#0b0b12", sub: "rgba(11,11,18,.7)" },
  { bg: "#1a1a26", accent: "#ff7a1a", ink: "#f2f2f8", sub: "rgba(242,242,248,.62)" },
  { bg: "#101018", accent: "#13f28a", ink: "#f2f2f8", sub: "rgba(242,242,248,.62)" },
  { bg: "#e9e5dd", accent: "#141a2e", ink: "#141a2e", sub: "rgba(20,26,46,.6)" },
];

const MOTIF = {
  "Sci-Fi": "orbit", Fantasy: "orbit", Horror: "slash", Thriller: "slash", Mystery: "blinds",
  Drama: "sun", Romance: "sun", Musical: "sun", Comedy: "dots", "Children's": "dots", Animation: "dots",
  Action: "bars", War: "bars", Adventure: "bars", Western: "bars", Crime: "blinds", "Film-Noir": "blinds",
  Documentary: "grid",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrap(text, max) {
  const words = text.toUpperCase().split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((w) => {
    if ((line + " " + w).trim().length > max && line) { lines.push(line); line = w; } else line = (line + " " + w).trim();
  });
  if (line) lines.push(line);
  return lines;
}

function motif(kind, w, h, a, b) {
  const cx = w / 2;
  switch (kind) {
    case "orbit":
      return `<circle cx="${cx}" cy="${h * 0.36}" r="${w * 0.2}" fill="${a}"/>
        <ellipse cx="${cx}" cy="${h * 0.36}" rx="${w * 0.44}" ry="${w * 0.11}" fill="none" stroke="${a}" stroke-width="${w * 0.016}" transform="rotate(-16 ${cx} ${h * 0.36})"/>
        <ellipse cx="${cx}" cy="${h * 0.36}" rx="${w * 0.34}" ry="${w * 0.07}" fill="none" stroke="${b}" stroke-width="${w * 0.008}" opacity=".6" transform="rotate(14 ${cx} ${h * 0.36})"/>`;
    case "slash":
      return `<path d="M${w * 0.58} 0 L${w * 0.74} 0 L${w * 0.36} ${h} L${w * 0.2} ${h} Z" fill="${a}"/>
        <path d="M${w * 0.8} 0 L${w * 0.84} 0 L${w * 0.46} ${h} L${w * 0.42} ${h} Z" fill="${b}" opacity=".5"/>`;
    case "sun":
      return `<circle cx="${cx}" cy="${h * 0.42}" r="${w * 0.3}" fill="${a}"/>
        ${[0, 1, 2, 3, 4].map((i) => `<rect x="0" y="${h * 0.44 + i * h * 0.04}" width="${w}" height="${h * 0.012 + i * h * 0.006}" fill="var(--bg)"/>`).join("")}`;
    case "dots":
      return Array.from({ length: 16 }, (_, i) => {
        const col = i % 4, row = (i / 4) | 0;
        return `<circle cx="${w * (0.14 + col * 0.24 + (row % 2) * 0.1)}" cy="${h * (0.1 + row * 0.13)}" r="${w * (i % 3 === 0 ? 0.08 : 0.045)}" fill="${i % 3 === 0 ? a : b}" opacity="${i % 3 === 0 ? 1 : 0.55}"/>`;
      }).join("");
    case "bars":
      return [0, 1, 2, 3].map((i) => `<path d="M${w * (-0.4 + i * 0.34)} ${h * 0.7} L${w * (0.1 + i * 0.34)} 0 L${w * (0.26 + i * 0.34)} 0 L${w * (-0.24 + i * 0.34)} ${h * 0.7} Z" fill="${i % 2 ? b : a}" opacity="${i % 2 ? 0.55 : 1}"/>`).join("");
    case "blinds":
      return Array.from({ length: 8 }, (_, i) => `<rect x="${-w * 0.1}" y="${h * (0.05 + i * 0.07)}" width="${w * 1.2}" height="${h * 0.028}" fill="${a}" transform="skewY(-12)"/>`).join("")
        + `<circle cx="${w * 0.72}" cy="${h * 0.22}" r="${w * 0.08}" fill="${b}"/>`;
    default:
      return Array.from({ length: 6 }, (_, i) => `<line x1="${(w / 5) * i}" y1="0" x2="${(w / 5) * i}" y2="${h * 0.7}" stroke="${a}" stroke-width="1.5"/>`).join("")
        + `<rect x="${w * 0.4}" y="${h * 0.2}" width="${w * 0.2}" height="${h * 0.3}" fill="${b}"/>`;
  }
}

function svgURI(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const FONT = `'Helvetica Neue', Helvetica, Arial, sans-serif`;

/* one-sheet; the Filmstrip shows a near-square window, so it asks for 1:1 */
export function posterDataURI(movie, { square = false } = {}) {
  const W = 400, H = square ? 420 : 600;
  const p = PALETTES[movie.id % PALETTES.length];
  const other = PALETTES[(movie.id * 7 + 3) % PALETTES.length].accent;
  const b = other === p.bg ? p.ink : other;
  const lines = wrap(movie.title, 13).slice(0, 4);
  const size = Math.min(square ? 54 : 64, Math.max(30, (square ? 440 : 560) / Math.max(...lines.map((l) => l.length), 6)));
  const baseY = square ? 40 + size * 0.8 : H - 56 - (lines.length - 1) * size * 0.92;
  const motifShift = square ? `translate(0 ${H * 0.12})` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="--bg:${p.bg}">
  <defs><pattern id="s" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="rgba(0,0,0,.14)"/></pattern></defs>
  <rect width="${W}" height="${H}" fill="${p.bg}"/>
  <g transform="${motifShift}">${motif(MOTIF[movie.genres[0]] || "grid", W, H, p.accent, b).replace(/var\(--bg\)/g, p.bg)}</g>
  <rect width="${W}" height="${H}" fill="url(#s)"/>
  ${lines.map((l, i) => `<text x="28" y="${baseY + i * size * 0.92}" font-family="${FONT}" font-weight="900" font-size="${size}" letter-spacing="-1.5" fill="${p.ink}">${esc(l)}</text>`).join("")}
  <text x="28" y="${square ? baseY + lines.length * size * 0.92 + 4 : H - 22}" font-family="${FONT}" font-weight="600" font-size="20" fill="${p.sub}">${esc(movie.year ?? "")}</text>
</svg>`;
  return svgURI(svg);
}

/* 3:2 lobby card for the catalogue sphere */
export function lobbyCardDataURI(movie) {
  const W = 384, H = 256;
  const p = PALETTES[(movie.id * 3) % PALETTES.length];
  const other = PALETTES[(movie.id * 5 + 1) % PALETTES.length].accent;
  const b = other === p.bg ? p.ink : other;
  const lines = wrap(movie.title, 16).slice(0, 3);
  const size = Math.min(40, Math.max(24, 470 / Math.max(...lines.map((l) => l.length), 8)));
  const top = H - 46 - (lines.length - 1) * size * 0.95;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${p.bg}"/>
  <g transform="translate(${W * 0.5} 0)" opacity=".95">${motif(MOTIF[movie.genres[0]] || "grid", W * 0.5, H * 1.3, p.accent, b).replace(/var\(--bg\)/g, p.bg)}</g>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="${p.sub}" stroke-width="1.5"/>
  <text x="26" y="40" font-family="${FONT}" font-weight="700" font-size="14" letter-spacing="1" fill="${p.sub}">${esc((movie.genres[0] || "").toUpperCase())}</text>
  ${lines.map((l, i) => `<text x="26" y="${top + i * size * 0.95}" font-family="${FONT}" font-weight="900" font-size="${size}" letter-spacing="-1" fill="${p.ink}">${esc(l)}</text>`).join("")}
  <text x="26" y="${H - 24}" font-family="${FONT}" font-weight="600" font-size="15" fill="${p.sub}">${esc(movie.year ?? "")}</text>
</svg>`;
  return svgURI(svg);
}
