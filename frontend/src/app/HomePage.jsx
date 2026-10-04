import { useCallback, useEffect, useState } from "react";
import { PosterRingIntro } from "../cinematch/PosterRingIntro.jsx";
import { CatalogueOrb } from "../cinematch/CatalogueOrb.jsx";
import { MOST_RATED } from "../cinematch/catalogue.js";
import { parseTitle, STATS } from "../cinematch/data.js";
import { SparsityMatrix } from "./parts.jsx";
import ScrollRail from "./ScrollRail.jsx";
import { useReveal } from "./useReveal.js";

const fmt = (n) => n.toLocaleString("en-US");

export function Wordmark({ href = "#/" }) {
  return (
    <a className="bc-wordmark" href={href} aria-label="CineMatch home">
      <svg viewBox="0 0 22 16" aria-hidden="true">
        <rect x="0" y="10" width="4" height="6" />
        <rect x="6" y="6" width="4" height="10" />
        <rect x="12" y="2" width="4" height="14" />
        <rect x="18" y="0" width="4" height="16" className="is-off" />
      </svg>
      <span>CineMatch</span>
    </a>
  );
}

function TopBar() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`bc-top${solid ? " is-scrolled" : ""}`}>
      <Wordmark />
      <nav className="bc-top__nav" aria-label="Sections">
        <a href="#/" onClick={(e) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); }}>How it works</a>
        <a href="#/" onClick={(e) => { e.preventDefault(); document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" }); }}>The catalogue</a>
      </nav>
          </header>
  );
}

/* Seen once per page load: coming back from the app lands on the home screen. */
let introSeen = false;

function Intro({ onReveal, onDone }) {
  const [launching, setLaunching] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [stopped, setStopped] = useState(false);
  const enter = useCallback(() => setLaunching(true), []);
  /* fade out over the home page, stop the ring once it's invisible, and only
     tear the intro down after the home page has finished rising in, so the
     teardown never lands in the middle of an animation */
  const launched = useCallback(() => {
    setLeaving(true);
    onReveal();
    setTimeout(() => setStopped(true), 520);
    setTimeout(onDone, 1300);
  }, [onReveal, onDone]);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const key = (e) => { if (["Enter", " ", "ArrowDown", "PageDown"].includes(e.key)) { e.preventDefault(); enter(); } };
    const wheel = (e) => { if (Math.abs(e.deltaY) > 4) enter(); };
    window.addEventListener("keydown", key);
    window.addEventListener("wheel", wheel, { passive: true });
    if (reduce && launching) { onReveal(); onDone(); }
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("wheel", wheel); };
  }, [enter, launching, onReveal, onDone]);

  return (
    <section className={`bc-intro${launching ? " is-launching" : ""}${leaving ? " is-leaving" : ""}`} aria-label="Stop scrolling, start watching">
      <PosterRingIntro launching={launching} stopped={stopped} onEnter={enter} onLaunched={launched} />
      <div className="bc-intro__hud">
        <span className="bc-corner is-tl" /><span className="bc-corner is-tr" />
        <span className="bc-corner is-bl" /><span className="bc-corner is-br" />
        <div className="bc-intro__brand"><Wordmark /></div>
        <button type="button" className="bc-enter" onClick={enter} disabled={launching}>
          <span className="bc-enter__ring" aria-hidden="true" />
          <span className="bc-enter__label">Enter CineMatch</span>
        </button>
      </div>
    </section>
  );
}

