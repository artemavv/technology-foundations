// Admin page: user accounts. New registrations are 'pending' until approved here.
import { useEffect, useState } from 'react'
import { deleteUser, fetchUsers, setUserStatus } from './admin.js'
import { useAdmin } from './auth.js'
import AdminNav from './components/AdminNav.jsx'
import AdminOnly from './components/AdminOnly.jsx'
import { useLang } from './i18n.jsx'

const when = (ms) => (ms ? new Date(ms).toLocaleString() : '')

function UserRow({ user, busy, onApprove, onRevoke, onDelete }) {
  const { t } = useLang()
  const pending = user.status === 'pending'
  return (
    <section className="tr-row user-row">
      <div className="user-info">
        <strong>{user.login}</strong>
        <span className="tr-time">{t('usersRegistered', when(user.createdAt))}</span>
        {user.lastLoginAt && <span className="tr-time">{t('usersLastLogin', when(user.lastLoginAt))}</span>}
      </div>
      <div className="edit-buttons">
        <button type="button" className="danger" onClick={() => onDelete(user)} disabled={busy}>
          {t(pending ? 'reject' : 'usersDelete')}
        </button>
        {pending ? (
          <button type="button" className="primary" onClick={() => onApprove(user)} disabled={busy}>
            {t('approve')}
          </button>
        ) : (
          <button type="button" onClick={() => onRevoke(user)} disabled={busy}>
            {t('usersRevoke')}
          </button>
        )}
      </div>
    </section>
  )
}

export default function UsersPage() {
  const { t } = useLang()
  const admin = useAdmin() // null = checking
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = `${t('siteTitle')} — ${t('usersTitle')}`
  }, [t])

  useEffect(() => {
    if (admin) {
      fetchUsers()
        .then(setUsers)
        .catch((err) => setError(err.message))
    }
  }, [admin])

  const act = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      setUsers(await fetchUsers())
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }
  const approve = (u) => act(() => setUserStatus(u.id, 'approve'))
  const revoke = (u) =>
    window.confirm(t('usersConfirmRevoke', u.login)) && act(() => setUserStatus(u.id, 'revoke'))
  const remove = (u) =>
    window.confirm(t(u.status === 'pending' ? 'usersConfirmReject' : 'usersConfirmDelete', u.login)) &&
    act(() => deleteUser(u.id))

  if (admin === null) return <p className="loading">{t('loading')}</p>
  if (!admin) return <AdminOnly />
  const pending = users?.filter((u) => u.status === 'pending') ?? []
  const approved = users?.filter((u) => u.status === 'approved') ?? []
  return (
    <div className="tr-page">
      <header className="tr-header">
        <h1>
          {t('usersTitle')}
          {pending.length > 0 && <span className="pr-count">{pending.length}</span>}
        </h1>
        <AdminNav users={users ? pending.length : undefined} />
      </header>
      {error && <p className="edit-error" role="alert">{error}</p>}
      {!users && !error && <p className="loading">{t('loading')}</p>}
      {users && (
        <>
          <h2 className="user-heading">{t('usersPending')}</h2>
          {pending.length === 0 && <p className="loading">{t('usersNone')}</p>}
          {pending.map((u) => (
            <UserRow key={u.id} user={u} busy={busy} onApprove={approve} onRevoke={revoke} onDelete={remove} />
          ))}
          <h2 className="user-heading">{t('usersApproved')}</h2>
          {approved.length === 0 && <p className="loading">{t('usersNone')}</p>}
          {approved.map((u) => (
            <UserRow key={u.id} user={u} busy={busy} onApprove={approve} onRevoke={revoke} onDelete={remove} />
          ))}
        </>
      )}
    </div>
  )
}
