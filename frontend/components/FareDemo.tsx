'use client'

import { useEffect, useState, type FormEvent } from 'react'
import sampleJson from '@/lib/fare-sample.json'
import { API_URL } from '@/lib/content'
import { DESTINATIONS, HUB } from '@/lib/flights'
import { SectionHead } from './Sections'

/* ------------------------------------------------------------------ API types (mirror backend/internal/fares) */

interface Offer {
  id: string
  supplier: string
  carrier: string
  flight: string
  brand: string
  from: string
  to: string
  date: string
  depart: string
  arrive: string
  durationMin: number
  base: number
  taxes: number
  total: number
  currency: string
}
interface Itinerary {
  outbound: Offer
  return?: Offer
  total: number
}
interface Call {
  leg: string
  supplier: string
  ms: number
  offers: number
  error?: string
}
interface SearchResult {
  itineraries: Itinerary[]
  calls: Call[]
  wallMs: number
  sequentialMs: number
  matched: number
}
interface Reval {
  status: 'confirmed' | 'price_changed'
  path: 'native' | 'cached'
  supplier: string
  previous: number
  current: number
  message: string
}
interface Sample {
  request: { from: string; to: string; date: string; return: string }
  search: SearchResult
  revalidations: Record<string, Reval>
}
const sample = sampleJson as unknown as Sample

type RevalState = { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; legs: Reval[]; accepted?: boolean }

/* ------------------------------------------------------------------ helpers */

