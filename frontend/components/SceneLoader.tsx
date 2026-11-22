'use client'

import dynamic from 'next/dynamic'

// WebGL only exists in the browser, so the 3D scene is client-only and loads
// after the text has painted. Without WebGL the CSS backdrop shows instead.
const Scene = dynamic(() => import('./scene/Scene'), { ssr: false })

export default function SceneLoader() {
  return <Scene />
}
