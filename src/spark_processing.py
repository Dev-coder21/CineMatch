from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .appName("MovieRecommendationSystem")
    .master("local[*]")
    .getOrCreate()
)

ratings = spark.read.csv(
    "data/processed/ratings.csv",
    header=True,
    inferSchema=True
)

print("Ratings Schema:")
ratings.printSchema()

print("\nTotal Ratings:", ratings.count())

print("\nFirst 5 Ratings:")
ratings.show(5)
print("\nPreparing data for ALS:")

als_data = ratings.select(
    "userId",
    "movieId",
    "rating"
)

als_data.printSchema()

print("Total ALS ratings:", als_data.count())

als_data.show(5)
print("\nSplitting data into training and testing sets:")

training, test = als_data.randomSplit(
    [0.8, 0.2],
    seed=42
)

print("Training ratings:", training.count())
print("Testing ratings:", test.count())
from pyspark.ml.recommendation import ALS

print("\nTraining ALS model:")

als = ALS(
    maxIter=20,
    regParam=0.05,
    rank=10,
    userCol="userId",
    itemCol="movieId",
    ratingCol="rating",
    coldStartStrategy="drop",
    nonnegative=True
)

model = als.fit(training)
from pyspark.ml.evaluation import RegressionEvaluator

print("\nEvaluating ALS model:")

predictions = model.transform(test)

evaluator = RegressionEvaluator(
    metricName="rmse",
    labelCol="rating",
    predictionCol="prediction"
)

rmse = evaluator.evaluate(predictions)

print("RMSE:", rmse)

print("ALS model trained successfully!")
print("\nGenerating recommendations:")

selected_user = als_data.filter(
    als_data.userId == 1
).select("userId").distinct()

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

# Get movies already rated by User 1
rated_movies = als_data.filter(
    als_data.userId == 1
).select("movieId")

recommendations = recommendations.join(
    rated_movies,
    on="movieId",
    how="left_anti"
)

from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")
db = client["movie_recommendation"]

movie_ids = [
    row.movieId
    for row in recommendations.select("movieId").collect()
]

movies_from_mongodb = db["movies"].find(
    {"movieId": {"$in": movie_ids}},
    {"_id": 0}
)

movie_data = list(movies_from_mongodb)

client.close()

movie_details = spark.createDataFrame(movie_data)

recommendations = recommendations.join(
    movie_details,
    on="movieId",
    how="left"
)

recommendations.select(
    "movieId",
    "title",
    "genres",
    "predictedRating"
).show(
    10,
    truncate=False
)
print("\nSaving ALS model...")

model.write().overwrite().save(
    "models/als_model"
)

print("ALS model saved successfully!")
spark.stop()