const AIRPORTS = [HUB, ...DESTINATIONS].map((a) => ({ code: a.code, name: a.name }))
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dur = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`

function isoIn(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function call<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 9000)
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: ctl.signal })
    const body = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, data: body as T }
    return { ok: false, status: res.status, message: (body as { message?: string }).message ?? 'The request failed.' }
  } catch {
    return { ok: false, status: 0, message: 'network' }
  } finally {
    clearTimeout(timer)
  }
}

const SLEEPING =
  'The live Go API is asleep (free hosting spins down when idle), so this is a response recorded from the same code. Try again in about 30 seconds for a live run.'
const NO_API = 'This copy of the site has no API configured, so it replays a response recorded from the Go service.'

/* ------------------------------------------------------------------ component */

export default function FareDemo() {
  const [from, setFrom] = useState('BOM')
  const [to, setTo] = useState('DXB')
  const [roundTrip, setRoundTrip] = useState(true)
  const [date, setDate] = useState('')
  const [ret, setRet] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [source, setSource] = useState<'live' | 'sample'>('live')
  const [note, setNote] = useState('')
  const [reval, setReval] = useState<Record<string, RevalState>>({})

  // dates depend on "today", so set them after mount to avoid a hydration mismatch
  useEffect(() => {
    setDate(isoIn(21))
    setRet(isoIn(28))
    if (API_URL) fetch(`${API_URL}/healthz`).catch(() => {}) // wake a sleeping free-tier API early
  }, [])

  function showSample(why: string) {
    setFrom(sample.request.from)
    setTo(sample.request.to)
    setRoundTrip(true)
    setDate(sample.request.date)
    setRet(sample.request.return)
    setResult(sample.search)
    setSource('sample')
    setNote(why)
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault()
    setError('')
    setReval({})
    if (from === to) {
      setError('Pick two different airports.')
      return
    }
    setBusy(true)
    if (!API_URL) {
      await new Promise((r) => setTimeout(r, 500))
      showSample(NO_API)
      setBusy(false)
      return
    }
    const q = new URLSearchParams({ from, to, date })
    if (roundTrip) q.set('return', ret)
    const res = await call<SearchResult>(`/api/fares/search?${q}`)
    setBusy(false)
    if (res.ok) {
      setResult(res.data)
      setSource('live')
      setNote('')
    } else if (res.status === 422 || res.status === 429) {
      setError(res.message)
    } else {
      showSample(SLEEPING)
    }
  }

  async function revalidate(it: Itinerary) {
    const key = it.outbound.id
    setReval((r) => ({ ...r, [key]: { state: 'loading' } }))
    const ids = [it.outbound.id, ...(it.return ? [it.return.id] : [])]

    if (source === 'sample') {
      await new Promise((r) => setTimeout(r, 450))
      const legs = ids.map((id) => sample.revalidations[id]).filter(Boolean)
      setReval((r) => ({ ...r, [key]: { state: 'done', legs } }))
      return
    }
    // both legs are revalidated in parallel, like the search
    const results = await Promise.all(
      ids.map((id) =>
        call<Reval>('/api/fares/revalidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        }),
      ),
    )
    const bad = results.find((x) => !x.ok)
    if (bad && !bad.ok) {
      const message = bad.status === 410 ? 'This offer expired. Search again for fresh fares.' : bad.status === 0 ? 'The API did not answer. Try again.' : bad.message
      setReval((r) => ({ ...r, [key]: { state: 'error', message } }))
      return
    }
    setReval((r) => ({ ...r, [key]: { state: 'done', legs: results.map((x) => (x as { data: Reval }).data) } }))
  }

  const maxMs = result ? Math.max(result.sequentialMs, 1) : 1
  const speedup = result && result.wallMs > 0 ? result.sequentialMs / result.wallMs : 0

  return (
    <section className="section" id="demo" aria-labelledby="demo-title">
      <SectionHead n="03" label="Live demo" title="Search fares on my Go API" id="demo-title">
        A small version of what I build at work, running on this site&apos;s Go backend. Suppliers and airlines are
        fictional; the engineering is real: parallel supplier calls, hashmap matching, and a price check before booking.
      </SectionHead>

      <div className="demo hud" data-reveal>
        <form className="demo-form" onSubmit={onSearch}>
          <div className="demo-trip" role="radiogroup" aria-label="Trip type">
            <button type="button" role="radio" aria-checked={roundTrip} onClick={() => setRoundTrip(true)}>
              Return
            </button>
            <button type="button" role="radio" aria-checked={!roundTrip} onClick={() => setRoundTrip(false)}>
              One way
            </button>
          </div>
          <label className="demo-field">
            <span>From</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {AIRPORTS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="demo-swap"
            aria-label="Swap airports"
            onClick={() => {
              setFrom(to)
              setTo(from)
            }}
          >
            ⇄
          </button>
          <label className="demo-field">
            <span>To</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {AIRPORTS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="demo-field">
            <span>Depart</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          {roundTrip && (
            <label className="demo-field">
              <span>Return</span>
              <input type="date" value={ret} min={date} onChange={(e) => setRet(e.target.value)} required />
            </label>
          )}
          <button className="btn btn-primary demo-go" type="submit" disabled={busy}>
            {busy ? 'Searching…' : 'Search fares'}
          </button>
        </form>

        <div className="demo-status" role="status" aria-live="polite">
          {error && <p className="demo-error">{error}</p>}
          {note && (
            <p className="demo-note">
              <span>Recorded</span> {note}
            </p>
          )}
          {busy && <p className="demo-wait">Calling suppliers in parallel…</p>}
        </div>

        {!result && !busy && (
          <p className="demo-empty">
            Pick a route and search. The response shows each supplier call, how long it took, and how the return trip was
            assembled.
          </p>
        )}

        {result && (
          <div className="demo-out">
            {/* ---- how the search ran */}
            <div className="trace">
              <div className="trace-head">
                <h3>How the search ran</h3>
                {source === 'live' && <span className="trace-live">● live response</span>}
              </div>
              <ul className="trace-calls">
                {result.calls.map((c) => (
                  <li key={c.leg + c.supplier}>
                    <span className="trace-name">
                      {c.leg} <small>{c.supplier}</small>
                    </span>
                    <span className="trace-bar">
                      <i style={{ width: `${(c.ms / maxMs) * 100}%` }} className={c.error ? 'trace-fail' : undefined} />
                    </span>
                    <span className="trace-ms">{c.error ? 'failed' : `${c.ms} ms`}</span>
                  </li>
                ))}
              </ul>
              <div className="trace-sum">
                <div>
                  <span>In parallel (goroutines)</span>
                  <span className="trace-bar">
                    <i className="trace-fast" style={{ width: `${(result.wallMs / maxMs) * 100}%` }} />
                  </span>
                  <strong>{result.wallMs} ms</strong>
                </div>
                <div>
                  <span>One after another</span>
                  <span className="trace-bar">
                    <i className="trace-slow" style={{ width: '100%' }} />
                  </span>
                  <strong>{result.sequentialMs} ms</strong>
                </div>
              </div>
              <p className="trace-foot">
                {result.calls.length} one-way supplier calls ran at once through a panic-safe <code>safeGo()</code> wrapper,{' '}
                <strong>{speedup.toFixed(1)}× faster</strong> than calling them in turn.
                {result.matched > 0 && (
                  <>
                    {' '}
                    Outbound and return fares were paired with a hashmap in <code>O(n+m)</code>: {result.matched} round trips.
                  </>
                )}
              </p>
            </div>

            {/* ---- offers */}
            <ol className="offers">
              {result.itineraries.map((it) => {
                const r = reval[it.outbound.id]
                const legs = [it.outbound, ...(it.return ? [it.return] : [])]
                return (
                  <li className="offer" key={it.outbound.id}>
                    <div className="offer-main">
                      <div className="offer-carrier">
                        <strong>{it.outbound.carrier}</strong>
                        <span>
                          {it.outbound.brand} · via {it.outbound.supplier}
                        </span>
                      </div>
                      <div className="offer-legs">
                        {legs.map((o) => (
                          <div className="offer-leg" key={o.id}>
                            <span className="offer-flight">{o.flight}</span>
                            <span className="offer-time">
                              {o.depart} <b>{o.from}</b>
                            </span>
                            <span className="offer-dur">{dur(o.durationMin)}</span>
                            <span className="offer-time">
                              {o.arrive} <b>{o.to}</b>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="offer-price">
                        <strong>{inr.format(it.total)}</strong>
                        <button className="btn btn-ghost btn-sm" onClick={() => revalidate(it)} disabled={r?.state === 'loading'}>
                          {r?.state === 'loading' ? 'Checking…' : 'Check price & book'}
                        </button>
                      </div>
                    </div>
                    {r && r.state !== 'loading' && <RevalPanel r={r} total={it.total} onAccept={() => setReval((x) => ({ ...x, [it.outbound.id]: { ...(r as { state: 'done'; legs: Reval[] }), accepted: true } }))} />}
                  </li>
                )
              })}
            </ol>

            <details className="demo-code">
              <summary>See the Go behind it</summary>
              <pre>
                <code>{GO_SNIPPET}</code>
              </pre>
            </details>
          </div>
        )}
      </div>
    </section>
  )
}

function RevalPanel({ r, total, onAccept }: { r: RevalState; total: number; onAccept: () => void }) {
  if (r.state === 'error') return <p className="reval reval-error">{r.message}</p>
  if (r.state !== 'done') return null
  const changed = r.legs.some((l) => l.status === 'price_changed')
  const now = r.legs.reduce((s, l) => s + l.current, 0)
  return (
    <div className={`reval ${changed ? 'reval-changed' : 'reval-ok'}`}>
      <ul className="reval-legs">
        {r.legs.map((l, i) => (
          <li key={i}>
            <span className={`reval-tag reval-${l.path}`}>{l.path === 'native' ? 'Supplier API' : 'Cached snapshot'}</span>
            {l.status === 'price_changed' ? `${inr.format(l.previous)} → ${inr.format(l.current)}` : `${inr.format(l.current)} confirmed`}
            <small>{l.message}</small>
          </li>
        ))}
      </ul>
      {changed ? (
        r.accepted ? (
          <p className="reval-verdict">
            ✓ Traveller accepted {inr.format(now)}. Now the booking can be written, at the confirmed price.
          </p>
        ) : (
          <p className="reval-verdict">
            ⚠ Fare went from {inr.format(total)} to {inr.format(now)}. Nothing was booked at the old price.{' '}
            <button className="link-btn" onClick={onAccept}>
              Accept new fare
            </button>
          </p>
        )
      ) : (
        <p className="reval-verdict">✓ Price confirmed at {inr.format(now)}. Safe to create the booking.</p>
      )}
    </div>
  )
}

const GO_SNIPPET = `// Fan every leg out to every capable supplier, in parallel.
for i, j := range jobs {
    results[i] = outcome{err: errIncomplete} // stays if the call panics
    wg.Add(1)
    safego.Go("fare-search:"+j.supplier.Name(), func() {
        defer wg.Done()
        offers, err := j.supplier.Search(ctx, j.leg)
        results[i] = outcome{offers: offers, err: err}
    }, nil)
}
wg.Wait()

// Pair outbound and return offers: index once, look up once. O(n+m).
cheapest := make(map[string]Offer, len(inbound))
for _, r := range inbound {
    if c, ok := cheapest[matchKey(r)]; !ok || r.Total < c.Total {
        cheapest[matchKey(r)] = r
    }
}
for _, o := range outbound {
    if r, ok := cheapest[matchKey(o)]; ok {
        out = append(out, Itinerary{Outbound: o, Return: &r, Total: o.Total + r.Total})
    }
}`
