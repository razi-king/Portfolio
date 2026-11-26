'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, AdaptiveDpr } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Globe } from './Globe'
import { Crown } from './Crown'
import GlobeLabels from './GlobeLabels'

/** Pointer parallax, scroll-driven camera pull-back, and responsive placement. */
function Rig({ children }: { children: React.ReactNode }) {
  const world = useRef<THREE.Group>(null)
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const { size, camera } = useThree()
  const wide = size.width > 900
  const tablet = !wide && size.width > 600

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      pointer.current.tx = (e.clientX / window.innerWidth - 0.5) * 2
      pointer.current.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame(() => {
    const p = pointer.current
    p.x += (p.tx - p.x) * 0.04
    p.y += (p.ty - p.y) * 0.04
    if (world.current) {
      world.current.rotation.y = p.x * 0.18
      world.current.rotation.x = p.y * 0.1
    }
    const k = Math.min(window.scrollY / Math.max(1, window.innerHeight), 1.5)
    camera.position.z = 7.4 + k * 2.2
    camera.position.y = 0.3 - k * 0.6
    camera.lookAt(0, -k * 0.3, 0)
  })

  // Desktop: globe on the right of the hero text. Phones: globe on top, text below.
  const position: [number, number, number] = wide ? [1.85, -0.2, 0] : tablet ? [0, 1.05, 0] : [0, 1.02, 0]
  const scale = wide ? 1 : tablet ? 0.72 : 0.6

  return (
    <group ref={world} position={position} scale={scale}>
      {children}
    </group>
  )
}

export default function Scene() {
  const [reduced, setReduced] = useState(false)
  const [ready, setReady] = useState(false)
  const [settled, setSettled] = useState(false)
  const [small, setSmall] = useState(false)
  const speed = reduced ? 0 : 1

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sm = window.matchMedia('(max-width: 700px)')
    const sync = () => {
      setReduced(mq.matches)
      setSmall(sm.matches)
    }
    sync()
    mq.addEventListener('change', sync)
    sm.addEventListener('change', sync)
    return () => {
      mq.removeEventListener('change', sync)
      sm.removeEventListener('change', sync)
    }
  }, [])

  // Past the hero, dim the globe so text on top stays readable.
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dim = () => {
      const k = Math.min(1, Math.max(0, (window.scrollY - window.innerHeight * 0.45) / (window.innerHeight * 0.6)))
      wrap.current?.style.setProperty('--scene-dim', String(1 - k * 0.75))
      wrap.current?.classList.toggle('past-hero', k > 0.5)
    }
    dim()
    window.addEventListener('scroll', dim, { passive: true })
    return () => window.removeEventListener('scroll', dim)
  }, [])

  return (
    <div ref={wrap} className={`scene${ready ? ' ready' : ''}${settled ? ' settled' : ''}`} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.3, 7.4], fov: 42, near: 0.1, far: 100 }}
        dpr={small ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={() => {
          requestAnimationFrame(() => setReady(true))
          setTimeout(() => setSettled(true), 1700)
        }}
      >
        <ambientLight color="#5b6bff" intensity={0.7} />
        <pointLight position={[3, 3, 4]} color="#e6fbff" intensity={30} distance={20} />
        <Rig>
          <Globe speed={speed} />
          <Crown speed={speed} />
        </Rig>
        <Stars radius={20} depth={18} count={small ? 700 : 1600} factor={2.2} saturation={0.6} fade speed={reduced ? 0 : 0.6} />
        <EffectComposer>
          <Bloom intensity={0.85} luminanceThreshold={0.3} luminanceSmoothing={0.5} mipmapBlur />
        </EffectComposer>
        <AdaptiveDpr pixelated={false} />
      </Canvas>
      <GlobeLabels />
    </div>
  )
}
