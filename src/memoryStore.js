// Where a visitor's memory line lives. Signed in: on the server (SQLite). Signed out:
// in this browser's localStorage, for the global chronos only (no own chronos).
// Both stores answer the same calls, so the Memory line and training pages don't care.
import { api } from './auth.js'

const KEY = 'pf_guest'
const MAX_RUNS = 20

// localStorage can be missing or throw (private windows, blocked site data): then the
// selection lasts until the page is closed.
let fallback = null
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return {
      selected: Array.isArray(v?.selected) ? v.selected.filter(Number.isInteger) : [],
      known: Array.isArray(v?.known) ? v.known.filter(Number.isInteger) : [],
      runs: Array.isArray(v?.runs) ? v.runs : [],
    }
  } catch {
    return fallback ?? { selected: [], known: [], runs: [] }
  }
}
const write = (state) => {
  fallback = state
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // kept in `fallback`
  }
}
const withId = (list, id, on) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id))

const fail = (message, code) => Object.assign(new Error(message), { status: 400, code })

const serverStore = {
  guest: false,
  load: () => api('GET', '/api/memory'),
  setSelected: (id, on) => api(on ? 'PUT' : 'DELETE', `/api/me/selected/${id}`),
  setKnown: (id, on) => api(on ? 'PUT' : 'DELETE', `/api/me/known/${id}`),
  startRun: () => api('POST', '/api/training/runs', {}),
  saveAnswer: (run, answer) => api('POST', `/api/training/runs/${run.id}/answers`, { answers: [answer] }),
  finishRun: (run) => api('POST', `/api/training/runs/${run.id}/finish`, {}),
}

const guestStore = {
  guest: true,
  async load() {
    const { chronos } = await api('GET', '/api/chronos')
    const state = read()
    const ids = new Set(chronos.map((c) => c.id))
    // chronos an admin has deleted since are dropped from the saved lists
    const selected = state.selected.filter((id) => ids.has(id))
    const known = state.known.filter((id) => selected.includes(id))
    if (selected.length !== state.selected.length || known.length !== state.known.length) {
      write({ ...state, selected, known })
    }
    return {
      chronos: chronos.map((c) => ({ ...c, selected: selected.includes(c.id), known: known.includes(c.id) })),
      personal: [],
    }
  },
  async setSelected(id, on) {
    const state = read()
    // like on the server: taking a chrono off the line forgets that it was known
    write({ ...state, selected: withId(state.selected, id, on), known: on ? state.known : withId(state.known, id, false) })
  },
  async setKnown(id, on) {
    const state = read()
    if (on && !state.selected.includes(id)) return
    write({ ...state, known: withId(state.known, id, on) })
  },
  async startRun() {
    const { chronos } = await guestStore.load()
    const mine = chronos.filter((c) => c.selected)
    if (mine.length === 0) throw fail('Add some chronos to your memory line first')
    const todo = mine.filter((c) => !c.known)
    if (todo.length === 0) throw fail('All your chronos are marked as known', 'all_known')
    return { id: null, startedAt: Date.now(), chronos: todo, answers: [] }
  },
  // the answers are only kept in memory; the totals are what is stored, as on the server
  async saveAnswer(run, answer) {
    run.answers.push(answer)
  },
  async finishRun(run) {
    if (run.summary) return run.summary
    const total = run.answers.filter((a) => !a.skipped).length
    const summary = {
      total,
      correct: run.answers.filter((a) => a.correct).length,
      skipped: run.answers.length - total,
      finishedAt: Date.now(),
      durationMs: Date.now() - run.startedAt,
    }
    const state = read()
    write({ ...state, runs: [summary, ...state.runs].slice(0, MAX_RUNS) })
    run.summary = summary
    return summary
  },
}

export const storeFor = (user) => (user ? serverStore : guestStore)
