import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// GitHub Pages serves this repo at /Portfolio/. Override with BASE_PATH for other hosts.
export default defineConfig({
  base: process.env.BASE_PATH || '/Portfolio/',
  resolve: {
    alias: {
      // projects.json lives in the Go backend so the API and the site share one source of truth
      '@projects': fileURLToPath(new URL('../backend/internal/projects/projects.json', import.meta.url)),
    },
  },
  server: { fs: { allow: ['..'] } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
})
