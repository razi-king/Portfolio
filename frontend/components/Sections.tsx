import { BASE_PATH, board, RESUME_URL, stats, strengths, timeline, toolkit } from '@/lib/content'
import Architecture from './Architecture'
import { StatusPill } from './StatusPill'
import FlightStrip from './FlightStrip'

export function SectionHead({ n, label, title, id, children }: { n: string; label: string; title: string; id: string; children?: React.ReactNode }) {
  return (
    <div className="section-head" data-reveal>
      <p className="eyebrow">
        <span>{n}</span>
        {label}
      </p>
      <h2 id={id}>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Hero() {
  return (
    <section className="hero" id="top">
      <p className="hero-kicker">
        <span className="pulse-dot" aria-hidden="true" />
        Open to Go backend roles · Mumbai, India
      </p>
      {/* background-clip:text paints every glyph inside the h1, so the full name lives in aria-label, not a hidden span */}
      <h1 className="hero-title" aria-label="Razi Ahmed (Razi King)">
        <span className="line" aria-hidden="true">Razi</span>
        <span className="line" aria-hidden="true">King</span>
      </h1>
      <p className="hero-role">
        Backend engineer <span>(Go)</span> · Travel tech
      </p>
      <p className="hero-lede">
        I build the Go services that sell airline seats. Supplier integrations, booking flows and pricing logic, running in
        production at <strong>Infohybrid</strong> from first search to issued ticket.
      </p>
      <div className="hero-actions">
        <a className="btn btn-primary" href="#impact">
          See what I&apos;ve shipped
          <span aria-hidden="true">→</span>
        </a>
        {RESUME_URL && (
          <a className="btn btn-ghost" href={RESUME_URL} download="Razi_Ahmed_Resume.pdf">
            <svg className="btn-ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14" />
            </svg>
            Résumé
          </a>
        )}
        <a className="btn btn-ghost" href={`${BASE_PATH}/recruiter/`}>
          1-page summary
        </a>
      </div>
      <dl className="stats">
        {stats.map((s) => (
          <div className="stat hud" key={s.label}>
            <dt>{s.label}</dt>
            <dd>
              {s.value}
              {s.unit && <small> {s.unit}</small>}
            </dd>
          </div>
        ))}
      </dl>
      <FlightStrip />
    </section>
  )
}

/** A slow ticker of the tools I use, between the hero and the work. */
export function Marquee() {
  const items = toolkit.flatMap((g) => g.items.map((i) => i.name))
  const row = (hidden?: boolean) => (
    <ul aria-hidden={hidden || undefined}>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  )
  return (
    <div className="marquee" aria-label="Skills">
      <div className="marquee-track">
        {row()}
        {row(true)}
      </div>
    </div>
  )
}

const ICONS: Record<string, React.ReactNode> = {
  plug: <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4" />,
  bug: <path d="M8 6a4 4 0 0 1 8 0M6 10h12v4a6 6 0 0 1-12 0zM12 10v10M3 13h3M18 13h3M4 7l2.5 2M20 7l-2.5 2M4 20l2.5-2.5M20 20l-2.5-2.5" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  layers: <path d="m12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5" />,
  gauge: <path d="M12 14l4-6M3.5 18a10 10 0 1 1 17 0z" />,
  coins: <path d="M8 6a6 3 0 1 0 12 0 6 3 0 1 0-12 0M8 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3V6M4 12a6 3 0 0 0 6 3M4 12v6c0 1.7 2.7 3 6 3" />,
}

export function Strengths() {
  return (
    <section className="section" id="impact" aria-labelledby="impact-title">
      <SectionHead n="01" label="Why hire me" title="What I bring to a backend team" id="impact-title">
        Six things I do well, each with the production work that proves it.
      </SectionHead>
      <div className="strengths" data-reveal>
        {strengths.map((s, i) => (
          <article className="strength spot hud" key={s.title}>
            <div className="strength-top">
              <span className="strength-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24">{ICONS[s.icon]}</svg>
              </span>
              <span className="strength-n">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <ul className="stack" aria-label="Keywords">
              {s.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

export function Routes() {
  return (
    <section className="section" id="routes" aria-labelledby="routes-title">
      <SectionHead n="02" label="Departures" title="Routes I've shipped" id="routes-title">
        Production work at Infohybrid, a travel-technology company. The code is private, so here is what each piece does.
      </SectionHead>
      <div className="board hud" role="table" aria-label="Production work" data-reveal>
        <div className="board-row board-head" role="row">
          <span role="columnheader">Flight</span>
          <span role="columnheader">Carrier / system</span>
          <span role="columnheader">What I did</span>
          <span role="columnheader">Status</span>
        </div>
        {board.map((r, i) => (
          <div className="board-row" role="row" key={r.carrier}>
            <span className="board-code" role="cell">
              RK-{String(i + 1).padStart(2, '0')}
            </span>
            <span className="board-carrier" role="cell">
              {r.carrier}
              <small>{r.stack}</small>
            </span>
            <span className="board-work" role="cell">
              {r.work}
            </span>
            <span className="board-status" role="cell">
              <StatusPill status={r.status} />
            </span>
          </div>
        ))}
      </div>
      <Architecture />
    </section>
  )
}

export function Journey() {
  return (
    <section className="section" id="journey" aria-labelledby="journey-title">
      <SectionHead n="05" label="Flight log" title="Journey so far" id="journey-title" />
      <ol className="timeline" data-reveal>
        {timeline.map((t) => (
          <li className="tl-item" key={t.role}>
            <p className="tl-when">{t.when}</p>
            <h3>
              {t.role}
              <span className="tl-org"> at {t.org}</span>
            </h3>
            <p className="tl-text">{t.text}</p>
            <ul className="stack tl-tags" aria-label="Technologies">
              {t.tags.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="toolkit-head" data-reveal>
        <h3>Technical toolkit</h3>
        <p className="legend">
          <span className="chip-prod">Go</span> = used in production at Infohybrid
        </p>
      </div>
      <div className="toolkit hud" data-reveal>
        {toolkit.map((g) => (
          <div className="tk-group" key={g.group}>
            <h4>{g.group}</h4>
            <ul className="stack">
              {g.items.map((i) => (
                <li key={i.name} className={i.prod ? 'prod' : undefined}>
                  {i.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-sign">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z" />
          </svg>
        </span>
        <div>
          <strong>Razi Ahmed · Razi King</strong>
          <p>Backend engineer (Go) · Mumbai</p>
        </div>
      </div>
      <div className="footer-links">
        <a href="https://github.com/razi-king">GitHub</a>
        <a href="https://www.linkedin.com/in/razi-ahmed-8s/">LinkedIn</a>
        {RESUME_URL && (
          <a href={RESUME_URL} download="Razi_Ahmed_Resume.pdf">
            Résumé
          </a>
        )}
        <a href={`${BASE_PATH}/recruiter/`}>Recruiter one-pager</a>
        <a href="mailto:raziinsane@gmail.com">raziinsane@gmail.com</a>
      </div>
      <p className="footer-note">
        Built with Next.js, React Three Fiber, Go, RabbitMQ and PostgreSQL.{' '}
        <a href="https://github.com/razi-king/Portfolio">Read the source</a>.
      </p>
    </footer>
  )
}
