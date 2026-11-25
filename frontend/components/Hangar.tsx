'use client'

import { useState } from 'react'
import { categoryLabel, projects, type Category, type Project } from '@/lib/content'
import { StatusPill } from './StatusPill'
import { SectionHead } from './Sections'

type Filter = 'all' | Category
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fullstack', label: 'Full-stack' },
  { id: 'frontend', label: 'Frontend' },
]

function ProjectCard({ p }: { p: Project }) {
  return (
    <article className={`project spot hud${p.featured ? ' project-featured' : ''}`}>
      <div className="project-top">
        <span className="project-cat">{categoryLabel[p.category]}</span>
        <StatusPill status={p.status} />
      </div>
      <h3>{p.title}</h3>
      <p className="project-tagline">{p.tagline}</p>
      <p className="project-desc">{p.description}</p>
      <ul className="project-highlights">
        {p.highlights.map((h) => <li key={h}>{h}</li>)}
      </ul>
      <ul className="stack" aria-label="Tech stack">
        {p.stack.map((s) => <li key={s}>{s}</li>)}
      </ul>
      <div className="project-links">
        {p.live && (
          <a className="btn btn-primary btn-sm" href={p.live} target="_blank" rel="noopener noreferrer">Open live site</a>
        )}
        {p.repo && (
          <a className="btn btn-ghost btn-sm" href={p.repo} target="_blank" rel="noopener noreferrer">View code</a>
        )}
        {!p.live && !p.repo && <span className="muted">Code goes public when the first release ships.</span>}
      </div>
    </article>
  )
}

export default function Hangar() {
  const [filter, setFilter] = useState<Filter>('all')
  const shown = projects.filter((p) => filter === 'all' || p.category === filter)

  return (
    <section className="section" id="hangar" aria-labelledby="hangar-title">
      <SectionHead n="02" label="Hangar" title="The hangar" id="hangar-title">
        Everything I&apos;ve built on my own time, with live demos where they&apos;re deployed.
      </SectionHead>
      <div className="filters" role="group" aria-label="Filter projects" data-reveal>
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className={`projects${filter === 'all' ? '' : ' filtered'}`} data-reveal>
        {shown.map((p) => <ProjectCard key={p.slug} p={p} />)}
      </div>
    </section>
  )
}
