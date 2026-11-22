import type { Metadata, Viewport } from 'next'
import '@fontsource/unbounded/latin-600.css'
import '@fontsource/unbounded/latin-800.css'
import '@fontsource/instrument-sans/latin-400.css'
import '@fontsource/instrument-sans/latin-500.css'
import '@fontsource/instrument-sans/latin-600.css'
import './globals.css'

const SITE = 'https://razi-king.github.io/Portfolio/'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Razi King · Backend Engineer (Go)',
  description:
    'Razi Ahmed (Razi King), backend engineer in Go. Airline and supplier API integrations, booking engines, PostgreSQL, Redis, RabbitMQ.',
  openGraph: {
    title: 'Razi King, Backend Engineer (Go)',
    description: 'I connect airlines to booking engines in Go. See my production work and projects.',
    url: SITE,
    type: 'website',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👑</text></svg>",
  },
}

export const viewport: Viewport = { themeColor: '#150C30' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
