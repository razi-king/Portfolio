'use client'

import { DESTINATIONS, HUB, useFlights, type FlightState } from '@/lib/flights'
import { labelRefs } from './labels'

const PHASE_TAG: Record<FlightState['phase'], string> = { boarding: 'Next stop', airborne: 'Inbound', arrived: 'Arrived' }

function Card({ s, selected }: { s: FlightState; selected: boolean }) {
  const head = selected
    ? `Selected route · ${s.phase === 'airborne' ? 'in flight' : s.phase === 'arrived' ? 'arrived' : 'boarding'}`
    : `Arrived · ${s.flight}`
  return (
    <div className={`geo-card${selected ? ' geo-card-selected' : ''}`} key={`${selected ? 's' : 'a'}${s.leg}`}>
      <div className="geo-card-top">
        <span className="geo-live" /> {head}
      </div>
      <div className="geo-card-city">{s.to.name}</div>
      <div className="geo-card-country">
        {s.to.country} · {s.to.code}
      </div>
      <div className="geo-card-meta">
        <span>
          {HUB.code} → {s.to.code}
        </span>
        <span>{s.km.toLocaleString('en-IN')} km</span>
        <span>{s.time}</span>
      </div>
      {selected && <p className="geo-card-note">{s.to.related}</p>}
    </div>
  )
}

/** Popups pinned to the globe. Positions are written by the Globe each frame. */
export default function GlobeLabels() {
  const { planes, selected, hover } = useFlights()
  const lead = planes[0]
  const status = lead.phase === 'boarding' ? `Boarding ${lead.flight}` : `${planes.filter((p) => p.phase === 'airborne').length} in the air`
  const hovered = hover ? DESTINATIONS.find((d) => d.code === hover) : undefined
  const hoverShown = hovered && planes.some((p) => p.to.code === hovered.code)

  return (
    <div className="geo-layer">
      <div ref={(el) => void (labelRefs.hub = el)} className="geo-anchor" data-side="right">
        <div className="geo-tag geo-hub">
          <span className="geo-dot" />
          <span className="geo-code">{HUB.code}</span>
          <span className="geo-name">{HUB.name}</span>
          <span className="geo-sub">{status}</span>
        </div>
      </div>

      {planes.map((p, i) => {
        const isSelected = i === 0 && selected === p.to.code
        const big = i === 0 && (isSelected || p.phase === 'arrived')
        return (
          <div
            key={i}
            ref={(el) => void (labelRefs.dest[i] = el)}
            className={`geo-anchor${i === 0 ? ' geo-anchor-lead' : ''}`}
            data-side="right"
          >
            {big ? (
              <Card s={p} selected={isSelected} />
            ) : (
              <div className={`geo-tag geo-next${i > 0 ? ' geo-minor' : ''}`} key={`${p.leg}${p.phase}`}>
                <span className="geo-dot" />
                <span className="geo-code">{p.to.code}</span>
                <span className="geo-sub">{i === 0 ? PHASE_TAG[p.phase] : p.phase === 'arrived' ? 'Landed' : p.flight}</span>
              </div>
            )}
          </div>
        )
      })}

      <div ref={(el) => void (labelRefs.hover = el)} className="geo-anchor geo-anchor-hover" data-side="right">
        {hovered && !hoverShown && (
          <div className="geo-tag geo-hover">
            <span className="geo-dot" />
            <span className="geo-code">{hovered.code}</span>
            <span className="geo-name">{hovered.name}</span>
            <span className="geo-sub">Click to fly</span>
          </div>
        )}
      </div>
    </div>
  )
}
