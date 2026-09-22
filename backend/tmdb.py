import os
import re
import requests
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

TMDB_API_TOKEN = os.getenv("TMDB_API_TOKEN")

TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"


@lru_cache(maxsize=1000)
def get_movie_poster(title):
    if not TMDB_API_TOKEN:
        return None

    # MovieLens titles look like:
    # "The Matrix (1999)"
    # Remove the year for the search query.
    year_match = re.search(r"\((\d{4})\)$", title)

    clean_title = re.sub(
        r"\s*\(\d{4}\)$",
        "",
        title
    ).strip()

    params = {
        "query": clean_title,
        "include_adult": "false",
        "language": "en-US"
    }

    if year_match:
        params["year"] = year_match.group(1)

    headers = {
        "Authorization": f"Bearer {TMDB_API_TOKEN}",
        "accept": "application/json"
    }

    try:
        response = requests.get(
            TMDB_SEARCH_URL,
            params=params,
            headers=headers,
            timeout=10
        )

        response.raise_for_status()

        results = response.json().get("results", [])

        if not results:
            return None

        poster_path = results[0].get("poster_path")

        if not poster_path:
            return None

        return f"{TMDB_IMAGE_BASE_URL}{poster_path}"

    except requests.RequestException:
        return None