import type { Metadata, Viewport } from 'next'
import '@fontsource/unbounded/latin-600.css'
import '@fontsource/unbounded/latin-800.css'
import '@fontsource/instrument-sans/latin-400.css'
import '@fontsource/instrument-sans/latin-500.css'
import '@fontsource/instrument-sans/latin-600.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-600.css'
import './globals.css'

const SITE = 'https://razi-king.github.io/Portfolio/'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Razi Ahmed (Razi King) · Backend Engineer, Go · Travel Tech',
  description:
    'Razi Ahmed, backend engineer in Go at Infohybrid. Integrated TripJack and Akasa Air into a live flight booking engine, supports FlyArystan, SalamAir and ASL Airlines, and builds with PostgreSQL, Redis and goroutines. Open to Go backend roles.',
  openGraph: {
    title: 'Razi Ahmed, Backend Engineer (Go)',
    description: 'I build the Go services that sell airline seats: supplier integrations, booking flows and pricing logic in production. Open to Go backend roles.',
    url: SITE,
    type: 'website',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👑</text></svg>",
  },
}

export const viewport: Viewport = { themeColor: '#05060F' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
