// Local-only: the project's Vite config plus a proxy, so the dev server can
// call the FastAPI backend from any port without touching its CORS list.
// Run with: VITE_API_URL=/api npx vite --config vite.local.config.js
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config.js'

export default mergeConfig(base, defineConfig({
  server: {
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.CINEMATCH_API_PORT || 8000}`, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
}))
