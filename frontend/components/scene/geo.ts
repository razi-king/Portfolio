import * as THREE from 'three'

export const GOLD = new THREE.Color('#F2C14E')
export const AMETHYST = new THREE.Color('#A77BFF')
export const CYAN = new THREE.Color('#72F1FF')
export const R = 1.6

export const HUB = { name: 'Mumbai', lat: 19.07, lon: 72.88 }
export const DESTINATIONS = [
  { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
  { name: 'Muscat', lat: 23.59, lon: 58.41 },
  { name: 'Almaty', lat: 43.24, lon: 76.95 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'London', lat: 51.5, lon: -0.12 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
]

/** Latitude/longitude in degrees → point on a sphere of radius r. */
export function toVec(lat: number, lon: number, r = R) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}
