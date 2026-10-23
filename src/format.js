const trim = (n, digits = 6) => String(Number(n.toPrecision(digits)))

// Age under the timeline cursor, written like the timeline ticks: Gya / Mya /
// Kya, then BC from 10000 BC on (cards and ticks count back from AD 2000, so
// 10000 BC is 12 Kya).
export function formatAge(mya, digits = 3) {
  const kya = mya * 1000
  if (kya > 12.001) return formatKya(kya, digits)
  return `${trim(kya * 1000 - 2000, digits)} BC`
}

// kya (thousands of years ago) -> "13.8 Gya" / "300 Mya" / "233 Kya"
export function formatKya(kya, digits = 6) {
  if (kya >= 1e6) return `${trim(kya / 1e6, digits)} Gya`
  if (kya >= 1e3) return `${trim(kya / 1e3, digits)} Mya`
  return `${trim(kya, digits)} Kya`
}
