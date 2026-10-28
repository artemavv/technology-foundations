import { useEffect, useState } from 'react'
import { fetchPending, fetchUsers } from '../admin.js'
import { useLang } from '../i18n.jsx'

const PAGES = [
  ['/memory.html', 'memoryLine'],
  ['/users.html', 'usersTitle', 'users'],
  ['/proposals.html', 'proposalsTitle', 'proposals'],
  ['/translations.html', 'translationsTitle'],
]

// Links to the Chronos page and the admin pages, for page headers; the page being shown is marked, and
// a link shows (X) when X accounts / proposed cards wait for approval. A page that
// already holds one of the lists passes its length as `users` / `proposals`, which
// keeps the count current as it approves or rejects; the other count is fetched.
export default function AdminNav({ users, proposals }) {
  const { t, lang } = useLang()
  const [fetched, setFetched] = useState({})

  useEffect(() => {
    let cancelled = false
    const keep = (key) => (list) => !cancelled && setFetched((f) => ({ ...f, [key]: list.length }))
    if (users === undefined) fetchUsers('pending').then(keep('users')).catch(() => {})
    if (proposals === undefined) fetchPending().then(keep('proposals')).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [users === undefined, proposals === undefined])

  const counts = { users: users ?? fetched.users, proposals: proposals ?? fetched.proposals }
  return (
    <nav className="admin-nav" aria-label={t('adminNav')}>
      {PAGES.map(([path, title, countKey]) => (
        <a
          key={path}
          href={`${path}?lang=${lang}`}
          aria-current={window.location.pathname === path ? 'page' : undefined}
        >
          {t(title)}
          {counts[countKey] > 0 && <span className="admin-count"> ({counts[countKey]})</span>}
        </a>
      ))}
    </nav>
  )
}
