// Vite plugin: user accounts, the memory line (chronos) and training statistics
// (dev and `vite preview`). Data lives in SQLite (data/app.db, or $DB_PATH).
//   POST /api/auth/register   { login, password, nickname } -> account is 'pending' until an admin approves it
//   POST /api/auth/login      { login, password } -> session cookie; 403 { code: 'pending' } while pending
//   POST /api/auth/logout
//   GET  /api/auth/me         { user: { id, login, nickname, isAdmin } | null }
//   PUT  /api/auth/profile    { nickname }                    signed in
//   POST /api/auth/password   { current, password }           signed in; other sessions end
//   GET    /api/admin/users?status=pending|approved   admin
//   POST   /api/admin/users/:id/approve | /revoke     admin
//   DELETE /api/admin/users/:id                       admin (reject or delete; cascades)
// Chronos, memory line and training routes are in chronosApi.js and trainingApi.js.
// Everything, admin routes included, uses the pf_session cookie and needs an
// X-Requested-With: pf header on anything that changes data. An admin is an
// account with is_admin set (scripts/create-admin.js). For every /api/ request
// this plugin sets req.pfAdmin, which adminApi.js relies on, so register it before
// adminApi, which also answers 404 to every /api/ path it doesn't know.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { openDb } from './db.js'
import {
  COOKIE,
  LOGIN_RE,
  NICKNAME_RE,
  RESERVED_LOGINS,
  clearCookie,
  createSession,
  csrfOk,
  destroyOtherSessions,
  destroySession,
  hashPassword,
  nicknameKey,
  purgeExpiredSessions,
  sessionCookie,
  sessionUser,
  verifyPassword,
} from './auth.js'
import { clientIp, parseCookies, parseJsonBody, rateLimiter, send } from './http.js'
import { adminChronosRoutes, bootstrapChronos, memoryRoutes, syncCardChrono } from './chronosApi.js'
import { trainingRoutes } from './trainingApi.js'
import { playersRoutes } from './playersApi.js'

const MAX_PENDING_USERS = 200
const MIN_PASSWORD = 6
const FAILED_LOGIN_IP = { count: 10, windowMs: 15 * 60 * 1000 }
const FAILED_LOGIN_NAME = { count: 5, windowMs: 15 * 60 * 1000 }
// per IP; $REGISTER_LIMIT raises it (the smoke test registers more often than a visitor would)
const REGISTER_LIMIT = { count: Number(process.env.REGISTER_LIMIT) || 5, windowMs: 60 * 60 * 1000 }

// everything this plugin answers; /api/admin/check and the card routes stay with adminApi
const OURS = /^\/api\/(auth|me|memory|chronos|training|players|admin\/users|admin\/chronos)(\/|$)/

const userJson = (r) => ({
  id: r.id,
  login: r.login,
  nickname: r.nickname,
  status: r.status,
  createdAt: r.created_at,
  approvedAt: r.approved_at,
  lastLoginAt: r.last_login_at,
})

