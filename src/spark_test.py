from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .appName("MovieRecommendationSystem")
    .master("local[*]")
    .getOrCreate()
)

print("Spark version:", spark.version)
print("Spark started successfully!")

spark.stop()