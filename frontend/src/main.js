import '@fontsource/unbounded/latin-600.css'
import '@fontsource/unbounded/latin-800.css'
import '@fontsource/instrument-sans/latin-400.css'
import '@fontsource/instrument-sans/latin-500.css'
import '@fontsource/instrument-sans/latin-600.css'
import './style.css'
import projects from '@projects'
import { board, statusLabel, timeline, toolkit } from './content.js'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------------------------------------------------------------- 3D scene
// Loaded lazily so text paints first; falls back to the CSS backdrop without WebGL.
;(async () => {
  const canvas = document.getElementById('scene')
  const { supportsWebGL, startScene } = await import('./scene.js')
  if (!supportsWebGL()) {
    document.body.classList.add('no-webgl')
    return
  }
  startScene(canvas, { reducedMotion })
  requestAnimationFrame(() => canvas.classList.add('ready'))
  setTimeout(() => canvas.classList.add('settled'), 1700)
  // Past the hero, the globe dims so text stays readable on top of it.
  const dim = () => {
    const k = Math.min(1, Math.max(0, (window.scrollY - window.innerHeight * 0.45) / (window.innerHeight * 0.6)))
    canvas.style.setProperty('--scene-dim', String(1 - k * 0.72))
  }
  window.addEventListener('scroll', dim, { passive: true })
  dim()
})()

// ---------------------------------------------------------------- helpers
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') n.className = v
    else if (k === 'text') n.textContent = v
    else n.setAttribute(k, v === true ? '' : v)
  }
  for (const c of children.flat()) if (c != null) n.append(c)
  return n
}

const statusPill = (status) => el('span', { class: `status status-${status}` }, el('i', { 'aria-hidden': 'true' }), statusLabel[status] || status)

// ---------------------------------------------------------------- departure board
document.getElementById('board-rows').append(
  ...board.map((r) =>
    el('div', { class: 'board-row', role: 'row' },
      el('span', { class: 'board-carrier', role: 'cell' }, r.carrier, el('small', { text: r.stack })),
      el('span', { class: 'board-work', role: 'cell', text: r.work }),
      el('span', { class: 'board-status', role: 'cell' }, statusPill(r.status)),
    ),
  ),
)

// ---------------------------------------------------------------- projects
const projectsEl = document.getElementById('projects')
const categoryName = { fullstack: 'Full-stack', frontend: 'Frontend', backend: 'Backend' }

function projectCard(p) {
  const links = []
  if (p.live) links.push(el('a', { class: 'btn btn-gold btn-sm', href: p.live, target: '_blank', rel: 'noopener' }, 'Open live site'))
  if (p.repo) links.push(el('a', { class: 'btn btn-ghost btn-sm', href: p.repo, target: '_blank', rel: 'noopener' }, 'View code'))
  if (!links.length) links.push(el('span', { class: 'muted', text: 'Code goes public when the first release ships.' }))

  return el('article', { class: `project${p.featured ? ' project-featured' : ''}`, 'data-category': p.category },
    el('div', { class: 'project-top' },
      el('span', { class: 'project-cat', text: categoryName[p.category] || p.category }),
      statusPill(p.status),
    ),
    el('h3', { text: p.title }),
    el('p', { class: 'project-tagline', text: p.tagline }),
    el('p', { class: 'project-desc', text: p.description }),
    el('ul', { class: 'project-highlights' }, p.highlights.map((h) => el('li', { text: h }))),
    el('ul', { class: 'stack', 'aria-label': 'Tech stack' }, p.stack.map((s) => el('li', { text: s }))),
    el('div', { class: 'project-links' }, links),
  )
}

projectsEl.append(...projects.map(projectCard))

document.querySelectorAll('.chip').forEach((chip) =>
  chip.addEventListener('click', () => {
    const f = chip.dataset.filter
    document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)))
    projectsEl.querySelectorAll('.project').forEach((card) => {
      card.hidden = f !== 'all' && card.dataset.category !== f
    })
  }),
)

// ---------------------------------------------------------------- journey
document.getElementById('timeline').append(
  ...timeline.map((t) =>
    el('li', { class: 'tl-item' },
      el('p', { class: 'tl-when', text: t.when }),
      el('h3', {}, t.role, el('span', { class: 'tl-org', text: ` at ${t.org}` })),
      el('p', { class: 'tl-text', text: t.text }),
    ),
  ),
)

document.getElementById('toolkit').append(
  ...toolkit.map((g) =>
    el('div', { class: 'tk-group' },
      el('h3', { text: g.group }),
      el('ul', { class: 'stack' }, g.items.map((i) => el('li', { text: i }))),
    ),
  ),
)

// ---------------------------------------------------------------- contact form
const form = document.getElementById('contact-form')
const statusEl = document.getElementById('form-status')
const sendBtn = document.getElementById('send')
const fields = ['name', 'email', 'subject', 'message']

function showErrors(errs = {}) {
  for (const f of fields) {
    const input = form.elements[f]
    const msg = errs[f] || ''
    document.getElementById(`e-${f}`).textContent = msg
    input.setAttribute('aria-invalid', msg ? 'true' : 'false')
    if (msg) input.setAttribute('aria-describedby', `e-${f}`)
    else input.removeAttribute('aria-describedby')
  }
  const first = fields.find((f) => errs[f])
  if (first) form.elements[first].focus()
}

function clientValidate(d) {
  const e = {}
  if (!d.name.trim()) e.name = 'Name is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'Email address is not valid.'
  if (d.message.trim().length < 10) e.message = 'Message must be at least 10 characters.'
  return e
}

function setStatus(text, kind = '') {
  statusEl.textContent = text
  statusEl.className = `form-status ${kind}`
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault()
  const data = Object.fromEntries(fields.map((f) => [f, form.elements[f].value]))
  data.website = form.elements.website.value

  const errs = clientValidate(data)
  showErrors(errs)
  if (Object.keys(errs).length) {
    setStatus('Please fix the highlighted fields.', 'error')
    return
  }

  if (!API_URL) {
    const body = encodeURIComponent(`${data.message}\n\n${data.name}`)
    window.location.href = `mailto:raziinsane@gmail.com?subject=${encodeURIComponent(data.subject || 'Hello from your portfolio')}&body=${body}`
    setStatus('Opening your email app.', 'ok')
    return
  }

  sendBtn.disabled = true
  setStatus('Sending…')
  try {
    const res = await fetch(`${API_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json().catch(() => ({}))
    if (res.status === 202) {
      form.reset()
      showErrors()
      setStatus(`Message sent. I'll reply to ${data.email}.`, 'ok')
    } else if (res.status === 422) {
      showErrors(json.fields)
      setStatus(json.message || 'Please fix the highlighted fields.', 'error')
    } else if (res.status === 429) {
      setStatus('Too many messages from this network. Try again in a minute.', 'error')
    } else {
      throw new Error(json.message || `HTTP ${res.status}`)
    }
  } catch {
    // Free hosting may be waking up; give a direct route instead of a dead end.
    statusEl.className = 'form-status error'
    statusEl.replaceChildren('Message not sent: the server didn’t respond. Email me at ',
      el('a', { href: 'mailto:raziinsane@gmail.com', text: 'raziinsane@gmail.com' }), ' instead.')
  } finally {
    sendBtn.disabled = false
  }
})

// Wake a sleeping free-tier API early so the form is fast when someone reaches it.
if (API_URL) fetch(`${API_URL}/healthz`).catch(() => {})
