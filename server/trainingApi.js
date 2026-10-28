// Training runs and statistics: what the training page (src/TrainPage.jsx) does is
// recorded here, so that every run updates the user's statistics.
//   POST /api/training/runs                  user: start a run on the user's chronos that are not marked as known
//                                            (400 with code 'all_known' when they all are)
//                                            { mode: 'exam' } starts an exam instead: the chronos the user has memorized and not
//                                            passed yet (at most 50, the newest), 400 with code 'no_exam' when there are fewer than 5.
//                                            In an exam the server grades the answers itself ({ value, unit } or { timeout });
//                                            each chrono answered correctly is passed for good and earns a competition point.
//   POST /api/training/runs/:id/answers      user: { answers: [{ seq, chronoId, correct, responseMs?, answer? }] }
//                                            or { seq, chronoId, skipped: true } when the answer was only shown:
//                                            kept, but neither correct nor incorrect (not in total, correct or stats)
//   POST /api/training/runs/:id/finish       user: optional { answers }; totals are computed here
//   GET  /api/me/training/runs?limit=20      user: recent runs
//   GET  /api/me/stats                       user: totals over finished runs, per chrono
import { parseJsonBody, rateLimiter, send } from './http.js'
import { cardMap, examIds, userChronos } from './chronosApi.js'
import { EXAM_MIN, UNITS, isClose, toMya } from '../src/training.js'

const MAX_ANSWERS = 500 // per run
const MAX_ANSWER_TEXT = 1000
const STALE_MS = 24 * 60 * 60 * 1000
const RUN_LIMIT = { count: 30, windowMs: 60 * 60 * 1000 } // per user

const runLimit = rateLimiter(RUN_LIMIT)

const mode = (v) => (typeof v === 'string' && v !== 'exam' && /^[\w-]{1,32}$/.test(v) ? v : 'default')
const runJson = (r) => ({
  id: r.id,
  mode: r.mode,
  status: r.status,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  total: r.total, // answered, skipped ones not included
  correct: r.correct,
  skipped: r.skipped,
  durationMs: r.duration_ms,
})

// Validated rows to store, or { error }. A chrono must be global or the user's own.
function checkAnswers(db, userId, list) {
  if (!Array.isArray(list)) return { error: 'answers must be a list' }
  const out = []
  for (const a of list) {
    if (!a || typeof a !== 'object') return { error: 'Invalid answer' }
    if (!Number.isInteger(a.seq) || a.seq < 0 || a.seq >= MAX_ANSWERS) return { error: 'Invalid seq' }
    if (!Number.isInteger(a.chronoId)) return { error: 'Invalid chronoId' }
    if (a.skipped !== undefined && typeof a.skipped !== 'boolean') return { error: 'skipped must be true or false' }
    if (a.skipped ? a.correct === true : typeof a.correct !== 'boolean') {
      return { error: a.skipped ? 'A skipped answer is not correct' : 'correct must be true or false' }
    }
    if (a.responseMs != null && !(Number.isInteger(a.responseMs) && a.responseMs >= 0)) {
      return { error: 'Invalid responseMs' }
    }
    const answer = a.answer === undefined ? null : JSON.stringify(a.answer)
    if (answer && answer.length > MAX_ANSWER_TEXT) return { error: 'answer is too large' }
    const chrono = db
      .prepare('SELECT id, title, title_i18n FROM chronos WHERE id = ? AND (owner_id IS NULL OR owner_id = ?)')
      .get(a.chronoId, userId)
    if (!chrono) return { error: `No such chrono: ${a.chronoId}` }
    // the title is kept so statistics survive the chrono being deleted
    const i18n = chrono.title_i18n ? JSON.parse(chrono.title_i18n) : null
    const snapshot = chrono.title ?? i18n.en ?? Object.values(i18n)[0] ?? ''
    out.push({ ...a, answer, snapshot })
  }
  return { value: out }
}

const saveAnswers = (db, runId, rows) => {
  const upsert = db.prepare(
    `INSERT INTO training_answers (run_id, seq, chrono_id, title_snapshot, correct, skipped, response_ms, answer, answered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (run_id, seq) DO UPDATE SET chrono_id = excluded.chrono_id,
       title_snapshot = excluded.title_snapshot, correct = excluded.correct, skipped = excluded.skipped,
       response_ms = excluded.response_ms, answer = excluded.answer, answered_at = excluded.answered_at`,
  )
  const now = Date.now()
  for (const a of rows) {
    upsert.run(runId, a.seq, a.chronoId, a.snapshot, a.correct ? 1 : 0, a.skipped ? 1 : 0, a.responseMs ?? null, a.answer, now)
  }
}

