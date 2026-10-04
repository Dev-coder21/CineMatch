# CineMatch: notes for coding agents

## Run the project

From the repository root:

```bash
./start.sh
```

This one command checks Java 17, the Python `.venv`, MongoDB (starting and seeding it if needed) and the frontend packages, then starts:

- the FastAPI + Spark ALS API on http://127.0.0.1:8000 (docs at `/docs`)
- the React site on http://localhost:5173 (or the next free port)

The site calls the API through Vite's `/api` proxy (`frontend/vite.local.config.js`), so it works on any port. Press Ctrl+C to stop both servers. Logs go to `.api.log` and `.web.log`.

## Rules

- Do not change anything in `backend/`; the FastAPI, Spark ALS and MongoDB logic is final.
- Never commit `.env`; it holds the TMDB token.
- PySpark needs Java 17. Do not run the API with a newer default JDK.
- `frontend/vite.config.js` must keep `base: './'` (GitHub Pages deploy).
