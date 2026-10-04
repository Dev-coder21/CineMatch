import { useEffect, useMemo, useRef, useState } from "react";
import filmstripSource from "../shaders/character-carousel/sources/character-filmstrip.html?raw";
import { posterDataURI } from "./posterArt.js";

/*
 * The ThreeUI Filmstrip (character-filmstrip.html, untouched on disk) with its
 * sample portraits swapped for a viewer's recommendations at runtime. Layout,
 * paper grain, perspective rail, easing and input handling are the authored
 * ones. CineMatch changes: a dark stage, taller poster cards, calmer motion,
 * 60 fps tuning, the deck glides in to card 01 and holds still when idle (the details panel
 * follows the focused card), and a bridge script
 * tells the page which card is in focus and lets the page focus a card.
 */
const PORTRAITS_BLOCK = /const portraits = \{[\s\S]*?\n {6}\};/;
const PROFILES_BLOCK = /const profiles = \[[\s\S]*?\]\.map\(\(\[name, role, portrait\]\) => \(\{ name, role, portrait \}\)\);/;

function buildDocument(movies) {
  const portraits = {};
  const profiles = movies.map((m, i) => {
    portraits[`p${i}`] = m.posterUrl || posterDataURI(m);
    const role = m.predicted != null
      ? `${Math.min(5, m.predicted).toFixed(1)} predicted · ${m.genres.slice(0, 2).join(" / ")}`
      : `Most rated · ${m.genres.slice(0, 2).join(" / ")}`;
    return [m.title, role, `p${i}`];
  });

  const bridge = `<script data-cinematch-bridge>
(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var last = -1;
  function report() {
    var i = cards.findIndex(function (c) { return c.getAttribute('aria-current') === 'true'; });
    if (i !== last && i >= 0) { last = i; parent.postMessage({ type: 'cinematch-focus', index: i }, '*'); }
  }
  new MutationObserver(report).observe(document.getElementById('deck'), { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'cinematch-goto') return;
    var card = cards[e.data.index];
    if (card) card.click();
  });
  report();
})();
</script>`;

  /* CineMatch dress: a dark projection-room stage instead of the beige paper
     (the cards keep their cream print frames), and taller cards so a real
     2:3 poster shows whole instead of being cropped to a square. */
  const focusStyles = `<style data-cinematch-reel>
html, body, .stage { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #121014 !important; }
:root { color-scheme: dark; background: #121014; }
.stage {
  min-height: 0 !important;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px) 50% 0 / 25% 100%,
    repeating-linear-gradient(0deg, transparent 0, transparent 109px, rgba(255, 255, 255, 0.04) 110px, transparent 111px),
    radial-gradient(circle at var(--pointer-x) 46%, rgba(255, 236, 214, 0.14), transparent 36%),
    radial-gradient(120% 80% at 50% 125%, rgba(255, 47, 109, 0.12), transparent 60%),
    #121014 !important;
}
.stage::before { opacity: 0.1; mix-blend-mode: screen; }
.stage::after { background: linear-gradient(90deg, rgba(0, 0, 0, 0.6), transparent 16%, transparent 84%, rgba(0, 0, 0, 0.6)); }
.card {
  aspect-ratio: 0.56; width: clamp(140px, 14.5vw, 212px);
  will-change: transform, opacity; backface-visibility: hidden; contain: layout paint style;
  box-shadow: 0 26px 54px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.64);
}
.card::before { border-color: rgba(28, 22, 14, 0.2); }
.portrait img { transform: none; filter: none; }
.portrait { inset: 7px 7px 21%; }
.footer { height: calc(21% - 7px); }
@media (max-width: 650px) { .card { width: clamp(128px, 40vw, 168px); } }
</style>`;

  return filmstripSource
    .replace(PORTRAITS_BLOCK, `const portraits = ${JSON.stringify(portraits)};`)
    .replace(PROFILES_BLOCK, `const profiles = ${JSON.stringify(profiles)}.map(([name, role, portrait]) => ({ name, role, portrait }));`)
    .replace("phase: 3,\n        target: 3,\n        base: 3,", "phase: -3.5,\n        target: 0,\n        base: 0,")
    .replace("alt=\"Generated portrait of ${profile.name}\"", "alt=\"Poster for ${profile.name}\"")
    .replace("aria-label=\"Interactive editorial character filmstrip\"", "aria-label=\"Recommended films\"")
    /* hold still when idle: the focused film is what the details panel shows */
    .replace("if (!state.active && time - state.lastInput > 3600) {", "if (false) {")
    /* calmer motion: slower easing, a shorter reach for the pointer, and one
       card per wheel gesture instead of one per trackpad event */
    .replace("1 - Math.pow(0.001, deltaTime / 1000)", "1 - Math.pow(0.045, deltaTime / 1000)")
    .replace("(innerWidth < 650 ? ny * 2.2 : nx * 3.1)", "(innerWidth < 650 ? ny * 1.0 : nx * 1.4)")
    .replace("if (!direction) return;", "if (!direction || performance.now() - (state.lastWheel || 0) < 380) return;\n        state.lastWheel = performance.now();")
    /* 60 fps: no per-frame blur or repaint-triggering style variable, and no
       work at all on frames where nothing moved */
    .replace("card.style.filter = `blur(${Math.max(0, distance - 1.5) * 0.38}px)`;", "")
    .replace('card.style.setProperty("--focus", focus.toFixed(4));', "")
    .replace(
      "state.phase += (state.target - state.phase) * ease;",
      "state.phase += (state.target - state.phase) * ease;\n        var sig = state.phase.toFixed(4) + '|' + state.pointerX.toFixed(3) + '|' + state.pointerY.toFixed(3) + '|' + innerWidth + 'x' + innerHeight;\n        if (sig === state.sig) { requestAnimationFrame(render); return; }\n        state.sig = sig;",
    )
    .replace("</head>", `${focusStyles}</head>`)
    .replace("</body>", `${bridge}</body>`);
}

export function PosterFilmstrip({ movies, onFocus, controlRef }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const source = useMemo(() => buildDocument(movies), [movies]);

  useEffect(() => {
    const on = (e) => {
      if (e.source === ref.current?.contentWindow && e.data?.type === "cinematch-focus") onFocus(e.data.index);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [onFocus]);

  useEffect(() => { setReady(false); }, [source]);

  if (controlRef) {
    controlRef.current = (index) => ref.current?.contentWindow?.postMessage({ type: "cinematch-goto", index }, "*");
  }

  return (
    <div className="threeui-background character-carousel character-carousel--filmstrip cm-filmstrip" style={{ background: "#121014" }}>
      <iframe
        ref={ref}
        title="Recommended films"
        srcDoc={source}
        sandbox="allow-scripts"
        onLoad={() => setReady(true)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, display: "block", background: "#121014", opacity: ready ? 1 : 0, transition: "opacity .3s ease" }}
      />
    </div>
  );
}