// An exam run's rows, graded here instead of trusting the client: only chronos the exam was
// started with, once per question (a question already answered keeps its answer), no skipping.
// Returns the rows to store, or { error }.
function gradeExam(db, run, chronosById, rows) {
  const allowed = new Set(JSON.parse(run.meta ?? '{}').chronos ?? [])
  const have = new Set(db.prepare('SELECT seq FROM training_answers WHERE run_id = ?').all(run.id).map((r) => r.seq))
  const out = []
  for (const row of rows) {
    if (!allowed.has(row.chronoId)) return { error: 'That chrono is not part of this exam' }
    if (row.skipped) return { error: 'An exam question cannot be skipped' }
    if (have.has(row.seq)) continue
    have.add(row.seq)
    const given = row.answer ? JSON.parse(row.answer) : null
    const unit = given?.unit
    const valid = Number.isFinite(given?.value) && given.value > 0 && (UNITS.includes(unit) || unit === 'Ya')
    const chrono = chronosById.get(row.chronoId)
    out.push({ ...row, correct: Boolean(valid && chrono && isClose(toMya(given.value, unit), chrono.mya)) })
  }
  return { value: out }
}

// Each chrono answered correctly in an exam, and memorized, is passed once, for one competition point.
function awardPasses(db, userId, rows) {
  const now = Date.now()
  for (const a of rows) {
    if (!a.correct || a.skipped) continue
    if (!db.prepare('SELECT 1 FROM user_known WHERE user_id = ? AND chrono_id = ?').get(userId, a.chronoId)) continue
    const { changes } = db
      .prepare('INSERT OR IGNORE INTO user_passed (user_id, chrono_id, passed_at) VALUES (?, ?, ?)')
      .run(userId, a.chronoId, now)
    if (changes) db.prepare('UPDATE users SET competition_points = competition_points + 1 WHERE id = ?').run(userId)
  }
}

// An exam's rows graded, other runs' rows as sent. Returns { value } or { error }.
async function gradeFor(ctx, run, rows) {
  if (run.mode !== 'exam') return { value: rows }
  const mine = userChronos(ctx.db, ctx.user.id, cardMap(await ctx.loadCards()))
  return gradeExam(ctx.db, run, new Map(mine.map((c) => [c.id, c])), rows)
}

// The run if it is the user's; otherwise answers 404 and returns null.
const ownRun = (db, res, userId, id) => {
  const run = db.prepare('SELECT * FROM training_runs WHERE id = ? AND user_id = ?').get(id, userId)
  if (!run) send(res, 404, { error: 'No such run' })
  return run
}

// Would the new rows push the run past the answer cap?
const overCap = (db, runId, rows) => {
  const have = new Set(db.prepare('SELECT seq FROM training_answers WHERE run_id = ?').all(runId).map((r) => r.seq))
  for (const a of rows) have.add(a.seq)
  return have.size > MAX_ANSWERS
}

