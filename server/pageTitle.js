// Fetch a web page's <title> for the sources list. Best-effort: returns ''
// on any failure. Server-side fetch of user-supplied URLs, so private and
// local addresses are refused (checked again on every redirect).
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const TIMEOUT_MS = 5000
const MAX_BYTES = 256 * 1024
const MAX_REDIRECTS = 3
const MAX_LENGTH = 200

const isPrivate = (ip) => {
  if (ip.includes(':')) {
    const v = ip.toLowerCase()
    if (v.startsWith('::ffff:')) return isPrivate(v.slice(7))
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v)
  }
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

async function isPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  return addrs.length > 0 && addrs.every((a) => !isPrivate(a.address))
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (s) =>
  s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })

export function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return ''
  return decode(m[1]).replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH)
}

export async function fetchTitle(url) {
  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS)
    let target = new URL(url)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!['http:', 'https:'].includes(target.protocol) || !(await isPublicHost(target.hostname))) return ''
      const res = await fetch(target, {
        redirect: 'manual',
        signal,
        headers: { 'User-Agent': 'PF-timeline/0.4 (page title fetch)', Accept: 'text/html' },
      })
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        target = new URL(res.headers.get('location'), target)
        continue
      }
      if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? '')) return ''
      const decoder = new TextDecoder()
      let text = ''
      let size = 0
      for await (const chunk of res.body) {
        size += chunk.length
        text += decoder.decode(chunk, { stream: true })
        if (/<\/title>/i.test(text) || size >= MAX_BYTES) break
      }
      return extractTitle(text)
    }
  } catch {
    // fall through: no title
  }
  return ''
}
