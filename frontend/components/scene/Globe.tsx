'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  AMETHYST,
  CYAN,
  DESTINATIONS,
  FLIGHT_EVENT,
  GOLD,
  HUB,
  R,
  legState,
  toVec,
  type FlightState,
} from './geo'

/* ------------------------------------------------------------------ surface */

/** Fibonacci-distributed dots, tinted cyan at the poles and violet at the equator. */
function DotSphere() {
  const { positions, colors } = useMemo(() => {
    const count = 5600
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const golden = Math.PI * (3 - Math.sqrt(5))
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const t = golden * i
      positions.set([Math.cos(t) * rad * R, y * R, Math.sin(t) * rad * R], i * 3)
      c.copy(AMETHYST).lerp(CYAN, Math.abs(y) * 0.9)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    return { positions, colors }
  }, [])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial vertexColors size={0.012} transparent opacity={0.8} depthWrite={false} />
    </points>
  )
}

function LatitudeRings() {
  const rings = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.08 })
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

/** A glowing band that sweeps from pole to pole, like a radar scan. */
function Scanner({ speed }: { speed: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const a = Math.sin(clock.getElapsedTime() * 0.45 * (speed || 0)) * 1.25
    const y = Math.sin(a) * R
    const r = Math.cos(a) * R * 1.004
    m.position.y = y
    m.scale.setScalar(Math.max(r, 0.001))
    ;(m.material as THREE.MeshBasicMaterial).opacity = speed ? 0.35 * Math.cos(a) : 0
  })
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.985, 1, 96]} />
      <meshBasicMaterial color={CYAN} transparent side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

/** Tilted orbit rings with tick marks, outside the planet. */
function Orbits({ speed }: { speed: number }) {
  const a = useRef<THREE.Group>(null)
  const ticks = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const r = R * 1.32
    for (let i = 0; i < 120; i++) {
      const t = (i / 120) * Math.PI * 2
      const len = i % 10 === 0 ? 0.07 : 0.025
      pts.push(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r))
      pts.push(new THREE.Vector3(Math.cos(t) * (r + len), 0, Math.sin(t) * (r + len)))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])
  useFrame((_, dt) => {
    if (a.current) a.current.rotation.y += dt * 0.08 * speed
  })
  return (
    <group rotation={[0.42, 0, -0.32]}>
      <group ref={a}>
        <lineSegments geometry={ticks}>
          <lineBasicMaterial color={CYAN} transparent opacity={0.35} />
        </lineSegments>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R * 1.32, 0.0025, 6, 200]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.4} />
        </mesh>
        <mesh position={[R * 1.32, 0, 0]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshBasicMaterial color={GOLD} />
        </mesh>
      </group>
      <mesh rotation={[Math.PI / 2 + 0.5, 0.2, 0]}>
        <torusGeometry args={[R * 1.5, 0.0018, 6, 200]} />
        <meshBasicMaterial color={AMETHYST} transparent opacity={0.25} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ routes */

const arcVertex = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const arcFragment = /* glsl */ `
  uniform float uTime; uniform float uOffset; uniform float uProgress; uniform vec3 uColor; uniform vec3 uHot;
  varying float vT;
  void main() {
    if (uProgress >= 0.0) {
      // active leg: a hot trail behind the plane, marching dashes ahead of it
      float d = uProgress - vT;
      if (d >= 0.0) {
        float trail = 0.35 + 0.65 * smoothstep(0.35, 0.0, d);
        gl_FragColor = vec4(mix(uColor, uHot, smoothstep(0.12, 0.0, d)), trail);
      } else {
        float dash = step(0.5, fract(vT * 46.0 - uTime * 1.6));
        gl_FragColor = vec4(uHot, 0.32 * dash);
      }
      return;
    }
    // idle legs: a faint pulse keeps the network alive
    float head = fract(uTime * 0.12 + uOffset);
    float d = head - vT; if (d < 0.0) d += 1.0;
    float trail = smoothstep(0.3, 0.0, d);
    gl_FragColor = vec4(uColor, 0.07 + trail * 0.35);
  }
`

const BOARD = 0.9 // seconds at the gate
const HOLD = 2.6 // seconds the arrival popup stays up
const flyTime = (km: number) => 2.6 + km / 2400

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Facing angle (y rotation) that brings a longitude to the front of the globe. */
const faceLon = (lon: number) => -THREE.MathUtils.degToRad(lon + 90)

function broadcast(s: FlightState) {
  ;(window as unknown as { __rkFlight?: FlightState }).__rkFlight = s
  window.dispatchEvent(new CustomEvent(FLIGHT_EVENT, { detail: s }))
}

/** A small glowing airliner, modelled along +Z with +Y up. */
function Plane() {
  return (
    <group scale={0.07}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.17, 1.6, 12]} />
        <meshStandardMaterial color="#ffffff" emissive={CYAN} emissiveIntensity={0.9} metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.95]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.13, 0.32, 12]} />
        <meshStandardMaterial color="#ffffff" emissive={CYAN} emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, -0.02, 0.05]} rotation={[0, 0, 0]}>
        <boxGeometry args={[2, 0.04, 0.42]} />
        <meshStandardMaterial color="#dff9ff" emissive={CYAN} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.68]}>
        <boxGeometry args={[0.75, 0.03, 0.22]} />
        <meshStandardMaterial color="#dff9ff" emissive={CYAN} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0.2, -0.7]}>
        <boxGeometry args={[0.03, 0.4, 0.26]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.8} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, -0.02, -0.12]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={GOLD} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ popups */

