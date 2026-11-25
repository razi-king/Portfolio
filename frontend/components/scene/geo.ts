import * as THREE from 'three'

export { HUB, DESTINATIONS, FLIGHT_EVENT, legState, type City, type FlightState } from '@/lib/flights'

export const GOLD = new THREE.Color('#F2C14E')
export const AMETHYST = new THREE.Color('#8B5CFF')
export const CYAN = new THREE.Color('#5EF0FF')
export const R = 1.6

/** Latitude/longitude in degrees → point on a sphere of radius r. */
export function toVec(lat: number, lon: number, r = R) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}
