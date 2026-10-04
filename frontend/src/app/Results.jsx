import { useCallback, useRef, useState } from "react";
import { genreMix } from "../cinematch/data.js";
import { PosterFilmstrip } from "../cinematch/PosterFilmstrip.jsx";

const GENRE_HUES = ["#ff2f6d", "#00e6ff", "#13f28a", "#7a1bff", "#ff7a1a", "#f2f2f8"];

function SignalBars({ value }) {
  const v = Math.min(5, Math.max(0, value ?? 0));
  return (
    <span className="bc-signal" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={v >= n - 0.25 ? "is-on" : v >= n - 0.75 ? "is-half" : ""} style={{ height: `${30 + n * 14}%` }} />
      ))}
    </span>
  );
}

function GenreStrip({ movies }) {
  const mix = genreMix(movies).slice(0, 5);
  return (
    <div className="bc-mix">
      <div className="bc-mix__bar" aria-hidden="true">
        {mix.map((g, i) => <i key={g.genre} style={{ flexGrow: g.share, background: GENRE_HUES[i] }} />)}
      </div>
      <ul className="bc-mix__keys">
        {mix.map((g, i) => (
          <li key={g.genre}><i style={{ background: GENRE_HUES[i] }} />{g.genre} <span>{Math.round(g.share * 100)}%</span></li>
        ))}
      </ul>
    </div>
  );
}

export function Results({ state }) {
  const [focus, setFocus] = useState(0);
  const control = useRef(null);
  const onFocus = useCallback((i) => setFocus(i), []);
  const movies = state.movies;
  const m = movies[focus] || movies[0];
  const personal = state.type === "personalized";
  const goto = (i) => { setFocus(i); control.current?.(i); };
  const step = (d) => goto((focus + d + movies.length) % movies.length);

  return (
    <div className="bc-results">
      <header className="bc-results__head" data-reveal>
        <h2 className="bc-results__title">{personal ? `Viewer ${state.userId}` : "New viewer"}</h2>
        <p>
          {personal
            ? `${movies.length === 10 ? "Ten" : movies.length} films the model expects this viewer to rate highest, best first. Anything they've already rated is left out.`
            : `Viewer ${state.userId} isn't in MovieLens yet, so here are the ten most-rated films to start with.`}
        </p>
        <GenreStrip movies={movies} />
      </header>

      <div className="bc-reel" data-reveal="scale">
        <PosterFilmstrip movies={movies} onFocus={onFocus} controlRef={control} />
      </div>

      <section className="bc-detail" aria-live="polite">
        <div className="bc-detail__now" data-reveal="left">
          <span className="bc-detail__rank">{String(focus + 1).padStart(2, "0")}</span>
          <div className="bc-detail__info">
            <h2>{m.title}</h2>
            <p className="bc-detail__meta">{m.year} <span>{m.genres.join(", ")}</span></p>
            {m.predicted != null ? (
              <div className="bc-detail__score">
                <SignalBars value={m.predicted} />
                <strong>{Math.min(5, m.predicted).toFixed(1)}</strong>
                <span>predicted rating out of 5</span>
              </div>
            ) : (
              <p className="bc-detail__popular">One of the ten most-rated films in MovieLens.</p>
            )}
            <div className="bc-detail__nav">
              <button type="button" className="bc-btn bc-btn--ghost bc-btn--sm bc-btn--prev" onClick={() => step(-1)}><span>Previous</span></button>
              <button type="button" className="bc-btn bc-btn--ghost bc-btn--sm bc-btn--next" onClick={() => step(1)}><span>Next</span></button>
            </div>
          </div>
        </div>

        <ol className="bc-index">
          {movies.map((x, i) => (
            <li key={x.id} data-reveal="right" style={{ "--d": `${i * 50}ms` }}>
              <button type="button" className={i === focus ? "is-on" : ""} aria-current={i === focus ? "true" : undefined} onClick={() => goto(i)}>
                <span className="bc-index__n">{String(i + 1).padStart(2, "0")}</span>
                <span className="bc-index__t">{x.title}</span>
                <span className="bc-index__r">{x.predicted != null ? Math.min(5, x.predicted).toFixed(1) : "—"}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

