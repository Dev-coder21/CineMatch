import json
import os
import re
from functools import lru_cache
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

TMDB_API_TOKEN = os.getenv("TMDB_API_TOKEN")

TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie"
TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie/{tmdb_id}"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"

# Poster URLs saved ahead of time by scripts/fetch_posters.py, keyed by
# MovieLens movieId. Checked first so most requests never call TMDB at all.
POSTERS_FILE = Path(__file__).resolve().parent.parent / "frontend" / "public" / "posters.json"

ARTICLES = ("The", "A", "An", "La", "Le", "Les", "L'", "Il", "Das", "Der", "Die", "El", "Los", "Las")


def _headers():
    return {"Authorization": f"Bearer {TMDB_API_TOKEN}", "accept": "application/json"}


def title_variants(title):
    """
    MovieLens titles rarely match TMDB as written:
      "Matrix, The (1999)"                         -> "The Matrix"
      "Seven (Se7en) (1995)"                       -> "Seven", "Se7en"
      "Shawshank Redemption, The (1994)"           -> "The Shawshank Redemption"
      "Sunset Blvd. (a.k.a. Sunset Boulevard) (1950)" -> "Sunset Blvd.", "Sunset Boulevard"
    Returns (names to try in order, release year or None).
    """
    year_match = re.search(r"\((\d{4})\)\s*$", title)
    year = int(year_match.group(1)) if year_match else None
    base = re.sub(r"\s*\(\d{4}\)\s*$", "", title).strip()

    alternates = re.findall(r"\(([^()]+)\)", base)
    main = re.sub(r"\s*\([^()]+\)", "", base).strip()

    names = []
    for name in [main, *alternates]:
        name = re.sub(r"^a\.k\.a\.\s*", "", name.strip(), flags=re.I)
        for article in ARTICLES:
            if name.endswith(f", {article}"):
                name = f"{article} {name[: -len(article) - 2]}".replace("L' ", "L'")
                break
        if name and name not in names:
            names.append(name)
    return names, year


def _search(query, year=None):
    params = {"query": query, "include_adult": "false", "language": "en-US"}
    if year:
        params["primary_release_year"] = year
    response = requests.get(TMDB_SEARCH_URL, params=params, headers=_headers(), timeout=10)
    response.raise_for_status()
    for result in response.json().get("results", []):
        if result.get("poster_path"):
            return f"{TMDB_IMAGE_BASE_URL}{result['poster_path']}"
    return None


@lru_cache(maxsize=4000)
def get_movie_poster(title):
    """Find a poster by title, trying every cleaned-up variant, then nearby years, then no year."""
    if not TMDB_API_TOKEN:
        return None
    names, year = title_variants(title)
    years = [year, year - 1, year + 1, None] if year else [None]
    try:
        for y in years:
            for name in names:
                url = _search(name, y)
                if url:
                    return url
    except requests.RequestException:
        return None
    return None


@lru_cache(maxsize=4000)
def get_poster_by_tmdb_id(tmdb_id):
    """Exact lookup when the MovieLens -> TMDB id is known (MovieLens links.csv)."""
    if not TMDB_API_TOKEN or not tmdb_id:
        return None
    try:
        response = requests.get(TMDB_MOVIE_URL.format(tmdb_id=tmdb_id), headers=_headers(), timeout=10)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        path = response.json().get("poster_path")
        return f"{TMDB_IMAGE_BASE_URL}{path}" if path else None
    except requests.RequestException:
        return None


_saved_posters = None


def poster_for(movie_id, title):
    """Saved poster first (instant), live TMDB search only if it isn't saved."""
    global _saved_posters
    if _saved_posters is None:
        try:
            _saved_posters = json.loads(POSTERS_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            _saved_posters = {}
    return _saved_posters.get(str(movie_id)) or get_movie_poster(title)
