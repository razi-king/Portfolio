// Production work (Infohybrid) shown as a departure board.
export const board = [
  {
    carrier: 'TripJack',
    work: 'Integrated the full flight booking flow: search, branded fares, price validation, ancillaries, hold-then-confirm and ticketing.',
    stack: 'Go, PostgreSQL',
    status: 'live',
  },
  {
    carrier: 'Akasa Air',
    work: 'Resolved the integration defects and took it through QA to sign-off for production release.',
    stack: 'Go',
    status: 'cleared',
  },
  {
    carrier: 'FlyArystan, SalamAir, ASL Airlines',
    work: 'Took over three integrations after the original developer left. I fix mapping, booking-flow and SQL defects.',
    stack: 'Go, SQL',
    status: 'live',
  },
  {
    carrier: 'Amadeus Transfers',
    work: 'Helped build a new transfer booking service from scratch, including the booking lifecycle and commission rules.',
    stack: 'Go, PostgreSQL',
    status: 'awaiting',
  },
  {
    carrier: 'Fare integrity',
    work: 'Found why bookings kept a stale fare after a price change. Traced it through app logic, a SQL query and a SQL function, then fixed it.',
    stack: 'Go, SQL',
    status: 'live',
  },
  {
    carrier: 'Multi-city search',
    work: 'Split return and multi-city searches into parallel one-way calls with goroutines and a panic-safe safeGo() wrapper. Matching went from O(n×m) to O(n+m).',
    stack: 'Go concurrency',
    status: 'live',
  },
]

export const statusLabel = {
  live: 'In production',
  cleared: 'Cleared by QA',
  awaiting: 'Awaiting supplier',
  deploying: 'Deploying soon',
  'in-progress': 'Building',
}

export const timeline = [
  {
    when: 'Jan 2026 – now',
    role: 'Backend Developer',
    org: 'Infohybrid',
    text: 'Go services for a live flight and transfer booking engine: supplier integrations, pricing and commission logic, Redis caching, and production support.',
  },
  {
    when: 'Feb 2025 – Jan 2026',
    role: 'Full Stack Developer Intern',
    org: 'ITDaksh Education',
    text: 'Built an internal CRM in Spring Boot on my own, including an event-driven email system on RabbitMQ with retries, dead-letter and parking-lot queues. Also built the institute website in Astro and React.',
  },
  {
    when: 'Jul 2023 – Apr 2026',
    role: 'B.Sc. Information Technology',
    org: 'University of Mumbai',
    text: 'Graduated with a CGPA of 9.3 / 10.',
  },
]

export const toolkit = [
  { group: 'Backend', items: ['Go', 'Goroutines', 'REST APIs', 'Java', 'Spring Boot', 'RabbitMQ', 'JWT'] },
  { group: 'Data', items: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Azure Blob Storage'] },
  { group: 'Frontend', items: ['React', 'Next.js', 'Astro', 'TypeScript', 'Tailwind CSS', 'Three.js'] },
  { group: 'Tools', items: ['Docker', 'Git', 'Postman', 'Linux'] },
]