function Ticker() {
  const items = MOST_RATED.map(([id, raw]) => parseTitle(raw));
  const row = items.map((m, i) => (
    <span key={i} className="bc-ticker__item">{m.title}<em>{m.year}</em></span>
  ));
  return (
    <div className="bc-ticker" data-reveal="left" aria-label="The ten most-rated films in MovieLens 1M">
      <div className="bc-ticker__label">Most rated</div>
      <div className="bc-ticker__track"><div className="bc-ticker__run">{row}{row}</div></div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ["Factorise", "Spark's ALS splits a million ratings into ten hidden taste numbers for every viewer and every film."],
    ["Predict", "Multiply a viewer's numbers by a film's numbers and you get the rating they'd probably give it."],
    ["Filter", "Anything the viewer has already rated is dropped, so every pick is something new."],
    ["Dress", "TMDB supplies the posters. Brand-new viewers get the most-rated films until the model knows them."],
  ];
  return (
    <section className="bc-how" id="how" aria-labelledby="how-title">
      <div className="bc-how__intro" data-reveal="left">
        <h2 id="how-title" className="bc-par">95.74% of the picture is missing.</h2>
        <p>
          {fmt(STATS.users)} viewers × {fmt(STATS.movies)} films is 23,453,320 possible ratings. MovieLens has {fmt(STATS.ratings)} of them.
          CineMatch's job is to fill in the rest, then hand you the brightest gaps in your row.
        </p>
      </div>
      <SparsityMatrix />
      <ol className="bc-steps">
        {steps.map(([t, d], i) => (
          <li key={t} data-reveal style={{ "--d": `${i * 90}ms` }}>
            <span className="bc-steps__n">{i + 1}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </li>
        ))}
      </ol>
      <dl className="bc-spec">
        <div data-reveal style={{ "--d": "0ms" }}><dt>Latent factors</dt><dd>{STATS.rank}</dd></div>
        <div data-reveal style={{ "--d": "90ms" }}><dt>Regularisation λ</dt><dd>{STATS.lambda}</dd></div>
        <div data-reveal style={{ "--d": "180ms" }}><dt>Iterations</dt><dd>{STATS.iterations}</dd></div>
        <div data-reveal style={{ "--d": "270ms" }}><dt>RMSE on held-out 20%</dt><dd>{STATS.rmse}</dd></div>
      </dl>
    </section>
  );
}

function Catalogue({ warm }) {
  return (
    <section className="bc-orb" id="catalogue" aria-labelledby="catalogue-title">
      <div className="bc-orb__head" data-reveal>
        <h2 id="catalogue-title" className="bc-par">3,883 films in the catalogue.</h2>
        <p>Every one has its own ten-number taste fingerprint, and every viewer is matched against all of them.</p>
      </div>
      <div className="bc-orb__stage" data-reveal="scale">
        <CatalogueOrb warm={warm} />
      </div>
    </section>
  );
}

function StartHero() {
  return (
    <section className="bc-start" aria-label="Get your picks">
      <div data-reveal="scale"><a className="bc-btn bc-btn--solid bc-btn--hero" href="#/console"><span>Get my picks</span></a></div>
    </section>
  );
}

export function Signature() {
  return (
    <footer className="bc-sign" data-reveal>
      <Wordmark />
      <p className="bc-sign__made">Made by Dev Trivedi</p>
    </footer>
  );
}

function Finale() {
  return (
    <section className="bc-finale">
      <a className="bc-finale__link" href="#/console">
        <span className="bc-finale__line" data-reveal="left">Start</span>
        <span className="bc-finale__line" data-reveal="right" style={{ "--d": "120ms" }}>watching</span>
      </a>
    </section>
  );
}

export default function HomePage() {
  const [intro, setIntro] = useState(!introSeen);
  const [revealed, setRevealed] = useState(introSeen);
  const reveal = useCallback(() => { introSeen = true; setRevealed(true); }, []);
  const done = useCallback(() => setIntro(false), []);
  useReveal(revealed);
  useEffect(() => {
    document.documentElement.style.overflow = intro ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [intro]);
  return (
    <div className={`bc${revealed ? " is-home" : " has-intro"}`}>
      {intro && <Intro onReveal={reveal} onDone={done} />}
      <TopBar />
      <main className="bc-homepage">
        <div className="bc-home-top">
          <Ticker />
          <StartHero />
        </div>
        <HowItWorks />
        <Catalogue warm={!intro} />
        <Finale />
      </main>
      <Signature />
      <ScrollRail hidden={intro} />
    </div>
  );
}
