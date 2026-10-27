// Smoke test for the accounts / chronos / training API.
//   npm run build && npm run smoke
// Starts `vite preview` on a free port with a throwaway database and a throwaway
// admin account; it never touches data/app.db, cards or pending cards.
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4300 + Math.floor(Math.random() * 500)
const BASE = `http://127.0.0.1:${PORT}`
const dir = mkdtempSync(join(tmpdir(), 'pf-smoke-'))
const env = { ...process.env, DB_PATH: join(dir, 'app.db'), REGISTER_LIMIT: '50' }
execFileSync(process.execPath, ['scripts/create-admin.js', 'smoke-admin', 'smoke-admin-password'], { env, stdio: 'ignore' })

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  env,
  stdio: ['ignore', 'pipe', 'inherit'],
})
server.stdout.on('data', () => {})

let failed = 0
const check = (name, ok, extra = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`)
}

// one fetch wrapper per "browser": it keeps its own cookie
function client() {
  let cookie = ''
  return async (method, path, body, headers = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'X-Requested-With': 'pf' }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.startsWith('pf_session=;') ? '' : set.split(';')[0]
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers }
  }
}

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(BASE + '/api/auth/me')
      return
    } catch {
      await sleep(250)
    }
  }
  throw new Error('preview server did not start')
}

async function run() {
  await waitUp()
  const anon = client()
  const alice = client()
  const bob = client()
  const adm = client()

  // ---- accounts ----
  let r = await anon('GET', '/api/auth/me')
  check('anonymous me is null', r.status === 200 && r.body.user === null)
  r = await anon('POST', '/api/auth/register', { login: 'alice', nickname: 'Alice A', password: 'correct horse' }, { 'X-Requested-With': '' })
  check('register without X-Requested-With is refused', r.status === 403, r.status)
  r = await alice('POST', '/api/auth/register', { login: 'Alice', nickname: 'Алиса  Z', password: 'correct horse' })
  check('register creates a pending account', r.status === 201 && r.body.status === 'pending', JSON.stringify(r.body))
  r = await anon('POST', '/api/auth/register', { login: 'alice', nickname: 'Other', password: 'another pass' })
  check('login is unique, ignoring case', r.status === 409, r.status)
  r = await anon('POST', '/api/auth/register', { login: 'alice2', nickname: 'алиса z', password: 'another pass' })
  check('nickname is unique, ignoring case and extra spaces', r.status === 409 && /nickname/.test(r.body.error), JSON.stringify(r.body))
  r = await anon('POST', '/api/auth/register', { login: 'alice3', password: 'another pass' })
  check('nickname is required', r.status === 400, r.status)
  r = await anon('POST', '/api/auth/register', { login: 'alice4', nickname: '<b>', password: 'another pass' })
  check('nickname rejects odd characters', r.status === 400, r.status)
  r = await anon('POST', '/api/auth/register', { login: 'shorty', nickname: 'Shorty', password: 'abcde' })
  check('a 5-character password is refused', r.status === 400, r.status)
  r = await anon('POST', '/api/auth/register', { login: 'admin', nickname: 'Adm', password: 'another pass' })
  check('the login "admin" is reserved', r.status === 400, r.status)
  r = await alice('POST', '/api/auth/login', { login: 'alice', password: 'correct horse' })
  check('pending account cannot sign in', r.status === 403 && r.body.code === 'pending', JSON.stringify(r.body))
  r = await anon('POST', '/api/auth/login', { login: 'alice', password: 'wrong' })
  check('wrong password is 401', r.status === 401, r.status)
  r = await anon('POST', '/api/auth/login', { login: 'nobody', password: 'wrong' })
  check('unknown login looks the same (401)', r.status === 401, r.status)

  r = await anon('GET', '/api/admin/users?status=pending')
  check('admin users need a signed-in admin', r.status === 401, r.status)
  r = await anon('GET', '/api/admin/users', undefined, { 'X-Admin-Login': 'smoke-admin', 'X-Admin-Password': 'smoke-admin-password' })
  check('credentials in headers no longer make an admin', r.status === 401, r.status)
  r = await adm('POST', '/api/auth/login', { login: 'smoke-admin', password: 'smoke-admin-password' })
  check('admin signs in like a user', r.status === 200, JSON.stringify(r.body))
  r = await adm('GET', '/api/auth/me')
  check('me says the admin is an admin', r.body.user?.isAdmin === true, JSON.stringify(r.body))
  r = await adm('GET', '/api/admin/check')
  check('admin check passes for the admin session', r.status === 204, r.status)
  r = await adm('POST', '/api/admin/chronos', { title: { en: 'x' }, date: '1 Mya' }, { 'X-Requested-With': '' })
  check('admin change without X-Requested-With is refused', r.status === 403, r.status)
  r = await adm('POST', '/api/cards', {}, { 'X-Requested-With': '' })
  check('same for the card API', r.status === 403, r.status)
  r = await adm('POST', '/api/cards', {})
  check('admin card API reached (validation fails)', r.status === 400, r.status)
  r = await adm('GET', '/api/admin/users?status=pending')
  check('admin lists pending users', r.status === 200 && r.body.length === 1 && r.body[0].login === 'Alice', JSON.stringify(r.body))
  const aliceId = r.body[0].id
  r = await adm('POST', `/api/admin/users/${aliceId}/approve`)
  check('admin approves', r.status === 204, r.status)
  r = await alice('POST', '/api/auth/login', { login: 'ALICE', password: 'correct horse' })
  check('approved account signs in', r.status === 200 && /HttpOnly/.test(r.headers.get('set-cookie')), JSON.stringify(r.body))
  r = await alice('GET', '/api/auth/me')
  check('me shows the user', r.body.user?.login === 'Alice' && r.body.user.nickname === 'Алиса Z' && r.body.user.isAdmin === false, JSON.stringify(r.body))
  // ---- profile ----
  r = await anon('PUT', '/api/auth/profile', { nickname: 'Anon' })
  check('profile needs a session', r.status === 401, r.status)
  r = await alice('PUT', '/api/auth/profile', { nickname: 'Алиса Z' })
  check('a user may keep or re-case their own nickname', r.status === 200, JSON.stringify(r.body))
  r = await alice('PUT', '/api/auth/profile', { nickname: 'Alice  Two' })
  check('nickname can be changed (spaces are collapsed)', r.status === 200 && r.body.nickname === 'Alice Two', JSON.stringify(r.body))
  r = await alice('GET', '/api/auth/me')
  check('me shows the new nickname', r.body.user?.nickname === 'Alice Two', JSON.stringify(r.body))
  r = await alice('PUT', '/api/auth/profile', { nickname: 'admin' })
  check('a reserved nickname is refused in the profile too', r.status === 400, r.status)
  r = await alice('POST', '/api/auth/password', { current: 'wrong', password: 'brand new pass' })
  check('password change needs the current password', r.status === 400, r.status)
  r = await alice('POST', '/api/auth/password', { current: 'correct horse', password: 'abc' })
  check('a short new password is refused', r.status === 400, r.status)
  r = await alice('POST', '/api/auth/password', { current: 'correct horse', password: 'brand new pass' })
  check('password is changed', r.status === 204, r.status)
  r = await alice('GET', '/api/auth/me')
  check('the session survives the password change', r.body.user?.login === 'Alice', JSON.stringify(r.body))
  r = await anon('POST', '/api/auth/login', { login: 'alice', password: 'correct horse' })
  check('the old password no longer works', r.status === 401, r.status)
  r = await alice('POST', '/api/auth/login', { login: 'alice', password: 'brand new pass' })
  check('the new password works', r.status === 200, r.status)
  r = await alice('GET', '/api/admin/users')
  check('a normal user is no admin (users)', r.status === 401, r.status)
  r = await alice('GET', '/api/admin/check')
  check('a normal user is no admin (check)', r.status === 401, r.status)
  r = await adm('GET', '/api/admin/users')
  check('the admin account is not listed with the users', !r.body.some((u) => u.login === 'smoke-admin'), JSON.stringify(r.body))
  r = await adm('DELETE', '/api/admin/users/1')
  check('the admin account cannot be deleted through the API', r.status === 404, r.status)

  // ---- chronos (admin) ----
  r = await adm('GET', '/api/admin/chronos')
  const seeded = r.body
  check('seed chronos were imported', r.status === 200 && seeded.length > 0, r.status)
  const linked = seeded.find((c) => c.cardId)
  check('a linked chrono carries its card date', Boolean(linked?.time && linked.mya > 0))
  r = await adm('POST', '/api/admin/chronos', { title: { en: 'Test date' }, date: '100 Mya' })
  check('admin creates a chrono by date', r.status === 201 && r.body.time === '100 Mya', JSON.stringify(r.body))
  const mine = r.body
  r = await adm('POST', '/api/admin/chronos', { title: { en: 'Test link' }, cardId: linked.cardId })
  check('admin creates a chrono linked to a card', r.status === 201 && r.body.cardId === linked.cardId, JSON.stringify(r.body))
  r = await adm('POST', '/api/admin/chronos', { title: { en: 'Bad' }, cardId: 'no-such-card' })
  check('unknown card is refused', r.status === 400, r.status)
  r = await adm('POST', '/api/admin/chronos', { title: { en: 'Bad' }, date: 'someday' })
  check('bad date is refused', r.status === 400, r.status)
  r = await adm('PUT', `/api/admin/chronos/${mine.id}`, { title: { en: 'Test date 2' }, date: '90 Mya' })
  check('admin edits a chrono', r.status === 200 && r.body.time === '90 Mya' && r.body.title.en === 'Test date 2', JSON.stringify(r.body))

  // ---- memory line ----
  r = await anon('GET', '/api/memory')
  check('memory needs a session', r.status === 401, r.status)
  r = await anon('GET', '/api/chronos')
  check('anyone can list the global chronos', r.status === 200 && r.body.chronos.length > 0 && r.body.chronos.every((c) => !c.personal && !c.selected && !('known' in c)), r.status)
  r = await anon('POST', '/api/chronos', {})
  check('the public chronos list is read-only', r.status === 404, r.status)
  r = await alice('GET', '/api/memory')
  check('memory lists the global chronos, none selected', r.status === 200 && r.body.chronos.length > 0 && r.body.chronos.every((c) => !c.selected))
  const ages = r.body.chronos.map((c) => c.mya)
  check('memory is sorted oldest first', ages.every((a, i) => i === 0 || ages[i - 1] >= a))
  r = await alice('PUT', `/api/me/selected/${mine.id}`)
  check('select a chrono', r.status === 204, r.status)
  r = await alice('PUT', `/api/me/selected/${mine.id}`)
  check('select is idempotent', r.status === 204, r.status)
  r = await alice('PUT', '/api/me/selected/999999')
  check('select unknown chrono is 404', r.status === 404, r.status)
  r = await alice('POST', '/api/me/personal', { title: 'My birthday', date: '2800 BC', description: 'a note' })
  check('add a personal chrono', r.status === 201 && r.body.personal && r.body.description === 'a note', JSON.stringify(r.body))
  const personal = r.body
  r = await alice('POST', '/api/me/personal', { title: '', date: '2800 BC' })
  check('personal chrono needs a title', r.status === 400, r.status)
  r = await alice('GET', '/api/memory')
  check('memory shows selection and personal', r.body.chronos.find((c) => c.id === mine.id).selected && r.body.personal.length === 1)

  // another user cannot see or touch alice's chronos
  await bob('POST', '/api/auth/register', { login: 'bob', nickname: 'Bob', password: 'bob123' })
  r = await adm('GET', '/api/admin/users?status=pending')
  await adm('POST', `/api/admin/users/${r.body.find((u) => u.login === 'bob').id}/approve`)
  await bob('POST', '/api/auth/login', { login: 'bob', password: 'bob123' })
  r = await bob('GET', '/api/memory')
  check("bob does not see alice's personal chronos", r.body.personal.length === 0)
  r = await bob('PUT', `/api/me/personal/${personal.id}`, { title: 'hijack', date: '1 Mya' })
  check("bob cannot edit alice's chrono (404)", r.status === 404, r.status)
  r = await bob('DELETE', `/api/me/personal/${personal.id}`)
  check("bob cannot delete alice's chrono (404)", r.status === 404, r.status)
  r = await alice('PUT', `/api/me/personal/${personal.id}`, { title: 'My birthday!', date: '2800 BC' })
  check('alice edits her chrono', r.status === 200 && r.body.title === 'My birthday!' && r.body.description === null, JSON.stringify(r.body))

  // ---- training ----
  r = await bob('POST', '/api/training/runs', {})
  check('training on an empty set is refused', r.status === 400, r.status)
  r = await alice('POST', '/api/training/runs', {})
  check('start a run', r.status === 201 && r.body.chronos.length === 2, JSON.stringify(r.body))
  const run = r.body
  const [first, second] = run.chronos
  r = await alice('POST', `/api/training/runs/${run.id}/answers`, {
    answers: [{ seq: 0, chronoId: first.id, correct: true, responseMs: 1200, answer: { picked: '100 Mya' } }],
  })
  check('record an answer', r.status === 204, r.status)
  r = await alice('POST', `/api/training/runs/${run.id}/answers`, {
    answers: [{ seq: 0, chronoId: first.id, correct: true, responseMs: 900 }],
  })
  check('re-sending an answer is idempotent', r.status === 204, r.status)
  r = await alice('POST', `/api/training/runs/${run.id}/answers`, { answers: [{ seq: 1, chronoId: 999999, correct: true }] })
  check('answer for an unknown chrono is refused', r.status === 400, r.status)
  r = await bob('POST', `/api/training/runs/${run.id}/answers`, { answers: [] })
  check("bob cannot use alice's run (404)", r.status === 404, r.status)
  r = await alice('POST', `/api/training/runs/${run.id}/finish`, { answers: [{ seq: 1, chronoId: second.id, correct: false }] })
  check('finish computes totals', r.status === 200 && r.body.total === 2 && r.body.correct === 1 && r.body.status === 'finished', JSON.stringify(r.body))
  r = await alice('POST', `/api/training/runs/${run.id}/finish`, {})
  check('finish is idempotent', r.status === 200 && r.body.total === 2, JSON.stringify(r.body))
  r = await alice('POST', `/api/training/runs/${run.id}/answers`, { answers: [] })
  check('a finished run takes no more answers', r.status === 409, r.status)
  r = await alice('GET', '/api/me/stats')
  check('stats count the finished run', r.status === 200 && r.body.runs === 1 && r.body.answered === 2 && r.body.correct === 1 && r.body.perChrono.length === 2, JSON.stringify(r.body))
  r = await alice('GET', '/api/me/training/runs')
  check('recent runs are listed', r.status === 200 && r.body.length === 1)

  // skipped answers: kept, but neither correct nor incorrect
  r = await alice('POST', '/api/training/runs', {})
  const run2 = r.body
  const [c1, c2] = run2.chronos
  r = await alice('POST', `/api/training/runs/${run2.id}/answers`, { answers: [{ seq: 0, chronoId: c1.id, correct: true }, { seq: 1, chronoId: c2.id, skipped: true, correct: false }, { seq: 2, chronoId: c2.id, skipped: true }] })
  check('skipped answers are accepted', r.status === 204, r.status)
  r = await alice('POST', `/api/training/runs/${run2.id}/answers`, { answers: [{ seq: 3, chronoId: c1.id, skipped: true, correct: true }] })
  check('a skipped answer cannot be correct', r.status === 400, r.status)
  r = await alice('POST', `/api/training/runs/${run2.id}/finish`, {})
  check('skipped answers stay out of total and correct', r.status === 200 && r.body.total === 1 && r.body.correct === 1 && r.body.skipped === 2, JSON.stringify(r.body))
  r = await alice('POST', '/api/training/runs', {})
  const run3 = r.body
  await alice('POST', `/api/training/runs/${run3.id}/answers`, { answers: [{ seq: 0, chronoId: run3.chronos[0].id, skipped: true, correct: false }] })
  r = await alice('POST', `/api/training/runs/${run3.id}/finish`, {})
  check('a run of only skipped answers has total 0', r.status === 200 && r.body.total === 0 && r.body.skipped === 1, JSON.stringify(r.body))
  r = await alice('GET', '/api/me/stats')
  check('stats: skipped are not answered or incorrect; an all-skipped run is not counted', r.body.runs === 2 && r.body.answered === 3 && r.body.correct === 2 && r.body.skipped === 2, JSON.stringify(r.body))
  const skippedRow = r.body.perChrono.find((c) => c.chronoId === c2.id)
  check('per chrono: a skipped one has no answers counted', skippedRow && skippedRow.skipped >= 1, JSON.stringify(r.body.perChrono))

  // known chronos: left out of training
  r = await alice('GET', '/api/memory')
  check('chronos start as not known', r.body.chronos.every((c) => c.known === false) && r.body.personal.every((c) => c.known === false), JSON.stringify(r.body.personal))
  r = await alice('PUT', `/api/me/known/${mine.id}`)
  check('mark a chrono as known', r.status === 204, r.status)
  r = await bob('PUT', `/api/me/known/${mine.id}`)
  check("a chrono that is not on the user's memory line cannot be marked known (404)", r.status === 404, r.status)
  r = await anon('PUT', `/api/me/known/${mine.id}`)
  check('marking known needs a session', r.status === 401, r.status)
  r = await alice('GET', '/api/memory')
  check('memory shows known', r.body.chronos.find((c) => c.id === mine.id).known === true && r.body.personal[0].known === false)
  r = await alice('POST', '/api/training/runs', {})
  check('a known chrono is left out of a new run', r.status === 201 && r.body.chronos.length === 1 && r.body.chronos[0].id === personal.id, JSON.stringify(r.body.chronos?.map((c) => c.id)))
  r = await alice('PUT', `/api/me/known/${personal.id}`)
  check('own chronos can be marked known', r.status === 204, r.status)
  r = await alice('POST', '/api/training/runs', {})
  check("when all are known there is nothing to train (400, code all_known)", r.status === 400 && r.body.code === 'all_known', JSON.stringify(r.body))
  r = await alice('PUT', `/api/me/personal/${personal.id}`, { title: 'My birthday!', date: '2800 BC' })
  check('editing an own chrono keeps it known', r.body.known === true, JSON.stringify(r.body))
  r = await alice('DELETE', `/api/me/known/${personal.id}`)
  check('mark as not known', r.status === 204, r.status)
  r = await alice('DELETE', `/api/me/selected/${mine.id}`)
  r = await alice('PUT', `/api/me/selected/${mine.id}`)
  r = await alice('GET', '/api/memory')
  check('taking a chrono off the memory line forgets that it was known', r.body.chronos.find((c) => c.id === mine.id).known === false)
  r = await adm('GET', '/api/admin/chronos')
  check('admin chronos list carries no per-user known', r.status === 200 && r.body.every((c) => !('known' in c)))

  // ---- revoke, logout, deletes ----
  r = await adm('POST', `/api/admin/users/${aliceId}/revoke`)
  check('admin revokes', r.status === 204, r.status)
  r = await alice('GET', '/api/auth/me')
  check('a revoked user is signed out at once', r.body.user === null, JSON.stringify(r.body))
  r = await adm('DELETE', `/api/admin/chronos/${mine.id}`)
  check('admin deletes a chrono', r.status === 204, r.status)
  r = await bob('POST', '/api/auth/logout')
  check('logout', r.status === 204, r.status)
  r = await bob('GET', '/api/memory')
  check('after logout the session is gone', r.status === 401, r.status)

  // ---- login rate limit ----
  let last
  for (let i = 0; i < 6; i++) last = await anon('POST', '/api/auth/login', { login: 'bob', password: `wrong-${i}` })
  check('repeated failures are rate limited (429)', last.status === 429 && Boolean(last.headers.get('retry-after')), last.status)

  // ---- the old API still answers ----
  r = await anon('GET', '/api/nope')
  check('unknown /api path is 404', r.status === 404, r.status)
}

try {
  await run()
} catch (e) {
  failed++
  console.error('FAIL smoke test crashed:', e)
} finally {
  server.kill()
  await sleep(300)
  rmSync(dir, { recursive: true, force: true })
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
