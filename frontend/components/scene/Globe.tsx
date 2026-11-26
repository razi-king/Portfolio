'use client'

import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { AMETHYST, CYAN, DESTINATIONS, GOLD, HUB, PLANES, R, ROUTE_KM, flightStore, legState, toVec, type Phase } from './geo'
import { hoverRoute, selectRoute, useFlights } from '@/lib/flights'
import { labelRefs } from './labels'

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
  uniform float uTime; uniform float uOffset; uniform float uProgress; uniform float uDim; uniform float uSel;
  uniform vec3 uColor; uniform vec3 uHot;
  varying float vT;
  void main() {
    if (uProgress >= 0.0) {
      // a leg in use: a hot trail behind the plane, marching dashes ahead of it
      float d = uProgress - vT;
      if (d >= 0.0) {
        float trail = 0.35 + 0.65 * smoothstep(0.35, 0.0, d);
        gl_FragColor = vec4(mix(uColor, uHot, smoothstep(0.12, 0.0, d)), trail * uDim);
      } else {
        float dash = step(0.5, fract(vT * 46.0 - uTime * 1.6));
        gl_FragColor = vec4(uHot, (0.32 + uSel * 0.4) * dash * uDim);
      }
      return;
    }
    // idle legs: a faint pulse keeps the network alive
    float head = fract(uTime * 0.12 + uOffset);
    float d = head - vT; if (d < 0.0) d += 1.0;
    float trail = smoothstep(0.3, 0.0, d);
    gl_FragColor = vec4(uColor, (0.07 + trail * 0.35) * uDim);
  }
