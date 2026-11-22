/** @type {import('next').NextConfig} */
// Static export so the site runs on GitHub Pages (no Node server needed).
// GitHub Pages serves this repo under /Portfolio; override BASE_PATH for other hosts ("" for root).
const basePath = process.env.BASE_PATH ?? '/Portfolio'

const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default nextConfig