function HubTag({ s }: { s: FlightState }) {
  const status = s.phase === 'boarding' ? `Boarding ${s.flight}` : s.phase === 'airborne' ? `${s.flight} departed` : 'Gate open'
  return (
    <div className="geo-tag geo-hub">
      <span className="geo-dot" />
      <span className="geo-code">{HUB.code}</span>
      <span className="geo-name">{HUB.name}</span>
      <span className="geo-sub">{status}</span>
    </div>
  )
}

function ArrivalCard({ s }: { s: FlightState }) {
  if (s.phase !== 'arrived') {
    return (
      <div className="geo-tag geo-next" key={`n${s.leg}`}>
        <span className="geo-dot" />
        <span className="geo-code">{s.to.code}</span>
        <span className="geo-sub">{s.phase === 'boarding' ? 'Next stop' : 'Inbound'}</span>
      </div>
    )
  }
  return (
    <div className="geo-card" key={`a${s.leg}`}>
      <div className="geo-card-top">
        <span className="geo-live" /> Arrived · {s.flight}
      </div>
      <div className="geo-card-city">{s.to.name}</div>
      <div className="geo-card-country">
        {s.to.country} · {s.to.code}
      </div>
      <div className="geo-card-meta">
        <span>{s.from.code} → {s.to.code}</span>
        <span>{s.km.toLocaleString('en-IN')} km</span>
        <span>{s.time}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ globe */

export function Globe({ speed }: { speed: number }) {
  const spin = useRef<THREE.Group>(null)
  const plane = useRef<THREE.Group>(null)
  const hubAnchor = useRef<THREE.Group>(null)
  const destAnchor = useRef<THREE.Group>(null)
  const hubEl = useRef<HTMLDivElement>(null)
  const destEl = useRef<HTMLDivElement>(null)

  const [state, setState] = useState<FlightState>(() => legState(0, 'boarding'))
  const clockRef = useRef({ leg: 0, t: 0, phase: 'boarding' as FlightState['phase'] })

  const { curves, lines, materials, hub } = useMemo(() => {
    const from = toVec(HUB.lat, HUB.lon)
    const materials: THREE.ShaderMaterial[] = []
    const curves: THREE.QuadraticBezierCurve3[] = []
    const lines = DESTINATIONS.map((d, i) => {
      const to = toVec(d.lat, d.lon)
      const dist = from.distanceTo(to)
      const mid = from.clone().add(to).multiplyScalar(0.5).normalize().multiplyScalar(R + 0.18 + dist * 0.32)
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
      curves.push(curve)
      const pts = curve.getSpacedPoints(160)
      const g = new THREE.BufferGeometry().setFromPoints(pts)
      g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(pts.map((_, k) => k / (pts.length - 1))), 1))
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOffset: { value: i / DESTINATIONS.length },
          uProgress: { value: -1 },
          uColor: { value: GOLD },
          uHot: { value: CYAN },
        },
        vertexShader: arcVertex,
        fragmentShader: arcFragment,
      })
      materials.push(m)
      return { line: new THREE.Line(g, m), end: to }
    })
    return { curves, lines, materials, hub: from }
  }, [])

  useEffect(() => broadcast(legState(0, 'boarding')), [])

  const pulse = useRef<THREE.Mesh>(null)
  const pulseTarget = useMemo(() => hub.clone().multiplyScalar(2), [hub])
  const scratch = useMemo(
    () => ({
      basis: new THREE.Matrix4(),
      x: new THREE.Vector3(),
      y: new THREE.Vector3(),
      z: new THREE.Vector3(),
      a: new THREE.Vector3(),
      c: new THREE.Vector3(),
      v: new THREE.Vector3(),
    }),
    [],
  )

  const initialYaw = useMemo(() => faceLon((HUB.lon + DESTINATIONS[0].lon) / 2), [])

  useFrame(({ clock, camera, size }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const t = clock.getElapsedTime()
    const c = clockRef.current
    const dest = DESTINATIONS[c.leg]
    const km = legState(c.leg, 'airborne').km
    const fly = flyTime(km)

    // ---- leg state machine
    c.t += dt
    let next: FlightState['phase'] = c.phase
    if (c.phase === 'boarding' && c.t > BOARD) next = 'airborne'
    else if (c.phase === 'airborne' && c.t > BOARD + fly) next = 'arrived'
    else if (c.phase === 'arrived' && c.t > BOARD + fly + HOLD) {
      materials[c.leg].uniforms.uProgress.value = -1
      c.leg = (c.leg + 1) % DESTINATIONS.length
      c.t = 0
      next = 'boarding'
    }
    if (next !== c.phase) {
      c.phase = next
      const s = legState(c.leg, next)
      setState(s)
      broadcast(s)
    }

    // ---- plane along the active arc
    const progress = c.phase === 'boarding' ? 0 : c.phase === 'arrived' ? 1 : ease(Math.min(1, (c.t - BOARD) / fly))
    for (let i = 0; i < materials.length; i++) {
      materials[i].uniforms.uTime.value = speed ? t : 2
      if (i === c.leg) materials[i].uniforms.uProgress.value = progress
    }
    const p = plane.current
    if (p) {
      const curve = curves[c.leg]
      const k = Math.min(0.999, Math.max(0.001, progress))
      curve.getPointAt(k, p.position)
      const { x, y, z, basis } = scratch
      curve.getTangentAt(k, z).normalize()
      y.copy(p.position).normalize()
      y.addScaledVector(z, -y.dot(z)).normalize()
      x.crossVectors(y, z)
      basis.makeBasis(x, y, z)
      p.quaternion.setFromRotationMatrix(basis)
      // a little bank as the plane climbs out and descends
      p.rotateZ(Math.sin(progress * Math.PI * 2) * 0.18)
      p.visible = speed > 0 && c.phase === 'airborne'
      const grow = Math.min(1, (c.t - BOARD) * 3, (BOARD + fly - c.t) * 3)
      p.scale.setScalar(Math.max(0.01, grow))
    }

    // ---- turn the globe so the active route faces the viewer
    const g = spin.current
    if (g) {
      const target = faceLon((HUB.lon + dest.lon) / 2)
      let d = target - g.rotation.y
      d = Math.atan2(Math.sin(d), Math.cos(d))
      g.rotation.y += speed ? d * Math.min(1, dt * 0.9) : d
    }

    // ---- hub pulse
    if (pulse.current) {
      const q = (t * 0.8) % 1
      pulse.current.scale.setScalar(1 + q * 2.4)
      ;(pulse.current.material as THREE.MeshBasicMaterial).opacity = speed ? 1 - q : 0.6
    }

    // ---- hide popups on the far side, and flip them away from screen edges
    const { a, c: centre, v } = scratch
    spin.current?.getWorldPosition(centre)
    // returns the label's screen x so the two labels can be pushed to opposite sides
    const place = (anchor: THREE.Group | null, el: HTMLDivElement | null) => {
      if (!anchor || !el) return 0
      anchor.getWorldPosition(a)
      const facing = v.copy(a).sub(centre).normalize().dot(scratch.x.copy(camera.position).sub(a).normalize())
      const o = THREE.MathUtils.smoothstep(facing, 0.02, 0.3)
      el.style.opacity = o.toFixed(3)
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
      const ndc = v.copy(a).project(camera)
      return ((ndc.x + 1) / 2) * size.width
    }
    const hx = place(hubAnchor.current, hubEl.current)
    const dx = place(destAnchor.current, destEl.current)
    const room = size.width < 640 ? 190 : 230
    const side = (x: number, want: 'left' | 'right') =>
      want === 'right' && x > size.width - room ? 'left' : want === 'left' && x < room ? 'right' : want
    const destSide = side(dx, dx < hx ? 'left' : 'right')
    const hubSide = side(hx, destSide === 'left' ? 'right' : 'left')
    if (destEl.current) destEl.current.dataset.side = destSide
    if (hubEl.current) hubEl.current.dataset.side = hubSide
  })

  const destPos = useMemo(() => toVec(state.to.lat, state.to.lon, R * 1.01), [state.to])

  return (
    <group>
      <group ref={spin} rotation={[0.3, initialYaw, 0]}>
        <mesh>
          <sphereGeometry args={[R * 0.985, 64, 64]} />
          <meshBasicMaterial color="#070a22" transparent opacity={0.9} />
        </mesh>
        <DotSphere />
        <LatitudeRings />
        <Scanner speed={speed} />

        {lines.map(({ line, end }, i) => (
          <group key={i}>
            <primitive object={line} />
            <mesh position={end}>
              <sphereGeometry args={[i === state.leg ? 0.028 : 0.016, 12, 12]} />
              <meshBasicMaterial color={i === state.leg ? CYAN : GOLD} />
            </mesh>
          </group>
        ))}

        <mesh position={hub}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color={CYAN} />
        </mesh>
        <mesh ref={pulse} position={hub.clone().multiplyScalar(1.001)} onUpdate={(m) => m.lookAt(pulseTarget)}>
          <ringGeometry args={[0.04, 0.05, 48]} />
          <meshBasicMaterial color={CYAN} transparent side={THREE.DoubleSide} />
        </mesh>

        <group ref={plane} visible={false}>
          <Plane />
        </group>

        <group ref={hubAnchor} position={hub.clone().multiplyScalar(1.01)}>
          <Html zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={hubEl} className="geo-anchor" data-side="right">
              <HubTag s={state} />
            </div>
          </Html>
        </group>
        <group ref={destAnchor} position={destPos}>
          <Html zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={destEl} className="geo-anchor geo-anchor-dest" data-side="right">
              <ArrivalCard s={state} />
            </div>
          </Html>
        </group>
      </group>
      <Orbits speed={speed} />
      <Atmosphere />
    </group>
  )
}

/* ------------------------------------------------------------------ glow */

const atmoVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const atmoFragment = /* glsl */ `
  uniform vec3 uA; uniform vec3 uB; varying vec3 vN; varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(vN, vV)), 3.0);
    gl_FragColor = vec4(mix(uA, uB, vN.y * 0.5 + 0.5), f * 0.6);
  }
`

/** Fresnel glow around the planet, violet below and cyan above. */
function Atmosphere() {
  const uniforms = useMemo(() => ({ uA: { value: AMETHYST }, uB: { value: CYAN } }), [])
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
