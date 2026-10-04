"""
Fetch a TMDB poster URL for every MovieLens film and save them to
frontend/public/posters.json ({ movieId: posterUrl }). The frontend and the
backend both read this file, so posters show instantly and consistently.

How each film is matched, best first:
  1. Exact TMDB id, if data/raw/links.csv is present. MovieLens ids are the
     same across MovieLens releases, so links.csv from "ml-latest-small"
     (https://grouplens.org/datasets/movielens/latest/) covers most of 1M.
  2. TMDB search with cleaned-up title variants ("Matrix, The" -> "The Matrix",
     alternate titles in brackets, year +-1, then no year).
Anything still missing is listed in frontend/public/posters_missing.txt and
gets CineMatch's generated poster in the UI.

Uses the TMDB_API_TOKEN in .env. Run from the project root:

    python scripts/fetch_posters.py

Safe to re-run: saved posters are kept and only missing films are looked up again.
"""
import csv
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

from backend.tmdb import TMDB_API_TOKEN, get_movie_poster, get_poster_by_tmdb_id  # noqa: E402

MOVIES = os.path.join(ROOT, "data", "processed", "movies.csv")
LINKS = os.path.join(ROOT, "data", "raw", "links.csv")
OUT = os.path.join(ROOT, "frontend", "public", "posters.json")
MISSING = os.path.join(ROOT, "frontend", "public", "posters_missing.txt")


def load_links():
    if not os.path.exists(LINKS):
        return {}
    with open(LINKS, newline="", encoding="utf-8") as f:
        return {int(r["movieId"]): r["tmdbId"] for r in csv.DictReader(f) if r.get("tmdbId")}


def find(movie_id, title, links):
    url = get_poster_by_tmdb_id(links.get(movie_id)) if movie_id in links else None
    return url or get_movie_poster(title)


def main():
    if not TMDB_API_TOKEN:
        sys.exit("TMDB_API_TOKEN is missing from .env, so no posters can be fetched.")

    with open(MOVIES, newline="", encoding="utf-8") as f:
        movies = [(int(r["movieId"]), r["title"]) for r in csv.DictReader(f)]

    posters = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            posters = json.load(f)

    links = load_links()
    print(f"links.csv: {'found, ' + str(len(links)) + ' TMDB ids' if links else 'not found, matching by title'}")

    todo = [(mid, title) for mid, title in movies if str(mid) not in posters]
    print(f"{len(posters)} posters already saved, looking up {len(todo)}…")

    done = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(find, mid, title, links): mid for mid, title in todo}
        for future in as_completed(futures):
            url = future.result()
            if url:
                posters[str(futures[future])] = url.replace("/w500/", "/w342/")
            done += 1
            if done % 250 == 0:
                print(f"  {done}/{len(todo)}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(posters, f, separators=(",", ":"))

    missing = [f"{mid}\t{title}" for mid, title in movies if str(mid) not in posters]
    with open(MISSING, "w", encoding="utf-8") as f:
        f.write("\n".join(missing) + ("\n" if missing else ""))

    share = 100 * len(posters) / len(movies)
    print(f"Saved {len(posters)} of {len(movies)} posters ({share:.1f}%) to {os.path.relpath(OUT, ROOT)}")
    if missing:
        print(f"{len(missing)} still missing, listed in {os.path.relpath(MISSING, ROOT)}; they use generated posters.")


if __name__ == "__main__":
    main()
