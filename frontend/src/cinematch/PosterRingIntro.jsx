import { useEffect, useRef, useState } from "react";
import gallerySource from "../shaders/neuform-isolated/sources/gallery-heading.html?raw";
import { GALLERY_HEADING_VARIANTS, transformGalleryHeadingSource } from "../shaders/neuform-isolated/NeuformIsolatedEffects.tsx";
import { MOST_RATED, SAMPLE_POOL } from "./catalogue.js";
import { normaliseMovie } from "./data.js";
import { posterDataURI } from "./posterArt.js";
import { loadPosterMap } from "./posters.js";

/*
 * The opening of CineMatch: the ThreeUI Glitch Fall heading ("cinematch"
 * variant: STOP SCROLLING / START WATCHING) with its glitch plates replaced by
 * a ring of twenty real movie posters. On top of the authored ring:
 *   - plates are portrait (2:3), smaller and twice as many
 *   - posters always read upright and unmirrored
 *   - the ring turns slowly at rest and a little faster under the pointer
 *   - "launch" plays a three-part exit, then tells the page to cut to home:
 *       0.0-1.6 s  the ring whirls up to ~30x speed (any faster and, at
 *                  60 Hz, a poster moves more than half the gap to the next
 *                  each frame, so the ring strobes instead of spinning)
 *       1.2-2.4 s  it rushes toward the screen as the headline swells and fades
 *       2.2-3.1 s  every poster shatters into twelve shards that fly apart
 */
const RING_COUNT = 20;

