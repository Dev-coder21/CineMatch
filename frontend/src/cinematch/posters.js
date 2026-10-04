/*
 * Real TMDB posters, looked up once by scripts/fetch_posters.py and saved to
 * frontend/public/posters.json as { movieId: posterUrl }. If that file isn't
 * there yet, everything falls back to CineMatch's generated posters.
 */
let pending = null;

export function loadPosterMap() {
  if (!pending) {
    pending = fetch("posters.json")
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return pending;
}

/* Load an image that may be drawn into a canvas (TMDB sends CORS headers). */
export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
