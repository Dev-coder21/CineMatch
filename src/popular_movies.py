from pymongo import MongoClient


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

print("Popular Movies:")

for movie in popular_movies:
    print(movie)

client.close()