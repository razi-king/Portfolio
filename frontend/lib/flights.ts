/**
 * Flight network shown on the globe, plus a tiny store shared by the 3D scene
 * and the page. Plain data, no three.js, so the page can import it cheaply.
 */
import { useSyncExternalStore } from 'react'

export interface City {
  name: string
  code: string
  country: string
  lat: number
  lon: number
  /** How this place connects to my work, shown when the route is selected. */
  related: string
}

export const HUB = { name: 'Mumbai', code: 'BOM', country: 'India', lat: 19.07, lon: 72.88 }

const AGGREGATOR = 'Bookable through supplier APIs like TripJack, whose full booking flow I integrated in Go.'
const AKASA = 'Akasa Air flies this route from Mumbai. I fixed its integration defects and took it through QA sign-off.'

/** Flown roughly in this order, always departing Mumbai. */
export const DESTINATIONS: City[] = [
  { name: 'Dubai', code: 'DXB', country: 'UAE', lat: 25.2, lon: 55.27, related: AGGREGATOR },
  { name: 'Jeddah', code: 'JED', country: 'Saudi Arabia', lat: 21.49, lon: 39.19, related: AKASA },
  { name: 'Singapore', code: 'SIN', country: 'Singapore', lat: 1.35, lon: 103.82, related: AGGREGATOR },
  { name: 'London', code: 'LHR', country: 'United Kingdom', lat: 51.5, lon: -0.12, related: AGGREGATOR },
  { name: 'Muscat', code: 'MCT', country: 'Oman', lat: 23.59, lon: 58.41, related: 'Home of SalamAir, one of three airline integrations I maintain in production.' },
  { name: 'Almaty', code: 'ALA', country: 'Kazakhstan', lat: 43.24, lon: 76.95, related: 'Home of FlyArystan, one of three airline integrations I maintain in production.' },
  { name: 'Riyadh', code: 'RUH', country: 'Saudi Arabia', lat: 24.71, lon: 46.68, related: AKASA },
  { name: 'Paris', code: 'CDG', country: 'France', lat: 48.86, lon: 2.35, related: 'Home of ASL Airlines France, one of three airline integrations I maintain in production.' },
  { name: 'Nairobi', code: 'NBO', country: 'Kenya', lat: -1.29, lon: 36.82, related: AGGREGATOR },
  { name: 'Delhi', code: 'DEL', country: 'India', lat: 28.61, lon: 77.21, related: AKASA },
  { name: 'Bengaluru', code: 'BLR', country: 'India', lat: 12.97, lon: 77.59, related: AKASA },
]

const rad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Rough block time: cruise at 820 km/h plus 30 min taxi and climb. */
export function flightTime(km: number) {
  const mins = Math.round((km / 820) * 60 + 30)
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
}

export const ROUTE_KM = DESTINATIONS.map((d) => distanceKm(HUB, d))

export type Phase = 'boarding' | 'airborne' | 'arrived'

/** One plane's current leg. */
export interface FlightState {
  plane: number
  leg: number
  phase: Phase
  to: City
  km: number
  time: string
  flight: string
}

export function legState(leg: number, phase: Phase, plane = 0): FlightState {
  const i = ((leg % DESTINATIONS.length) + DESTINATIONS.length) % DESTINATIONS.length
  return {
    plane,
    leg: i,
    phase,
    to: DESTINATIONS[i],
    km: Math.round(ROUTE_KM[i]),
    time: flightTime(ROUTE_KM[i]),
    flight: `RK ${101 + i * 7}`,
  }
}

/* ------------------------------------------------------------------ store */

export const PLANES = 3

export interface Snapshot {
  /** planes[0] is the lead flight: the globe follows it and it flies the selected route. */
  planes: FlightState[]
  selected: string | null
  hover: string | null
}

let snap: Snapshot = {
  planes: [legState(0, 'boarding', 0), legState(3, 'boarding', 1), legState(7, 'boarding', 2)],
  selected: null,
  hover: null,
}
const subs = new Set<() => void>()

export const flightStore = {
  get: () => snap,
  set(patch: Partial<Snapshot>) {
    snap = { ...snap, ...patch }
    subs.forEach((f) => f())
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
}

export function useFlights() {
  return useSyncExternalStore(flightStore.subscribe, flightStore.get, flightStore.get)
}

/** Pick a route by IATA code (null goes back to autopilot). Picking the same one again clears it. */
export function selectRoute(code: string | null) {
  flightStore.set({ selected: code && code === snap.selected ? null : code })
}

export function hoverRoute(code: string | null) {
  if (snap.hover !== code) flightStore.set({ hover: code })
}