function launchLayer(posters) {
  return {
    vars: `var LAUNCH = 0, LAUNCH_RATE = 0, LAUNCH_T0 = 0, LAUNCH_SENT = false;
var A0 = RING.a, D0 = RING.dist, T0 = RING.tile, HEAD_ALPHA = 1, HEAD_SCALE = 1, SHATTER = 0, FLASH = 0;
function ease(t){ t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
function launchStep(now){
  var lt = (now - LAUNCH_T0) / 1000;
  LAUNCH_RATE = 1 + 29 * ease(lt / 1.6);
  var k = ease((lt - 1.2) / 1.2);
  RING.dist = D0 * (1 - 0.6 * k);
  RING.a = A0 * (1 + 0.9 * k);
  RING.tile = T0 * (1 + 1.1 * k);
  HEAD_SCALE = 1 + 0.35 * ease((lt - 0.9) / 1.2);
  HEAD_ALPHA = 1 - ease((lt - 1.0) / 0.9);
  var sh = (lt - 2.2) / 0.9;
  SHATTER = sh <= 0 ? 0 : 1 - Math.pow(1 - Math.min(1, sh), 2);
  FLASH = lt > 2.2 && lt < 2.6 ? 1 - (lt - 2.2) / 0.4 : 0;
  if (lt > 2.75 && !LAUNCH_SENT){
    LAUNCH_SENT = true;
    try { window.parent.postMessage({ cinematch: 'launched' }, '*'); } catch (e) {}
  }
}
function drawHead(){
  if (HEAD_ALPHA <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = HEAD_ALPHA;
  if (HEAD_SCALE !== 1){
    ctx.translate(W / 2, H / 2); ctx.scale(HEAD_SCALE, HEAD_SCALE); ctx.translate(-W / 2, -H / 2);
  }
  ctx.drawImage(headLayer, 0, 0);
  ctx.restore();
}
window.addEventListener('message', function(e){
  if (e.data && e.data.cinematch === 'launch' && !LAUNCH){ LAUNCH = 1; LAUNCH_T0 = performance.now(); settled = false; }
  /* the page has faded us out: stop drawing so the home page has every frame */
  if (e.data && e.data.cinematch === 'stop') playing = false;
});
/* the canvas measures its frame when the script starts; if the frame was
   still 0 px or mid-layout at that moment the ring and headline would be
   drawn at zero size, so re-measure whenever the frame's size really changes */
(function(){
  var lastW = -1, lastH = -1;
  function check(){
    var w = window.innerWidth, h = window.innerHeight;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    if (w > 0 && h > 0){ resize(); settled = false; render(tNow); }
  }
  if (window.ResizeObserver) new ResizeObserver(check).observe(document.documentElement);
  window.addEventListener('load', check);
  window.addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden){ lastW = -1; check(); } });
  requestAnimationFrame(function(){ requestAnimationFrame(check); });
  setTimeout(check, 250); setTimeout(check, 1200);
})();
function askEnter(){ try { window.parent.postMessage({ cinematch: 'enter' }, '*'); } catch (e) {} }
document.addEventListener('click', askEnter);
document.addEventListener('wheel', function(e){ if (Math.abs(e.deltaY) > 4) askEnter(); }, { passive: true });
document.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') askEnter(); });
`,
    posters: `var TEX = buildTextures();
/* CineMatch: real posters on the ring, with the broadcast scanlines over them */
(function(){
  var SRC = ${JSON.stringify(posters)};
  SRC.forEach(function(src, i){
    var im = new Image();
    im.onload = function(){
      var W = 240, H = 360;
      var f = mkc(W, H), x = f.getContext('2d');
      var s = Math.max(W / im.width, H / im.height);
      x.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
      x.fillStyle = 'rgba(0,0,0,0.14)';
      for (var k = 0; k < H; k += 3) x.fillRect(0, k, W, 1);
      var b = mkc(W, H), y = b.getContext('2d');
      y.drawImage(f, 0, 0);
      y.fillStyle = 'rgba(6,6,14,0.6)'; y.fillRect(0, 0, W, H);
      TEX.front[i] = f;
      TEX.back[i] = b;
    };
    im.src = src;
  });
})();`,
    drawTile: `function drawTile(i, psi){
  var c = Math.cos(psi), s = Math.sin(psi);
  var C = [c*U[0]+s*V[0], c*U[1]+s*V[1], c*U[2]+s*V[2]];
  var T = [-s*U[0]+c*V[0], -s*U[1]+c*V[1], -s*U[2]+c*V[2]];
  var h = RING.tile/(2*RING.a);
  var p0 = project(C);
  var pT = project([C[0]+T[0]*h, C[1]+T[1]*h, C[2]+T[2]*h]);
  var pA = project([C[0]+AXIS[0]*h, C[1]+AXIS[1]*h, C[2]+AXIS[2]*h]);
  var ex = pT[0]-p0[0], ey = pT[1]-p0[1];
  var fx = pA[0]-p0[0], fy = pA[1]-p0[1];
  if (Math.abs(ex*fy - ey*fx) < 0.4) return;
  /* keep every poster upright and unmirrored */
  if (fy < 0){ ex = -ex; ey = -ey; fx = -fx; fy = -fy; }
  if (ex*fy - ey*fx < 0){ ex = -ex; ey = -ey; }
  var list = C[2] > 0 ? TEX.front : TEX.back;
  var img = list[i % list.length];
  var w = TS, hh = TS*RING.aspect;
  ctx.save();
  ctx.setTransform(ex*2/TS, ey*2/TS, fx*2/TS, fy*2/TS, p0[0], p0[1]);
  if (SHATTER <= 0){
    roundRectPath(ctx, w, hh, TS*0.07);
    ctx.clip();
    ctx.drawImage(img, -w/2, -hh/2, w, hh);
  } else {
    /* twelve shards per poster, flung outward from the poster's centre */
    var cols = 3, rows = 4, sw = w/cols, sh = hh/rows, k = SHATTER, iw = img.width/cols, ih = img.height/rows;
    ctx.globalAlpha = Math.max(0, 1 - k*k*k);
    for (var r = 0; r < rows; r++){
      for (var q = 0; q < cols; q++){
        var n1 = ((i*131 + r*17 + q*7) % 97) / 97, n2 = ((i*61 + r*29 + q*43) % 89) / 89;
        var cx = -w/2 + (q + 0.5)*sw, cy = -hh/2 + (r + 0.5)*sh;
        var push = k*k*TS*2.4;
        ctx.save();
        ctx.translate(cx + (cx/(w/2) + (n1 - 0.5)*1.4)*push, cy + (cy/(hh/2) + (n2 - 0.5)*1.4)*push);
        ctx.rotate((n1 - 0.5)*4*k);
        ctx.scale(1 - 0.35*k, 1 - 0.35*k);
        ctx.drawImage(img, q*iw, r*ih, iw, ih, -sw/2, -sh/2, sw + 0.8, sh + 0.8);
        ctx.restore();
      }
    }
  }
  ctx.restore();
  ctx.setTransform(1,0,0,1,0,0);
}
`,
    flash: `ctx.drawImage(labelLayer,0,0);
  if (FLASH > 0){
    ctx.fillStyle = 'rgba(255,47,109,' + (0.22*FLASH).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,230,255,' + (0.12*FLASH).toFixed(3) + ')';
    for (var y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
  }`,
  };
}

