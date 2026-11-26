import type { Metadata } from 'next'
import { BASE_PATH, board, projects, RESUME_URL, stats, strengths, timeline, toolkit } from '@/lib/content'
import PrintButton from '@/components/PrintButton'

export const metadata: Metadata = {
  title: 'Razi Ahmed · Backend Engineer (Go) · One-page summary',
  description: 'A one-page summary of Razi Ahmed for recruiters and hiring managers: Go backend engineer in travel tech, open to backend roles.',
}

const EMAIL = 'raziinsane@gmail.com'
const SITE = 'razi-king.github.io/Portfolio'

export default function Recruiter() {
  const work = timeline[0]
  const intern = timeline[1]
  const edu = timeline[2]
  const shipped = projects.filter((p) => p.repo || p.live)

  return (
    <div className="cv-page">
      <div className="cv-toolbar" role="navigation" aria-label="Page actions">
        <a href={`${BASE_PATH}/`}>← Full portfolio</a>
        <div>
          {RESUME_URL && (
            <a className="cv-btn" href={RESUME_URL} download="Razi_Ahmed_Resume.pdf">
              Download résumé
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      <main className="cv">
        <header className="cv-head">
          <div>
            <h1>Razi Ahmed</h1>
            <p className="cv-role">Backend Engineer (Go) · Travel technology</p>
          </div>
          <p className="cv-open">Open to Go backend roles · Mumbai or remote</p>
          <p className="cv-contact">
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            <a href="https://www.linkedin.com/in/razi-ahmed-8s/">linkedin.com/in/razi-ahmed-8s</a>
            <a href="https://github.com/razi-king">github.com/razi-king</a>
            <a href={`https://${SITE}/`}>{SITE}</a>
          </p>
        </header>

        <section className="cv-summary">
          <p>
            Backend engineer with <strong>10+ months of production Go</strong> at Infohybrid, a travel-technology company, plus
            an 11-month full-stack internship in Java and Spring Boot. I integrated the <strong>TripJack</strong> flight supplier
            into a live booking engine, took the <strong>Akasa Air</strong> integration to QA sign-off, support three inherited
            airline integrations, and helped build a transfer booking platform on <strong>Amadeus</strong>. Strong in Go
            concurrency, PostgreSQL debugging, caching and supplier API design.
          </p>
          <dl className="cv-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dd>
                  {s.value}
                  {s.unit && <small> {s.unit}</small>}
                </dd>
                <dt>{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <div className="cv-cols">
          <div>
            <section>
              <h2>Experience</h2>
              <article className="cv-job">
                <h3>
                  {work.role} · {work.org}
                  <span>{work.when}</span>
                </h3>
                <ul>
                  {board.map((b) => (
                    <li key={b.carrier}>
                      <strong>{b.carrier}:</strong> {b.work}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="cv-job">
                <h3>
                  {intern.role} · {intern.org}
                  <span>{intern.when}</span>
                </h3>
                <p>{intern.text}</p>
              </article>
            </section>
          </div>

          <aside>
            <section>
              <h2>Strengths</h2>
              <ul className="cv-plain">
                {strengths.map((s) => (
                  <li key={s.title}>
                    <strong>{s.title}</strong>
                    <span>{s.tags.join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2>Skills</h2>
              {toolkit.map((g) => (
                <p className="cv-skill" key={g.group}>
                  <strong>{g.group}:</strong> {g.items.map((i) => i.name).join(', ')}
                </p>
              ))}
            </section>
            <section>
              <h2>Projects</h2>
              <ul className="cv-plain">
                {shipped.map((p) => (
                  <li key={p.slug}>
                    <strong>{p.title}</strong>
                    <span>{p.tagline}</span>
                    <span className="cv-link">{(p.live || p.repo)?.replace(/^https:\/\//, '')}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2>Education</h2>
              <p className="cv-skill">
                <strong>{edu.role}</strong>
                <br />
                {edu.org}, {edu.when}
                <br />
                CGPA 9.3 / 10
              </p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
