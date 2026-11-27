import projectsJson from './projects.json'

export type Status = 'live' | 'cleared' | 'awaiting' | 'deploying' | 'in-progress' | 'demo' | 'tested'
export type Category = 'fullstack' | 'frontend' | 'backend'

export interface Project {
  slug: string
  title: string
  tagline: string
  description: string
  category: Category
  status: Status
  highlights: string[]
  stack: string[]
  repo?: string
  live?: string
  featured: boolean
}

/** Shared with the Go API (backend/internal/projects/projects.json). */
export const projects = projectsJson as Project[]

export const statusLabel: Record<Status, string> = {
  live: 'In production',
  cleared: 'Cleared by QA',
  awaiting: 'Awaiting supplier',
  deploying: 'Deploying soon',
  'in-progress': 'Building',
  demo: 'Live demo',
  tested: 'Tested in CI',
}

export const categoryLabel: Record<Category, string> = {
  fullstack: 'Full-stack',
  frontend: 'Frontend',
  backend: 'Backend',
}

/** Put the résumé PDF at frontend/public/resume.pdf; the buttons appear once it exists. */
export const RESUME_URL = process.env.NEXT_PUBLIC_HAS_RESUME ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/resume.pdf` : ''

/** The Go API, e.g. https://razi-portfolio-api.onrender.com (empty: demo uses recorded data). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** Headline numbers in the hero. Every one is backed by something on the page below. */
export const stats = [
  { value: '10+', unit: 'months', label: 'shipping production Go' },
  { value: '6', unit: 'integrations', label: 'airline & supplier APIs' },
  { value: 'O(n+m)', unit: '', label: 'matching, down from O(n×m)' },
  { value: '9.3', unit: '/ 10', label: 'B.Sc. IT CGPA' },
]

/** "Why hire me": each strength with the proof behind it. */
export const strengths = [
  {
    icon: 'plug',
    title: 'Supplier integrations, end to end',
    text: 'I integrated TripJack into a live booking engine: search, branded fares, price validation, ancillaries, hold-then-confirm and ticketing. I also took Akasa Air through QA to production sign-off.',
    tags: ['TripJack', 'Akasa Air', 'Amadeus'],
  },
  {
    icon: 'bug',
    title: 'Production debugging',
    text: 'Bookings were keeping a stale fare after a price change. I traced it through the application logic, a faulty SQL query and an SQL function, then fixed the root cause rather than the symptom.',
    tags: ['PostgreSQL', 'SQL functions', 'Root cause'],
  },
  {
    icon: 'bolt',
    title: 'Go concurrency, done safely',
    text: 'Return and multi-city searches fan out into parallel one-way supplier calls. My safeGo() wrapper recovers panics in background goroutines and raises an alert, which HTTP middleware never sees.',
    tags: ['Goroutines', 'safeGo()', 'Fan-out'],
  },
  {
    icon: 'layers',
    title: 'Architecture that absorbs change',
    text: 'I designed a capability-scoped supplier abstraction: each plugin call is checked against what that supplier supports, so partial APIs plug in without touching booking business logic.',
    tags: ['Interfaces', 'Plugins', 'SOLID'],
  },
  {
    icon: 'gauge',
    title: 'Performance with evidence',
    text: 'Supplier tokens are cached in Redis, and search results in MongoDB and Azure Blob for suppliers without revalidation. I replaced nested-loop matching with hashmaps and benchmarked both versions.',
    tags: ['Redis', 'MongoDB', 'Benchmarks'],
  },
  {
    icon: 'coins',
    title: 'Money logic that adds up',
    text: 'I fixed commission, DealCode and ancillary-markup defects that drive booking totals, and built configurable commission rules for the new transfer platform. When money is involved, correctness comes first.',
    tags: ['Pricing', 'Commission', 'Markups'],
  },
]

/** Production work at Infohybrid, shown as a departure board. */
export const board: { carrier: string; work: string; stack: string; status: Status }[] = [
  {
    carrier: 'TripJack',
    work: 'Integrated the full flight booking flow into a live engine: search, branded fares, pricing and price validation, ancillaries, hold-then-confirm, direct booking and ticket issuance.',
    stack: 'Go, PostgreSQL',
    status: 'live',
  },
  {
    carrier: 'Akasa Air',
    work: 'Resolved the integration defects and drove it through QA testing to sign-off for production release.',
    stack: 'Go',
    status: 'cleared',
  },
  {
    carrier: 'FlyArystan, SalamAir, ASL Airlines',
    work: 'Took over maintenance and production support of three airline integrations after the original developer left. I fix request/response mapping, booking-flow, SQL and business-logic defects.',
    stack: 'Go, SQL',
    status: 'live',
  },
  {
    carrier: 'Amadeus Transfer Quick Connect',
    work: 'Helped build a transfer booking service from scratch: search, revalidation, pre-booking, add-ons and confirmation, plus booking management APIs, commission rules and normalized PostgreSQL tables. Validated in the supplier test environment.',
    stack: 'Go, PostgreSQL, Logrus',
    status: 'awaiting',
  },
  {
    carrier: 'Fare integrity',
    work: 'Fixed a critical defect where booking data was written before supplier confirmation and never updated when the fare changed. Root cause spanned app logic, a SQL query and a SQL function.',
    stack: 'Go, SQL',
    status: 'live',
  },
  {
    carrier: 'Pricing engine',
    work: 'Fixed defects in flight commission, DealCode and ancillary-markup logic, which drive pricing, commissions, markups and booking totals.',
    stack: 'Go, PostgreSQL',
    status: 'live',
  },
  {
    carrier: 'Multi-city search',
    work: 'Split return and multi-city searches into parallel one-way calls with goroutines and a panic-safe safeGo() wrapper. Offer matching went from O(n×m) to O(n+m), benchmarked with Go’s testing package.',
    stack: 'Go concurrency',
    status: 'live',
  },
  {
    carrier: 'Supplier platform',
    work: 'Capability-scoped supplier abstraction, Redis-cached supplier tokens, and JWT auth for internal APIs, issuing and validating keys for new suppliers and API consumers.',
    stack: 'Go, Redis, JWT',
    status: 'live',
  },
]

export const timeline = [
  {
    when: 'Jan 2026 – now',
    role: 'Backend Developer',
    org: 'Infohybrid',
    text: 'Go services for a live flight and transfer booking engine: supplier integrations (TripJack, Akasa Air, FlyArystan, SalamAir, ASL Airlines, Amadeus Transfers), pricing and commission logic, Redis caching, and production support.',
    tags: ['Go', 'PostgreSQL', 'Redis', 'MongoDB', 'Azure Blob'],
  },
  {
    when: 'Feb 2025 – Jan 2026',
    role: 'Full Stack Developer Intern',
    org: 'ITDaksh Education',
    text: 'Built an internal CRM on my own in Spring Boot and MySQL (leads, enrolment, fee tracking), replacing spreadsheets. It includes an event-driven email system on RabbitMQ with retries, dead-letter and parking-lot queues, scheduled fee reminders and duplicate-lead detection. I also built the institute website in Astro and React.',
    tags: ['Java', 'Spring Boot', 'RabbitMQ', 'MySQL', 'Astro'],
  },
  {
    when: 'Jul 2023 – Apr 2026',
    role: 'B.Sc. Information Technology',
    org: 'Kalsekar Degree College, University of Mumbai',
    text: 'Graduated with a CGPA of 9.3 / 10 while working in industry for most of the final year.',
    tags: ['CGPA 9.3 / 10'],
  },
]

/** Skills from my résumé. `prod` marks what I use in production at Infohybrid. */
export const toolkit: { group: string; items: { name: string; prod?: boolean }[] }[] = [
  {
    group: 'Languages',
    items: [{ name: 'Go', prod: true }, { name: 'Java' }, { name: 'Python' }, { name: 'TypeScript' }, { name: 'JavaScript' }],
  },
  {
    group: 'Backend',
    items: [
      { name: 'REST APIs', prod: true },
      { name: 'Goroutines & concurrency', prod: true },
      { name: 'JWT auth', prod: true },
      { name: 'Unit tests & benchmarks', prod: true },
      { name: 'Spring Boot' },
      { name: 'Spring Security' },
      { name: 'RabbitMQ' },
      { name: 'WebSocket (STOMP)' },
    ],
  },
  {
    group: 'Data & storage',
    items: [
      { name: 'PostgreSQL', prod: true },
      { name: 'Redis', prod: true },
      { name: 'MongoDB', prod: true },
      { name: 'Azure Blob Storage', prod: true },
      { name: 'SQL functions & debugging', prod: true },
      { name: 'MySQL' },
    ],
  },
  {
    group: 'Domain',
    items: [
      { name: 'Flight booking', prod: true },
      { name: 'Supplier API integration', prod: true },
      { name: 'Transfer booking', prod: true },
      { name: 'Commission & markup rules', prod: true },
    ],
  },
  {
    group: 'Practices & tools',
    items: [
      { name: 'Repository pattern' },
      { name: 'Interface-based design', prod: true },
      { name: 'Logrus', prod: true },
      { name: 'Git' },
      { name: 'Postman' },
      { name: 'Docker' },
      { name: 'OpenAPI / Swagger' },
      { name: 'React / Next.js' },
    ],
  },
]
