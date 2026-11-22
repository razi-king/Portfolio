// Holographic globe with flight routes out of Mumbai and an orbiting crown.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const GOLD = new THREE.Color('#F2C14E')
const AMETHYST = new THREE.Color('#A77BFF')
const CYAN = new THREE.Color('#72F1FF')
const R = 1.6

const HUB = { name: 'Mumbai', lat: 19.07, lon: 72.88 }
const DESTINATIONS = [
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

function toVec(lat, lon, r = R) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

function dotSphere() {
  const count = 5200
  const pos = new Float32Array(count * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const rad = Math.sqrt(1 - y * y)
    const t = golden * i
    pos.set([Math.cos(t) * rad * R, y * R, Math.sin(t) * rad * R], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const m = new THREE.PointsMaterial({ color: AMETHYST, size: 0.012, transparent: true, opacity: 0.75, depthWrite: false })
  return new THREE.Points(g, m)
}

function atmosphere() {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: AMETHYST } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uColor, f*0.55); }`,
  })
  return new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 64), m)
}

function latitudeRings() {
  const grp = new THREE.Group()
  const mat = new THREE.LineBasicMaterial({ color: AMETHYST, transparent: true, opacity: 0.14 })
  for (let lat = -60; lat <= 60; lat += 30) {
    const r = R * Math.cos(THREE.MathUtils.degToRad(lat)) * 1.002
    const pts = new THREE.EllipseCurve(0, 0, r, r).getPoints(128).map((p) => new THREE.Vector3(p.x, 0, p.y))
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat)
    line.position.y = R * Math.sin(THREE.MathUtils.degToRad(lat))
    grp.add(line)
  }
  return grp
}

// Arc material: a bright head travels along the route, leaving a fading trail.
function arcMaterial(offset) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOffset: { value: offset }, uColor: { value: GOLD } },
    vertexShader: `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform float uOffset; uniform vec3 uColor; varying float vT;
      void main(){
        float head = fract(uTime*0.18 + uOffset);
        float d = head - vT; if (d < 0.0) d += 1.0;
        float trail = smoothstep(0.45, 0.0, d);
        float base = 0.16;
        gl_FragColor = vec4(uColor, base + trail*0.95);
      }`,
  })
}

function routes() {
  const grp = new THREE.Group()
  const from = toVec(HUB.lat, HUB.lon)
  const uniforms = []
  DESTINATIONS.forEach((d, i) => {
    const to = toVec(d.lat, d.lon)
    const dist = from.distanceTo(to)
    const mid = from.clone().add(to).multiplyScalar(0.5).normalize().multiplyScalar(R + 0.25 + dist * 0.35)
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
    const pts = curve.getPoints(96)
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(pts.map((_, k) => k / (pts.length - 1))), 1))
    const mat = arcMaterial(i / DESTINATIONS.length)
    uniforms.push(mat.uniforms)
    grp.add(new THREE.Line(g, mat))

    const node = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), new THREE.MeshBasicMaterial({ color: GOLD }))
    node.position.copy(to)
    grp.add(node)
  })
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshBasicMaterial({ color: CYAN }))
  hub.position.copy(from)
  grp.add(hub)
  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(0.04, 0.05, 48),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, side: THREE.DoubleSide }),
  )
  pulse.position.copy(from.clone().multiplyScalar(1.001))
  pulse.lookAt(from.clone().multiplyScalar(2))
  grp.add(pulse)
  return { grp, uniforms, pulse }
}

function crown() {
  const grp = new THREE.Group()
  const gold = new THREE.MeshStandardMaterial({
    color: GOLD, metalness: 0.9, roughness: 0.25, emissive: GOLD, emissiveIntensity: 0.12, side: THREE.DoubleSide,
  })
  // Band with five points, built as a lathe-free custom ring so it stays crisp.
  const points = 5
  const seg = points * 2
  const shape = []
  for (let i = 0; i <= seg * 8; i++) {
    const a = (i / (seg * 8)) * Math.PI * 2
    const phase = (a / (Math.PI * 2)) * points
    const tip = Math.pow(Math.abs(Math.cos(Math.PI * phase)), 6)
    shape.push({ a, h: 0.18 + tip * 0.22 })
  }
  const pos = []
  const r = 0.28
  for (let i = 0; i < shape.length - 1; i++) {
    const p0 = shape[i], p1 = shape[i + 1]
    const b0 = [Math.cos(p0.a) * r, 0, Math.sin(p0.a) * r]
    const b1 = [Math.cos(p1.a) * r, 0, Math.sin(p1.a) * r]
    const t0 = [b0[0], p0.h, b0[2]]
    const t1 = [b1[0], p1.h, b1[2]]
    pos.push(...b0, ...t0, ...b1, ...b1, ...t0, ...t1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  grp.add(new THREE.Mesh(g, gold))
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.5 }))
  grp.add(edge)
  for (let k = 0; k < points; k++) {
    const a = (k / points) * Math.PI * 2
    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), new THREE.MeshBasicMaterial({ color: k % 2 ? CYAN : AMETHYST }))
    jewel.position.set(Math.cos(a) * r, 0.42, Math.sin(a) * r)
    grp.add(jewel)
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 64), gold)
  ring.rotation.x = Math.PI / 2
  grp.add(ring)
  return grp
}

function starfield() {
  const n = 1400
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(8 + Math.random() * 18)
    pos.set([v.x, v.y, v.z], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#d9ccff', size: 0.03, transparent: true, opacity: 0.6, depthWrite: false }))
}

export function supportsWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch {
    return false
  }
}

export function startScene(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(0, 0.3, 7.4)

  scene.add(new THREE.AmbientLight('#6b4bd6', 0.6))
  const key = new THREE.PointLight('#fff1c9', 30, 20)
  key.position.set(3, 3, 4)
  scene.add(key)

  const world = new THREE.Group()
  const globe = new THREE.Group()
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 64), new THREE.MeshBasicMaterial({ color: '#1a0e3d', transparent: true, opacity: 0.85 })))
  globe.add(dotSphere(), latitudeRings())
  const r = routes()
  globe.add(r.grp)
  // Turn the globe so Mumbai faces the camera.
  globe.rotation.y = -THREE.MathUtils.degToRad(HUB.lon + 90) + 0.35
  globe.rotation.x = 0.28
  world.add(globe, atmosphere())

  const crownGrp = crown()
  world.add(crownGrp)
  scene.add(world, starfield())

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.35)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
  }, { passive: true })

  let scroll = 0
  window.addEventListener('scroll', () => { scroll = window.scrollY / Math.max(1, window.innerHeight) }, { passive: true })

  function resize() {
    const w = window.innerWidth, h = window.innerHeight
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.resolution.set(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const wide = w > 900
    world.position.x = wide ? 1.75 : 0
    world.position.y = wide ? -0.25 : 1.55
    world.scale.setScalar(wide ? 1 : 0.6)
  }
  window.addEventListener('resize', resize)
  resize()

  const timer = new THREE.Timer()
  timer.connect(document)
  let running = true
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden
    if (running) loop()
  })

  function frame() {
    timer.update()
    const t = timer.getElapsed()
    const speed = reducedMotion ? 0 : 1
    r.uniforms.forEach((u) => (u.uTime.value = t * speed + (reducedMotion ? 2 : 0)))
    globe.rotation.y += 0.0009 * speed
    const s = 1 + ((t * 0.8) % 1) * 2.4
    r.pulse.scale.setScalar(s)
    r.pulse.material.opacity = 1 - ((t * 0.8) % 1)

    const orbit = t * 0.35 * speed
    crownGrp.position.set(Math.cos(orbit) * 0.25, R + 0.42 + Math.sin(t * 1.3) * 0.05 * speed, Math.sin(orbit) * 0.25)
    crownGrp.rotation.y = t * 0.5 * speed
    crownGrp.rotation.z = 0.12

    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    world.rotation.y = pointer.x * 0.18
    world.rotation.x = pointer.y * 0.1
    // Scroll pulls the camera back and dims the globe behind the content.
    const k = Math.min(scroll, 1.5)
    camera.position.z = 7.4 + k * 2.2
    camera.position.y = 0.3 - k * 0.6
    camera.lookAt(0, -k * 0.3, 0)
    composer.render()
  }

  function loop() {
    if (!running) return
    frame()
    requestAnimationFrame(loop)
  }
  loop()
}
