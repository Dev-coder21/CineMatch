"""
Precompute CineMatch's recommendations for every MovieLens viewer, so the
website can be hosted as static files (GitHub Pages) with no Spark, MongoDB
or API server running.

It repeats backend/recommender.py step for step, using the same trained model:
  personalised  model.recommendForUserSubset(user, 10)  -> top 10 predicted
                ratings (user factors . item factors), then drop every film the
                viewer has already rated (the left-anti join), best first
  new viewers   the 10 films with the most ratings (the MongoDB aggregation)

The trained ALS model in models/als_model is read directly (scripts/als_parquet.py),
so this runs with only numpy, no Spark or Java. Re-run it after retraining:

    python scripts/export_recommendations.py

Writes frontend/public/recommendations.json.
"""
import csv
import json
import os
import sys
from collections import Counter
from datetime import date

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from als_parquet import read_factors  # noqa: E402

MODEL = os.path.join(ROOT, "models", "als_model")
RATINGS = os.path.join(ROOT, "data", "processed", "ratings.csv")
MOVIES = os.path.join(ROOT, "data", "processed", "movies.csv")
OUT = os.path.join(ROOT, "frontend", "public", "recommendations.json")
TOP_N = 10


def main():
    users = read_factors(os.path.join(MODEL, "userFactors"))
    items = read_factors(os.path.join(MODEL, "itemFactors"))
    item_ids = np.array(sorted(items), dtype=np.int64)
    item_matrix = np.array([items[i] for i in item_ids], dtype=np.float32)
    print(f"model: {len(users)} viewers, {len(items)} films, rank {item_matrix.shape[1]}")

    rated = {}
    counts = Counter()
    with open(RATINGS, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            uid, mid = int(r["userId"]), int(r["movieId"])
            rated.setdefault(uid, set()).add(mid)
            counts[mid] += 1
    popular = [mid for mid, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_N]]

    with open(MOVIES, newline="", encoding="utf-8") as f:
        catalogue = {int(r["movieId"]): (r["title"], r["genres"]) for r in csv.DictReader(f)}

    picks, used = {}, set(popular)
    sizes = Counter()
    for uid in sorted(rated):
        if uid not in users:
            continue
        scores = item_matrix @ np.asarray(users[uid], dtype=np.float32)
        top = np.argsort(-scores, kind="stable")[:TOP_N]
        seen = rated[uid]
        row = [[int(item_ids[k]), round(float(scores[k]), 2)] for k in top if int(item_ids[k]) not in seen]
        picks[str(uid)] = row
        used.update(m for m, _ in row)
        sizes[len(row)] += 1

    out = {
        "generated": date.today().isoformat(),
        "topN": TOP_N,
        "popular": popular,
        "users": picks,
        "movies": {str(m): list(catalogue[m]) for m in sorted(used) if m in catalogue},
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)

    kb = os.path.getsize(OUT) / 1024
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({kb:.0f} KB): {len(picks)} viewers, {len(out['movies'])} films")
    print("picks per viewer after removing already-rated films:", dict(sorted(sizes.items())))


if __name__ == "__main__":
    main()
