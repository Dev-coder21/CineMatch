import { normaliseMovie } from "./data.js";

/*
 * Recommendations for a brand-new visitor, made in the browser from the
 * trained ALS model's film vectors (public/films.json, written by
 * scripts/export_films.py).
 *
 * ALS gives every film a 10-number taste vector V_i and every viewer one too
 * (u); a predicted rating is the dot product u . V_i. A new visitor has no u,
 * so we "fold them in": hold the film vectors fixed and solve the same
 * regularised least-squares problem ALS solves for each user,
 *
 *     minimise  sum_i w_i (r_i - u . V_i)^2  +  lambda * n * |u|^2,   u >= 0
 *
 * over the films they've told us about. Their mood and genres become a soft
 * starting point (the best-loved films in those genres count as gentle 5-star
 * "anchors"), and every film they actually rate counts fully and pulls u
 * toward their own taste. Then every film is scored with u . V_i, just like
 * the backend scores a known viewer.
 */

export const GENRES = ["Action", "Adventure", "Animation", "Children's", "Comedy", "Crime", "Documentary", "Drama", "Fantasy",
  "Film-Noir", "Horror", "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"];

export const MOODS = [
  { id: "feel-good", label: "Feel-good", line: "Light, funny, warm", genres: ["Comedy", "Romance", "Musical", "Animation", "Children's"] },
  { id: "edge", label: "Edge of my seat", line: "Tense, fast, gripping", genres: ["Thriller", "Action", "Crime"] },
  { id: "mind", label: "Mind-bending", line: "Strange, clever, twisty", genres: ["Sci-Fi", "Mystery", "Thriller"] },
  { id: "emotional", label: "Something emotional", line: "Big stories, real feelings", genres: ["Drama", "Romance", "War"] },
  { id: "scare", label: "Scare me", line: "Dread, gore, jump scares", genres: ["Horror"] },
  { id: "adventure", label: "Big adventure", line: "Quests, worlds, frontiers", genres: ["Adventure", "Fantasy", "Western"] },
];

export const ERAS = [
  { id: "any", label: "Any era", from: 0, to: 3000 },
  { id: "classic", label: "Classics, before 1970", from: 0, to: 1969 },
  { id: "7080", label: "70s & 80s", from: 1970, to: 1989 },
  { id: "90s", label: "90s", from: 1990, to: 3000 },
];

export const REACH = [
  { id: "popular", label: "Crowd favourites", min: 800, max: Infinity },
  { id: "balanced", label: "A bit of both", min: 150, max: Infinity },
  { id: "gems", label: "Hidden gems", min: 40, max: 500 },
];

export const RATING_STARS = { loved: 5, liked: 4, nope: 2 };

const K = 10;
const ANCHOR_WEIGHT = 0.35; // a mood pick nudges; a real rating counts fully
const GENRE_BONUS = 1.0;    // how much a film's fit to their genre taste adds to its rank

let pending = null;

/* films.json, decoded once: about 3,000 films x 10 factors */
export function loadFilms() {
  if (!pending) {
    pending = fetch("films.json")
      .then((r) => {
        if (!r.ok) throw new Error(`films.json answered ${r.status}`);
        return r.json();
      })
      .then(decode);
    pending.catch(() => { pending = null; });
  }
  return pending;
}

function decode(data) {
  const n = data.films.length;
  const V = new Float64Array(n * K);
  const films = data.films.map((row, i) => {
    const [id, title, year, mask, count, mean10] = row;
    for (let k = 0; k < K; k++) V[i * K + k] = row[6 + k] / 1000;
    const genres = data.genres.filter((_, g) => mask & (1 << g));
    return { i, id, rawTitle: title, year, mask, count, mean: mean10 / 10, genres };
  });
  const byId = new Map(films.map((f) => [f.id, f]));
  // Bayesian average, so a film with three 5-star ratings doesn't outrank Casablanca
  const prior = films.reduce((a, f) => a + f.mean * f.count, 0) / films.reduce((a, f) => a + f.count, 0);
  films.forEach((f) => { f.score = (f.mean * f.count + prior * 50) / (f.count + 50); });
  return { films, byId, V, lambda: data.regParam ?? 0.05 };
}

const maskOf = (genres) => genres.reduce((m, g) => m | (1 << GENRES.indexOf(g)), 0);

/* solve A x = b for a small square system (Gaussian elimination, partial pivoting) */
function solve(A, b, n) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

