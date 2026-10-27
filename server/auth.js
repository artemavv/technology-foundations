// Passwords (scrypt), cookie sessions and the CSRF check for user accounts.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { isLoopback, parseCookies } from './http.js'

export const COOKIE = 'pf_session'
const SESSION_MS = 30 * 24 * 60 * 60 * 1000
const TOUCH_MS = 24 * 60 * 60 * 1000 // sliding expiry is refreshed at most once a day
const PARAMS = { N: 16384, r: 8, p: 1 }
const PARAMS_TEXT = `scrypt:${PARAMS.N}:${PARAMS.r}:${PARAMS.p}`

export const RESERVED_LOGINS = ['admin', 'administrator', 'root']
export const LOGIN_RE = /^[A-Za-z0-9_.-]{3,32}$/
// a nickname may use letters of any alphabet, digits, spaces, dots, dashes and underscores
export const NICKNAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,22}[\p{L}\p{N}]$/u
export const nicknameKey = (nickname) => nickname.normalize('NFKC').toLowerCase()

const derive = (password, salt, { N, r, p }) =>
  new Promise((ok, fail) =>
    scrypt(password.normalize('NFKC'), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 }, (e, key) =>
      e ? fail(e) : ok(key),
    ),
  )

export async function hashPassword(password) {
  const salt = randomBytes(16)
  return { hash: await derive(password, salt, PARAMS), salt, params: PARAMS_TEXT }
}

const parseParams = (text) => {
  const [, N, r, p] = String(text).split(':')
  return { N: Number(N), r: Number(r), p: Number(p) }
}

// `row` may be undefined (unknown login): a dummy hash is checked so that the
// response time doesn't reveal whether the login exists.
let dummy
export async function verifyPassword(password, row) {
  dummy ??= await hashPassword('dummy-password')
  const target = row ?? { pw_hash: dummy.hash, pw_salt: dummy.salt, pw_params: dummy.params }
  const key = await derive(password, target.pw_salt, parseParams(target.pw_params))
  return timingSafeEqual(key, target.pw_hash) && Boolean(row)
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex')

export function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
  ).run(sha256(token), userId, now, now + SESSION_MS, now)
  return token
}

// after a password change: every session of the user but the one making the request
export function destroyOtherSessions(db, req, userId) {
  const token = parseCookies(req)[COOKIE]
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, token ? sha256(token) : '')
}

export function destroySession(db, req) {
  const token = parseCookies(req)[COOKIE]
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
}

// The signed-in, approved user of this request, or null. Revoking a user takes
// effect at once because the status is checked on every request.
export function sessionUser(db, req) {
  const token = parseCookies(req)[COOKIE]
  if (!token) return null
  const now = Date.now()
  const hash = sha256(token)
  const row = db
    .prepare(
      `SELECT u.id, u.login, u.nickname, u.is_admin, s.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'approved'`,
    )
    .get(hash, now)
  if (!row) return null
  if (now - row.last_seen_at > TOUCH_MS) {
    db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?').run(
      now,
      now + SESSION_MS,
      hash,
    )
  }
  return { id: row.id, login: row.login, nickname: row.nickname, isAdmin: Boolean(row.is_admin) }
}

export function purgeExpiredSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
}

// Secure only when the browser reached us over HTTPS: directly, via a local proxy
// that says so (X-Forwarded-Proto), or when COOKIE_SECURE=1 forces it.
const isHttps = (req) =>
  process.env.COOKIE_SECURE === '1' ||
  Boolean(req.socket.encrypted) ||
  (isLoopback(req.socket.remoteAddress) &&
    String(req.headers['x-forwarded-proto'] ?? '').split(',').pop().trim() === 'https')

export function sessionCookie(req, token) {
  const parts = [`${COOKIE}=${token}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${SESSION_MS / 1000}`]
  if (isHttps(req)) parts.push('Secure')
  return parts.join('; ')
}

export function clearCookie(req) {
  const parts = [`${COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0']
  if (isHttps(req)) parts.push('Secure')
  return parts.join('; ')
}

// State-changing user requests must come from our own pages: a custom header
// (which forces a CORS preflight we never answer) and, when the browser sends
// one, an Origin that matches the host the visitor used.
export function csrfOk(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true
  if (req.headers['x-requested-with'] !== 'pf') return false
  const origin = req.headers.origin
  if (!origin) return true
  const behindProxy = isLoopback(req.socket.remoteAddress)
  const host = (behindProxy && req.headers['x-forwarded-host']) || req.headers.host
  try {
    return new URL(origin).host === String(host).split(',').pop().trim()
  } catch {
    return false
  }
}
