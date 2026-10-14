// readable text color (black/white) for a hex background
export function textOn(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#1f2937' : '#fff'
}
