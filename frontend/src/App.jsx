import { useState } from "react"

function App() {
  const [userId, setUserId] = useState("")
  const [submittedUser, setSubmittedUser] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleRecommend = async () => {
    if (!userId) return

    setSubmittedUser(userId)
    setLoading(true)
    setError("")
    setRecommendations([])

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/recommend/${userId}`
      )

      if (!response.ok) {
        throw new Error("Failed to fetch recommendations")
      }

      const data = await response.json()

      setRecommendations(data.recommendations.recommendations)
    } catch (err) {
      setError("Unable to get recommendations. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">

      {/* Cinematic background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-red-900/20 blur-3xl" />
        <div className="absolute -right-40 top-10 h-150 w-150 rounded-full bg-red-700/10 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-175 w-225 -translate-x-1/2 bg-linear-to-b from-red-950/20 via-transparent to-transparent blur-3xl" />
      </div>

      <section className="relative z-10 px-6 py-10">

        <div className="mx-auto max-w-7xl">

          {/* Hero */}
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">

            

        {/* Logo */}
            <h1 className="text-6xl font-black tracking-tight sm:text-7xl md:text-8xl">
              Cine<span className="text-red-500">Match</span>
            </h1>

            {/* Description */}
            <p className="mt-7 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              Discover movies you'll love, powered by collaborative
              filtering and personalized just for you.
            </p>

            {/* Search */}
            <div className="mt-10 flex w-full max-w-2xl flex-col gap-3 sm:flex-row">

            <div className="relative flex-1">
            <input
  type="text"
  inputMode="numeric"
  autoComplete="new-password"
  name="user-id"
  spellCheck="false"
    placeholder="Enter your User ID"
    value={userId}
    onChange={(e) => setUserId(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        handleRecommend()
      }
    }}
    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none backdrop-blur transition focus:border-red-500/70 focus:bg-white/10"
  />
</div>

              <button
                onClick={handleRecommend}
                disabled={loading}
                className="rounded-2xl bg-red-500 px-8 py-4 font-bold transition hover:bg-red-400 hover:shadow-lg hover:shadow-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Finding..." : "Recommend →"}
              </button>

            </div>

            <p className="mt-4 text-sm text-zinc-600">
              Don't know your User ID? We'll show popular movies instead.
            </p>

          </div>


          {/* Loading */}
          {loading && (
            <div className="mx-auto mb-12 max-w-6xl text-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-zinc-400">
                <span className="animate-pulse">🎬</span>
                Finding movies for User {submittedUser}...
              </div>
            </div>
          )}


          {/* Error */}
          {error && (
            <div className="mx-auto mb-12 max-w-2xl rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-center text-red-400">
              {error}
            </div>
          )}


          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="pb-16">

              {/* Section heading */}
              <div className="mb-8">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
                  {recommendations[0]?.predictedRating
                    ? `Personalized for User ${submittedUser}`
                    : "Popular Picks"}
                </p>

                <h2 className="text-3xl font-black sm:text-4xl">
                  Recommended Movies
                </h2>

                <p className="mt-2 text-zinc-500">
                  {recommendations[0]?.predictedRating
                    ? "Movies our model thinks you'll enjoy."
                    : "Popular movies from our movie collection."}
                </p>
              </div>


              {/* Movie grid */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

                {recommendations.map((movie, index) => (

                  <div
                    key={movie.movieId}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-xl backdrop-blur transition duration-300 hover:-translate-y-2 hover:border-red-500/40 hover:shadow-red-950/30"
                  >

                    {/* Poster area */}
                    <div className="relative flex h-64 items-center justify-center overflow-hidden bg-linear-to-br from-zinc-800 via-zinc-900 to-black">

                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />

                      {movie.posterUrl ? (
  <img
    src={movie.posterUrl}
    alt={movie.title}
    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
  />
) : (
  <span className="text-7xl opacity-60 transition duration-500 group-hover:scale-110 group-hover:opacity-90">
    🎬
  </span>
)}

                      {/* Ranking */}
                      <div className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-sm font-bold backdrop-blur">
                        #{index + 1}
                      </div>

                    </div>


                    {/* Card content */}
                    <div className="p-5">

                      <h3 className="min-h-13 text-lg font-bold leading-6 text-white">
                        {movie.title}
                      </h3>


                      {/* Genres */}
                      <div className="mt-4 flex min-h-7.5 flex-wrap gap-2">

                        {movie.genres.split("|").map((genre) => (

                          <span
                            key={genre}
                            className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400"
                          >
                            {genre}
                          </span>

                        ))}

                      </div>


                      {/* Rating */}
                      {movie.predictedRating ? (

                        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">

                          <span className="text-xs font-medium uppercase tracking-widest text-zinc-600">
                            Predicted
                          </span>

                          <span className="font-bold text-red-400">
                            ⭐ {Math.min(movie.predictedRating, 5).toFixed(2)} / 5
                          </span>

                        </div>

                      ) : (

                        <div className="mt-6 border-t border-white/5 pt-4">

                          <span className="text-xs font-medium uppercase tracking-widest text-zinc-600">
                            🔥 Popular
                          </span>

                        </div>

                      )}

                    </div>

                  </div>

                ))}

              </div>

            </div>
          )}

        </div>

      </section>

    </div>
  )
}

export default App