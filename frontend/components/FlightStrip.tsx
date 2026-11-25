'use client'

import { useEffect, useState } from 'react'
import { FLIGHT_EVENT, legState, type FlightState } from '@/lib/flights'

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

/** Live readout of the flight currently on the globe, plus Mumbai local time. */
export default function FlightStrip() {
  const [s, setS] = useState<FlightState>(() => legState(0, 'boarding'))
  const [clock, setClock] = useState('--:--:--')

  useEffect(() => {
    const last = (window as unknown as { __rkFlight?: FlightState }).__rkFlight
    if (last) setS(last)
    const on = (e: Event) => setS((e as CustomEvent<FlightState>).detail)
    window.addEventListener(FLIGHT_EVENT, on)
    setClock(mumbaiTime())
    const id = setInterval(() => setClock(mumbaiTime()), 1000)
    return () => {
      window.removeEventListener(FLIGHT_EVENT, on)
      clearInterval(id)
    }
  }, [])

  return (
    <div className="strip hud" aria-label="Live flight on the globe">
      <div className="strip-cell">
        <span className="strip-k">Flight</span>
        <span className="strip-v">{s.flight}</span>
      </div>
      <div className="strip-cell strip-route">
        <span className="strip-k">Route</span>
        <span className="strip-v">
          {s.from.code}
          <span className={`strip-plane strip-${s.phase}`} aria-hidden="true">
            <i />
            <svg viewBox="0 0 24 24">
              <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
            </svg>
          </span>
          {s.to.code}
        </span>
        <span className="strip-city">
          {s.from.name} → {s.to.name}, {s.to.country}
        </span>
      </div>
      <div className="strip-cell">
        <span className="strip-k">Status</span>
        <span className={`strip-v strip-status strip-${s.phase}`}>{PHASE[s.phase]}</span>
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
  )
}
