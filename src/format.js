const trim = (n, digits = 6) => String(Number(n.toPrecision(digits)))

// kya (thousands of years ago) -> "13.8 Gya" / "300 Mya" / "233 Kya"
export function formatKya(kya, digits = 6) {
  if (kya >= 1e6) return `${trim(kya / 1e6, digits)} Gya`
  if (kya >= 1e3) return `${trim(kya / 1e3, digits)} Mya`
  return `${trim(kya, digits)} Kya`
}
