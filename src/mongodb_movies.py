from pymongo import MongoClient


client = MongoClient("mongodb://localhost:27017/")
db = client["movie_recommendation"]

movie_ids = [572, 318, 858, 953]

movies = db["movies"].find(
    {"movieId": {"$in": movie_ids}},
    {"_id": 0}
)

print("Movies from MongoDB:")

for movie in movies:
    print(movie)

client.close()