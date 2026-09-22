from pyspark.sql import SparkSession
from pyspark.ml.recommendation import ALSModel

spark = (
    SparkSession.builder
    .appName("LoadALSModel")
    .master("local[*]")
    .getOrCreate()
)

print("Loading saved ALS model...")

model = ALSModel.load("models/als_model")

print("ALS model loaded successfully!")

print("Number of user factors:", model.userFactors.count())
print("Number of item factors:", model.itemFactors.count())

spark.stop()