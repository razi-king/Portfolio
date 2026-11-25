'use client'

import { useEffect } from 'react'

/**
 * Page-wide effects with no markup of their own:
 * - elements with [data-reveal] fade up the first time they scroll into view
 * - elements with .spot get a glow that follows the mouse (--mx / --my)
 * Content stays visible if this never runs.
 */
export default function Fx() {
  useEffect(() => {
    const root = document.documentElement
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let io: IntersectionObserver | undefined
    if (!reduced && 'IntersectionObserver' in window) {
      root.classList.add('fx-reveal')
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue
            e.target.classList.add('in')
            io?.unobserve(e.target)
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
      )
      document.querySelectorAll('[data-reveal]').forEach((el) => io!.observe(el))
    }

    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.spot') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    return () => {
      io?.disconnect()
      root.classList.remove('fx-reveal')
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return null
}
