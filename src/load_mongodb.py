import pandas as pd
from pymongo import MongoClient

users = pd.read_csv(
    "data/processed/users.csv"
)

client = MongoClient("mongodb://localhost:27017/")
db = client["movie_recommendation"]

users_collection = db["users"]

users_collection.delete_many({})

users_collection.insert_many(
    users.to_dict("records")
)

print("Users loaded successfully!")
print("Total users:", users_collection.count_documents({}))

client.close()