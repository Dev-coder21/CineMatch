import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRESET_VIEWERS, STATS, useRecommendations } from "../cinematch/data.js";
import { ERAS, GENRES, MOODS, REACH, loadFilms, ratingPool, recommendFor } from "../cinematch/moodEngine.js";
import { posterDataURI } from "../cinematch/posterArt.js";
import { loadPosterMap } from "../cinematch/posters.js";
import { go } from "../cinematch/router.js";
import { Wordmark } from "./HomePage.jsx";
import { Static } from "./parts.jsx";
import { Results } from "./Results.jsx";
import ScrollRail from "./ScrollRail.jsx";
import { useReveal } from "./useReveal.js";

/*
 * One page for the whole task. A visitor says how they feel (mood, genres,
 * era, how well known), optionally rates a few films they've seen, and the
 * trained ALS model ranks every film for them (cinematch/moodEngine.js).
 * Their ten films appear underneath. A real MovieLens viewer can still be
 * opened by ID (#/console?viewer=42), which uses the precomputed picks.
 */

const PAGE = 8;
const REACTIONS = [
  { id: "loved", label: "Loved it", short: "Loved" },
  { id: "liked", label: "Liked it", short: "Liked" },
  { id: "nope", label: "Not for me", short: "Nope" },
];

function Step({ n, title, note, children, className = "" }) {
  return (
    <section className={`bc-step ${className}`} data-reveal>
      <header className="bc-step__head">
        <span className="bc-step__n">{n}</span>
        <h2 className="bc-step__title">{title}</h2>
        {note && <p className="bc-step__note">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function RateCard({ movie, poster, value, onRate }) {
  return (
    <li className={`bc-rate${value ? ` is-${value}` : ""}`}>
      <div className="bc-rate__poster">
        <img src={poster} alt="" loading="lazy" decoding="async" />
        {value && <span className="bc-rate__badge">{REACTIONS.find((r) => r.id === value).short}</span>}
      </div>
      <p className="bc-rate__title">{movie.title} <span>{movie.year}</span></p>
      <div className="bc-rate__btns" role="group" aria-label={`Rate ${movie.title}`}>
        {REACTIONS.map((r) => (
          <button key={r.id} type="button" aria-pressed={value === r.id} aria-label={r.label}
            className={value === r.id ? "is-on" : ""} onClick={() => onRate(movie.id, value === r.id ? null : r.id)}>
            {r.short}
          </button>
        ))}
      </div>
    </li>
  );
}

function useMoodPicks() {
  const [state, setState] = useState({ status: "idle", movies: [], title: "", lede: "", type: "personalized", source: "mood", error: "" });
  const req = useRef(0);
  const run = useCallback(async (picks, meta) => {
    const mine = ++req.current;
    setState((s) => ({ ...s, status: "loading", error: "" }));
    const started = performance.now();
    try {
      const [model, posters] = await Promise.all([loadFilms(), loadPosterMap()]);
      const movies = recommendFor(model, picks).map((m) => ({ ...m, posterUrl: posters[m.id] || null }));
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (performance.now() - started))));
      if (mine !== req.current) return;
      setState({ status: "done", movies, type: "personalized", source: "mood", key: mine, ...meta, error: "" });
    } catch {
      if (mine !== req.current) return;
      setState((s) => ({ ...s, status: "error", error: "The film data couldn't be loaded. Check your connection and try again." }));
    }
  }, []);
  return [state, run];
}

const list = (xs) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

