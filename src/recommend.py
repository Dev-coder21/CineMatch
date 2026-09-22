from pyspark.sql import SparkSession
from pyspark.ml.recommendation import ALSModel
from pymongo import MongoClient


spark = (
    SparkSession.builder
    .appName("MovieRecommendation")
    .master("local[*]")
    .getOrCreate()
)

# Load ratings
ratings = spark.read.csv(
    "data/processed/ratings.csv",
    header=True,
    inferSchema=True
).select(
    "userId",
    "movieId",
    "rating"
)

# Load saved ALS model
model = ALSModel.load("models/als_model")

# Ask for User ID
user_id = int(input("Enter User ID: "))

# Check whether user exists
user_exists = ratings.filter(
    ratings.userId == user_id
).count()

if user_exists == 0:
    print("User ID not found.")
    print("Showing popular movies instead...")

    client = MongoClient("mongodb://localhost:27017/")
    db = client["movie_recommendation"]

    popular_movies = db["ratings"].aggregate([
        {
            "$group": {
                "_id": "$movieId",
                "ratingCount": {"$sum": 1},
                "averageRating": {"$avg": "$rating"}
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

    popular_movie_ids = [
        movie["_id"]
        for movie in popular_movies
    ]

    movies = db["movies"].find(
        {"movieId": {"$in": popular_movie_ids}},
        {"_id": 0}
    )

    print("\nPopular Movies:")

    for movie in movies:
        print(
        movie["title"],
        "| Genres:", movie["genres"]
        )
    

    client.close()
    spark.stop()
    exit()

# Select user
selected_user = spark.createDataFrame(
    [(user_id,)],
    ["userId"]
)

# Generate recommendations
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

# Get movies already rated
rated_movies = ratings.filter(
    ratings.userId == user_id
).select("movieId")

# Remove already-rated movies
recommendations = recommendations.join(
    rated_movies,
    on="movieId",
    how="left_anti"
)

# Connect to MongoDB
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

# Convert MongoDB data to Spark DataFrame
movie_details = spark.createDataFrame(movie_data)

# Join recommendations with movie details
recommendations = recommendations.join(
    movie_details,
    on="movieId",
    how="left"
)

print(f"\nTop Recommendations for User {user_id}:")

recommendations.select(
    "movieId",
    "title",
    "genres",
    "predictedRating"
).show(
    10,
    truncate=False
)

spark.stop()