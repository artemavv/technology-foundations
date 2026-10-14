// Time <-> vertical position for the mobile view. Cards sit at fixed
// distances in normal flow, so positions are measured from the page; time is
// interpolated between the cards in the same cube-root space as the desktop
// scale. `anchors` = [{ mya, pos }] ordered top to bottom (descending mya).
import { POWER, raw } from './timeScale.js'

// position -> mya; clamped to the first/last card outside the list
export function myaAt(anchors, pos) {
  if (anchors.length === 0) return null
  if (pos <= anchors[0].pos) return anchors[0].mya
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    if (pos <= b.pos && b.pos > a.pos) {
      const r = raw(a.mya) + ((pos - a.pos) / (b.pos - a.pos)) * (raw(b.mya) - raw(a.mya))
      return Math.pow(r, 1 / POWER)
    }
  }
  return anchors[anchors.length - 1].mya
}

// mya -> position (inverse); dates outside the cards' range clamp to the first/last card
export function posAt(anchors, mya) {
  if (anchors.length === 0) return null
  const r = raw(mya)
  if (r >= raw(anchors[0].mya)) return anchors[0].pos
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    const ra = raw(a.mya)
    const rb = raw(b.mya)
    if (r <= ra && r >= rb && ra > rb) return a.pos + ((ra - r) / (ra - rb)) * (b.pos - a.pos)
  }
  return anchors[anchors.length - 1].pos
}
