'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SectionHead } from './Sections'
import { API_URL as SITE_API, BASE_PATH, RESUME_URL } from '@/lib/content'

const API_URL = SITE_API
const EMAIL = 'raziinsane@gmail.com'

type Field = 'name' | 'email' | 'subject' | 'message'
type Errors = Partial<Record<Field, string>>
type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string }
  | { kind: 'offline' }

function validate(d: Record<Field, string>): Errors {
  const e: Errors = {}
  if (!d.name.trim()) e.name = 'Name is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'Email address is not valid.'
  if (d.message.trim().length < 10) e.message = 'Message must be at least 10 characters.'
  return e
}

export default function ContactForm() {
  const [errors, setErrors] = useState<Errors>({})
  const [state, setState] = useState<State>({ kind: 'idle' })
  const form = useRef<HTMLFormElement>(null)

  // Wake a sleeping free-tier API early so the form is fast by the time someone uses it.
  useEffect(() => {
    if (API_URL) fetch(`${API_URL}/healthz`).catch(() => {})
  }, [])

  function focusFirst(errs: Errors) {
    const first = (['name', 'email', 'subject', 'message'] as Field[]).find((f) => errs[f])
    if (first) (form.current?.elements.namedItem(first) as HTMLElement | null)?.focus()
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const data = {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      subject: String(fd.get('subject') ?? ''),
      message: String(fd.get('message') ?? ''),
      website: String(fd.get('website') ?? ''), // honeypot
    }
    const errs = validate(data)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setState({ kind: 'error', message: 'Please fix the highlighted fields.' })
      focusFirst(errs)
      return
    }

    if (!API_URL) {
      const body = encodeURIComponent(`${data.message}\n\n${data.name}`)
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(data.subject || 'Hello from your portfolio')}&body=${body}`
      setState({ kind: 'sent', email: data.email })
      return
    }

    setState({ kind: 'sending' })
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 202) {
        form.current?.reset()
        setErrors({})
        setState({ kind: 'sent', email: data.email })
      } else if (res.status === 422) {
        setErrors(json.fields ?? {})
        setState({ kind: 'error', message: json.message ?? 'Please fix the highlighted fields.' })
        focusFirst(json.fields ?? {})
      } else if (res.status === 429) {
        setState({ kind: 'error', message: 'Too many messages from this network. Try again in a minute.' })
      } else {
        setState({ kind: 'offline' })
      }
    } catch {
      setState({ kind: 'offline' })
    }
  }

  const field = (name: Field, label: React.ReactNode, input: React.ReactElement, wide = false) => (
    <div className={`field${wide ? ' field-wide' : ''}`}>
      <label htmlFor={`f-${name}`}>{label}</label>
      {input}
      <p className="field-error" id={`e-${name}`}>{errors[name]}</p>
    </div>
  )
  const aria = (name: Field) => ({
    id: `f-${name}`,
    name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `e-${name}` : undefined,
  })

  return (
    <section className="section contact" id="contact" aria-labelledby="contact-title">
      <SectionHead n="06" label="Contact" title="Hiring for a Go backend role?" id="contact-title">
        I&apos;m open to backend engineering roles in Go, on-site in Mumbai or remote. Send a message and I&apos;ll reply
        within a day. It travels through my Go API and a RabbitMQ queue to my inbox.
      </SectionHead>
      <ul className="contact-links" data-reveal>
        <li>
          <a href="mailto:raziinsane@gmail.com"><span>Email</span>raziinsane@gmail.com</a>
        </li>
        <li>
          <a href="https://www.linkedin.com/in/razi-ahmed-8s/" target="_blank" rel="noopener noreferrer"><span>LinkedIn</span>razi-ahmed-8s</a>
        </li>
        <li>
          <a href="https://github.com/razi-king" target="_blank" rel="noopener noreferrer"><span>GitHub</span>razi-king</a>
        </li>
        <li>
          {RESUME_URL ? (
            <a href={RESUME_URL} download="Razi_Ahmed_Resume.pdf"><span>Résumé</span>Download PDF</a>
          ) : (
            <a href={`${BASE_PATH}/recruiter/`}><span>One-pager</span>Recruiter summary</a>
          )}
        </li>
      </ul>
      <form className="form hud" data-reveal ref={form} onSubmit={onSubmit} noValidate>
        {field('name', 'Your name', <input {...aria('name')} autoComplete="name" required maxLength={80} />)}
        {field('email', 'Email', <input {...aria('email')} type="email" autoComplete="email" required />)}
        {field('subject', <>Subject <span className="optional">(optional)</span></>, <input {...aria('subject')} maxLength={120} />, true)}
        {field('message', 'Message', <textarea {...aria('message')} rows={5} required maxLength={4000} />, true)}
        <div className="hp" aria-hidden="true">
          <label htmlFor="f-website">Website</label>
          <input id="f-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="form-foot field-wide">
          <button className="btn btn-primary" type="submit" disabled={state.kind === 'sending'}>
            Send message
          </button>
          <p
            className={`form-status${state.kind === 'sent' ? ' ok' : state.kind === 'error' || state.kind === 'offline' ? ' error' : ''}`}
            role="status"
            aria-live="polite"
          >
            {state.kind === 'sending' && 'Sending…'}
            {state.kind === 'sent' && (API_URL ? `Message sent. I'll reply to ${state.email}.` : 'Opening your email app.')}
            {state.kind === 'error' && state.message}
            {state.kind === 'offline' && (
              <>Message not sent: the server didn&apos;t respond. Email me at <a href={`mailto:${EMAIL}`}>{EMAIL}</a> instead.</>
            )}
          </p>
        </div>
      </form>
    </section>
  )
}
