import { useCallback, useRef, useState } from "react";
import { loadPosterMap } from "./posters.js";

/*
 * Where recommendations come from:
 *   - by default, recommendations.json: every viewer's picks precomputed from
 *     the trained ALS model by scripts/export_recommendations.py (this is what
 *     the deployed GitHub Pages site uses: no server needed)
 *   - set VITE_API_URL (e.g. in frontend/.env.local) to call the live FastAPI
 *     backend instead: VITE_API_URL=http://127.0.0.1:8000
 */
export const API_URL = (import.meta.env && import.meta.env.VITE_API_URL) || "";

export const STATS = {
  ratings: 1000209,
  users: 6040,
  movies: 3883,
  sparsity: 95.74,
  rmse: 0.8573,
  rank: 10,
  lambda: 0.05,
  iterations: 20,
};

/* "Matrix, The (1999)" -> { title: "The Matrix", year: 1999 } */
export function parseTitle(raw = "") {
  const m = raw.match(/^(.*)\s+\((\d{4})\)\s*$/);
  let title = m ? m[1] : raw;
  const year = m ? Number(m[2]) : null;
  // MovieLens keeps alternate titles in parentheses: keep the first.
  while (/\s+\([^()]{3,}\)$/.test(title)) title = title.replace(/\s+\([^()]{3,}\)$/, "");
  title = title.trim();
  const article = title.match(/^(.*), (The|A|An|La|Le|Les|Il|Das|Der|Die|El)$/);
  if (article) title = `${article[2]} ${article[1]}`;
  return { title, year };
}

export function splitGenres(genres = "") {
  return genres.split("|").filter(Boolean);
}

export function normaliseMovie(movie) {
  const { title, year } = parseTitle(movie.title);
  return {
    id: movie.movieId,
    rawTitle: movie.title,
    title,
    year,
    genres: splitGenres(movie.genres),
    predicted: typeof movie.predictedRating === "number" ? movie.predictedRating : null,
    posterUrl: movie.posterUrl || null,
  };
}

/* The precomputed picks, loaded once on the first search (about 700 KB). */
let staticData = null;
function loadStatic() {
  if (!staticData) {
    staticData = fetch("recommendations.json").then((r) => {
      if (!r.ok) throw new Error(`recommendations.json answered ${r.status}`);
      return r.json();
    });
    staticData.catch(() => { staticData = null; });
  }
  return staticData;
}

/* Same response shape as the FastAPI /recommend/{user_id} endpoint. */
async function staticResponse(userId) {
  const data = await loadStatic();
  const row = data.users[String(userId)];
  const movie = (id) => {
    const [title, genres] = data.movies[String(id)] || [`Movie ${id}`, ""];
    return { movieId: id, title, genres };
  };
  if (!row) {
    return { userId, recommendations: { type: "popular", recommendations: data.popular.map(movie) } };
  }
  return {
    userId,
    recommendations: {
      type: "personalized",
      recommendations: row.map(([id, predictedRating]) => ({ ...movie(id), predictedRating })),
    },
  };
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/*
 * status: idle | loading | done | error
 * source: "api" (live FastAPI backend) or "static" (precomputed picks)
 */
export function useRecommendations() {
  const [state, setState] = useState({ status: "idle", userId: null, type: null, movies: [], source: null, error: "" });
  const req = useRef(0);

  const run = useCallback(async (rawId) => {
    const trimmed = String(rawId ?? "").trim();
    if (!/^\d{1,7}$/.test(trimmed)) {
      setState((s) => ({ ...s, status: "error", error: "Viewer IDs are whole numbers, like 42 or 4169." }));
      return;
    }
    const userId = Number(trimmed);
    const mine = ++req.current;
    setState({ status: "loading", userId, type: null, movies: [], source: null, error: "" });
    const started = performance.now();
    let data;
    const source = API_URL ? "api" : "static";
    try {
      if (API_URL) {
        // The model can take a moment on the first call while Spark warms up.
        const res = await fetchWithTimeout(`${API_URL}/recommend/${userId}`, 45000);
        if (!res.ok) throw new Error(`API answered ${res.status}`);
        data = await res.json();
      } else {
        data = await staticResponse(userId);
      }
    } catch {
      if (mine !== req.current) return;
      setState({ status: "error", userId, type: null, movies: [], source, error: "Recommendations couldn't be loaded. Check your connection and try again." });
      return;
    }
    // Keep the tuning moment readable even when the answer is instant.
    const wait = Math.max(0, 900 - (performance.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    if (mine !== req.current) return;
    const block = data.recommendations || {};
    const posters = await loadPosterMap();
    const list = (block.recommendations || []).map((m) => normaliseMovie({ ...m, posterUrl: m.posterUrl || posters[m.movieId] }));
    const type = block.type || (list[0]?.predicted != null ? "personalized" : "popular");
    setState({ status: "done", userId, type, movies: list, source, error: "" });
  }, []);

  return [state, run];
}

export function genreMix(movies) {
  const counts = {};
  movies.forEach((m) => m.genres.forEach((g) => { counts[g] = (counts[g] || 0) + 1 / m.genres.length; }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(counts)
    .map(([genre, n]) => ({ genre, share: n / total }))
    .sort((a, b) => b.share - a.share);
}

export const PRESET_VIEWERS = [1, 42, 1337, 4169, 99999];
