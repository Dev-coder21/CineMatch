# 🎬 CineMatch — Movie Recommendation System

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Apache Spark](https://img.shields.io/badge/Apache%20Spark-4.2-E25A1C.svg?logo=apachespark&logoColor=white)](https://spark.apache.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Local-47A248.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com/)

**CineMatch** is an end-to-end, full-stack movie recommendation platform. It leverages **Apache Spark ALS (Alternating Least Squares)** collaborative filtering to compute personalized movie suggestions on the **MovieLens 1M** dataset, falls back dynamically to popularity metrics for cold-start users via **MongoDB**, enriches metadata with live poster artwork using the **TMDB API**, and presents recommendations through a sleek, cinematic **React & Tailwind CSS** web application.

---

## 📑 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Dataset](#-dataset)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Environment Variables](#2-environment-variables)
  - [3. Backend & Spark Setup](#3-backend--spark-setup)
  - [4. MongoDB Setup & Data Ingestion](#4-mongodb-setup--data-ingestion)
  - [5. Frontend Setup](#5-frontend-setup)
- [Running the Project](#-running-the-project)
- [Machine Learning Pipeline](#-machine-learning-pipeline)
- [API Reference](#-api-reference)
- [Author](#-author)

---

## 🏛️ Architecture Overview

```
                 +---------------------------+
                 |    MovieLens 1M Dataset   |
                 +-------------+-------------+
                               |
               +---------------+---------------+
               |                               |
       [EDA & ETL (Spark)]             [MongoDB Ingestion]
               |                               |
               v                               v
    +--------------------+            +------------------+
    |  ALS Matrix        |            |     MongoDB      |
    |  Factorization     |            |  - movies        |
    |  Model Training    |            |  - ratings       |
    +----------+---------+            |  - users         |
               |                      +--------+---------+
               v                               |
    +--------------------+                     |
    | models/als_model   |                     |
    +----------+---------+                     |
               |                               |
               +---------------+---------------+
                               |
                               v
                     +--------------------+
                     |  FastAPI Backend   | <---> [ TMDB API ] (Movie Posters)
                     +---------+----------+
                               |  JSON API (port 8000)
                               v
                     +--------------------+
                     | React + Vite App   | (port 5173)
                     | Tailwind CSS UI    |
                     +--------------------+
```

---

## ✨ Key Features

- **Personalized Recommendations**: Uses PySpark's ALS algorithm to discover latent factors for users and movies, generating top-N personalized movie predictions.
- **Cold-Start Handling**: If an unseen user ID is requested, the system automatically falls back to top-rated, popular movies aggregated from MongoDB.
- **Live TMDB Poster Art**: Queries The Movie Database (TMDB) API dynamically using title extraction and regex matching, with in-memory LRU caching for performance.
- **Exclusion of Previously Rated Movies**: Ensures users are not recommended films they have already watched and rated.
- **Modern Cinematic UI**: Built with React 19 and Tailwind CSS v4, featuring a dark aesthetic, backdrop glows, responsive cards, and real-time state feedback.

---

## 🛠️ Tech Stack

### Machine Learning & Data Processing
- **Apache Spark / PySpark**: Large-scale distributed data processing and Matrix Factorization (ALS).
- **Pandas & NumPy**: Exploratory data analysis and pre-processing.
- **Matplotlib & Seaborn**: Data visualizations and rating distribution analysis.

### Backend & Database
- **FastAPI**: Asynchronous, high-performance web framework.
- **Uvicorn**: Lightning-fast ASGI web server.
- **MongoDB**: NoSQL database for flexible storage of movie metadata, user records, and popularity queries.
- **Requests & Python-dotenv**: HTTP client for TMDB poster retrieval and environment variable management.

### Frontend
- **React 19**: Modern UI library with functional components and hooks.
- **Vite**: Ultra-fast frontend build tool and dev server.
- **Tailwind CSS v4**: Utility-first styling framework with custom cinematic dark styling.

---

## 📁 Project Structure

```bash
movie-recommendation-system/
├── backend/
│   ├── main.py                  # FastAPI application entrypoint & routes
│   ├── recommender.py           # Spark ALS inference & MongoDB fallback logic
│   └── tmdb.py                  # TMDB API integration for poster retrieval
├── data/
│   ├── raw/ml-1m/               # Raw MovieLens 1M files (ratings, movies, users)
│   └── processed/               # Cleaned CSV files used for modeling
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main React component & UI layout
│   │   ├── index.css            # Tailwind CSS imports & global styles
│   │   └── main.jsx             # React DOM root
│   ├── package.json             # Frontend dependencies and scripts
│   └── vite.config.js           # Vite configuration
├── models/
│   └── als_model/               # Saved Spark ALS recommendation model
├── notebooks/                   # Jupyter notebooks for experimentation
├── src/
│   ├── als_tuning.py            # Hyperparameter tuning script for ALS
│   ├── eda.py                   # Exploratory data analysis on MovieLens
│   ├── load_mongodb.py          # Script to seed MongoDB with users/ratings
│   ├── mongodb_movies.py        # Movie collection queries & verification
│   ├── popular_movies.py        # Aggregation script for fallback popular movies
│   ├── recommend.py             # CLI recommendation script
│   └── spark_processing.py      # Spark data pipeline & initial ALS training
├── visualizations/              # Plots and graphs (e.g. rating distributions)
├── .env.example                 # Example environment variables
├── requirements.txt             # Python dependencies
└── README.md                    # Project documentation
```

---

## 📊 Dataset

The project uses the **MovieLens 1M Dataset** provided by GroupLens Research:
- **1,000,209 ratings** from **6,040 users** on **3,900 movies**.
- Ratings range from 1 to 5 stars.
- Includes movie metadata (Title, Release Year, Genres) and demographic data (Age, Gender, Occupation, Zip Code).

---

## ⚙️ Prerequisites

Make sure you have the following installed on your machine:
1. **Python 3.10+** (Python 3.11 or 3.12 recommended)
2. **Java 11 or 17** (Required for PySpark; e.g., Amazon Corretto 17)
3. **Node.js 18+ & npm** (For the React frontend)
4. **MongoDB Community Server** (Running locally on default port `27017`)

---

## 🚀 Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/Dev-coder21/movie-recommendation-system.git
cd movie-recommendation-system
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```bash
TMDB_API_TOKEN=your_tmdb_read_access_token_here
```

> **Note:** Obtain a free API Read Access Token (v4 auth) from [themoviedb.org](https://www.themoviedb.org/settings/api).

### 3. Backend & Spark Setup

Set up a virtual environment and install the required Python packages:

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Verify `JAVA_HOME` is pointed to Java 11 or 17:
```bash
export JAVA_HOME="/Library/Java/JavaVirtualMachines/amazon-corretto-17.jdk/Contents/Home" # (Adjust for your OS)
```

### 4. MongoDB Setup & Data Ingestion

Start your local MongoDB service:
```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod
```

Seed the MongoDB collections:
```bash
python src/load_mongodb.py
```

### 5. Frontend Setup

In a separate terminal, navigate to `frontend` and install packages:

```bash
cd frontend
npm install
```

---

## 🖥️ Running the Project

### Start the FastAPI Backend

From the project root (with `.venv` activated):

```bash
uvicorn backend.main:app --reload --port 8000
```
- API will be accessible at: `http://127.0.0.1:8000`
- Interactive Swagger docs: `http://127.0.0.1:8000/docs`

### Start the React Frontend

From the `frontend` folder:

```bash
npm run dev
```
- Web application will be live at: `http://localhost:5173`

---

## 🧠 Machine Learning Pipeline

1. **Exploratory Data Analysis (`src/eda.py`)**:
   - Inspects distribution, checks nulls, and generates `visualizations/rating_distribution.png`.
2. **Spark Processing (`src/spark_processing.py`)**:
   - Reads processed ratings into Spark DataFrames.
   - Splits dataset into 80% train / 20% test sets.
3. **Hyperparameter Tuning (`src/als_tuning.py`)**:
   - Evaluates combinations of latent factors (`rank`), regularization parameter (`regParam`), and iterations (`maxIter`) using `RegressionEvaluator` (RMSE).
4. **Model Export**:
   - Trained model is persisted under `models/als_model` for rapid inference via `ALSModel.load()`.

---

## 📡 API Reference

### Root Health Check
```http
GET /
```
**Response:**
```json
{
  "message": "CineMatch API is running!"
}
```

### Get Recommendations
```http
GET /recommend/{user_id}
```
**Parameters:**
- `user_id` *(integer, required)*: Target user ID (e.g., `1`, `60`, `450`).

**Response Example (Personalized):**
```json
{
  "userId": 1,
  "recommendations": {
    "type": "personalized",
    "recommendations": [
      {
        "movieId": 1198,
        "title": "Raiders of the Lost Ark (1981)",
        "genres": "Action|Adventure",
        "predictedRating": 4.88,
        "posterUrl": "https://image.tmdb.org/t/p/w500/..."
      }
    ]
  }
}
```

---

## 👤 Author

- **Dev Trivedi** — [GitHub (@Dev-coder21)](https://github.com/Dev-coder21)
