// Parse a card date such as "12 Gya", "300 Mya", "233 Kya", "3200 BC" or a bare
// number (years ago). Returns { time, mya } (display text + millions of years
// ago) or { error }. BC years count back from 2000 (10000 BC -> 0.012 Mya),
// matching the existing cards.
const UNITS = { gya: 1000, mya: 1, kya: 0.001, bc: null, bce: null, ya: 1e-6 }
export const MIN_MYA = 0.0045 // 2500 BC, the end of the timeline
export const MAX_MYA = 13800 // the Big Bang

const trim = (n) => String(Number(n.toPrecision(6)))

function display(mya) {
  if (mya >= 1000) return `${trim(mya / 1000)} Gya`
  if (mya >= 1) return `${trim(mya)} Mya`
  return `${trim(mya * 1000)} Kya`
}

export function parseDate(text) {
  const m = String(text ?? '')
    .trim()
    .replace(/,/g, '')
    .match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/i)
  if (!m) return { error: 'Date must look like "12 Gya", "300 Mya", "233 Kya", "3200 BC" or a number' }
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  let mya
  let time
  if (unit === 'bc' || unit === 'bce') {
    mya = (n + 2000) / 1e6
    time = `${trim(n)} BC`
  } else if (unit === '') {
    mya = n / 1e6 // bare number = years ago
    time = display(mya)
  } else if (unit in UNITS) {
    mya = n * UNITS[unit]
    time = unit === 'ya' ? display(mya) : `${trim(n)} ${unit[0].toUpperCase()}${unit.slice(1)}`
  } else {
    return { error: `Unknown date unit "${m[2]}" (use Gya, Mya, Kya or BC)` }
  }
  if (!(mya >= MIN_MYA && mya <= MAX_MYA)) {
    const range = 'Date must be between 13.8 Gya and 2500 BC'
    // a bare number is years ago, which is easy to forget when typing a year
    return { error: unit === '' ? `${range}. A number without a unit means years ago; write "${m[1]} BC" for a year BC` : range }
  }
  return { time, mya }
}
