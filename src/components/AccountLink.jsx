import { memo } from 'react'
import { useUser } from '../auth.js'
import { useLang } from '../i18n.jsx'

// A small round link beside the language flag, to the Memory line page. Signed
// out it shows a person; signed in, the first letter of the login. The Memory line
// page sends signed-out visitors to the login page and back.
function AccountLink() {
  const { t, lang } = useLang()
  const { user, loading } = useUser()
  if (loading) return null
  const label = user ? t('accountOpenMemory', user.login) : t('accountLogIn')
  return (
    <a className="account-link" href={`/memory.html?lang=${lang}`} title={label} aria-label={label}>
      {user ? (
        <span aria-hidden="true">{user.login[0].toUpperCase()}</span>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="4" fill="currentColor" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor" />
        </svg>
      )}
    </a>
  )
}

export default memo(AccountLink)