export default function ConsolePage({ params }) {
  const viewer = params.get("viewer") || "";
  const [mood, setMood] = useState(null);
  const [genres, setGenres] = useState([]);
  const [era, setEra] = useState("any");
  const [reach, setReach] = useState("balanced");
  const [ratings, setRatings] = useState({});
  const [page, setPage] = useState(0);
  const [model, setModel] = useState(null);
  const [posters, setPosters] = useState({});
  const [showId, setShowId] = useState(Boolean(viewer));
  const [value, setValue] = useState(viewer);

  const [moodState, runMood] = useMoodPicks();
  const [idState, runId] = useRecommendations();
  const [mode, setMode] = useState(viewer ? "id" : "mood");
  const state = mode === "id" ? idState : moodState;
  const resultsRef = useRef(null);
  const topRef = useRef(null);

  useEffect(() => {
    let live = true;
    loadFilms().then((m) => live && setModel(m)).catch(() => {});
    loadPosterMap().then((p) => live && setPosters(p));
    return () => { live = false; };
  }, []);

  /* a viewer in the URL: the old lookup, kept for showing real MovieLens viewers */
  useEffect(() => {
    setValue(viewer);
    if (viewer) { setMode("id"); setShowId(true); runId(viewer); }
  }, [viewer, runId]);

  const loading = state.status === "loading";
  const showResults = state.status !== "idle";
  useEffect(() => {
    if (loading || state.status === "done") resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.status, loading, state.key, idState.userId]);
  useReveal(`${mode}-${state.status}-${state.key ?? state.userId}-${model ? 1 : 0}`);

  const pickMood = (m) => {
    if (mood === m.id) { setMood(null); setGenres([]); } else { setMood(m.id); setGenres(m.genres); }
    setPage(0);
  };
  const toggleGenre = (g) => { setGenres((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g])); setPage(0); };
  const rate = (id, how) => setRatings((r) => { const next = { ...r }; if (how) next[id] = how; else delete next[id]; return next; });

  const pool = useMemo(() => (model ? ratingPool(model, genres) : []), [model, genres]);
  const shown = useMemo(() => {
    if (!pool.length) return [];
    const start = (page * PAGE) % pool.length;
    return [...pool, ...pool].slice(start, start + Math.min(PAGE, pool.length));
  }, [pool, page]);
  const nRated = Object.keys(ratings).length;
  const ready = Boolean(mood || genres.length || nRated);

  const moodObj = MOODS.find((m) => m.id === mood);
  const eraObj = ERAS.find((e) => e.id === era);
  const getPicks = () => {
    if (!ready) return;
    setMode("mood");
    if (viewer) go("/console");
    const title = moodObj ? moodObj.label : genres.length ? list(genres.slice(0, 3)) : "Your picks";
    const bits = [
      genres.length ? `${list(genres.slice(0, 4))}${genres.length > 4 ? " and more" : ""}` : "Every genre",
      era === "any" ? "from any era" : `from the ${eraObj.label.replace("Classics, before 1970", "classic years before 1970")}`,
    ];
    const lede = `${bits.join(" ")}, ranked by the model for your taste${nRated ? ` and the ${nRated} film${nRated === 1 ? "" : "s"} you rated` : ""}. Best first.`;
    runMood({ genres, era, reach, ratings }, { title, lede });
  };

  const submitId = (id) => {
    const v = String(id ?? value).trim();
    if (!v) return;
    setMode("id");
    if (v === viewer) runId(v); else go("/console", { viewer: v });
  };

  const newSearch = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const posterFor = (m) => posters[m.id] || posterDataURI(m);

  return (
    <div className="bc bc-page bc-console-page">
      <header className="bc-top is-solid"><Wordmark /></header>
      <main>
        <section className="bc-home bc-home--picker" ref={topRef}>
          <div className="bc-home__inner">
            <h1 className="bc-home__title" data-reveal>Find your next ten films.</h1>
            <p className="bc-home__lede" data-reveal style={{ "--d": "80ms" }}>
              Tell CineMatch what you&rsquo;re in the mood for. A model that learned from {STATS.ratings.toLocaleString("en-US")} ratings ranks every film for you.
            </p>

            <div className="bc-steps-flow">
              <Step n="01" title="How are you feeling?">
                <div className="bc-moods">
                  {MOODS.map((m, i) => (
                    <button key={m.id} type="button" aria-pressed={mood === m.id}
                      className={`bc-mood${mood === m.id ? " is-on" : ""}`} style={{ "--d": `${i * 40}ms` }} onClick={() => pickMood(m)}>
                      <span className="bc-mood__label">{m.label}</span>
                      <span className="bc-mood__line">{m.line}</span>
                    </button>
                  ))}
                </div>
              </Step>

              <Step n="02" title="Genres" note={mood ? "Set from your mood. Tap to add or remove." : "Pick any you like."}>
                <div className="bc-chips">
                  {GENRES.map((g) => (
                    <button key={g} type="button" aria-pressed={genres.includes(g)}
                      className={`bc-chip${genres.includes(g) ? " is-on" : ""}`} onClick={() => toggleGenre(g)}>{g}</button>
                  ))}
                </div>
              </Step>

              <div className="bc-step-pair">
                <Step n="03" title="When from?">
                  <div className="bc-chips">
                    {ERAS.map((e) => (
                      <button key={e.id} type="button" aria-pressed={era === e.id} className={`bc-chip${era === e.id ? " is-on" : ""}`} onClick={() => setEra(e.id)}>{e.label}</button>
                    ))}
                  </div>
                </Step>
                <Step n="04" title="How well known?">
                  <div className="bc-chips">
                    {REACH.map((r) => (
                      <button key={r.id} type="button" aria-pressed={reach === r.id} className={`bc-chip${reach === r.id ? " is-on" : ""}`} onClick={() => setReach(r.id)}>{r.label}</button>
                    ))}
                  </div>
                </Step>
              </div>

              <Step n="05" title="Sharpen it" className="bc-step--rate"
                note="Optional. Rate a few films you've seen and the picks lean towards your own taste. Skip any you haven't watched.">
                {shown.length > 0 ? (
                  <>
                    <ul className="bc-rates">
                      {shown.map((m) => <RateCard key={m.id} movie={m} poster={posterFor(m)} value={ratings[m.id]} onRate={rate} />)}
                    </ul>
                    <div className="bc-rates__foot">
                      <button type="button" className="bc-btn bc-btn--ghost bc-btn--sm bc-btn--next" onClick={() => setPage((p) => p + 1)}>
                        <span>Show other films</span>
                      </button>
                      <span className="bc-rates__count">{nRated ? `${nRated} rated` : "None rated yet"}</span>
                    </div>
                  </>
                ) : (
                  <div className="bc-rates is-loading" aria-hidden="true">{Array.from({ length: PAGE }, (_, i) => <i key={i} />)}</div>
                )}
              </Step>
            </div>

            <div className="bc-go" data-reveal="scale">
              <button type="button" className="bc-btn bc-btn--pink bc-btn--xl bc-btn--go" disabled={!ready || loading} onClick={getPicks}>
                <span>{loading && mode === "mood" ? "Finding…" : "Get my picks"}</span>
              </button>
              <p className="bc-go__hint">{ready ? "" : "Choose a mood or a genre to start."}</p>
            </div>

            <div className="bc-idmode" data-reveal>
              <button type="button" className="bc-idmode__toggle" aria-expanded={showId} onClick={() => setShowId((s) => !s)}>
                Or try a real MovieLens viewer
              </button>
              {showId && (
                <div className="bc-idmode__body">
                  <form className="bc-tune__form" onSubmit={(e) => { e.preventDefault(); submitId(); }}>
                    <label className="bc-sr" htmlFor="tune-input">Viewer ID</label>
                    <input id="tune-input" className="bc-tune__input bc-tune__input--sm" inputMode="numeric" autoComplete="off" spellCheck="false"
                      placeholder="0042" value={value} maxLength={7} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} />
                    <button className="bc-btn bc-btn--solid" type="submit" disabled={!value || (loading && mode === "id")}>
                      <span>{loading && mode === "id" ? "Finding…" : "Get picks"}</span>
                    </button>
                  </form>
                  <div className="bc-tune__presets">
                    {PRESET_VIEWERS.map((id) => (
                      <button key={id} type="button" className={`bc-chip${String(id) === viewer && mode === "id" ? " is-on" : ""}`} onClick={() => submitId(id)}>
                        {id === 99999 ? "New viewer" : `Viewer ${id}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!showResults && (
              <div className="bc-page-actions" data-reveal>
                <a className="bc-btn bc-btn--solid bc-btn--prev" href="#/"><span>Go to home page</span></a>
              </div>
            )}
          </div>
        </section>

        {showResults && (
          <section className="bc-screen" ref={resultsRef} aria-live="polite">
            {loading && (
              <div className="bc-nosignal is-tuning">
                <Static intensity={1.2} />
                <div className="bc-nosignal__msg">
                  <h2>Tuning in</h2>
                  <p>{mode === "id" ? `Finding films for viewer ${idState.userId}…` : "Ranking every film for you…"}</p>
                </div>
              </div>
            )}
            {state.status === "error" && (
              <div className="bc-nosignal">
                <Static intensity={0.5} />
                <div className="bc-nosignal__msg">
                  <h2>{mode === "id" ? "Check the ID" : "No signal"}</h2>
                  <p>{state.error}</p>
                </div>
              </div>
            )}
            {state.status === "done" && state.movies.length === 0 && (
              <div className="bc-nosignal">
                <Static intensity={0.5} />
                <div className="bc-nosignal__msg">
                  <h2>Nothing on this channel</h2>
                  <p>No films match all of that. Try another era, more genres or a different &ldquo;how well known&rdquo;.</p>
                </div>
              </div>
            )}
            {state.status === "done" && state.movies.length > 0 && (
              <Results key={mode === "id" ? `id-${idState.userId}` : `mood-${state.key}`} state={state} />
            )}

            <div className="bc-page-actions" data-reveal="scale">
              <a className="bc-btn bc-btn--solid bc-btn--prev" href="#/"><span>Home page</span></a>
              <button type="button" className="bc-btn bc-btn--solid bc-btn--up" onClick={newSearch}><span>New search</span></button>
            </div>
          </section>
        )}
      </main>
      <ScrollRail />
    </div>
  );
}
