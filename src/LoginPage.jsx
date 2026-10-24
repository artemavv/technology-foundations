// Log in or register. A new account is 'pending' until an admin approves it.
import { useEffect, useState } from 'react'
import { login, logout, register, safeNext, useUser } from './auth.js'
import LangSwitcher from './components/LangSwitcher.jsx'
import { useLang } from './i18n.jsx'

export default function LoginPage() {
  const { t } = useLang()
  const { user, loading, refresh } = useUser()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [registered, setRegistered] = useState(false)
  const next = safeNext(new URLSearchParams(window.location.search).get('next'))

  useEffect(() => {
    document.title = `${t('siteTitle')} — ${t('accountLogIn')}`
  }, [t])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'register') {
        await register(name, password)
        setRegistered(true)
        setPassword('')
      } else {
        await login(name, password)
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
      <LangSwitcher />
      <h1>{t('siteTitle')}</h1>
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
      <p className="login-back">
        <a href="/">{t('memoryBackToTimeline')}</a>
      </p>
    </div>
  )
}
