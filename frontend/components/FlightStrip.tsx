'use client'

import { useEffect, useState } from 'react'
import { DESTINATIONS, HUB, legState, selectRoute, useFlights, type FlightState } from '@/lib/flights'

const PHASE: Record<FlightState['phase'], string> = {
  boarding: 'Boarding',
  airborne: 'In flight',
  arrived: 'Arrived',
}

function mumbaiTime() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(
    new Date(),
  )
}

/** Live readout of the lead flight on the globe, plus a picker to choose a route. */
export default function FlightStrip() {
  const { planes, selected } = useFlights()
  const [clock, setClock] = useState('--:--:--')

  useEffect(() => {
    setClock(mumbaiTime())
    const id = setInterval(() => setClock(mumbaiTime()), 1000)
    return () => clearInterval(id)
  }, [])

  // The lead plane flies the selected route; until it switches over, show the pick as boarding.
  const lead = planes[0]
  const selIdx = selected ? DESTINATIONS.findIndex((d) => d.code === selected) : -1
  const s = selIdx >= 0 && lead.leg !== selIdx ? legState(selIdx, 'boarding') : lead
  const airborne = planes.filter((p) => p.phase === 'airborne').length

  return (
    <div className="strip-wrap">
      <div className="strip hud" aria-label="Live flight on the globe">
        <div className="strip-cell">
          <span className="strip-k">Flight</span>
          <span className="strip-v">{s.flight}</span>
          <span className="strip-city">{airborne} in the air</span>
        </div>
        <div className="strip-cell strip-route">
          <span className="strip-k">{selIdx >= 0 ? 'Selected route' : 'Route'}</span>
          <span className="strip-v">
            {HUB.code}
            <span className={`strip-plane strip-${s.phase}`} aria-hidden="true">
              <i />
              <svg viewBox="0 0 24 24">
                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
              </svg>
            </span>
            {s.to.code}
          </span>
          <span className="strip-city">
            {HUB.name} → {s.to.name}, {s.to.country}
          </span>
        </div>
        <div className="strip-cell">
          <span className="strip-k">Status</span>
          <span className={`strip-v strip-status strip-${s.phase}`}>{PHASE[s.phase]}</span>
          <span className="strip-city">{s.time}</span>
        </div>
        <div className="strip-cell strip-hide-sm">
          <span className="strip-k">Distance</span>
          <span className="strip-v">{s.km.toLocaleString('en-IN')} km</span>
        </div>
        <div className="strip-cell strip-hide-sm">
          <span className="strip-k">BOM local</span>
          <span className="strip-v" suppressHydrationWarning>
            {clock}
          </span>
        </div>
      </div>

      <div className="route-pick" role="group" aria-label="Pick a route to fly on the globe">
        <button className="route-chip route-auto" aria-pressed={!selected} onClick={() => selectRoute(null)}>
          <span className="route-dot" aria-hidden="true" />
          Auto
        </button>
        {DESTINATIONS.map((d) => (
          <button
            key={d.code}
            className="route-chip"
            aria-pressed={selected === d.code}
            aria-label={`Fly Mumbai to ${d.name}, ${d.country}`}
            title={`${d.name}, ${d.country}`}
            onClick={() => selectRoute(d.code)}
          >
            {d.code}
          </button>
        ))}
      </div>
    </div>
  )
}