function buildDocument(posters) {
  const variant = GALLERY_HEADING_VARIANTS.cinematch;
  const layer = launchLayer(posters);
  return transformGalleryHeadingSource(gallerySource, "dark", variant)
    .replace("  n: 12,", `  n: ${RING_COUNT},`)
    .replace("  tile: 346,", "  tile: 172,")
    .replace("  aspect: 0.75,", "  aspect: 1.5, ")
    /* a full-screen 2D canvas: 1.5x pixel density keeps it crisp and fluid */
    .replace("var dpr = Math.min(window.devicePixelRatio || 1, 2);", "var dpr = Math.min(window.devicePixelRatio || 1, 1.5);")
    .replace("var TEX = buildTextures();", layer.posters)
    .replace(/function drawTile\(i, psi\)\{[\s\S]*?\n\}\n/, layer.drawTile)
    .replace("var tNow = 0, playing = true, hovering = false,", `${layer.vars}var tNow = 0, playing = true, hovering = false,`)
    .replace("  last = now;\n  if (playing){", "  last = now;\n  if (LAUNCH) launchStep(now);\n  if (playing){")
    .replace(
      "rate += ((hovering ? 1 : 0) - rate) * (1 - Math.exp(-dt/EASE));",
      "rate += ((LAUNCH ? LAUNCH_RATE : hovering ? 1.8 : 0.8) - rate) * (1 - Math.exp(-dt/(LAUNCH ? 0.25 : EASE)));",
    )
    .replaceAll("ctx.drawImage(headLayer,0,0)", "drawHead()")
    .replace("ctx.drawImage(labelLayer,0,0);", layer.flash);
}

async function pickPosters() {
  const map = await loadPosterMap();
  const seen = new Set();
  const films = [...MOST_RATED, ...SAMPLE_POOL]
    .filter(([id]) => (seen.has(id) ? false : seen.add(id)))
    .map(([movieId, title, genres]) => normaliseMovie({ movieId, title, genres }));
  const withPoster = films.filter((m) => map[m.id]);
  const chosen = (withPoster.length >= RING_COUNT ? withPoster : films).slice(0, RING_COUNT);
  return chosen.map((m) => map[m.id] || posterDataURI(m));
}

export function PosterRingIntro({ launching, stopped = false, onEnter, onLaunched }) {
  const frame = useRef(null);
  const [source, setSource] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    pickPosters().then((p) => { if (live) setSource(buildDocument(p)); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const on = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.cinematch === "launched") onLaunched();
      if (e.data?.cinematch === "enter") onEnter();
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [onEnter, onLaunched]);

  useEffect(() => {
    if (launching) frame.current?.contentWindow?.postMessage({ cinematch: "launch" }, "*");
  }, [launching]);

  useEffect(() => {
    if (stopped) frame.current?.contentWindow?.postMessage({ cinematch: "stop" }, "*");
  }, [stopped]);

  return source ? (
    <iframe
      ref={frame}
      title="Stop scrolling, start watching"
      srcDoc={source}
      sandbox="allow-scripts"
      onLoad={() => setReady(true)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, display: "block", background: "#000", opacity: ready ? 1 : 0, transition: "opacity .6s ease" }}
    />
  ) : null;
}
