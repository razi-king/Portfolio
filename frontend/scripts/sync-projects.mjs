// The Go API embeds backend/internal/projects/projects.json. Copy it here so the
// site and the API always show the same projects (one source of truth).
import { copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../../backend/internal/projects/projects.json', import.meta.url))
const dest = fileURLToPath(new URL('../lib/projects.json', import.meta.url))
mkdirSync(fileURLToPath(new URL('../lib/', import.meta.url)), { recursive: true })
copyFileSync(src, dest)
console.log('synced projects.json from the Go backend')