export default function accountsApi({ dbFile } = {}) {
  const file = resolve(dbFile ?? process.env.DB_PATH ?? 'data/app.db')
  const cardsFile = resolve('public/data/cards.json')
  const languagesFile = resolve('public/data/languages.json')
  const chronosSeed = resolve('public/data/chronos.json')
  const failedByIp = rateLimiter(FAILED_LOGIN_IP)
  const failedByName = rateLimiter(FAILED_LOGIN_NAME)
  const registrations = rateLimiter(REGISTER_LIMIT)

  const readJson = async (path, fallback) => {
    try {
      return JSON.parse(await readFile(path, 'utf8'))
    } catch (e) {
      if (e.code === 'ENOENT') return fallback
      throw e
    }
  }
  const loadCards = () => readJson(cardsFile, [])
  const loadLangs = async () => {
    const codes = (await readJson(languagesFile, [])).map((l) => l?.code).filter((c) => typeof c === 'string')
    return codes.length ? codes : ['en']
  }

  // opened on the first request, so a missing native module only breaks the accounts
  let dbPromise = null
  let timer = null
  const getDb = () => {
    dbPromise ??= (async () => {
      const db = await openDb(file)
      purgeExpiredSessions(db)
      timer = setInterval(() => {
        purgeExpiredSessions(db)
        for (const l of [failedByIp, failedByName, registrations]) l.prune()
      }, 60 * 60 * 1000)
      timer.unref()
      await seedChronos(db)
      return db
    })().catch((e) => {
      dbPromise = null // try again on the next request
      throw e
    })
    return dbPromise
  }

  // the first start with an empty database imports public/data/chronos.json
  const seedChronos = async (db) => {
    const added = bootstrapChronos(db, await readJson(chronosSeed, null), await loadLangs(), await loadCards())
    if (added !== null) console.log(`chronos: imported ${added} from public/data/chronos.json`)
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms))
  const deny = async (res) => {
    await delay(500) // slow down guessing
    send(res, 401, { error: 'Unauthorized' })
  }

  // a nickname as typed -> { nickname, key }, or { status, error }; `selfId` is the account that
  // changes its own nickname (it may keep, say, a nickname equal to its own login)
  const checkNickname = (db, raw, selfId = 0) => {
    // runs of spaces count as one, so "A  B" and "A B" are the same nickname
    const nickname = typeof raw === 'string' ? raw.trim().replace(/ {2,}/g, ' ') : ''
    if (!NICKNAME_RE.test(nickname)) {
      return { status: 400, error: 'Nickname must be 2 to 24 letters, digits, spaces, dots, dashes or underscores' }
    }
    const key = nicknameKey(nickname)
    if (RESERVED_LOGINS.includes(key)) return { status: 400, error: 'This nickname is not available' }
    // a nickname that is somebody else's login would be confusing in a table
    if (db.prepare('SELECT 1 FROM users WHERE (login = ? OR nickname_key = ?) AND id != ?').get(key, key, selfId)) {
      return { status: 409, error: 'This nickname is taken' }
    }
    return { nickname, key }
  }

  const register = async (req, res, db) => {
    const body = await parseJsonBody(req, res)
    if (!body) return
    const ip = clientIp(req)
    if (registrations.blocked(ip)) return send(res, 429, { error: 'Too many registrations, try again later' })
    registrations.hit(ip)
    const login = typeof body.login === 'string' ? body.login.trim() : ''
    if (!LOGIN_RE.test(login)) {
      return send(res, 400, { error: 'Login must be 3 to 32 letters, digits, dots, dashes or underscores' })
    }
    if (RESERVED_LOGINS.includes(login.toLowerCase())) {
      return send(res, 400, { error: 'This login is not available' })
    }
    const nick = checkNickname(db, body.nickname)
    if (nick.error) return send(res, nick.status, { error: nick.error })
    const { nickname, key: nickKey } = nick
    if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD) {
      return send(res, 400, { error: `Password must be at least ${MIN_PASSWORD} characters` })
    }
    const waiting = db.prepare("SELECT COUNT(*) n FROM users WHERE status = 'pending'").get().n
    if (waiting >= MAX_PENDING_USERS) return send(res, 503, { error: 'Too many accounts awaiting approval' })
    const { hash, salt, params } = await hashPassword(body.password)
    try {
      db.prepare(
        `INSERT INTO users (login, nickname, nickname_key, pw_hash, pw_salt, pw_params, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(login, nickname, nickKey, hash, salt, params, 'pending', Date.now())
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // the login is checked by the NOCASE column, the nickname by its index
        const isNick = /nickname_key/.test(e.message)
        return send(res, 409, { error: isNick ? 'This nickname is taken' : 'This login is taken' })
      }
      throw e
    }
    send(res, 201, { status: 'pending' })
  }

  const signIn = async (req, res, db) => {
    const body = await parseJsonBody(req, res)
    if (!body) return
    const ip = clientIp(req)
    const login = typeof body.login === 'string' ? body.login.trim() : ''
    const name = login.toLowerCase()
    if (failedByIp.blocked(ip) || failedByName.blocked(name)) {
      res.setHeader('Retry-After', Math.max(failedByIp.retryAfter(ip), failedByName.retryAfter(name)))
      return send(res, 429, { error: 'Too many failed attempts, try again later' })
    }
    const row = db.prepare('SELECT * FROM users WHERE login = ?').get(login)
    const password = typeof body.password === 'string' ? body.password : ''
    // the same answer for an unknown login and a wrong password
    const ok = await verifyPassword(password, row)
    if (!ok) {
      failedByIp.hit(ip)
      failedByName.hit(name)
      await delay(500)
      return send(res, 401, { error: 'Wrong login or password' })
    }
    // only someone who knows the password learns the account is waiting
    if (row.status !== 'approved') {
      return send(res, 403, { error: 'Your account is waiting for approval', code: 'pending' })
    }
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), row.id)
    res.setHeader('Set-Cookie', sessionCookie(req, createSession(db, row.id)))
    send(res, 200, { login: row.login })
  }

  const updateProfile = async (req, res, db, user) => {
    if (!user) return deny(res)
    const body = await parseJsonBody(req, res)
    if (!body) return
    const nick = checkNickname(db, body.nickname, user.id)
    if (nick.error) return send(res, nick.status, { error: nick.error })
    try {
      db.prepare('UPDATE users SET nickname = ?, nickname_key = ? WHERE id = ?').run(nick.nickname, nick.key, user.id)
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return send(res, 409, { error: 'This nickname is taken' })
      throw e
    }
    send(res, 200, { nickname: nick.nickname })
  }

  const changePassword = async (req, res, db, user) => {
    if (!user) return deny(res)
    const body = await parseJsonBody(req, res)
    if (!body) return
    const ip = clientIp(req)
    const name = user.login.toLowerCase()
    if (failedByIp.blocked(ip) || failedByName.blocked(name)) {
      res.setHeader('Retry-After', Math.max(failedByIp.retryAfter(ip), failedByName.retryAfter(name)))
      return send(res, 429, { error: 'Too many failed attempts, try again later' })
    }
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
    // a stolen session alone must not be enough to take the account over
    if (!(await verifyPassword(typeof body.current === 'string' ? body.current : '', row))) {
      failedByIp.hit(ip)
      failedByName.hit(name)
      await delay(500)
      return send(res, 400, { error: 'The current password is wrong' })
    }
    if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD) {
      return send(res, 400, { error: `Password must be at least ${MIN_PASSWORD} characters` })
    }
    const { hash, salt, params } = await hashPassword(body.password)
    db.prepare('UPDATE users SET pw_hash = ?, pw_salt = ?, pw_params = ? WHERE id = ?').run(hash, salt, params, user.id)
    destroyOtherSessions(db, req, user.id)
    send(res, 204)
  }

  const adminUsers = async (req, res, url, db) => {
    if (!req.pfAdmin) return deny(res)
    const one = url.match(/^\/api\/admin\/users\/(\d+)(?:\/(approve|revoke))?$/)
    if (req.method === 'GET' && url === '/api/admin/users') {
      const status = new URL(req.url, 'http://x').searchParams.get('status')
      const rows = ['pending', 'approved'].includes(status)
        ? db.prepare('SELECT * FROM users WHERE is_admin = 0 AND status = ? ORDER BY created_at DESC').all(status)
        : db.prepare('SELECT * FROM users WHERE is_admin = 0 ORDER BY created_at DESC').all()
      return send(res, 200, rows.map(userJson))
    }
    if (!one) return send(res, 404, { error: 'Not found' })
    const id = Number(one[1])
    let changes
    if (req.method === 'POST' && one[2] === 'approve') {
      ;({ changes } = db.prepare("UPDATE users SET status = 'approved', approved_at = ? WHERE id = ? AND is_admin = 0").run(Date.now(), id))
    } else if (req.method === 'POST' && one[2] === 'revoke') {
      ;({ changes } = db.prepare("UPDATE users SET status = 'pending', approved_at = NULL WHERE id = ? AND is_admin = 0").run(id))
      if (changes) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    } else if (req.method === 'DELETE' && !one[2]) {
      ;({ changes } = db.prepare('DELETE FROM users WHERE id = ? AND is_admin = 0').run(id))
    } else {
      return send(res, 404, { error: 'Not found' })
    }
    return changes ? send(res, 204) : send(res, 404, { error: 'No such user' })
  }

  const route = async (req, res, next) => {
    const url = (req.url ?? '').split('?')[0]
    if (!url.startsWith('/api/')) return next()
    const ours = OURS.test(url)
    if (ours) res.setHeader('Cache-Control', 'no-store')
    // a cookie is sent by the browser on its own, so changes must prove they come from our pages
    const hasSession = Boolean(parseCookies(req)[COOKIE])
    if (!ours && !hasSession) return next()

    let db
    try {
      db = await getDb()
    } catch (e) {
      console.error('accounts database is not available:', e.message)
      if (ours) return send(res, 503, { error: 'Accounts are not available' })
      return next() // card routes keep working for anonymous visitors
    }
    const user = hasSession ? sessionUser(db, req) : null
    req.pfAdmin = user?.isAdmin === true
    // the card API (adminApi.js) has no database: it calls this when a card is published or edited
    if (req.pfAdmin) req.pfSyncChrono = (card, chronoTitle, langs, create) => syncCardChrono(db, card, chronoTitle, langs, create)
    if ((ours || req.pfAdmin) && !csrfOk(req)) return send(res, 403, { error: 'Request not allowed' })
    if (!ours) return next()

    if (url.startsWith('/api/admin/users')) return adminUsers(req, res, url, db)

    const ctx = { db, admin: req.pfAdmin, user, loadCards, loadLangs, deny }
    if (await adminChronosRoutes(ctx, req, res, url)) return

    if (req.method === 'POST' && url === '/api/auth/register') return register(req, res, db)
    if (req.method === 'POST' && url === '/api/auth/login') return signIn(req, res, db)
    if (req.method === 'POST' && url === '/api/auth/logout') {
      destroySession(db, req)
      res.setHeader('Set-Cookie', clearCookie(req))
      return send(res, 204)
    }
    if (req.method === 'PUT' && url === '/api/auth/profile') return updateProfile(req, res, db, user)
    if (req.method === 'POST' && url === '/api/auth/password') return changePassword(req, res, db, user)
    if (req.method === 'GET' && url === '/api/auth/me') {
      return send(res, 200, { user: ctx.user })
    }

    if (await memoryRoutes(ctx, req, res, url)) return
    if (await trainingRoutes(ctx, req, res, url)) return
    if (playersRoutes(ctx, req, res, url)) return
    return send(res, 404, { error: 'Not found' })
  }

  const handler = (req, res, next) =>
    route(req, res, next).catch((e) => {
      console.error('accounts api:', e)
      if (!res.headersSent) send(res, 500, { error: 'Server error' })
    })

  const close = () => {
    clearInterval(timer)
    dbPromise?.then((db) => db.close()).catch(() => {})
  }

  return {
    name: 'pf-accounts-api',
    // braces matter: a returned function would be run by Vite as a post hook
    configureServer(server) {
      server.middlewares.use(handler)
      server.httpServer?.on('close', close)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
      server.httpServer?.on('close', close)
    },
  }
}
