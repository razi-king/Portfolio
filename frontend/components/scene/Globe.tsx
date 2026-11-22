'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AMETHYST, CYAN, GOLD, HUB, DESTINATIONS, R, toVec } from './geo'

/** Fibonacci-distributed dots that form the planet's surface. */
function DotSphere() {
  const positions = useMemo(() => {
    const count = 5200
    const pos = new Float32Array(count * 3)
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const t = golden * i
      pos.set([Math.cos(t) * rad * R, y * R, Math.sin(t) * rad * R], i * 3)
    }
    return pos
  }, [])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={AMETHYST} size={0.012} transparent opacity={0.75} depthWrite={false} />
    </points>
  )
}

function LatitudeRings() {
  const rings = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: AMETHYST, transparent: true, opacity: 0.14 })
    return [-60, -30, 0, 30, 60].map((lat) => {
      const r = R * Math.cos(THREE.MathUtils.degToRad(lat)) * 1.002
      const pts = new THREE.EllipseCurve(0, 0, r, r).getPoints(128).map((p) => new THREE.Vector3(p.x, 0, p.y))
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat)
      line.position.y = R * Math.sin(THREE.MathUtils.degToRad(lat))
      return line
    })
  }, [])
  return (
    <group>
      {rings.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  )
}

const arcVertex = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const arcFragment = /* glsl */ `
  uniform float uTime; uniform float uOffset; uniform vec3 uColor; varying float vT;
  void main() {
    float head = fract(uTime * 0.18 + uOffset);
    float d = head - vT; if (d < 0.0) d += 1.0;
    float trail = smoothstep(0.45, 0.0, d);
    gl_FragColor = vec4(uColor, 0.16 + trail * 0.95);
  }
`

/** Gold flight routes from Mumbai; a bright head travels along each arc. */
function Routes({ speed }: { speed: number }) {
  const pulse = useRef<THREE.Mesh>(null)
  const { lines, materials, hub } = useMemo(() => {
    const from = toVec(HUB.lat, HUB.lon)
    const materials: THREE.ShaderMaterial[] = []
    const lines = DESTINATIONS.map((d, i) => {
      const to = toVec(d.lat, d.lon)
      const dist = from.distanceTo(to)
      const mid = from.clone().add(to).multiplyScalar(0.5).normalize().multiplyScalar(R + 0.25 + dist * 0.35)
      const pts = new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(96)
      const g = new THREE.BufferGeometry().setFromPoints(pts)
      g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(pts.map((_, k) => k / (pts.length - 1))), 1))
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOffset: { value: i / DESTINATIONS.length }, uColor: { value: GOLD } },
        vertexShader: arcVertex,
        fragmentShader: arcFragment,
      })
      materials.push(m)
      return { line: new THREE.Line(g, m), end: to }
    })
    return { lines, materials, hub: from }
  }, [])

  const pulseTarget = useMemo(() => hub.clone().multiplyScalar(2), [hub])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (const m of materials) m.uniforms.uTime.value = speed ? t : 2
    if (pulse.current) {
      const p = (t * 0.8) % 1
      pulse.current.scale.setScalar(1 + p * 2.4)
      ;(pulse.current.material as THREE.MeshBasicMaterial).opacity = 1 - p
    }
  })

  return (
    <group>
      {lines.map(({ line, end }, i) => (
        <group key={i}>
          <primitive object={line} />
          <mesh position={end}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshBasicMaterial color={GOLD} />
          </mesh>
        </group>
      ))}
      <mesh position={hub}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color={CYAN} />
      </mesh>
      <mesh
        ref={pulse}
        position={hub.clone().multiplyScalar(1.001)}
        onUpdate={(m) => m.lookAt(pulseTarget)}
      >
        <ringGeometry args={[0.04, 0.05, 48]} />
        <meshBasicMaterial color={CYAN} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const atmoVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const atmoFragment = /* glsl */ `
  uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
  void main() { float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uColor, f * 0.55); }
`

/** Fresnel glow around the planet. */
function Atmosphere() {
  const uniforms = useMemo(() => ({ uColor: { value: AMETHYST } }), [])
  return (
    <mesh>
      <sphereGeometry args={[R * 1.12, 64, 64]} />
      <shaderMaterial
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={atmoVertex}
        fragmentShader={atmoFragment}
      />
    </mesh>
  )
}

export function Globe({ speed }: { speed: number }) {
  const spin = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.055 * speed
  })
  return (
    <group>
      {/* Mumbai faces the camera on load */}
      <group ref={spin} rotation={[0.28, -THREE.MathUtils.degToRad(HUB.lon + 90) + 0.35, 0]}>
        <mesh>
          <sphereGeometry args={[R * 0.985, 64, 64]} />
          <meshBasicMaterial color="#1a0e3d" transparent opacity={0.85} />
        </mesh>
        <DotSphere />
        <LatitudeRings />
        <Routes speed={speed} />
      </group>
      <Atmosphere />
    </group>
  )
}
