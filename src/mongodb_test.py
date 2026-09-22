from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")

db = client["movie_recommendation"]

print("Connected to MongoDB!")
print("Database:", db.name)

client.close()