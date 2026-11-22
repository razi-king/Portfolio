import { board, timeline, toolkit } from '@/lib/content'
import { StatusPill } from './StatusPill'

export function Nav() {
  return (
    <header className="nav">
      <a className="brand" href="#top" aria-label="Razi King, home">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z" />
        </svg>
        <span>Razi King</span>
      </a>
      <nav aria-label="Sections">
        <a href="#routes">Work</a>
        <a href="#hangar">Projects</a>
        <a href="#journey">Journey</a>
        <a href="#contact" className="nav-cta">Contact</a>
      </nav>
    </header>
  )
}

export function Hero() {
  return (
    <section className="hero" id="top">
      <p className="hero-kicker">Razi Ahmed, backend engineer in Go</p>
      <h1 className="hero-title">
        <span className="line">Razi</span>
        <span className="line">King</span>
      </h1>
      <p className="hero-lede">
        I connect airlines to booking engines, so the fare a traveller sees is the fare they pay. Go, PostgreSQL, Redis, and
        a lot of goroutines.
      </p>
      <div className="hero-actions">
        <a className="btn btn-gold" href="#hangar">See my projects</a>
        <a className="btn btn-ghost" href="#contact">Get in touch</a>
      </div>
      <dl className="hero-facts">
        <div><dt>Based in</dt><dd>Mumbai, India</dd></div>
        <div><dt>Working at</dt><dd>Infohybrid, travel tech</dd></div>
        <div><dt>Looking for</dt><dd>Backend roles in Go</dd></div>
      </dl>
    </section>
  )
}

export function Routes() {
  return (
    <section className="section" id="routes" aria-labelledby="routes-title">
      <div className="section-head">
        <h2 id="routes-title">Routes I&apos;ve shipped</h2>
        <p>Production work at Infohybrid. The code is private, so here is what each piece does.</p>
      </div>
      <div className="board" role="table" aria-label="Production work">
        <div className="board-row board-head" role="row">
          <span role="columnheader">Carrier / system</span>
          <span role="columnheader">What I did</span>
          <span role="columnheader">Status</span>
        </div>
        {board.map((r) => (
          <div className="board-row" role="row" key={r.carrier}>
            <span className="board-carrier" role="cell">
              {r.carrier}
              <small>{r.stack}</small>
            </span>
            <span className="board-work" role="cell">{r.work}</span>
            <span className="board-status" role="cell"><StatusPill status={r.status} /></span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Journey() {
  return (
    <section className="section" id="journey" aria-labelledby="journey-title">
      <div className="section-head">
        <h2 id="journey-title">Journey so far</h2>
      </div>
      <ol className="timeline">
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
      <div className="toolkit">
        {toolkit.map((g) => (
          <div className="tk-group" key={g.group}>
            <h3>{g.group}</h3>
            <ul className="stack">
              {g.items.map((i) => <li key={i}>{i}</li>)}
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
      <div className="footer-links">
        <a href="https://github.com/razi-king">GitHub</a>
        <a href="https://www.linkedin.com/in/razi-ahmed-8s/">LinkedIn</a>
        <a href="mailto:raziinsane@gmail.com">raziinsane@gmail.com</a>
      </div>
      <p>
        Built with Next.js, React Three Fiber, Go, RabbitMQ and PostgreSQL.{' '}
        <a href="https://github.com/razi-king/Portfolio">Read the source</a>.
      </p>
    </footer>
  )
}
