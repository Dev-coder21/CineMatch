"""
Export what the browser needs to make recommendations for a brand-new visitor
from their mood, genres, era and a few quick ratings, using the trained ALS
model's film vectors (no retraining, no server).

For every film with at least MIN_RATINGS ratings it writes:
  id, title, year, genre bitmask, rating count, mean rating x10,
  and the film's 10 ALS factors x1000 (rounded to ints to keep the file small)

The site then "folds in" the visitor: it solves for the user vector that best
explains their (pseudo-)ratings with the film vectors held fixed, using the
same regularisation as training (regParam 0.05, scaled by number of ratings,
non-negative), and scores every film with a dot product, exactly as ALS does.

    python scripts/export_films.py

Writes frontend/public/films.json.
"""
import csv
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from als_parquet import read_factors  # noqa: E402

MODEL = os.path.join(ROOT, "models", "als_model")
RATINGS = os.path.join(ROOT, "data", "processed", "ratings.csv")
MOVIES = os.path.join(ROOT, "data", "processed", "movies.csv")
OUT = os.path.join(ROOT, "frontend", "public", "films.json")
MIN_RATINGS = 20

GENRES = ["Action", "Adventure", "Animation", "Children's", "Comedy", "Crime", "Documentary", "Drama", "Fantasy",
          "Film-Noir", "Horror", "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"]


def main():
    items = read_factors(os.path.join(MODEL, "itemFactors"))
    count, total = Counter(), Counter()
    with open(RATINGS, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            m = int(r["movieId"])
            count[m] += 1
            total[m] += float(r["rating"])

    films = []
    with open(MOVIES, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            m = int(r["movieId"])
            if m not in items or count[m] < MIN_RATINGS:
                continue
            y = re.search(r"\((\d{4})\)\s*$", r["title"])
            mask = 0
            for g in r["genres"].split("|"):
                if g in GENRES:
                    mask |= 1 << GENRES.index(g)
            films.append([m, r["title"], int(y.group(1)) if y else 0, mask, count[m],
                          round(10 * total[m] / count[m]), *[round(1000 * x) for x in items[m]]])

    films.sort(key=lambda row: -row[4])  # most-rated first
    out = {"genres": GENRES, "regParam": 0.05, "films": films}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) / 1024:.0f} KB): {len(films)} films")


if __name__ == "__main__":
    main()