export async function trainingRoutes(ctx, req, res, url) {
  const start = url === '/api/training/runs'
  const answers = url.match(/^\/api\/training\/runs\/(\d+)\/answers$/)
  const finish = url.match(/^\/api\/training\/runs\/(\d+)\/finish$/)
  const list = url === '/api/me/training/runs'
  const stats = url === '/api/me/stats'
  if (!start && !answers && !finish && !list && !stats) return false
  const { db, user } = ctx
  if (!user) return send(res, 401, { error: 'Sign in first' }), true

  if (start && req.method === 'POST') {
    const body = await parseJsonBody(req, res)
    if (!body) return true
    if (runLimit.blocked(user.id)) {
      return send(res, 429, { error: 'Too many training runs, try again later' }), true
    }
    const mine = userChronos(db, user.id, cardMap(await ctx.loadCards()))
    const exam = body.mode === 'exam'
    let chronos
    if (exam) {
      const ids = new Set(examIds(db, user.id))
      chronos = mine.filter((c) => ids.has(c.id))
      if (chronos.length < EXAM_MIN) {
        return send(res, 400, { error: `You need at least ${EXAM_MIN} memorized chronos to start the exam`, code: 'no_exam' }), true
      }
    } else {
      if (mine.length === 0) {
        return send(res, 400, { error: 'Add some chronos to your memory line first' }), true
      }
      chronos = mine.filter((c) => !c.known)
      if (chronos.length === 0) {
        return send(res, 400, { error: 'All your chronos are marked as known', code: 'all_known' }), true
      }
    }
    runLimit.hit(user.id)
    const now = Date.now()
    db.prepare(
      `UPDATE training_runs SET status = 'abandoned' WHERE user_id = ? AND status = 'in_progress' AND started_at < ?`,
    ).run(user.id, now - STALE_MS)
    const { lastInsertRowid } = db
      .prepare('INSERT INTO training_runs (user_id, mode, started_at, meta) VALUES (?, ?, ?, ?)')
      .run(user.id, exam ? 'exam' : mode(body.mode), now, exam ? JSON.stringify({ chronos: chronos.map((c) => c.id) }) : null)
    send(res, 201, { id: lastInsertRowid, startedAt: now, mode: exam ? 'exam' : 'default', chronos })
    return true
  }

  if (answers && req.method === 'POST') {
    const body = await parseJsonBody(req, res)
    if (!body) return true
    const run = ownRun(db, res, user.id, Number(answers[1]))
    if (!run) return true
    if (run.status !== 'in_progress') return send(res, 409, { error: 'The run is over' }), true
    const checked = checkAnswers(db, user.id, body.answers)
    if (checked.error) return send(res, 400, { error: checked.error }), true
    const graded = await gradeFor(ctx, run, checked.value)
    if (graded.error) return send(res, 400, { error: graded.error }), true
    if (overCap(db, run.id, graded.value)) {
      return send(res, 400, { error: `A run holds at most ${MAX_ANSWERS} answers` }), true
    }
    db.transaction(() => {
      saveAnswers(db, run.id, graded.value)
      if (run.mode === 'exam') awardPasses(db, user.id, graded.value)
    })()
    send(res, 204)
    return true
  }

  if (finish && req.method === 'POST') {
    const body = await parseJsonBody(req, res)
    if (!body) return true
    const run = ownRun(db, res, user.id, Number(finish[1]))
    if (!run) return true
    if (run.status === 'finished') return send(res, 200, runJson(run)), true // idempotent
    if (run.status === 'abandoned') return send(res, 409, { error: 'The run is over' }), true
    let rows = []
    if (body.answers !== undefined) {
      const checked = checkAnswers(db, user.id, body.answers)
      if (checked.error) return send(res, 400, { error: checked.error }), true
      const graded = await gradeFor(ctx, run, checked.value)
      if (graded.error) return send(res, 400, { error: graded.error }), true
      if (overCap(db, run.id, graded.value)) {
        return send(res, 400, { error: `A run holds at most ${MAX_ANSWERS} answers` }), true
      }
      rows = graded.value
    }
    const now = Date.now()
    db.transaction(() => {
      saveAnswers(db, run.id, rows)
      if (run.mode === 'exam') awardPasses(db, user.id, rows)
      const sum = db
        .prepare(
          `SELECT COALESCE(SUM(skipped = 0), 0) total, COALESCE(SUM(correct), 0) correct, COALESCE(SUM(skipped), 0) skipped
           FROM training_answers WHERE run_id = ?`,
        )
        .get(run.id)
      db.prepare(
        `UPDATE training_runs SET status = 'finished', finished_at = ?, total = ?, correct = ?, skipped = ?, duration_ms = ? WHERE id = ?`,
      ).run(now, sum.total, sum.correct, sum.skipped, now - run.started_at, run.id)
    })()
    send(res, 200, runJson(db.prepare('SELECT * FROM training_runs WHERE id = ?').get(run.id)))
    return true
  }

  if (list && req.method === 'GET') {
    const limit = Math.min(100, Math.max(1, Number(new URL(req.url, 'http://x').searchParams.get('limit')) || 20))
    const rows = db
      .prepare('SELECT * FROM training_runs WHERE user_id = ? ORDER BY started_at DESC, id DESC LIMIT ?')
      .all(user.id, limit)
    send(res, 200, rows.map(runJson))
    return true
  }

  if (stats && req.method === 'GET') {
    // only finished runs with at least one answer (not counting skipped ones) count
    const total = db
      .prepare(
        `SELECT COUNT(*) runs, COALESCE(SUM(total), 0) answered, COALESCE(SUM(correct), 0) correct,
           COALESCE(SUM(skipped), 0) skipped, MAX(finished_at) lastRunAt
         FROM training_runs WHERE user_id = ? AND status = 'finished' AND total > 0`,
      )
      .get(user.id)
    const perChrono = db
      .prepare(
        `SELECT a.chrono_id chronoId, MAX(a.title_snapshot) title, COALESCE(SUM(a.skipped = 0), 0) answered,
           COALESCE(SUM(a.correct), 0) correct, COALESCE(SUM(a.skipped), 0) skipped
         FROM training_answers a JOIN training_runs r ON r.id = a.run_id
         WHERE r.user_id = ? AND r.status = 'finished' AND r.total > 0
         GROUP BY a.chrono_id ORDER BY MAX(a.title_snapshot)`,
      )
      .all(user.id)
    send(res, 200, { ...total, perChrono })
    return true
  }
  return false
}
