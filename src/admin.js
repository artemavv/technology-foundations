// Admin API calls. An admin signs in on /login.html like any user; the session
// cookie identifies them, so these calls carry no credentials of their own.
import { api } from './auth.js'

// `approve: true` also publishes a pending card.
export const saveCard = (id, fields, approve = false) =>
  api('PUT', `/api/cards/${encodeURIComponent(id)}`, { ...fields, approve })

// Upload a JPEG/PNG/WebP; resolves to the stored file name.
export async function uploadPicture(file) {
  const r = await fetch('/api/pictures', {
    method: 'PUT',
    headers: { 'X-Requested-With': 'pf' },
    body: file,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `Upload failed (${r.status})`)
  return data.name
}

export const deleteCard = (id) => api('DELETE', `/api/cards/${encodeURIComponent(id)}`)

// Anyone may add a card: an admin's is published at once, anybody else's is 'pending'.
export const createCard = (fields) => api('POST', '/api/cards', fields)

export const fetchPending = () => api('GET', '/api/pending')

// A card's sources as the edit-form text: one "URL" or "URL (title)" per line.
export const sourcesToText = (sources) =>
  (sources ?? [])
    .map((s) => (typeof s === 'string' ? s : s.title ? `${s.url} (${s.title})` : s.url))
    .join('\n')

export const createBlock = (fields) => api('POST', '/api/blocks', fields)

// Special card ('start' or 'end'): title, contents (language maps) and langStatus only.
export const saveSpecialCard = (key, fields) => api('PUT', `/api/scards/${encodeURIComponent(key)}`, fields)

// ---- user accounts and chronos (admin pages) ----

// status: 'pending' | 'approved' | undefined for all
export const fetchUsers = (status) => api('GET', `/api/admin/users${status ? `?status=${status}` : ''}`)

// action: 'approve' | 'revoke'
export const setUserStatus = (id, action) => api('POST', `/api/admin/users/${id}/${action}`)

export const deleteUser = (id) => api('DELETE', `/api/admin/users/${id}`)

export const fetchChronos = () => api('GET', '/api/admin/chronos')

// id null creates; fields = { title: {lang: text}, cardId } or { title, date }
export const saveChrono = (id, fields) =>
  id === null ? api('POST', '/api/admin/chronos', fields) : api('PUT', `/api/admin/chronos/${id}`, fields)

export const deleteChrono = (id) => api('DELETE', `/api/admin/chronos/${id}`)
