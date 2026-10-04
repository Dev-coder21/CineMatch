#!/usr/bin/env bash
# CineMatch: start the full stack (FastAPI + Spark ALS + MongoDB + React) with one command.
#
#   ./start.sh            start everything and open the browser
#   ./start.sh --no-open  start everything without opening a browser
#
# Press Ctrl+C to stop both servers.
set -euo pipefail
cd "$(dirname "$0")"

API_PORT=8000
OPEN_BROWSER=1
[[ "${1:-}" == "--no-open" ]] && OPEN_BROWSER=0

say()  { printf '\033[1;35m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# ---------------------------------------------------------------- Java 17
# PySpark 4 needs Java 17; a newer default JDK (e.g. 26) makes Spark fail.
JAVA17="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
[[ -n "$JAVA17" ]] || die "Java 17 not found. Install it with: brew install --cask corretto@17"
export JAVA_HOME="$JAVA17" PATH="$JAVA17/bin:$PATH"
ok "Java 17 ($JAVA_HOME)"

# ---------------------------------------------------------------- Python
if [[ ! -x .venv/bin/python ]]; then
  say "Creating .venv and installing Python packages (first run only)…"
  python3 -m venv .venv
  .venv/bin/python -m pip install -q -r requirements.txt
fi
.venv/bin/python -c "import fastapi, uvicorn, pyspark, pymongo, dotenv" 2>/dev/null \
  || { say "Installing missing Python packages…"; .venv/bin/python -m pip install -q -r requirements.txt; }
ok "Python environment (.venv)"

# ---------------------------------------------------------------- TMDB token
if [[ -f .env ]] && grep -q '^TMDB_API_TOKEN=.\+' .env; then
  ok "TMDB token found in .env (real posters)"
else
  warn "No TMDB_API_TOKEN in .env: copy .env.example to .env and add it for real posters. Generated poster art will be used instead."
fi

# ---------------------------------------------------------------- MongoDB
if ! port_busy 27017; then
  say "Starting MongoDB…"
  brew services start mongodb-community >/dev/null 2>&1 || die "Could not start MongoDB. Install it with: brew install mongodb-community"
  for _ in $(seq 1 30); do port_busy 27017 && break; sleep 1; done
  port_busy 27017 || die "MongoDB did not start on port 27017."
fi
if ! .venv/bin/python - <<'PY' 2>/dev/null
from pymongo import MongoClient
db = MongoClient(serverSelectionTimeoutMS=3000)["movie_recommendation"]
assert db["movies"].estimated_document_count() > 0 and db["ratings"].estimated_document_count() > 0
PY
then
  say "Seeding MongoDB with MovieLens data (first run only)…"
  .venv/bin/python src/load_mongodb.py
fi
ok "MongoDB (movie_recommendation)"

# ---------------------------------------------------------------- Frontend deps
if [[ ! -d frontend/node_modules ]]; then
  say "Installing frontend packages (first run only)…"
  npm --prefix frontend install --silent
fi
ok "Frontend packages"

# ---------------------------------------------------------------- Ports
port_busy "$API_PORT" && die "Port $API_PORT is already in use. Stop whatever is running there (or a previous ./start.sh) and try again."
WEB_PORT=5173
while port_busy "$WEB_PORT"; do WEB_PORT=$((WEB_PORT + 1)); done

# ---------------------------------------------------------------- Start
PIDS=()
cleanup() {
  echo; say "Stopping CineMatch…"
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  ok "Stopped."
}
trap cleanup EXIT INT TERM

say "Starting the API (Spark loads the ALS model; this takes ~20 s)…"
.venv/bin/python -m uvicorn backend.main:app --port "$API_PORT" > .api.log 2>&1 &
PIDS+=($!)
for _ in $(seq 1 120); do
  curl -sf "http://127.0.0.1:$API_PORT/" >/dev/null && break
  kill -0 "${PIDS[0]}" 2>/dev/null || { tail -20 .api.log; die "The API failed to start (log above, full log in .api.log)."; }
  sleep 1
done
curl -sf "http://127.0.0.1:$API_PORT/" >/dev/null || die "The API did not answer within 2 minutes (see .api.log)."
ok "API on http://127.0.0.1:$API_PORT  (docs: http://127.0.0.1:$API_PORT/docs)"

# Spark's first query is slow; run one now so the demo is instant.
say "Warming up the model…"
curl -sf "http://127.0.0.1:$API_PORT/recommend/1" >/dev/null && ok "Model warm"

# The frontend talks to the API through Vite's /api proxy, so it works on any port.
VITE_API_URL=/api npm --prefix frontend exec -- vite frontend \
  --config frontend/vite.local.config.js --port "$WEB_PORT" --strictPort > .web.log 2>&1 &
PIDS+=($!)
for _ in $(seq 1 60); do curl -sf "http://localhost:$WEB_PORT/" >/dev/null && break; sleep 0.5; done
curl -sf "http://localhost:$WEB_PORT/" >/dev/null || { tail -20 .web.log; die "The website failed to start (see .web.log)."; }

URL="http://localhost:$WEB_PORT/"
echo
ok "CineMatch is running:  $URL"
echo "   Live recommendations come from the Spark ALS model. Try viewers 1, 42, 1337, or 99999 (new viewer)."
echo "   Press Ctrl+C to stop."
[[ $OPEN_BROWSER == 1 ]] && open "$URL"

# bash 3.2 (macOS) has no `wait -n`, so watch both servers instead
while kill -0 "${PIDS[0]}" 2>/dev/null && kill -0 "${PIDS[1]}" 2>/dev/null; do sleep 1; done
warn "A server stopped unexpectedly. Logs: .api.log and .web.log"
