// Chronos: short dated titles. Global ones are managed by admins and may link to a
// timeline card (whose date they then follow); personal ones belong to one user.
//   GET    /api/admin/chronos              admin: all global chronos (with `cardMissing`)
//   POST   /api/admin/chronos              admin: { title: {lang: text}, cardId? | date? }
//   PUT    /api/admin/chronos/:id          admin: same body
//   DELETE /api/admin/chronos/:id          admin
//   GET    /api/chronos                    anyone: { chronos } the global ones (no selection; visitors keep that in the browser)
//   GET    /api/memory                     user: { chronos: global (with `selected`), personal }
//   PUT    /api/me/selected/:chronoId      user: put a global chronos on the memory line
//   DELETE /api/me/selected/:chronoId      user: take it off
//   POST   /api/me/personal                user: { title, date, description? }
//   PUT    /api/me/personal/:id            user: same body
//   DELETE /api/me/personal/:id            user
//   PUT    /api/me/known/:chronoId         user: mark a chrono on their memory line (or their own) as known
//   DELETE /api/me/known/:chronoId         user: mark it as not known; taking a chrono off the memory line does it too
// A user's chronos carry `known`; known ones are left out of training runs.
import { parseDate } from './parseDate.js'
import { parseJsonBody, send } from './http.js'
import { langMap } from './adminApi.js'

const MAX_TITLE = 80
const MAX_DESCRIPTION = 1000
export const MAX_PERSONAL = 500

// ---- validation ----

// Global chronos: { title (language map, default language required), cardId | date }.
export function validateGlobal(body, langs, cards) {
  const m = langMap(body.title, 'Title', langs)
  if (m.error) return m
  const title = Object.fromEntries(Object.entries(m.value).filter(([, t]) => t))
  if (!title[langs[0]]) return { error: `Title is required in ${langs[0]}` }
  if (Object.values(title).some((t) => t.length > MAX_TITLE)) {
    return { error: `Title is too long (max ${MAX_TITLE} characters)` }
  }
  if (body.cardId) {
    const card = cards.get(body.cardId)
    if (!card) return { error: 'Unknown card' }
    return { value: { title, cardId: card.id, time: card.time, mya: card.mya } }
  }
  const date = parseDate(body.date)
  if (date.error) return { error: date.error }
  return { value: { title, cardId: null, time: date.time, mya: date.mya } }
}

// Personal chronos: { title, date, description? }.
export function validatePersonal(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return { error: 'Title is required' }
  if (title.length > MAX_TITLE) return { error: `Title is too long (max ${MAX_TITLE} characters)` }
  const description = body.description == null ? '' : body.description
  if (typeof description !== 'string') return { error: 'Description must be text' }
  if (description.length > MAX_DESCRIPTION) {
    return { error: `Description is too long (max ${MAX_DESCRIPTION} characters)` }
  }
  const date = parseDate(body.date)
  if (date.error) return { error: date.error }
  return {
    value: { title, description: description.trim() || null, time: date.time, mya: date.mya },
  }
}

// ---- row -> JSON ----

export const cardMap = (cards) => new Map(cards.map((c) => [c.id, c]))

// Linked chronos follow the card's date; a deleted card leaves the stored date.
export function shapeGlobal(row, cards, selected = false) {
  const card = row.card_id ? cards.get(row.card_id) : null
  return {
    id: row.id,
    personal: false,
    title: JSON.parse(row.title_i18n),
    time: card ? card.time : row.time,
    mya: card ? card.mya : row.mya,
    cardId: card ? card.id : null,
    ...(row.card_id && !card ? { cardMissing: true } : {}),
    selected,
    ...knownOf(row),
  }
}

// `known` is only there when the query asked for it (a user's view, not the admin's)
const knownOf = (row) => ('known' in row ? { known: Boolean(row.known) } : {})
// the SQL for it: chronos alias `c`, the user id as a parameter
const KNOWN = 'EXISTS(SELECT 1 FROM user_known k WHERE k.user_id = ? AND k.chrono_id = c.id) AS known'

