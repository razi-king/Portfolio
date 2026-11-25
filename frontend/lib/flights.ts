/** Flight network shown on the globe. Plain data, no three.js, so the page can import it too. */

export interface City {
  name: string
  code: string
  country: string
  lat: number
  lon: number
}

export const HUB: City = { name: 'Mumbai', code: 'BOM', country: 'India', lat: 19.07, lon: 72.88 }

/** Flown in this order, one leg at a time, always departing Mumbai. */
export const DESTINATIONS: City[] = [
  { name: 'Dubai', code: 'DXB', country: 'UAE', lat: 25.2, lon: 55.27 },
  { name: 'Jeddah', code: 'JED', country: 'Saudi Arabia', lat: 21.49, lon: 39.19 },
  { name: 'Singapore', code: 'SIN', country: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'London', code: 'LHR', country: 'United Kingdom', lat: 51.5, lon: -0.12 },
  { name: 'Muscat', code: 'MCT', country: 'Oman', lat: 23.59, lon: 58.41 },
  { name: 'Almaty', code: 'ALA', country: 'Kazakhstan', lat: 43.24, lon: 76.95 },
  { name: 'Riyadh', code: 'RUH', country: 'Saudi Arabia', lat: 24.71, lon: 46.68 },
  { name: 'Paris', code: 'CDG', country: 'France', lat: 48.86, lon: 2.35 },
  { name: 'Nairobi', code: 'NBO', country: 'Kenya', lat: -1.29, lon: 36.82 },
  { name: 'Delhi', code: 'DEL', country: 'India', lat: 28.61, lon: 77.21 },
  { name: 'Bengaluru', code: 'BLR', country: 'India', lat: 12.97, lon: 77.59 },
]

const rad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in km. */
export function distanceKm(a: City, b: City) {
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

/** What the globe is doing right now, broadcast to the page as a window event. */
export interface FlightState {
  leg: number
  phase: 'boarding' | 'airborne' | 'arrived'
  from: City
  to: City
  km: number
  time: string
  flight: string
}

export const FLIGHT_EVENT = 'rk:flight'

export function legState(leg: number, phase: FlightState['phase']): FlightState {
  const i = leg % DESTINATIONS.length
  const to = DESTINATIONS[i]
  const km = distanceKm(HUB, to)
  return { leg: i, phase, from: HUB, to, km: Math.round(km), time: flightTime(km), flight: `RK ${101 + i * 7}` }
}
