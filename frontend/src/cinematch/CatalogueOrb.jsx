import { useEffect, useRef, useState } from "react";
import orbSource from "../shaders/orb-gallery/sources/orb-gallery.html?raw";
import { SAMPLE_POOL, MOST_RATED } from "./catalogue.js";
import { normaliseMovie } from "./data.js";
import { lobbyCardDataURI } from "./posterArt.js";
import { loadImage, loadPosterMap } from "./posters.js";

/*
 * The ThreeUI Orb Gallery (orb-gallery.html, untouched on disk) used as the
 * MovieLens catalogue. At runtime its 96 interface plates become lobby cards
 * of real titles (with the TMDB poster when scripts/fetch_posters.py has been
 * run), its orb.gallery nav and copy are hidden, and the idle spin is slowed
 * from one turn every 20 s to one every 48 s. Sphere, lattice, hover lift,
 * focus dimming and inertial drag are the authored ones.
 */
const TILE_BLOCK = /const TILE_SRC=\[[\s\S]*?\];/;
const TW = 384, TH = 256;

/* the 96 films on the sphere: ones with a real poster first, generated
   posters only to fill any gaps */
function films(posters) {
  const seen = new Set();
  const all = [...MOST_RATED, ...SAMPLE_POOL]
    .filter(([id]) => (seen.has(id) ? false : seen.add(id)))
    .map(([movieId, title, genres]) => normaliseMovie({ movieId, title, genres }));
  return [...all.filter((m) => posters[m.id]), ...all.filter((m) => !posters[m.id])].slice(0, 96);
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "…");
  }
  return lines;
}

/* A lobby card: blurred poster as the backdrop, the poster itself on the left,
   genre, title and year set beside it. */
function posterCard(img, movie) {
  const c = document.createElement("canvas");
  c.width = TW; c.height = TH;
  const x = c.getContext("2d");
  const cover = Math.max(TW / img.width, TH / img.height);
  x.filter = "blur(16px) saturate(1.3)";
  x.drawImage(img, (TW - img.width * cover) / 2, (TH - img.height * cover) / 2, img.width * cover, img.height * cover);
  x.filter = "none";
  x.fillStyle = "rgba(8,8,12,.62)";
  x.fillRect(0, 0, TW, TH);
  const ph = TH - 28, pw = ph * (2 / 3);
  x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 14; x.shadowOffsetY = 4;
  x.drawImage(img, 14, 14, pw, ph);
  x.shadowColor = "transparent";
  const tx = 14 + pw + 16, tw = TW - tx - 16;
  x.fillStyle = "rgba(242,242,248,.6)";
  x.font = "700 12px 'Helvetica Neue', Helvetica, Arial, sans-serif";
  x.fillText((movie.genres[0] || "").toUpperCase(), tx, 40);
  x.fillStyle = "#f2f2f8";
  x.font = "800 26px 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const lines = wrapLines(x, movie.title, tw, 4);
  const top = TH - 46 - (lines.length - 1) * 28;
  lines.forEach((l, i) => x.fillText(l, tx, top + i * 28));
  x.fillStyle = "rgba(242,242,248,.6)";
  x.font = "600 14px 'Helvetica Neue', Helvetica, Arial, sans-serif";
  x.fillText(String(movie.year ?? ""), tx, TH - 22);
  return c.toDataURL("image/jpeg", 0.86);
}

async function buildTiles() {
  const posters = await loadPosterMap();
  const list = films(posters);
  return Promise.all(list.map(async (m) => {
    const url = posters[m.id];
    const img = url ? await loadImage(url) : null;
    if (img) {
      try { return posterCard(img, m); } catch { /* tainted or failed: fall back */ }
    }
    return lobbyCardDataURI(m);
  }));
}

function buildDocument(tiles) {
  const hideChrome = `<style data-cinematch>
  .nav, .band, .hint { display: none !important; }
  html, body { background: #000 !important; }
</style>`;
  return orbSource
    .replace(TILE_BLOCK, `const TILE_SRC=${JSON.stringify(tiles)};`)
    .replace("Drag to spin &middot; hover a screen", "Drag to spin &middot; hover a film")
    .replace("const AUTO=Math.PI*2/20;", "const AUTO=Math.PI*2/48;")
    .replace("</head>", `${hideChrome}</head>`);
}

export function CatalogueOrb() {
  const host = useRef(null);
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setVisible(e?.isIntersecting ?? true), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* build the 96 cards only once the sphere is about to scroll into view,
     so the page never pays for it during the intro or the first screen */
  const started = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!visible || started.current) return;
    started.current = true;
    buildTiles().then((tiles) => { if (mounted.current) setSource(buildDocument(tiles)); });
  }, [visible]);

  useEffect(() => { if (!visible) setReady(false); }, [visible]);

  return (
    <div ref={host} className="threeui-background orb-gallery" style={{ position: "relative", overflow: "hidden", background: "#000", width: "100%", height: "100%" }}>
      {visible && source && (
        <iframe
          title="The MovieLens catalogue"
          srcDoc={source}
          sandbox="allow-scripts"
          onLoad={() => setReady(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, display: "block", background: "#000", opacity: ready ? 1 : 0, transition: "opacity 400ms ease-out" }}
        />
      )}
    </div>
  );
}
