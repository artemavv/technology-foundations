// Admin access = `login` and `password` GET parameters, verified by the server.
const params = () => new URLSearchParams(window.location.search)

export function adminCredentials() {
  const p = params()
  const login = p.get('login')
  const password = p.get('password')
  return login && password ? { login, password } : null
}

const headers = (creds) => ({
  'X-Admin-Login': creds.login,
  'X-Admin-Password': creds.password,
})

export async function verifyAdmin(creds) {
  try {
    const r = await fetch('/api/admin/check', { headers: headers(creds) })
    return r.ok
  } catch {
    return false
  }
}

async function send(method, url, creds, body) {
  const r = await fetch(url, {
    method,
    headers: { ...(creds ? headers(creds) : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `Save failed (${r.status})`)
  return data
}

// `approve: true` also publishes a pending card.
export const saveCard = (creds, id, fields, approve = false) =>
  send('PUT', `/api/cards/${encodeURIComponent(id)}`, creds, { ...fields, approve })

// Upload a JPEG/PNG/WebP; resolves to the stored file name.
export async function uploadPicture(creds, file) {
  const r = await fetch('/api/pictures', {
    method: 'PUT',
    headers: headers(creds),
    body: file,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `Upload failed (${r.status})`)
  return data.name
}

export async function deleteCard(creds, id) {
  const r = await fetch(`/api/cards/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(creds),
  })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error(data.error || `Delete failed (${r.status})`)
  }
}

// creds may be null: anonymous visitors add cards as 'pending'.
export const createCard = (creds, fields) => send('POST', '/api/cards', creds, fields)

export async function fetchPending(creds) {
  const r = await fetch('/api/pending', { headers: headers(creds) })
  return r.ok ? r.json() : []
}

// A card's sources as the edit-form text: one "URL" or "URL (title)" per line.
export const sourcesToText = (sources) =>
  (sources ?? [])
    .map((s) => (typeof s === 'string' ? s : s.title ? `${s.url} (${s.title})` : s.url))
    .join('\n')

export const createBlock =(creds, fields) => send('POST', '/api/blocks', creds, fields)
