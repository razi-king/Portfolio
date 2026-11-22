'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, AdaptiveDpr } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Globe } from './Globe'
import { Crown } from './Crown'

/** Pointer parallax, scroll-driven camera pull-back, and responsive placement. */
function Rig({ children }: { children: React.ReactNode }) {
  const world = useRef<THREE.Group>(null)
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const { size, camera } = useThree()
  const wide = size.width > 900

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
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

  return (
    <group ref={world} position={wide ? [1.75, -0.25, 0] : [0, 1.55, 0]} scale={wide ? 1 : 0.6}>
      {children}
    </group>
  )
}

export default function Scene() {
  const [reduced, setReduced] = useState(false)
  const [ready, setReady] = useState(false)
  const [settled, setSettled] = useState(false)
  const speed = reduced ? 0 : 1

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Past the hero, dim the globe so text on top stays readable.
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dim = () => {
      const k = Math.min(1, Math.max(0, (window.scrollY - window.innerHeight * 0.45) / (window.innerHeight * 0.6)))
      wrap.current?.style.setProperty('--scene-dim', String(1 - k * 0.72))
    }
    dim()
    window.addEventListener('scroll', dim, { passive: true })
    return () => window.removeEventListener('scroll', dim)
  }, [])

  return (
    <div ref={wrap} className={`scene${ready ? ' ready' : ''}${settled ? ' settled' : ''}`} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.3, 7.4], fov: 42, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={() => {
          requestAnimationFrame(() => setReady(true))
          setTimeout(() => setSettled(true), 1700)
        }}
      >
        <ambientLight color="#6b4bd6" intensity={0.6} />
        <pointLight position={[3, 3, 4]} color="#fff1c9" intensity={30} distance={20} />
        <Rig>
          <Globe speed={speed} />
          <Crown speed={speed} />
        </Rig>
        <Stars radius={20} depth={18} count={1400} factor={2.2} saturation={0.4} fade speed={reduced ? 0 : 0.6} />
        <EffectComposer>
          <Bloom intensity={0.7} luminanceThreshold={0.35} luminanceSmoothing={0.5} mipmapBlur />
        </EffectComposer>
        <AdaptiveDpr pixelated={false} />
      </Canvas>
    </div>
  )
}