/* the visitor's taste vector: weighted, regularised, non-negative least squares */
function foldIn(model, rows) {
  const { V, lambda } = model;
  const wsum = rows.reduce((a, r) => a + r.w, 0);
  let active = Array.from({ length: K }, (_, k) => k);
  let u = new Array(K).fill(0);
  for (let pass = 0; pass < K; pass++) {
    const n = active.length;
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const b = new Array(n).fill(0);
    rows.forEach(({ i, r, w }) => {
      for (let a = 0; a < n; a++) {
        const va = V[i * K + active[a]];
        b[a] += w * r * va;
        for (let c = 0; c < n; c++) A[a][c] += w * va * V[i * K + active[c]];
      }
    });
    for (let a = 0; a < n; a++) A[a][a] += lambda * wsum;
    const x = solve(A, b, n);
    u = new Array(K).fill(0);
    active.forEach((k, a) => { u[k] = x[a]; });
    if (x.every((v) => v >= 0)) break;
    active = active.filter((k, a) => x[a] > 0); // the trained model is non-negative too
    if (!active.length) break;
  }
  return u.map((v) => Math.max(0, v));
}

/* the best-loved well-known films in these genres: the mood's starting point */
function anchorsFor(model, mask, era) {
  for (const min of [300, 100, 30]) {
    const list = model.films.filter((f) => f.mask & mask && f.count >= min && f.year >= era.from && f.year <= era.to)
      .sort((a, b) => b.score - a.score).slice(0, 20);
    if (list.length >= 8) return list;
  }
  return model.films.slice(0, 20);
}

/*
 * picks = { genres: [...], era: "90s", reach: "balanced", ratings: { movieId: "loved" | "liked" | "nope" } }
 * returns ten films, best first, in the same shape the rest of the site uses
 */
export function recommendFor(model, { genres, era, reach, ratings = {} }, topN = 10) {
  const mask = maskOf(genres.length ? genres : GENRES);
  const e = ERAS.find((x) => x.id === era) || ERAS[0];
  const lvl = REACH.find((x) => x.id === reach) || REACH[1];

  const rated = Object.entries(ratings)
    .map(([id, how]) => ({ film: model.byId.get(Number(id)), r: RATING_STARS[how] }))
    .filter((x) => x.film && x.r);
  // the more films they rate, the less the mood's starting point matters
  const anchorW = ANCHOR_WEIGHT * 5 / (5 + rated.length);
  const rows = [
    ...anchorsFor(model, mask, e).map((f) => ({ i: f.i, r: 5, w: anchorW })),
    ...rated.map(({ film, r }) => ({ i: film.i, r, w: 1 })),
  ];
  const u = foldIn(model, rows);
  const seen = new Set(rated.map((x) => x.film.id));

  // genre taste: the genres they chose, nudged up or down by the films they rated
  const affinity = GENRES.map((g, gi) => (mask & (1 << gi) ? 1 : 0));
  rated.forEach(({ film, r }) => {
    GENRES.forEach((g, gi) => { if (film.mask & (1 << gi)) affinity[gi] += (r - 3) / 2; });
  });
  const top = Math.max(1, ...affinity);
  const fitOf = (fm) => {
    let sum = 0, n = 0, best = -Infinity;
    for (let gi = 0; gi < GENRES.length; gi++) if (fm & (1 << gi)) { const a = affinity[gi] / top; sum += a; n++; best = Math.max(best, a); }
    return n ? (best + sum / n) / 2 : 0; // its strongest genre counts, and so does the overall mix
  };

  const scored = [];
  for (const f of model.films) {
    if (!(f.mask & mask) || seen.has(f.id)) continue;
    if (f.year < e.from || f.year > e.to || f.count < lvl.min || f.count > lvl.max) continue;
    let p = 0;
    for (let k = 0; k < K; k++) p += u[k] * model.V[f.i * K + k];
    const fit = fitOf(f.mask);
    scored.push({ f, p, rank: p + GENRE_BONUS * fit });
  }
  scored.sort((a, b) => b.rank - a.rank);
  return scored.slice(0, topN).map(({ f, p }) =>
    normaliseMovie({ movieId: f.id, title: f.rawTitle, genres: f.genres.join("|"), predictedRating: Math.round(p * 100) / 100 }));
}

/* films to rate: the most-watched ones in the chosen genres, so people have seen them */
export function ratingPool(model, genres) {
  const mask = maskOf(genres.length ? genres : GENRES);
  return model.films
    .filter((f) => f.mask & mask && f.count >= 400)
    .map((f) => normaliseMovie({ movieId: f.id, title: f.rawTitle, genres: f.genres.join("|") }));
}