export const shapePersonal = (row) => ({
  id: row.id,
  personal: true,
  title: row.title,
  description: row.description,
  time: row.time,
  mya: row.mya,
  cardId: null,
  selected: true,
  ...knownOf(row),
})

// oldest first, like the timeline
const byAge = (a, b) => b.mya - a.mya || a.id - b.id

// The global chronos on a user's memory line plus all their personal ones.
export function userChronos(db, userId, cards) {
  const global = db
    .prepare(
      `SELECT c.*, ${KNOWN} FROM chronos c JOIN user_chronos uc ON uc.chrono_id = c.id
       WHERE uc.user_id = ?`,
    )
    .all(userId, userId)
    .map((r) => shapeGlobal(r, cards, true))
  const personal = db
    .prepare(`SELECT c.*, ${KNOWN} FROM chronos c WHERE c.owner_id = ?`)
    .all(userId, userId)
    .map(shapePersonal)
  return [...global, ...personal].sort(byAge)
}

// ---- seed import ----

const insertGlobal = (db, value) => {
  const now = Date.now()
  db.prepare(
    `INSERT INTO chronos (card_id, time, mya, title_i18n, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(value.cardId, value.time, value.mya, JSON.stringify(value.title), now, now)
}

// public/data/chronos.json: [{ card | date, title: {lang: text} }]. Imported once,
// on the first start with an empty database; afterwards the database rules.
export function importSeed(db, entries, langs, cards) {
  let added = 0
  for (const entry of Array.isArray(entries) ? entries : []) {
    const { value, error } = validateGlobal(
      { title: entry?.title, cardId: entry?.card, date: entry?.date },
      langs,
      cards,
    )
    if (error) {
      console.warn(`chronos.json: skipped ${JSON.stringify(entry?.card ?? entry?.date)}: ${error}`)
      continue
    }
    insertGlobal(db, value)
    added++
  }
  return added
}

// The one-time import: returns how many were added, or null if it was done before
// (or there is no file).
export function bootstrapChronos(db, entries, langs, cards) {
  if (db.prepare("SELECT 1 FROM meta WHERE key = 'chronos_imported'").get() || !entries) return null
  const added = importSeed(db, entries, langs, cardMap(cards))
  db.prepare("INSERT INTO meta (key, value) VALUES ('chronos_imported', ?)").run(String(Date.now()))
  return added
}

// A chrono for every published card that has none yet, linked to the card and titled
// with the card's own (short) title in every language it has. Safe to run again.
// Returns { added, skipped: [{ id, error }] }.
export function chronosFromCards(db, cards, langs) {
  const linked = new Set(db.prepare('SELECT card_id FROM chronos WHERE card_id IS NOT NULL').all().map((r) => r.card_id))
  const byId = cardMap(cards)
  const out = { added: 0, skipped: [] }
  for (const card of cards) {
    if (linked.has(card.id)) continue
    // a bare string is the default language's text
    const title = typeof card.title === 'string' ? { [langs[0]]: card.title } : (card.title ?? {})
    const known = Object.fromEntries(Object.entries(title).filter(([code]) => langs.includes(code)))
    const { value, error } = validateGlobal({ title: known, cardId: card.id }, langs, byId)
    if (error) {
      out.skipped.push({ id: card.id, error })
      continue
    }
    insertGlobal(db, value)
    out.added++
  }
  return out
}

// ---- routes ----

const idOf = (m) => Number(m[1])

export async function adminChronosRoutes(ctx, req, res, url) {
  if (!url.startsWith('/api/admin/chronos')) return false
  const { db } = ctx
  if (!ctx.admin) {
    await ctx.deny(res)
    return true
  }
  const one = url.match(/^\/api\/admin\/chronos\/(\d+)$/)

  if (req.method === 'GET' && url === '/api/admin/chronos') {
    const cards = cardMap(await ctx.loadCards())
    const rows = db.prepare('SELECT * FROM chronos WHERE owner_id IS NULL').all()
    const used = new Map(
      db.prepare('SELECT chrono_id, COUNT(*) n FROM user_chronos GROUP BY chrono_id').all().map((r) => [r.chrono_id, r.n]),
    )
    send(res, 200, rows.map((r) => ({ ...shapeGlobal(r, cards), users: used.get(r.id) ?? 0 })).sort(byAge))
    return true
  }

  if (req.method === 'POST' && url === '/api/admin/chronos') {
    const body = await parseJsonBody(req, res)
    if (!body) return true
    const { value, error } = validateGlobal(body, await ctx.loadLangs(), cardMap(await ctx.loadCards()))
    if (error) return send(res, 400, { error }), true
    const now = Date.now()
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO chronos (card_id, time, mya, title_i18n, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(value.cardId, value.time, value.mya, JSON.stringify(value.title), now, now)
    const row = db.prepare('SELECT * FROM chronos WHERE id = ?').get(lastInsertRowid)
    send(res, 201, shapeGlobal(row, cardMap(await ctx.loadCards())))
    return true
  }

  if (req.method === 'PUT' && one) {
    const body = await parseJsonBody(req, res)
    if (!body) return true
    const { value, error } = validateGlobal(body, await ctx.loadLangs(), cardMap(await ctx.loadCards()))
    if (error) return send(res, 400, { error }), true
    const { changes } = db
      .prepare(
        `UPDATE chronos SET card_id = ?, time = ?, mya = ?, title_i18n = ?, updated_at = ?
         WHERE id = ? AND owner_id IS NULL`,
      )
      .run(value.cardId, value.time, value.mya, JSON.stringify(value.title), Date.now(), idOf(one))
    if (!changes) return send(res, 404, { error: 'No such chrono' }), true
    const row = db.prepare('SELECT * FROM chronos WHERE id = ?').get(idOf(one))
    send(res, 200, shapeGlobal(row, cardMap(await ctx.loadCards())))
    return true
  }

  if (req.method === 'DELETE' && one) {
    const { changes } = db.prepare('DELETE FROM chronos WHERE id = ? AND owner_id IS NULL').run(idOf(one))
    send(res, changes ? 204 : 404, changes ? undefined : { error: 'No such chrono' })
    return true
  }
  return false
}

// one of the user's own chronos, with `known`
const personalRow = (db, id, userId) =>
  db.prepare(`SELECT c.*, ${KNOWN} FROM chronos c WHERE c.id = ? AND c.owner_id = ?`).get(userId, id, userId)

export async function memoryRoutes(ctx, req, res, url) {
  // the global chronos for visitors without an account, who keep their selection in the browser
  if (url === '/api/chronos' && req.method === 'GET') {
    const cards = cardMap(await ctx.loadCards())
    const chronos = ctx.db
      .prepare('SELECT * FROM chronos WHERE owner_id IS NULL')
      .all()
      .map((r) => shapeGlobal(r, cards))
      .sort(byAge)
    send(res, 200, { chronos })
    return true
  }
  const isMemory = url === '/api/memory'
  const known = url.match(/^\/api\/me\/known\/(\d+)$/)
  const selected = url.match(/^\/api\/me\/selected\/(\d+)$/)
  const personal = url === '/api/me/personal'
  const personalOne = url.match(/^\/api\/me\/personal\/(\d+)$/)
  if (!isMemory && !selected && !known && !personal && !personalOne) return false
  const { db, user } = ctx
  if (!user) return send(res, 401, { error: 'Sign in first' }), true

  if (isMemory && req.method === 'GET') {
    const cards = cardMap(await ctx.loadCards())
    const mine = new Set(
      db.prepare('SELECT chrono_id FROM user_chronos WHERE user_id = ?').all(user.id).map((r) => r.chrono_id),
    )
    const chronos = db
      .prepare(`SELECT c.*, ${KNOWN} FROM chronos c WHERE c.owner_id IS NULL`)
      .all(user.id)
      .map((r) => shapeGlobal(r, cards, mine.has(r.id)))
      .sort(byAge)
    const own = db
      .prepare(`SELECT c.*, ${KNOWN} FROM chronos c WHERE c.owner_id = ?`)
      .all(user.id, user.id)
      .map(shapePersonal)
      .sort(byAge)
    send(res, 200, { chronos, personal: own })
    return true
  }

  if (selected && req.method === 'PUT') {
    const exists = db.prepare('SELECT 1 FROM chronos WHERE id = ? AND owner_id IS NULL').get(idOf(selected))
    if (!exists) return send(res, 404, { error: 'No such chrono' }), true
    db.prepare('INSERT OR IGNORE INTO user_chronos (user_id, chrono_id, added_at) VALUES (?, ?, ?)').run(
      user.id,
      idOf(selected),
      Date.now(),
    )
    send(res, 204)
    return true
  }
  if (selected && req.method === 'DELETE') {
    db.prepare('DELETE FROM user_chronos WHERE user_id = ? AND chrono_id = ?').run(user.id, idOf(selected))
    // put on the memory line again later, it starts as not known
    db.prepare('DELETE FROM user_known WHERE user_id = ? AND chrono_id = ?').run(user.id, idOf(selected))
    send(res, 204)
    return true
  }

  // only chronos in the user's own set can be known; others answer 404
  if (known && req.method === 'PUT') {
    const id = idOf(known)
    const inSet =
      db.prepare('SELECT 1 FROM user_chronos WHERE user_id = ? AND chrono_id = ?').get(user.id, id) ||
      db.prepare('SELECT 1 FROM chronos WHERE id = ? AND owner_id = ?').get(id, user.id)
    if (!inSet) return send(res, 404, { error: 'No such chrono' }), true
    db.prepare('INSERT OR IGNORE INTO user_known (user_id, chrono_id, known_at) VALUES (?, ?, ?)').run(user.id, id, Date.now())
    send(res, 204)
    return true
  }
  if (known && req.method === 'DELETE') {
    db.prepare('DELETE FROM user_known WHERE user_id = ? AND chrono_id = ?').run(user.id, idOf(known))
    send(res, 204)
    return true
  }

  if (personal && req.method === 'POST') {
    const body = await parseJsonBody(req, res)
    if (!body) return true
    const { value, error } = validatePersonal(body)
    if (error) return send(res, 400, { error }), true
    const count = db.prepare('SELECT COUNT(*) n FROM chronos WHERE owner_id = ?').get(user.id).n
    if (count >= MAX_PERSONAL) {
      return send(res, 409, { error: `You can have at most ${MAX_PERSONAL} chronos of your own` }), true
    }
    const now = Date.now()
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO chronos (owner_id, time, mya, title, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(user.id, value.time, value.mya, value.title, value.description, now, now)
    send(res, 201, shapePersonal(personalRow(db, lastInsertRowid, user.id)))
    return true
  }

  // other users' rows answer 404, so ids can't be probed
  if (personalOne && req.method === 'PUT') {
    const body = await parseJsonBody(req, res)
    if (!body) return true
    const { value, error } = validatePersonal(body)
    if (error) return send(res, 400, { error }), true
    const { changes } = db
      .prepare(
        `UPDATE chronos SET time = ?, mya = ?, title = ?, description = ?, updated_at = ?
         WHERE id = ? AND owner_id = ?`,
      )
      .run(value.time, value.mya, value.title, value.description, Date.now(), idOf(personalOne), user.id)
    if (!changes) return send(res, 404, { error: 'No such chrono' }), true
    send(res, 200, shapePersonal(personalRow(db, idOf(personalOne), user.id)))
    return true
  }
  if (personalOne && req.method === 'DELETE') {
    const { changes } = db.prepare('DELETE FROM chronos WHERE id = ? AND owner_id = ?').run(idOf(personalOne), user.id)
    send(res, changes ? 204 : 404, changes ? undefined : { error: 'No such chrono' })
    return true
  }
  return false
}
