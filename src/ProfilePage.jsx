// Edit profile: change the nickname (shown in competition tables) and the password.
import { useEffect, useState } from 'react'
import { changePassword, updateNickname, useUser } from './auth.js'
import SiteHeading from './components/SiteHeading.jsx'
import { useLang } from './i18n.jsx'

function NicknameForm({ user, onSaved }) {
  const { t } = useLang()
  const [nickname, setNickname] = useState(user.nickname ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const saved = await updateNickname(nickname)
      setNickname(saved.nickname)
      setMessage(t('profileSaved'))
      onSaved()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form className="login-box edit-form" onSubmit={submit}>
      <label>
        {t('accountNickname')}
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoComplete="nickname"
          minLength={2}
          maxLength={24}
          required
        />
        <span className="edit-hint">{t('accountNicknameHint')}</span>
      </label>
      {error && <p className="edit-error" role="alert">{error}</p>}
      {message && <p className="login-note" role="status">{message}</p>}
      <div className="edit-buttons">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t('accountWorking') : t('profileSave')}
        </button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const { t } = useLang()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setMessage('')
    if (password !== confirm) {
      setError(t('accountPasswordMismatch'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await changePassword(current, password)
      setCurrent('')
      setPassword('')
      setConfirm('')
      setMessage(t('profilePasswordChanged'))
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form className="login-box edit-form" onSubmit={submit}>
      <label>
        {t('profilePasswordCurrent')}
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        {t('profilePasswordNew')}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <span className="edit-hint">{t('accountPasswordHint')}</span>
      </label>
      <label>
        {t('accountPasswordConfirm')}
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      {error && <p className="edit-error" role="alert">{error}</p>}
      {message && <p className="login-note" role="status">{message}</p>}
      <div className="edit-buttons">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t('accountWorking') : t('profileChangePassword')}
        </button>
      </div>
    </form>
  )
}

export default function ProfilePage() {
  const { t } = useLang()
  const { user, loading, refresh } = useUser()

  useEffect(() => {
    document.title = `${t('siteTitle')} — ${t('profileTitle')}`
  }, [t])

  // only for signed-in users
  useEffect(() => {
    if (!loading && !user) {
      window.location.replace(`/login.html?next=${encodeURIComponent('/profile.html')}`)
    }
  }, [loading, user])

  if (loading || !user) return <p className="loading">{t('loading')}</p>
  return (
    <div className="tr-page memory-page">
      <header className="tr-header">
        <SiteHeading sub={t('profileTitle')} />
      </header>
      <div className="profile-forms">
        <h3>{t('accountNickname')}</h3>
        <NicknameForm user={user} onSaved={refresh} />
        <h3>{t('accountPassword')}</h3>
        <PasswordForm />
      </div>
    </div>
  )
}
