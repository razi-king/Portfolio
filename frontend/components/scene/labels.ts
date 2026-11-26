/**
 * DOM nodes for the globe popups. GlobeLabels (normal React DOM, outside the
 * canvas) fills these in; the Globe moves them every frame from inside useFrame.
 * Keeping the popups out of the 3D tree avoids a React root per label.
 */
export const labelRefs = {
  hub: null as HTMLDivElement | null,
  dest: [] as (HTMLDivElement | null)[],
  hover: null as HTMLDivElement | null,
}
