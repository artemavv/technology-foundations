// Vite plugin: minimal cards API (dev and `vite preview`).
//   GET  /api/admin/check  admin: 204 if credentials are valid, else 401
//   GET  /api/pending      admin: list pending cards
//   POST /api/cards        anyone: add a card. Admin -> published at once;
//                          anonymous -> 'pending' (stored outside public/)
//   PUT  /api/cards/:id    admin: edit a card; `approve: true` publishes a pending one
//   PUT  /api/pictures     admin: upload a JPEG/PNG/WebP (raw body); returns { name }
//   POST /api/blocks       admin: add a sidebar block { title, time, category }; stored as { id, title, kya, category }
//   DELETE /api/cards/:id  admin: delete a card and its pictures (if no other card uses them)
// Translatable fields (title, contents, wikipedia on cards; title on blocks) are
// per-language maps { <code>: text } with codes from public/data/languages.json
// (the first is the default). Plain strings are rejected. On edit the sent
// languages are merged into the stored map; an empty text removes that language.
// Credentials come from ADMIN_LOGIN / ADMIN_PASSWORD (e.g. in .env.local) and are
// sent by the page in the X-Admin-Login / X-Admin-Password headers. If either
// variable is unset, the admin API is disabled.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { parseDate } from './parseDate.js'

const MAX_BODY = 64 * 1024
const EDITABLE = ['time', 'mya', 'title', 'contents', 'sources', 'wikipedia', 'photo', 'illustration']
const TEXT_FIELDS = ['title', 'contents', 'wikipedia'] // per-language maps
const MAX_PICTURE = 2 * 1024 * 1024
const PICTURE_NAME = /^[\w-][\w.-]*\.(jpg|png|webp|svg)$/i
const MAX_TITLE = 40
const MAX_PENDING = 200
const SUBMIT_LIMIT = { count: 5, windowMs: 60 * 60 * 1000 } // per IP

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

// A { lang: text } map with known language codes; texts are trimmed.
function langMap(v, name, langs) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    return { error: `${name} must be a map of language code to text` }
  }
  const out = {}
  for (const [code, text] of Object.entries(v)) {
    if (!langs.includes(code)) return { error: `Unknown language: ${code}` }
    if (typeof text !== 'string') return { error: `${name} (${code}) must be text` }
    out[code] = text.trim()
  }
  return { value: out }
}

// Returns { value } or { error }. Text maps may hold empty strings (= remove
// that language); the caller checks the merged result.
function validate(body, langs) {
  if (!body || typeof body !== 'object') return { error: 'Invalid body' }
  const out = {}
  for (const key of ['title', 'contents']) {
    const m = langMap(body[key], key === 'title' ? 'Title' : 'Description', langs)
    if (m.error) return m
    out[key] = m.value
  }
  const date = parseDate(body.time)
  if (date.error) return { error: date.error }
  out.time = date.time
  out.mya = date.mya
  if (!Array.isArray(body.sources) || !body.sources.every((s) => typeof s === 'string')) {
    return { error: 'Sources must be a list of URLs' }
  }
  out.sources = body.sources.map((s) => s.trim()).filter(Boolean)
  const bad = out.sources.find((s) => !isHttpUrl(s))
  if (bad) return { error: `Not a valid http(s) URL: ${bad}` }
  const wiki = langMap(body.wikipedia, 'Wikipedia link', langs)
  if (wiki.error) return wiki
  out.wikipedia = wiki.value
  if (Object.values(out.wikipedia).some((w) => w && !isWikipedia(w))) {
    return { error: 'Wikipedia link must be a wikipedia.org URL' }
  }
  for (const key of ['photo', 'illustration']) {
    const v = body[key]
    if (v === undefined) continue
    if (typeof v !== 'string' || (v && !PICTURE_NAME.test(v))) {
      return { error: `Invalid ${key}` }
    }
    out[key] = v
  }
  return { value: out }
}

