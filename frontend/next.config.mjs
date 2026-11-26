import { existsSync } from 'node:fs'

/** @type {import('next').NextConfig} */
// Static export so the site runs on GitHub Pages (no Node server needed).
// GitHub Pages serves this repo under /Portfolio; override BASE_PATH for other hosts ("" for root).
const basePath = process.env.BASE_PATH ?? '/Portfolio'

// Résumé buttons only render when public/resume.pdf exists, so the site never links to a 404.
const hasResume = existsSync(new URL('./public/resume.pdf', import.meta.url))

const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_HAS_RESUME: hasResume ? '1' : '' },
}

export default nextConfig
