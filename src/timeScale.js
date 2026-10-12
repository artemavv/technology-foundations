// Positions along the timeline axis: left = oldest, right = newest.
// The scale is non-linear (cube root of "million years ago") so that the
// sparse, ancient past and the dense, recent past both get readable spacing.
//
// Card positions are anchored to this curve, then the gap between adjacent
// cards is clamped to [CARD_WIDTH + MIN_CLEAR_GAP, MAX_GAP_RATIO * viewport].
// Everything else (timeline markings, unit boundaries) is interpolated from
// the card anchors, so a period's on-screen width follows its card count.

export const MIN_MYA = 0.0000045 // 2500 BC ≈ 0.0045 Mya (end of the timeline)
export const MAX_MYA = 13800     // the Big Bang

export const POWER = 1 / 3

export const PAD = 100
export const CARD_WIDTH = 300
export const MIN_CLEAR_GAP = 100 // min empty space between adjacent card edges
export const MAX_GAP_RATIO = 0.5 // max left-edge-to-left-edge distance, vs viewport

// Reference canvas for the raw (pre-clamp) curve. Only differences matter;
// the span sets how large the desired gaps are versus the clamp bounds.
const RAW_CANVAS = 11000

const raw = (mya) => Math.pow(Math.max(mya, MIN_MYA), POWER)

const RAW_MIN = raw(MIN_MYA)
const RAW_MAX = raw(MAX_MYA)

// mya (older) -> smaller x (left), on the raw reference canvas.
export function timeToX(mya) {
  const n = (RAW_MAX - raw(mya)) / (RAW_MAX - RAW_MIN)
  return PAD + n * (RAW_CANVAS - PAD * 2)
}

// x -> mya (approximate inverse of the raw curve, on the reference canvas).
export function xToMya(x) {
  const n = (x - PAD) / (RAW_CANVAS - PAD * 2)
  return Math.pow(RAW_MAX - n * (RAW_MAX - RAW_MIN), 1 / POWER)
}

// Lay out cards (oldest first, i.e. descending mya) into static x positions.
// Returns { xs, contentWidth, mapTime } where mapTime(mya) -> x interpolates
// any point in time from the card anchors.
export function layoutTimeline(sortedMya, viewportWidth) {
  if (sortedMya.length === 0) {
    return {
      xs: [],
      contentWidth: CARD_WIDTH + PAD * 2,
      mapTime: () => PAD,
      mapX: () => MAX_MYA,
    }
  }

  const minDelta = CARD_WIDTH + MIN_CLEAR_GAP
  const maxDelta = Math.max(minDelta, MAX_GAP_RATIO * viewportWidth)

  const rawXs = sortedMya.map(timeToX)
  const xs = [PAD]
  for (let i = 1; i < rawXs.length; i++) {
    const desired = rawXs[i] - rawXs[i - 1]
    const delta = Math.min(Math.max(desired, minDelta), maxDelta)
    xs.push(xs[i - 1] + delta)
  }

  if (sortedMya.length === 1) {
    return {
      xs,
      contentWidth: xs[0] + CARD_WIDTH + PAD,
      mapTime: () => xs[0],
      mapX: () => sortedMya[0],
    }
  }

  // Anchors ordered oldest -> newest, so r decreases as x increases.
  const anchors = sortedMya.map((mya, i) => ({ r: raw(mya), x: xs[i] }))
  const first = anchors[0]
  const last = anchors[anchors.length - 1]

  const extrapolate = (a, b, r) => {
    const slope = (b.x - a.x) / (b.r - a.r)
    return a.x + (r - a.r) * slope
  }

  const mapTime = (mya) => {
    const r = raw(mya)
    // Beyond the outermost cards, extrapolate along the curve but cap the
    // extension at one max gap so the tail stays reasonable.
    if (r >= first.r) {
      return Math.max(extrapolate(first, anchors[1], r), first.x - maxDelta)
    }
    if (r <= last.r) {
      return Math.min(
        extrapolate(anchors[anchors.length - 2], last, r),
        last.x + maxDelta,
      )
    }
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i]
      const b = anchors[i + 1]
      if (r <= a.r && r >= b.r) {
        const t = (a.r - r) / (a.r - b.r)
        return a.x + t * (b.x - a.x)
      }
    }
    return last.x
  }

  // Inverse of mapTime: x -> mya. Linear in the raw curve between anchors,
  // extrapolated (and clamped to the timeline's range) beyond the outer cards.
  const mapX = (x) => {
    let r
    if (x <= first.x) {
      r = first.r + (x - first.x) / ((anchors[1].x - first.x) / (anchors[1].r - first.r))
    } else if (x >= last.x) {
      const prev = anchors[anchors.length - 2]
      r = last.r + (x - last.x) / ((last.x - prev.x) / (last.r - prev.r))
    } else {
      let i = 0
      while (i < anchors.length - 2 && x > anchors[i + 1].x) i++
      const a = anchors[i]
      const b = anchors[i + 1]
      r = a.r + ((x - a.x) / (b.x - a.x)) * (b.r - a.r)
    }
    r = Math.min(Math.max(r, RAW_MIN), RAW_MAX)
    return Math.pow(r, 1 / POWER)
  }

  // Extend the canvas to cover the end of the timeline (e.g. 2500 BC),
  // which sits just past the newest card.
  const contentWidth = Math.max(last.x + CARD_WIDTH, mapTime(MIN_MYA)) + PAD

  return { xs, contentWidth, mapTime, mapX }
}
