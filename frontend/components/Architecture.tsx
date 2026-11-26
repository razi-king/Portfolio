/** How a booking flows through the system I work on (simplified; the code is private). */

type Tone = 'cyan' | 'violet' | 'gold' | 'ghost'

function Box({ x, y, w, h, title, lines, tone = 'cyan' }: { x: number; y: number; w: number; h: number; title: string; lines: string[]; tone?: Tone }) {
  return (
    <g className={`arch-box arch-${tone}`}>
      <rect x={x} y={y} width={w} height={h} rx={8} />
      <text x={x + 14} y={y + 26} className="arch-title">
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + 14} y={y + 47 + i * 17} className="arch-sub">
          {l}
        </text>
      ))}
    </g>
  )
}

/** Elbow connector from (x1,y1) to (x2,y2). */
function Wire({ x1, y1, x2, y2, label, lx, ly, down, tone = 'cyan' }: { x1: number; y1: number; x2: number; y2: number; label?: string; lx?: number; ly?: number; down?: boolean; tone?: Tone }) {
  const mx = (x1 + x2) / 2
  const d = down && x1 !== x2
    ? `M${x1},${y1} V${(y1 + y2) / 2} H${x2} V${y2}`
    : y1 === y2 ? `M${x1},${y1} H${x2}` : x1 === x2 ? `M${x1},${y1} V${y2}` : `M${x1},${y1} H${mx} V${y2} H${x2}`
  return (
    <g className={`arch-wire arch-${tone}`}>
      <path d={d} className="arch-line" />
      <path d={d} className="arch-flow" />
      {label && (
        <text x={lx ?? mx} y={ly ?? Math.min(y1, y2) - 8} className="arch-label" textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  )
}

const PLUGINS = [
  { name: 'TripJack', sub: 'search → ticket, live' },
  { name: 'Akasa Air', sub: 'cleared by QA for release' },
  { name: 'FlyArystan · SalamAir', sub: '+ ASL Airlines, maintained' },
  { name: 'Amadeus Transfers', sub: 'transfer booking service' },
]

export default function Architecture() {
  const midY = 230
  return (
    <figure className="arch" data-reveal>
      <figcaption className="arch-cap">
        <span className="eyebrow-mini">System sketch</span>
        How a booking request moves through the engine I work on. Simplified; the production code is private.
      </figcaption>
      <div className="arch-scroll">
        <svg viewBox="0 0 1000 560" role="img" aria-labelledby="arch-t arch-d">
          <title id="arch-t">Booking engine architecture</title>
          <desc id="arch-d">
            Clients call a Go API with JWT auth and middleware. A booking service fans searches out in parallel with safeGo()
            to a supplier layer, which checks each supplier&apos;s capabilities before calling the TripJack, Akasa Air,
            FlyArystan, SalamAir, ASL Airlines and Amadeus Transfers plugins. Redis caches supplier tokens, PostgreSQL stores
            bookings and fare breakups, and MongoDB or Azure Blob keep search snapshots for suppliers without a revalidation
            API.
          </desc>

          {/* main path */}
          <Box x={10} y={midY - 50} w={130} h={100} title="Clients" lines={['website', 'B2B API consumers']} tone="ghost" />
          <Box x={170} y={midY - 60} w={180} h={120} title="Go API" lines={['JWT auth (issued keys)', 'request ID · recover', 'structured logging']} />
          <Box x={380} y={midY - 60} w={180} h={120} title="Booking service" lines={['search · revalidate', 'hold → confirm → issue', 'commission & markups']} tone="violet" />
          <Box x={595} y={midY - 60} w={150} h={120} title="Supplier layer" lines={['capability check', 'before every call', 'one interface']} />

          <Wire x1={140} y1={midY} x2={170} y2={midY} label="HTTPS" />
          <Wire x1={350} y1={midY} x2={380} y2={midY} label="" />
          <Wire x1={560} y1={midY} x2={595} y2={midY} label="safeGo()" ly={midY - 12} tone="gold" />
          <text x={577} y={midY + 24} className="arch-label" textAnchor="middle">
            fan-out
          </text>

          {/* plugins */}
          {PLUGINS.map((p, i) => {
            const y = 40 + i * 84
            return (
              <g key={p.name}>
                <Box x={780} y={y} w={210} h={66} title={p.name} lines={[p.sub]} tone="gold" />
                <Wire x1={745} y1={midY} x2={780} y2={y + 33} />
              </g>
            )
          })}
          <g className="arch-box arch-ghost">
            <rect x={780} y={376} width={210} height={52} rx={8} strokeDasharray="5 5" />
            <text x={794} y={398} className="arch-title">
              Next supplier
            </text>
            <text x={794} y={416} className="arch-sub">
              no booking-logic change
            </text>
          </g>
          <Wire x1={745} y1={midY} x2={780} y2={402} tone="ghost" />

          {/* data stores */}
          <Box x={170} y={450} w={180} h={92} title="PostgreSQL" lines={['bookings · passengers', 'fare breakup · SQL fns']} tone="violet" />
          <Box x={380} y={450} w={180} h={92} title="MongoDB · Blob" lines={['+ Azure Blob · search', 'snapshots for reval']} tone="violet" />
          <Box x={595} y={450} w={150} h={92} title="Redis" lines={['supplier tokens', '& credentials']} tone="violet" />
          <Wire x1={430} y1={midY + 60} x2={260} y2={450} down tone="violet" label="write after confirm" lx={345} ly={362} />
          <Wire x1={500} y1={midY + 60} x2={500} y2={450} tone="violet" />
          <Wire x1={670} y1={midY + 60} x2={670} y2={450} tone="violet" label="no repeat DB lookups" lx={670} ly={340} />
        </svg>
      </div>
      <ul className="arch-notes">
        <li>
          <strong>Capability-scoped plugins.</strong> Suppliers with partial APIs plug in without changes to booking logic.
        </li>
        <li>
          <strong>Write after confirm.</strong> A booking is stored only once the supplier confirms the fare, the fix behind
          the stale-price defect.
        </li>
        <li>
          <strong>Panic-safe fan-out.</strong> Return and multi-city searches split into parallel one-way calls through
          safeGo().
        </li>
      </ul>
    </figure>
  )
}
