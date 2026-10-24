// Client for user accounts: the session is an HttpOnly cookie set by the server.
// State-changing requests carry X-Requested-With: pf, which the server requires.
import { useCallback, useEffect, useState } from 'react'

export async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: {
      'X-Requested-With': 'pf',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await r.json().catch(() => null)
  if (!r.ok) {
    throw Object.assign(new Error(data?.error || `Request failed (${r.status})`), {
      status: r.status,
      code: data?.code,
    })
  }
  return data
}

let mePromise = null
const forgetMe = () => {
  mePromise = null
}

// the signed-in user ({ id, login }) or null; a network error counts as signed out
export const getMe = () =>
  (mePromise ??= api('GET', '/api/auth/me')
    .then((d) => d.user)
    .catch(() => null))

export const register = (login, password) => api('POST', '/api/auth/register', { login, password })

export async function login(name, password) {
  forgetMe()
  return api('POST', '/api/auth/login', { login: name, password })
}

export async function logout() {
  forgetMe()
  await api('POST', '/api/auth/logout')
}

export function useUser() {
  const [state, setState] = useState({ user: null, loading: true })
  const refresh = useCallback(() => {
    forgetMe()
    return getMe().then((user) => setState({ user, loading: false }))
  }, [])
  useEffect(() => {
    let cancelled = false
    getMe().then((user) => !cancelled && setState({ user, loading: false }))
    return () => {
      cancelled = true
    }
  }, [])
  return { ...state, refresh }
}

// Whether the signed-in user is an admin: null while that is being found out.
export function useAdmin() {
  const { user, loading } = useUser()
  return loading ? null : Boolean(user?.isAdmin)
}

// `?next=` is only followed when it is a path on this site
export const safeNext = (next, fallback = '/memory.html') =>
  typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : fallback
