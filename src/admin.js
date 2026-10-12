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

export async function saveCard(creds, id, fields) {
  const r = await fetch(`/api/cards/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { ...headers(creds), 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `Save failed (${r.status})`)
  return data
}

// Stored value may be a bare article title (legacy) or a full URL.
export const wikipediaUrl = (value) =>
  !value
    ? ''
    : /^https?:\/\//.test(value)
      ? value
      : `https://en.wikipedia.org/wiki/${value}`
