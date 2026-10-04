import { useEffect, useRef, useState } from "react";
import { PRESET_VIEWERS, STATS, useRecommendations } from "../cinematch/data.js";
import { go } from "../cinematch/router.js";
import { Wordmark } from "./HomePage.jsx";
import { Static } from "./parts.jsx";
import { Results } from "./Results.jsx";
import ScrollRail from "./ScrollRail.jsx";
import { useReveal } from "./useReveal.js";

/*
 * One page for the whole task: pick a viewer, and their ten films appear
 * underneath. The viewer lives in the URL (#/console?viewer=42) so a result
 * can be linked to and the back button works.
 */
export default function ConsolePage({ params }) {
  const viewer = params.get("viewer") || "";
  const [value, setValue] = useState(viewer);
  const [state, run] = useRecommendations();
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    setValue(viewer);
    if (viewer) run(viewer);
  }, [viewer, run]);

  /* bring the results up as soon as they start loading */
  useEffect(() => {
    if (viewer && (state.status === "loading" || state.status === "done")) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.status, viewer]);

  const submit = (id) => {
    const v = String(id ?? value).trim();
    if (!v) return;
    if (v === viewer) run(v); else go("/console", { viewer: v });
  };

  const newSearch = () => {
    setValue("");
    go("/console");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 500);
  };

  const showResults = Boolean(viewer) && state.status !== "idle";
  useReveal(`${state.status}-${state.userId}`);

  return (
    <div className="bc bc-page bc-console-page">
      <header className="bc-top is-solid"><Wordmark /></header>
      <main>
        <section className="bc-home">
          <div className="bc-home__inner">
            <h1 className="bc-home__title" data-reveal>Find your next ten films.</h1>
            <p className="bc-home__lede" data-reveal style={{ "--d": "80ms" }}>
              CineMatch learned from {STATS.ratings.toLocaleString("en-US")} ratings what people like you love. Enter a viewer ID and it picks the films you'll rate highest.
            </p>
            <form className="bc-tune__form" data-reveal style={{ "--d": "160ms" }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <label className="bc-sr" htmlFor="tune-input">Viewer ID</label>
              <input
                ref={inputRef}
                id="tune-input"
                className="bc-tune__input"
                inputMode="numeric"
                autoComplete="off"
                spellCheck="false"
                placeholder="0042"
                value={value}
                maxLength={7}
                onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
              />
              <button className="bc-btn bc-btn--pink bc-btn--xl" type="submit" disabled={!value || state.status === "loading"}>
                <span>{state.status === "loading" ? "Finding…" : "Get picks"}</span>
              </button>
            </form>
            <div className="bc-tune__presets" data-reveal style={{ "--d": "240ms" }}>
              {PRESET_VIEWERS.map((id) => (
                <button key={id} type="button" className={`bc-chip${String(id) === viewer ? " is-on" : ""}`} onClick={() => submit(id)}>
                  {id === 99999 ? "New viewer" : `Viewer ${id}`}
                </button>
              ))}
            </div>
            {!showResults && (
              <div className="bc-page-actions" data-reveal style={{ "--d": "320ms" }}>
                <a className="bc-btn bc-btn--solid bc-btn--prev" href="#/"><span>Go to home page</span></a>
              </div>
            )}
          </div>
        </section>

        {showResults && (
          <section className="bc-screen" ref={resultsRef} aria-live="polite">
            {state.status === "loading" && (
              <div className="bc-nosignal is-tuning">
                <Static intensity={1.2} />
                <div className="bc-nosignal__msg">
                  <h2>Tuning in</h2>
                  <p>Finding films for viewer {state.userId}…</p>
                </div>
              </div>
            )}
            {state.status === "error" && (
              <div className="bc-nosignal">
                <Static intensity={0.5} />
                <div className="bc-nosignal__msg">
                  <h2>Check the ID</h2>
                  <p>{state.error}</p>
                </div>
              </div>
            )}
            {state.status === "done" && <Results key={`${state.userId}-${state.source}`} state={state} />}

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
