// Training helpers: turning an answer ("375" + "Mya") into an age and judging it.

export const UNITS = ['Gya', 'Mya', 'Kya', 'BC']

// Above this number the units don't apply: it is a plain number of years ago ('Ya').
export const YEARS_ABOVE = 2000

// An answer counts as correct when its age is within this share of the real age.
export const TOLERANCE = 0.05

// A correct answer goes on to the next question by itself after this long (ms).
export const AUTO_NEXT_MS = 2000

// What is typed in the number field, cleaned up as it is typed: a comma is a
// decimal point; anything but digits and one point is dropped.
export function cleanNumber(text) {
  const [whole, ...rest] = text.replace(/,/g, '.').replace(/[^\d.]/g, '').split('.')
  return rest.length ? `${whole}.${rest.join('')}` : whole
}

// number + unit -> millions of years ago, the card's `mya`. Years BC count back
// from AD 2000, as on the timeline (so 3200 BC is 0.0052 Mya).
export function toMya(value, unit) {
  switch (unit) {
    case 'Gya':
      return value * 1000
    case 'Kya':
      return value / 1000
    case 'Ya':
      return value / 1e6
    case 'BC':
      return (value + 2000) / 1e6
    default:
      return value
  }
}

export const isClose = (guessMya, actualMya) => Math.abs(guessMya - actualMya) <= actualMya * TOLERANCE

// a new array in random order (Fisher-Yates)
export function shuffle(list) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
