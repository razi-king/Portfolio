import { board, timeline, toolkit } from '@/lib/content'
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
        Razi Ahmed · Backend engineer in Go
      </p>
      <h1 className="hero-title">
        <span className="line">Razi</span>
        <span className="line">King</span>
      </h1>
      <p className="hero-lede">
        I connect airlines to booking engines, so the fare a traveller sees is the fare they pay. Go, PostgreSQL, Redis, and
        a lot of goroutines.
      </p>
      <div className="hero-actions">
        <a className="btn btn-primary" href="#hangar">
          See my projects
          <span aria-hidden="true">→</span>
        </a>
        <a className="btn btn-ghost" href="#contact">Get in touch</a>
      </div>
      <dl className="hero-facts">
        <div className="hud">
          <dt>Based in</dt>
          <dd>Mumbai, India</dd>
        </div>
        <div className="hud">
          <dt>Working at</dt>
          <dd>Infohybrid</dd>
        </div>
        <div className="hud">
          <dt>Looking for</dt>
          <dd>Go backend roles</dd>
        </div>
      </dl>
      <FlightStrip />
    </section>
  )
}

/** A slow ticker of the tools I use, between the hero and the work. */
export function Marquee() {
  const items = toolkit.flatMap((g) => g.items)
  const row = (hidden?: boolean) => (
    <ul aria-hidden={hidden || undefined}>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  )
  return (
    <div className="marquee" aria-label="Tools I use">
      <div className="marquee-track">
        {row()}
        {row(true)}
      </div>
    </div>
  )
}

export function Routes() {
  return (
    <section className="section" id="routes" aria-labelledby="routes-title">
      <SectionHead n="01" label="Departures" title="Routes I've shipped" id="routes-title">
        Production work at Infohybrid. The code is private, so here is what each piece does.
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
    </section>
  )
}

export function Journey() {
  return (
    <section className="section" id="journey" aria-labelledby="journey-title">
      <SectionHead n="03" label="Flight log" title="Journey so far" id="journey-title" />
      <ol className="timeline" data-reveal>
        {timeline.map((t) => (
          <li className="tl-item" key={t.role}>
            <p className="tl-when">{t.when}</p>
            <h3>
              {t.role}
              <span className="tl-org"> at {t.org}</span>
            </h3>
            <p className="tl-text">{t.text}</p>
          </li>
        ))}
      </ol>
      <div className="toolkit hud" data-reveal>
        {toolkit.map((g) => (
          <div className="tk-group" key={g.group}>
            <h3>{g.group}</h3>
            <ul className="stack">
              {g.items.map((i) => (
                <li key={i}>{i}</li>
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
          <strong>Razi King</strong>
          <p>Go backend engineer · Mumbai</p>
        </div>
      </div>
      <div className="footer-links">
        <a href="https://github.com/razi-king">GitHub</a>
        <a href="https://www.linkedin.com/in/razi-ahmed-8s/">LinkedIn</a>
        <a href="mailto:raziinsane@gmail.com">raziinsane@gmail.com</a>
      </div>
      <p className="footer-note">
        Built with Next.js, React Three Fiber, Go, RabbitMQ and PostgreSQL.{' '}
        <a href="https://github.com/razi-king/Portfolio">Read the source</a>.
      </p>
    </footer>
  )
}
