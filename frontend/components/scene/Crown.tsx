'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AMETHYST, CYAN, GOLD, R } from './geo'

const POINTS = 5
const RADIUS = 0.28

/** A five-point crown band, built from triangles so its edges stay crisp. */
function useCrownGeometry() {
  return useMemo(() => {
    const seg = POINTS * 16
    const pos: number[] = []
    const at = (i: number) => {
      const a = (i / seg) * Math.PI * 2
      const phase = (a / (Math.PI * 2)) * POINTS
      const h = 0.18 + Math.pow(Math.abs(Math.cos(Math.PI * phase)), 6) * 0.22
      return { x: Math.cos(a) * RADIUS, z: Math.sin(a) * RADIUS, h }
    }
    for (let i = 0; i < seg; i++) {
      const p0 = at(i)
      const p1 = at(i + 1)
      pos.push(p0.x, 0, p0.z, p0.x, p0.h, p0.z, p1.x, 0, p1.z)
      pos.push(p1.x, 0, p1.z, p0.x, p0.h, p0.z, p1.x, p1.h, p1.z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    return g
  }, [])
}

export function Crown({ speed }: { speed: number }) {
  const ref = useRef<THREE.Group>(null)
  const geometry = useCrownGeometry()
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 30), [geometry])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const g = ref.current
    if (!g) return
    const orbit = t * 0.35 * speed
    g.position.set(Math.cos(orbit) * 0.25, R + 0.42 + Math.sin(t * 1.3) * 0.05 * speed, Math.sin(orbit) * 0.25)
    g.rotation.set(0, t * 0.5 * speed, 0.12)
  })

  return (
    <group ref={ref}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={GOLD}
          metalness={0.9}
          roughness={0.25}
          emissive={GOLD}
          emissiveIntensity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#fff3c4" transparent opacity={0.5} />
      </lineSegments>
      {Array.from({ length: POINTS }, (_, k) => {
        const a = (k / POINTS) * Math.PI * 2
        return (
          <mesh key={k} position={[Math.cos(a) * RADIUS, 0.42, Math.sin(a) * RADIUS]}>
            <octahedronGeometry args={[0.03]} />
            <meshBasicMaterial color={k % 2 ? CYAN : AMETHYST} />
          </mesh>
        )
      })}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RADIUS, 0.012, 8, 64]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} emissive={GOLD} emissiveIntensity={0.12} />
      </mesh>
    </group>
  )
}
