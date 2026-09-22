from pyspark.sql import SparkSession
from pyspark.ml.recommendation import ALS
from pyspark.ml.evaluation import RegressionEvaluator

spark = (
    SparkSession.builder
    .appName("ALSTuning")
    .master("local[*]")
    .getOrCreate()
)

ratings = spark.read.csv(
    "data/processed/ratings.csv",
    header=True,
    inferSchema=True
).select(
    "userId",
    "movieId",
    "rating"
)

training, test = ratings.randomSplit(
    [0.8, 0.2],
    seed=42
)

evaluator = RegressionEvaluator(
    metricName="rmse",
    labelCol="rating",
    predictionCol="prediction"
)

configs = [
    (10, 0.1, 10),
    (20, 0.1, 10),
    (10, 0.05, 20)
]

print("\nALS Parameter Tuning:")
print("-" * 50)

for rank, regParam, maxIter in configs:

    print(
        f"\nTesting: rank={rank}, "
        f"regParam={regParam}, "
        f"maxIter={maxIter}"
    )

    als = ALS(
        rank=rank,
        regParam=regParam,
        maxIter=maxIter,
        userCol="userId",
        itemCol="movieId",
        ratingCol="rating",
        coldStartStrategy="drop",
        nonnegative=True
    )

    model = als.fit(training)

    predictions = model.transform(test)

    rmse = evaluator.evaluate(predictions)

    print("RMSE:", rmse)

spark.stop()