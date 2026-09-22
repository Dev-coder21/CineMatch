import pandas as pd

ratings = pd.read_csv(
    "data/raw/ml-1m/ratings.dat",
    sep="::",
    engine="python",
    names=["userId", "movieId", "rating", "timestamp"]
)

movies = pd.read_csv(
    "data/raw/ml-1m/movies.dat",
    sep="::",
    engine="python",
    names=["movieId", "title", "genres"],
    encoding="latin-1"
)

users = pd.read_csv(
    "data/raw/ml-1m/users.dat",
    sep="::",
    engine="python",
    names=["userId", "gender", "age", "occupation", "zip"],
    encoding="latin-1"
)

print("Ratings:")
print(ratings.head())

print("\nMovies:")
print(movies.head())

print("\nUsers:")
print(users.head())
print("\nDataset Sizes:")
print("Ratings:", ratings.shape)
print("Movies:", movies.shape)
print("Users:", users.shape)
print("\nMissing Values:")
print("Ratings:\n", ratings.isnull().sum())
print("Movies:\n", movies.isnull().sum())
print("Users:\n", users.isnull().sum())

print("\nDuplicate Ratings:", ratings.duplicated().sum())
print("\nRating Distribution:")
print(ratings["rating"].value_counts().sort_index())
print("\nAverage Rating:", ratings["rating"].mean())
print("\nTop 10 Most Rated Movies:")

movie_rating_counts = (
    ratings["movieId"]
    .value_counts()
    .head(10)
    .rename_axis("movieId")
    .reset_index(name="ratingCount")
)

top_movies = movie_rating_counts.merge(
    movies,
    on="movieId"
)

print(top_movies[["movieId", "title", "ratingCount"]])
print("\nMovie Rating Statistics:")

movie_stats = (
    ratings.groupby("movieId")["rating"]
    .agg(["count", "mean"])
    .reset_index()
)

movie_stats.columns = ["movieId", "ratingCount", "averageRating"]

movie_stats = movie_stats.merge(
    movies,
    on="movieId"
)

popular_high_rated = (
    movie_stats[movie_stats["ratingCount"] >= 1000]
    .sort_values("averageRating", ascending=False)
    .head(10)
)

print(
    popular_high_rated[
        ["movieId", "title", "ratingCount", "averageRating"]
    ]
)
import matplotlib.pyplot as plt

rating_counts = ratings["rating"].value_counts().sort_index()

plt.figure(figsize=(8, 5))
plt.bar(rating_counts.index, rating_counts.values)

plt.xlabel("Rating")
plt.ylabel("Number of Ratings")
plt.title("Movie Rating Distribution")
plt.xticks([1, 2, 3, 4, 5])

plt.tight_layout()
plt.savefig("visualizations/rating_distribution.png")
plt.show()
ratings.to_csv("data/processed/ratings.csv", index=False)
movies.to_csv("data/processed/movies.csv", index=False)
users.to_csv("data/processed/users.csv", index=False)

print("\nProcessed data saved successfully.")