import os
if "JAVA_HOME" not in os.environ or "jdk-26" in os.environ.get("JAVA_HOME", ""):
    corretto17 = "/Library/Java/JavaVirtualMachines/amazon-corretto-17.jdk/Contents/Home"
    if os.path.exists(corretto17):
        os.environ["JAVA_HOME"] = corretto17

from pyspark.sql import SparkSession
from pyspark.ml.recommendation import ALSModel
from pymongo import MongoClient
from backend.tmdb import get_movie_poster

spark = (
    SparkSession.builder
    .appName("CineMatchAPI")
    .master("local[*]")
    .getOrCreate()
)

model = ALSModel.load("models/als_model")

ratings = spark.read.csv(
    "data/processed/ratings.csv",
    header=True,
    inferSchema=True
).select(
    "userId",
    "movieId",
    "rating"
)


def recommend_movies(user_id):

    user_exists = ratings.filter(
        ratings.userId == user_id
    ).count()

    if user_exists == 0:

        client = MongoClient("mongodb://localhost:27017/")
        db = client["movie_recommendation"]

        popular_movies = list(
            db["ratings"].aggregate([
                {
                    "$group": {
                        "_id": "$movieId",
                        "ratingCount": {"$sum": 1}
                    }
                },
                {
                    "$sort": {
                        "ratingCount": -1
                    }
                },
                {
                    "$limit": 10
                }
            ])
        )

        movie_ids = [movie["_id"] for movie in popular_movies]

        movies = list(
            db["movies"].find(
                {"movieId": {"$in": movie_ids}},
                {"_id": 0}
            )
        )

        client.close()

        movie_map = {
            movie["movieId"]: movie
            for movie in movies
        }

        return {
            "type": "popular",
            "recommendations": [
                {
                    "movieId": movie["movieId"],
                    "title": movie["title"],
                    "genres": movie["genres"]
                }
                for movie_id in movie_ids
                if (movie := movie_map.get(movie_id))
            ]
        }

    selected_user = spark.createDataFrame(
        [(user_id,)],
        ["userId"]
    )

    recommendations = model.recommendForUserSubset(
        selected_user,
        10
    )

    recommendations = recommendations.selectExpr(
        "userId",
        "explode(recommendations) as recommendation"
    )

    recommendations = recommendations.select(
        "userId",
        recommendations.recommendation.movieId.alias("movieId"),
        recommendations.recommendation.rating.alias("predictedRating")
    )

    rated_movies = ratings.filter(
        ratings.userId == user_id
    ).select("movieId")

    recommendations = recommendations.join(
        rated_movies,
        on="movieId",
        how="left_anti"
    )

    client = MongoClient("mongodb://localhost:27017/")
    db = client["movie_recommendation"]

    movie_ids = [
        row.movieId
        for row in recommendations.select("movieId").collect()
    ]

    movies = db["movies"].find(
        {"movieId": {"$in": movie_ids}},
        {"_id": 0}
    )

    movie_data = list(movies)

    client.close()

    movie_details = spark.createDataFrame(movie_data)

    recommendations = recommendations.join(
        movie_details,
        on="movieId",
        how="left"
    )

    result = recommendations.select(
    "movieId",
    "title",
    "genres",
    "predictedRating"
).orderBy(
    "predictedRating",
    ascending=False
).collect()

    return {
    "type": "personalized",
    "recommendations": [
        {
            "movieId": row.movieId,
            "title": row.title,
            "genres": row.genres,
            "predictedRating": round(float(row.predictedRating), 2),
            "posterUrl": get_movie_poster(row.title)
        }
        for row in result
    ]
}