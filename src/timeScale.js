// Positions along the timeline axis: left = oldest, right = newest.
// The scale is non-linear (cube root of "million years ago") so that the
// sparse, ancient past and the dense, recent past both get readable spacing.
//
// Card positions are anchored to this curve, then the gap between adjacent
// cards is clamped to [CARD_WIDTH + MIN_CLEAR_GAP, MAX_GAP_RATIO * viewport].
// Everything else (timeline markings, unit boundaries) is interpolated from
// the card anchors, so a period's on-screen width follows its card count.

export const MIN_MYA = 0.0000045 // 2500 BC ≈ 0.0045 Mya (end of the timeline)
export const END_MYA = 0.0045    // 2500 BC, where the timeline ends
export const MAX_MYA = 13800     // the Big Bang

export const POWER = 1 / 3

export const PAD = 100
export const START_X = 40 // left edge of the first card, from the screen's left side
export const CARD_WIDTH = 300
export const MIN_CLEAR_GAP = 100 // min empty space between adjacent card edges
export const MAX_GAP_RATIO = 0.3825 // max left-edge-to-left-edge distance, vs viewport

// Reference canvas for the raw (pre-clamp) curve. Only differences matter;
// the span sets how large the desired gaps are versus the clamp bounds.
const RAW_CANVAS = 11000

export const raw = (mya) => Math.pow(Math.max(mya, MIN_MYA), POWER)

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
  const xs = [START_X]
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

  // The timeline ends at END_MYA (2500 BC), just past the newest card: along
  // the curve, but at most one max gap away so the tail stays reasonable. The
  // stretch from the newest card to the end is its own segment, so mapTime and
  // mapX stay exact inverses there too.
  const endR = raw(END_MYA)
  const extended = extrapolate(anchors[anchors.length - 2], last, endR)
  const endX = Number.isFinite(extended)
    ? Math.max(last.x, Math.min(extended, last.x + maxDelta))
    : last.x + maxDelta

  const mapTime = (mya) => {
    const r = raw(mya)
    // The timeline starts at the first card: anything older (the 13.8 Gya
    // marking) sits on its left edge.
    if (r >= first.r) return first.x
    if (r <= last.r) {
      if (endR >= last.r || r <= endR) return endX
      return last.x + ((last.r - r) / (last.r - endR)) * (endX - last.x)
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
      r = endX > last.x ? last.r + Math.min((x - last.x) / (endX - last.x), 1) * (endR - last.r) : last.r
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
