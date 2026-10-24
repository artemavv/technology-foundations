// Small HTTP helpers shared by the API plugins (adminApi.js, accountsApi.js).
export const MAX_BODY = 64 * 1024

export const send = (res, status, body) => {
  res.statusCode = status
  if (body === undefined) return res.end()
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function readBody(req, limit = MAX_BODY) {
  return new Promise((resolveBody, reject) => {
    let size = 0
    let tooLarge = false
    const chunks = []
    // keep draining an oversized body so the client can still read our 413
    req.on('data', (c) => {
      size += c.length
      if (size > limit) tooLarge = true
      else chunks.push(c)
    })
    req.on('end', () =>
      tooLarge ? reject(new Error('too large')) : resolveBody(Buffer.concat(chunks)),
    )
    req.on('error', reject)
  })
}

// The JSON object in the request body, or null after answering 400 / 413.
export async function parseJsonBody(req, res) {
  let raw
  try {
    raw = await readBody(req)
  } catch {
    send(res, 413, { error: 'Request is too large' })
    return null
  }
  try {
    const body = JSON.parse(raw.toString('utf8') || '{}')
    if (body && typeof body === 'object' && !Array.isArray(body)) return body
  } catch {
    // fall through
  }
  send(res, 400, { error: 'Invalid JSON' })
  return null
}

// Behind a local reverse proxy the socket address is the proxy's: then take the
// client from the last X-Forwarded-For entry, the one the proxy itself appended.
export const isLoopback = (addr) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(addr)

export const clientIp = (req) => {
  const addr = req.socket.remoteAddress ?? '?'
  if (!isLoopback(addr)) return addr
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').pop().trim()
  return forwarded || addr
}

export function parseCookies(req) {
  const out = {}
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  }
  return out
}

// In-memory sliding-window counter per key. `hit` always counts; `blocked` only
// looks (so successful logins need not be counted); `retryAfter` is in seconds.
export function rateLimiter({ count, windowMs }) {
  const hits = new Map() // key -> timestamps
  const recent = (key) => {
    const now = Date.now()
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (list.length) hits.set(key, list)
    else hits.delete(key)
    return list
  }
  return {
    blocked: (key) => recent(key).length >= count,
    hit: (key) => {
      hits.set(key, [...recent(key), Date.now()])
    },
    retryAfter: (key) => {
      const list = recent(key)
      return list.length ? Math.max(1, Math.ceil((list[0] + windowMs - Date.now()) / 1000)) : 0
    },
    // drop idle keys so memory doesn't grow forever
    prune: () => {
      for (const key of [...hits.keys()]) recent(key)
    },
  }
}
