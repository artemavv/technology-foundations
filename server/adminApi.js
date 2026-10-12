// Vite plugin: minimal admin API for editing cards (dev and `vite preview`).
//   GET /api/admin/check   -> 204 if credentials are valid, 401 otherwise
//   PUT /api/cards/:id     -> update title/contents/sources/wikipedia of a card
// Credentials come from ADMIN_LOGIN / ADMIN_PASSWORD (e.g. in .env.local) and are
// sent by the page in the X-Admin-Login / X-Admin-Password headers. If either
// variable is unset, the admin API is disabled.
import { timingSafeEqual } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseDate } from './parseDate.js'

const MAX_BODY = 64 * 1024
const EDITABLE = ['time', 'mya', 'title', 'contents', 'sources', 'wikipedia']

const same = (a, b) => {
  const x = Buffer.from(String(a ?? ''))
  const y = Buffer.from(String(b ?? ''))
  return x.length === y.length && timingSafeEqual(x, y)
}

const send = (res, status, body) => {
  res.statusCode = status
  if (body === undefined) return res.end()
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const isHttpUrl = (s) => {
  try {
    return ['http:', 'https:'].includes(new URL(s).protocol)
  } catch {
    return false
  }
}

const isWikipedia = (s) => {
  if (!isHttpUrl(s)) return false
  const { hostname } = new URL(s)
  return hostname === 'wikipedia.org' || hostname.endsWith('.wikipedia.org')
}

// Returns { value } or { error }.
function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'Invalid body' }
  const out = {}
  if (typeof body.title !== 'string' || !body.title.trim()) {
    return { error: 'Title is required' }
  }
  out.title = body.title.trim()
  const date = parseDate(body.time)
  if (date.error) return { error: date.error }
  out.time = date.time
  out.mya = date.mya
  if (typeof body.contents !== 'string' || !body.contents.trim()) {
    return { error: 'Description is required' }
  }
  out.contents = body.contents.trim()
  if (!Array.isArray(body.sources) || !body.sources.every((s) => typeof s === 'string')) {
    return { error: 'Sources must be a list of URLs' }
  }
  out.sources = body.sources.map((s) => s.trim()).filter(Boolean)
  const bad = out.sources.find((s) => !isHttpUrl(s))
  if (bad) return { error: `Not a valid http(s) URL: ${bad}` }
  if (typeof body.wikipedia !== 'string') return { error: 'Invalid Wikipedia link' }
  out.wikipedia = body.wikipedia.trim()
  if (out.wikipedia && !isWikipedia(out.wikipedia)) {
    return { error: 'Wikipedia link must be a wikipedia.org URL' }
  }
  return { value: out }
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default function adminApi({ login, password }) {
  const cardsFile = resolve('public/data/cards.json')
  let writing = Promise.resolve() // serialize read-modify-write cycles

  const authorized = (req) =>
    Boolean(login && password) &&
    same(req.headers['x-admin-login'], login) &&
    same(req.headers['x-admin-password'], password)

  const handler = async (req, res, next) => {
    const url = (req.url ?? '').split('?')[0]
    if (!url.startsWith('/api/')) return next()

    if (!authorized(req)) {
      await new Promise((r) => setTimeout(r, 500)) // slow down guessing
      return send(res, 401, { error: 'Unauthorized' })
    }

    if (req.method === 'GET' && url === '/api/admin/check') return send(res, 204)

    const m = url.match(/^\/api\/cards\/([\w-]+)$/)
    if (req.method === 'PUT' && m) {
      let body
      try {
        body = JSON.parse(await readBody(req))
      } catch {
        return send(res, 400, { error: 'Invalid JSON' })
      }
      const { value, error } = validate(body)
      if (error) return send(res, 400, { error })

      const job = writing.then(async () => {
        const cards = JSON.parse(await readFile(cardsFile, 'utf8'))
        const card = cards.find((c) => c.id === m[1])
        if (!card) return null
        for (const key of EDITABLE) {
          if (key === 'sources' || key === 'wikipedia') {
            if (value[key].length === 0) delete card[key]
            else card[key] = value[key]
          } else card[key] = value[key]
        }
        const tmp = `${cardsFile}.tmp`
        await writeFile(tmp, JSON.stringify(cards, null, 2) + '\n')
        await rename(tmp, cardsFile)
        return card
      })
      writing = job.catch(() => {})
      try {
        const card = await job
        return card ? send(res, 200, card) : send(res, 404, { error: 'No such card' })
      } catch {
        return send(res, 500, { error: 'Could not save' })
      }
    }
    return send(res, 404, { error: 'Not found' })
  }

  return {
    name: 'pf-admin-api',
    // braces matter: a returned function would be run by Vite as a post hook
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
