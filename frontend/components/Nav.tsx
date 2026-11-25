'use client'

import { useEffect, useState } from 'react'

const LINKS = [
  { id: 'routes', label: 'Work', n: '01' },
  { id: 'hangar', label: 'Projects', n: '02' },
  { id: 'journey', label: 'Journey', n: '03' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    for (const id of [...LINKS.map((l) => l.id), 'contact', 'top']) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => {
      window.removeEventListener('scroll', onScroll)
      io.disconnect()
    }
  }, [])

  // Lock page scroll and close on Escape while the mobile menu is open.
  useEffect(() => {
    document.body.classList.toggle('menu-open', open)
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)

  return (
    <header className={`nav${scrolled ? ' nav-scrolled' : ''}${open ? ' nav-open' : ''}`}>
      <div className="nav-bar">
        <a className="brand" href="#top" aria-label="Razi King, home" onClick={close}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z" />
            </svg>
          </span>
          <span>Razi King</span>
        </a>
        <nav aria-label="Sections" id="site-menu" className="nav-links">
          {LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={close} aria-current={active === l.id ? 'true' : undefined}>
              <span className="nav-n">{l.n}</span>
              {l.label}
            </a>
          ))}
          <a href="#contact" className="nav-cta" onClick={close}>
            <span className="nav-n">04</span>
            Contact
          </a>
        </nav>
        <button
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  )
}
