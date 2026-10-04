import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' makes every asset path relative, so the same build works at
// https://dev-coder21.github.io/CineMatch/ and locally.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
