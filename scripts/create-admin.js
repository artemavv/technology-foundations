// Create an admin account, or turn an existing account into one and set its password:
//   node scripts/create-admin.js <login> <password>
// Uses data/app.db, or $DB_PATH. Admins sign in on /login.html like everybody else.
import { LOGIN_RE, hashPassword } from '../server/auth.js'
import { openDb } from '../server/db.js'

const [login, password] = process.argv.slice(2)
if (!login || !password) {
  console.error('Usage: node scripts/create-admin.js <login> <password>')
  process.exit(1)
}
if (!LOGIN_RE.test(login)) {
  console.error('Login must be 3 to 32 letters, digits, dots, dashes or underscores')
  process.exit(1)
}
if (password.length < 6) console.warn('Warning: registration requires at least 6 characters')

const db = await openDb(process.env.DB_PATH ?? 'data/app.db')
const { hash, salt, params } = await hashPassword(password)
const now = Date.now()
const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(login)
if (existing) {
  db.prepare(
    `UPDATE users SET pw_hash = ?, pw_salt = ?, pw_params = ?, status = 'approved', is_admin = 1,
       approved_at = COALESCE(approved_at, ?) WHERE id = ?`,
  ).run(hash, salt, params, now, existing.id)
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id) // a new password ends old sessions
} else {
  db.prepare(
    `INSERT INTO users (login, pw_hash, pw_salt, pw_params, status, is_admin, created_at, approved_at)
     VALUES (?, ?, ?, ?, 'approved', 1, ?, ?)`,
  ).run(login, hash, salt, params, now, now)
}
db.close()
console.log(`${existing ? 'Updated' : 'Created'} admin account "${login}"`)