// Sidebar block: { title (language map), time (date text, stored as kya), category (a key of cats.json) }.
function validateBlock(body, cats, langs) {
  if (!body || typeof body !== 'object') return { error: 'Invalid body' }
  const m = langMap(body.title, 'Title', langs)
  if (m.error) return m
  const title = Object.fromEntries(Object.entries(m.value).filter(([, t]) => t))
  if (Object.keys(title).length === 0) return { error: 'Title is required' }
  if (Object.values(title).some((t) => t.length > MAX_TITLE)) {
    return { error: `Title is too long (max ${MAX_TITLE} characters)` }
  }
  const date = parseDate(body.time)
  if (date.error) return { error: date.error }
  if (typeof body.category !== 'string' || !Object.hasOwn(cats, body.category)) {
    return { error: 'Unknown category' }
  }
  // kya = thousands of years ago; round away float noise (0.233 * 1000)
  const kya = Number((date.mya * 1000).toPrecision(10))
  return { value: { title, kya, category: body.category } }
}

// Picture type from the file's first bytes (never trust the name).
function pictureExt(buf) {
  if (buf.length > 12) {
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  }
  return null
}

function readBody(req, limit = MAX_BODY) {
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

const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'card'

// Merge sent languages into a stored map (a stored plain string is the default
// language's text); an empty text removes that language.
function mergeMap(old, patch, def) {
  const out = typeof old === 'string' ? { [def]: old } : { ...old }
  for (const [code, text] of Object.entries(patch)) {
    if (text) out[code] = text
    else delete out[code]
  }
  return out
}

// Copy validated fields onto a card; empty sources/wikipedia/pictures are removed.
// Returns an error message when the card would be left without a title or
// description in every language (the caller then discards the change).
function applyFields(card, value, def) {
  for (const key of EDITABLE) {
    const v = value[key]
    if (v === undefined) continue // not sent: leave unchanged
    if (TEXT_FIELDS.includes(key)) {
      card[key] = mergeMap(card[key], v, def)
      if (key === 'wikipedia' && Object.keys(card[key]).length === 0) delete card[key]
    } else if (['sources', 'photo', 'illustration'].includes(key) && v.length === 0) delete card[key]
    else card[key] = v
  }
  if (Object.keys(card.title ?? {}).length === 0) return 'Title is required'
  if (Object.keys(card.contents ?? {}).length === 0) return 'Description is required'
  return null
}

export default function adminApi({ login, password }) {
  const cardsFile = resolve('public/data/cards.json')
  // pending cards live outside public/ so they are never served to visitors
  const pendingFile = resolve('data/pending.json')
  const picturesDir = resolve('public/pictures')
  const blocksFile = resolve('public/data/blocks.json')
  const catsFile = resolve('public/data/cats.json')
  const languagesFile = resolve('public/data/languages.json')
  let queue = Promise.resolve() // serialize read-modify-write cycles
  const submissions = new Map() // ip -> timestamps of recent anonymous adds

  const locked = (fn) => {
    const job = queue.then(fn)
    queue = job.catch(() => {})
    return job
  }
  const readJson = async (file, fallback) => {
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch (e) {
      if (e.code === 'ENOENT') return fallback
      throw e
    }
  }
  const writeJson = async (file, data) => {
    await mkdir(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    await writeFile(tmp, JSON.stringify(data, null, 2) + '\n')
    await rename(tmp, file)
  }

  // delete picture files that no remaining card uses (names are reduced to a basename)
  const removeUnused = async (names, remaining) => {
    const inUse = new Set(remaining.flatMap((c) => [c.photo, c.illustration]))
    for (const name of new Set(names)) {
      if (!name || inUse.has(name)) continue
      await unlink(resolve(picturesDir, basename(String(name)))).catch((e) => {
        if (e.code !== 'ENOENT') throw e
      })
    }
  }

  // language codes; the first is the default
  const languages = async () => {
    const list = await readJson(languagesFile, [])
    const codes = list.map((l) => l?.code).filter((c) => typeof c === 'string')
    return codes.length ? codes : ['en']
  }
  // slug source: the default-language text if there is one, else any
  const slugSource = (map, def) => (typeof map === 'string' ? map : (map[def] || Object.values(map).find(Boolean) || ''))

  const isAdmin = (req) =>
    Boolean(login && password) &&
    same(req.headers['x-admin-login'], login) &&
    same(req.headers['x-admin-password'], password)
  const sentCredentials = (req) =>
    Boolean(req.headers['x-admin-login'] || req.headers['x-admin-password'])

  const tooMany = (ip) => {
    const now = Date.now()
    const recent = (submissions.get(ip) ?? []).filter((t) => now - t < SUBMIT_LIMIT.windowMs)
    if (recent.length >= SUBMIT_LIMIT.count) {
      submissions.set(ip, recent)
      return true
    }
    submissions.set(ip, [...recent, now])
    return false
  }

  const parse = async (req, res) => {
    let body
    try {
      body = JSON.parse((await readBody(req)).toString('utf8'))
    } catch {
      send(res, 400, { error: 'Invalid JSON' })
      return null
    }
    const langs = await languages()
    const { value, error } = validate(body, langs)
    if (error) {
      send(res, 400, { error })
      return null
    }
    return { value, def: langs[0], approve: body.approve === true }
  }

  const deny = async (res) => {
    await new Promise((r) => setTimeout(r, 500)) // slow down guessing
    send(res, 401, { error: 'Unauthorized' })
  }

  const route = async (req, res, next) => {
    const url = (req.url ?? '').split('?')[0]
    if (!url.startsWith('/api/')) return next()
    const admin = isAdmin(req)

    if (req.method === 'GET' && url === '/api/admin/check') {
      return admin ? send(res, 204) : deny(res)
    }

    if (req.method === 'GET' && url === '/api/pending') {
      if (!admin) return deny(res)
      return send(res, 200, await readJson(pendingFile, []))
    }

    if (req.method === 'POST' && url === '/api/blocks') {
      if (!admin) return deny(res)
      let body
      try {
        body = JSON.parse((await readBody(req)).toString('utf8'))
      } catch {
        return send(res, 400, { error: 'Invalid JSON' })
      }
      const langs = await languages()
      const { value, error } = validateBlock(body, await readJson(catsFile, {}), langs)
      if (error) return send(res, 400, { error })
      const block = await locked(async () => {
        const blocks = await readJson(blocksFile, [])
        const taken = new Set(blocks.map((b) => b.id))
        const base = slugify(slugSource(value.title, langs[0]))
        let id = base
        for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
        const fresh = { id, ...value }
        await writeJson(blocksFile, [...blocks, fresh])
        return fresh
      })
      return send(res, 201, block)
    }

    if (req.method === 'POST' && url === '/api/cards') {
      // anonymous is fine; credentials that were sent must be valid
      if (sentCredentials(req) && !admin) return deny(res)
      if (!admin && tooMany(req.socket.remoteAddress ?? '?')) {
        return send(res, 429, { error: 'Too many submissions, try again later' })
      }
      const parsed = await parse(req, res)
      if (!parsed) return
      try {
        const card = await locked(async () => {
          const cards = await readJson(cardsFile, [])
          const pending = await readJson(pendingFile, [])
          if (!admin && pending.length >= MAX_PENDING) return null
          const taken = new Set([...cards, ...pending].map((c) => c.id))
          const base = slugify(slugSource(parsed.value.title, parsed.def))
          let id = base
          for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
          if (!admin) {
            // only admins can attach pictures
            delete parsed.value.photo
            delete parsed.value.illustration
          }
          const fresh = { id }
          const problem = applyFields(fresh, parsed.value, parsed.def)
          if (problem) return { error: problem }
          if (admin) {
            await writeJson(cardsFile, [...cards, fresh])
            return { ...fresh, status: 'published' }
          }
          fresh.status = 'pending'
          await writeJson(pendingFile, [...pending, fresh])
          return fresh
        })
        if (!card) return send(res, 503, { error: 'Too many cards awaiting review' })
        if (card.error) return send(res, 400, { error: card.error })
        return send(res, 201, admin ? card : { status: 'pending' })
      } catch {
        return send(res, 500, { error: 'Could not save' })
      }
    }

    if (req.method === 'PUT' && url === '/api/pictures') {
      if (!admin) return deny(res)
      let buf
      try {
        buf = await readBody(req, MAX_PICTURE)
      } catch {
        return send(res, 413, { error: 'Picture is too large (max 2 MB)' })
      }
      const ext = pictureExt(buf)
      if (!ext) return send(res, 400, { error: 'Picture must be a JPEG, PNG or WebP file' })
      const name = `${randomBytes(6).toString('hex')}.${ext}`
      await mkdir(picturesDir, { recursive: true })
      await writeFile(resolve(picturesDir, name), buf)
      return send(res, 201, { name })
    }

    const m = url.match(/^\/api\/cards\/([\w-]+)$/)
    if (req.method === 'PUT' && m) {
      if (!admin) return deny(res)
      const parsed = await parse(req, res)
      if (!parsed) return
      try {
        const card = await locked(async () => {
          const cards = await readJson(cardsFile, [])
          const published = cards.find((c) => c.id === m[1])
          if (published) {
            const old = [published.photo, published.illustration]
            const problem = applyFields(published, parsed.value, parsed.def)
            if (problem) return { error: problem }
            await writeJson(cardsFile, cards)
            await removeUnused(old, cards)
            return { ...published, status: 'published' }
          }
          const pending = await readJson(pendingFile, [])
          const waiting = pending.find((c) => c.id === m[1])
          if (!waiting) return null
          const old = [waiting.photo, waiting.illustration]
          const problem = applyFields(waiting, parsed.value, parsed.def)
          if (problem) return { error: problem }
          if (!parsed.approve) {
            await writeJson(pendingFile, pending)
            await removeUnused(old, [...cards, ...pending])
            return waiting
          }
          const { status, ...approved } = waiting
          await writeJson(cardsFile, [...cards, approved])
          await writeJson(pendingFile, pending.filter((c) => c.id !== m[1]))
          return { ...approved, status: 'published' }
        })
        if (card?.error) return send(res, 400, { error: card.error })
        return card ? send(res, 200, card) : send(res, 404, { error: 'No such card' })
      } catch {
        return send(res, 500, { error: 'Could not save' })
      }
    }

    if (req.method === 'DELETE' && m) {
      if (!admin) return deny(res)
      try {
        const removed = await locked(async () => {
          const cards = await readJson(cardsFile, [])
          const pending = await readJson(pendingFile, [])
          const card = [...cards, ...pending].find((c) => c.id === m[1])
          if (!card) return false
          const keepCards = cards.filter((c) => c.id !== m[1])
          const keepPending = pending.filter((c) => c.id !== m[1])
          if (keepCards.length !== cards.length) await writeJson(cardsFile, keepCards)
          if (keepPending.length !== pending.length) await writeJson(pendingFile, keepPending)
          // pictures may be shared (photo and illustration, or between cards)
          await removeUnused([card.photo, card.illustration], [...keepCards, ...keepPending])
          return true
        })
        return removed ? send(res, 204) : send(res, 404, { error: 'No such card' })
      } catch {
        return send(res, 500, { error: 'Could not delete' })
      }
    }
    return send(res, 404, { error: 'Not found' })
  }

  const handler = (req, res, next) =>
    route(req, res, next).catch(() => {
      if (!res.headersSent) send(res, 500, { error: 'Server error' })
    })

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