`

const BOARD = 0.9 // seconds at the gate
const HOLD = 2.6 // seconds the arrival popup stays up
const flyTime = (km: number) => 2.6 + km / 2400
/** Planes 2 and 3 wait this long before their first departure, so take-offs are staggered. */
const STAGGER = [0, 2.4, 4.8]
const FIRST_LEGS = [0, 3, 7]

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Facing angle (y rotation) that brings a longitude to the front of the globe. */
const faceLon = (lon: number) => -THREE.MathUtils.degToRad(lon + 90)

interface Sched {
  leg: number
  t: number
  phase: Phase
}

/** The next leg after `from` that no other plane (or the selection) is using. */
function nextLeg(from: number, busy: Set<number>) {
  for (let k = 1; k <= DESTINATIONS.length; k++) {
    const c = (from + k) % DESTINATIONS.length
    if (!busy.has(c)) return c
  }
  return (from + 1) % DESTINATIONS.length
}

function progressOf(s: Sched) {
  if (s.phase === 'boarding') return 0
  if (s.phase === 'arrived') return 1
  return ease(Math.min(1, (s.t - BOARD) / flyTime(ROUTE_KM[s.leg])))
}

function setCursor(pointer: boolean) {
  document.body.style.cursor = pointer ? 'pointer' : ''
}

/** A small glowing airliner, modelled along +Z with +Y up. The lead plane glows cyan, the others violet. */
function Plane({ lead }: { lead: boolean }) {
  const glow = lead ? CYAN : AMETHYST
  return (
    <group scale={0.07}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.17, 1.6, 12]} />
        <meshStandardMaterial color="#ffffff" emissive={glow} emissiveIntensity={0.9} metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.95]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.13, 0.32, 12]} />
        <meshStandardMaterial color="#ffffff" emissive={glow} emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, -0.02, 0.05]} rotation={[0, 0, 0]}>
        <boxGeometry args={[2, 0.04, 0.42]} />
        <meshStandardMaterial color="#dff9ff" emissive={glow} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.68]}>
        <boxGeometry args={[0.75, 0.03, 0.22]} />
        <meshStandardMaterial color="#dff9ff" emissive={glow} emissiveIntensity={0.7} />
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

/* ------------------------------------------------------------------ globe */

export function Globe({ speed }: { speed: number }) {
  const spin = useRef<THREE.Group>(null)
  const planeRefs = useRef<(THREE.Group | null)[]>([])
  const pulse = useRef<THREE.Mesh>(null)
  const { planes, selected, hover } = useFlights()

  const scheds = useRef<Sched[]>(FIRST_LEGS.slice(0, PLANES).map((leg, i) => ({ leg, t: -STAGGER[i], phase: 'boarding' as Phase })))
  const lastSel = useRef<string | null>(null)

  const { curves, lines, materials, hub, ends, anchors, hubAnchor } = useMemo(() => {
    const from = toVec(HUB.lat, HUB.lon)
    const materials: THREE.ShaderMaterial[] = []
    const curves: THREE.QuadraticBezierCurve3[] = []
    const ends: THREE.Vector3[] = []
    const lines = DESTINATIONS.map((d, i) => {
      const to = toVec(d.lat, d.lon)
      ends.push(to)
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
          uDim: { value: 1 },
          uSel: { value: 0 },
          uColor: { value: GOLD },
          uHot: { value: CYAN },
        },
        vertexShader: arcVertex,
        fragmentShader: arcFragment,
      })
      materials.push(m)
      return new THREE.Line(g, m)
    })
    const anchors = DESTINATIONS.map((d) => toVec(d.lat, d.lon, R * 1.01))
    return { curves, lines, materials, hub: from, ends, anchors, hubAnchor: from.clone().multiplyScalar(1.01) }
  }, [])

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
      w: new THREE.Vector3(),
    }),
    [],
  )
  const initialYaw = useMemo(() => faceLon((HUB.lon + DESTINATIONS[0].lon) / 2), [])

  useFrame(({ clock, camera, size }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const t = clock.getElapsedTime()
    const all = scheds.current
    const store = flightStore.get()
    const selIdx = store.selected ? DESTINATIONS.findIndex((d) => d.code === store.selected) : -1
    let changed = false

    // ---- a new selection sends the lead plane straight onto that route
    if (store.selected !== lastSel.current) {
      lastSel.current = store.selected
      if (selIdx >= 0) {
        all[0] = { leg: selIdx, t: 0, phase: 'boarding' }
        for (let i = 1; i < all.length; i++) {
          if (all[i].leg !== selIdx) continue
          all[i] = { leg: nextLeg(selIdx, new Set(all.map((s) => s.leg))), t: 0, phase: 'boarding' }
        }
        changed = true
      }
    }

    // ---- each plane: boarding → airborne → arrived → next leg
    for (let i = 0; i < all.length; i++) {
      const s = all[i]
      const fly = flyTime(ROUTE_KM[s.leg])
      s.t += dt
      let next = s.phase
      if (s.phase === 'boarding' && s.t > BOARD) next = 'airborne'
      else if (s.phase === 'airborne' && s.t > BOARD + fly) next = 'arrived'
      else if (s.phase === 'arrived' && s.t > BOARD + fly + HOLD) {
        const busy = new Set(all.filter((_, k) => k !== i).map((o) => o.leg))
        if (selIdx >= 0) busy.add(selIdx)
        s.leg = i === 0 && selIdx >= 0 ? selIdx : nextLeg(s.leg, busy)
        s.t = 0
        next = 'boarding'
      }
      if (next !== s.phase) {
        s.phase = next
        changed = true
      }
    }
    if (changed) flightStore.set({ planes: all.map((s, i) => legState(s.leg, s.phase, i)) })

    // ---- route shaders: lit trails for legs in use, everything else dims while a route is selected
    for (let i = 0; i < materials.length; i++) {
      const u = materials[i].uniforms
      u.uTime.value = speed ? t : 2
      u.uProgress.value = -1
      u.uSel.value = i === selIdx ? 1 : 0
      const dim = selIdx >= 0 && i !== selIdx ? 0.25 : 1
      u.uDim.value += (dim - u.uDim.value) * Math.min(1, dt * 4)
    }
    for (const s of all) materials[s.leg].uniforms.uProgress.value = progressOf(s)

    // ---- planes ride their arcs, nose along the path and belly to the planet
    const { x, y, z, basis } = scratch
    all.forEach((s, i) => {
      const p = planeRefs.current[i]
      if (!p) return
      const progress = progressOf(s)
      const curve = curves[s.leg]
      const k = Math.min(0.999, Math.max(0.001, progress))
      curve.getPointAt(k, p.position)
      curve.getTangentAt(k, z).normalize()
      y.copy(p.position).normalize()
      y.addScaledVector(z, -y.dot(z)).normalize()
      x.crossVectors(y, z)
      basis.makeBasis(x, y, z)
      p.quaternion.setFromRotationMatrix(basis)
      p.rotateZ(Math.sin(progress * Math.PI * 2) * 0.18)
      const fly = flyTime(ROUTE_KM[s.leg])
      p.visible = speed > 0 && s.phase === 'airborne'
      const grow = Math.min(1, (s.t - BOARD) * 3, (BOARD + fly - s.t) * 3)
      const faded = selIdx >= 0 && i > 0 ? 0.75 : 1
      p.scale.setScalar(Math.max(0.01, grow) * faded)
    })

    // ---- turn the globe so the selected (or lead) route faces the viewer
    const g = spin.current
    if (g) {
      const focus = DESTINATIONS[selIdx >= 0 ? selIdx : all[0].leg]
      const target = faceLon((HUB.lon + focus.lon) / 2)
      let d = target - g.rotation.y
      d = Math.atan2(Math.sin(d), Math.cos(d))
      g.rotation.y += speed ? d * Math.min(1, dt * (selIdx >= 0 ? 2 : 0.9)) : d
    }

    if (pulse.current) {
      const q = (t * 0.8) % 1
      pulse.current.scale.setScalar(1 + q * 2.4)
      ;(pulse.current.material as THREE.MeshBasicMaterial).opacity = speed ? 1 - q : 0.6
    }

    // ---- pin the DOM popups to their cities; hide them on the far side
    if (!g) return
    const { a, c, v, w } = scratch
    g.getWorldPosition(c)
    const place = (local: THREE.Vector3, el: HTMLDivElement | null) => {
      if (!el) return 0
      g.localToWorld(a.copy(local))
      const facing = v.copy(a).sub(c).normalize().dot(w.copy(camera.position).sub(a).normalize())
      const o = THREE.MathUtils.smoothstep(facing, 0.02, 0.3)
      v.copy(a).project(camera)
      const px = ((v.x + 1) / 2) * size.width
      const py = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`
      el.style.opacity = o.toFixed(3)
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
      return px
    }
    const room = size.width < 640 ? 190 : 240
    const side = (px: number, want: 'left' | 'right') =>
      want === 'right' && px > size.width - room ? 'left' : want === 'left' && px < room ? 'right' : want

    const hx = place(hubAnchor, labelRefs.hub)
    let leadSide: 'left' | 'right' = 'right'
    for (let i = 0; i < all.length; i++) {
      const el = labelRefs.dest[i]
      const px = place(anchors[all[i].leg], el)
      const sd = side(px, px < hx ? 'left' : 'right')
      if (i === 0) leadSide = sd
      if (el) el.dataset.side = sd
    }
    if (labelRefs.hub) labelRefs.hub.dataset.side = side(hx, leadSide === 'left' ? 'right' : 'left')
    const hv = store.hover ? DESTINATIONS.findIndex((d) => d.code === store.hover) : -1
    if (hv >= 0 && labelRefs.hover) {
      const px = place(anchors[hv], labelRefs.hover)
      labelRefs.hover.dataset.side = side(px, px < hx ? 'left' : 'right')
    }
  })

  // The planet body swallows pointer events so cities on the far side can't be picked through it.
  const block = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation()
  const activeLegs = new Set(planes.map((p) => p.leg))
  const selIdx = selected ? DESTINATIONS.findIndex((d) => d.code === selected) : -1

  return (
    <group>
      <group ref={spin} rotation={[0.3, initialYaw, 0]}>
        <mesh onClick={block} onPointerOver={block} onPointerMove={block}>
          <sphereGeometry args={[R * 0.985, 64, 64]} />
          <meshBasicMaterial color="#070a22" transparent opacity={0.9} />
        </mesh>
        <DotSphere />
        <LatitudeRings />
        <Scanner speed={speed} />

        {lines.map((line, i) => {
          const on = i === selIdx || activeLegs.has(i)
          const hot = i === selIdx || hover === DESTINATIONS[i].code
          return (
            <group key={i}>
              <primitive object={line} />
              <mesh position={ends[i]}>
                <sphereGeometry args={[hot ? 0.034 : on ? 0.026 : 0.016, 12, 12]} />
                <meshBasicMaterial color={hot ? '#ffffff' : on ? CYAN : GOLD} />
              </mesh>
              {/* invisible, finger-sized hit target */}
              <mesh
                position={ends[i]}
                onClick={(e) => {
                  e.stopPropagation()
                  selectRoute(DESTINATIONS[i].code)
                }}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  hoverRoute(DESTINATIONS[i].code)
                  setCursor(true)
                }}
                onPointerOut={() => {
                  hoverRoute(null)
                  setCursor(false)
                }}
              >
                <sphereGeometry args={[0.12, 10, 10]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </group>
          )
        })}

        <mesh position={hub}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color={CYAN} />
        </mesh>
        <mesh ref={pulse} position={hub.clone().multiplyScalar(1.001)} onUpdate={(m) => m.lookAt(pulseTarget)}>
          <ringGeometry args={[0.04, 0.05, 48]} />
          <meshBasicMaterial color={CYAN} transparent side={THREE.DoubleSide} />
        </mesh>

        {Array.from({ length: PLANES }, (_, i) => (
          <group key={i} ref={(el) => void (planeRefs.current[i] = el)} visible={false}>
            <Plane lead={i === 0} />
          </group>
        ))}
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
