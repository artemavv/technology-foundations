// Log in or register. A new account is 'pending' until an admin approves it.
import { useEffect, useState } from 'react'
import logo from './assets/icon-43.png'
import { login, logout, register, safeNext, useUser } from './auth.js'
import { useLang } from './i18n.jsx'
import { importGuestMarks } from './memoryStore.js'

export default function LoginPage() {
  const { t, lang } = useLang()
  const { user, loading, refresh } = useUser()
  // 'login' | 'register'; ?mode=register opens the registration tab
  const [mode, setMode] = useState(() =>
    new URLSearchParams(window.location.search).get('mode') === 'register' ? 'register' : 'login',
  )
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [registered, setRegistered] = useState(false)
  const next = safeNext(new URLSearchParams(window.location.search).get('next'))

  useEffect(() => {
    document.title = `${t('siteTitle')} — ${t('accountLogIn')}`
  }, [t])

  const submit = async (e) => {
    e.preventDefault()
    if (mode === 'register' && password !== confirm) {
      setError(t('accountPasswordMismatch'))
      return
    }
    setBusy(true)
    setError('')
    try {
      if (mode === 'register') {
        await register(name, password, nickname)
        setRegistered(true)
        setPassword('')
        setConfirm('')
      } else {
        await login(name, password)
        await importGuestMarks() // what was marked before registering joins the account
        window.location.assign(next)
        return
      }
    } catch (err) {
      setError(err.code === 'pending' ? t('accountPendingNote') : err.message)
    }
    setBusy(false)
  }

  const switchTo = (m) => {
    setMode(m)
    setError('')
    setRegistered(false)
  }

  if (loading) return <p className="loading">{t('loading')}</p>
  return (
    <div className="login-page">
      <h1>
        <a href={`/?lang=${lang}`} title={t('siteTitle')}>
          <img src={logo} width="43" height="26" alt={t('siteTitle')} />
        </a>
      </h1>
      {user ? (
        <div className="login-box">
          <p>{t('accountSignedInAs', user.login)}</p>
          <div className="edit-buttons">
            <button type="button" onClick={() => logout().then(refresh)}>
              {t('accountLogOut')}
            </button>
            <a className="button-link primary" href={next}>
              {t('memoryLine')}
            </a>
          </div>
        </div>
      ) : (
        <form className="login-box edit-form" onSubmit={submit}>
          <div className="login-tabs" role="tablist">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? 'active' : ''}
                onClick={() => switchTo(m)}
              >
                {t(m === 'login' ? 'accountLogIn' : 'accountRegister')}
              </button>
            ))}
          </div>
          {registered ? (
            <p className="login-note" role="status">{t('accountPendingNote')}</p>
          ) : (
            <>
              <label>
                {t('accountLogin')}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="username"
                  maxLength={32}
                  required
                />
                {mode === 'register' && <span className="edit-hint">{t('accountLoginHint')}</span>}
              </label>
              {mode === 'register' && (
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
              )}
              <label>
                {t('accountPassword')}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 6 : undefined}
                  required
                />
                {mode === 'register' && <span className="edit-hint">{t('accountPasswordHint')}</span>}
              </label>
              {mode === 'register' && (
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
              )}
              {error && <p className="edit-error" role="alert">{error}</p>}
              <div className="edit-buttons">
                <button type="submit" className="primary" disabled={busy}>
                  {busy ? t('accountWorking') : t(mode === 'login' ? 'accountLogIn' : 'accountRegister')}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  )
}
