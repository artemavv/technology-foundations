import { memo } from 'react'
import { useUser } from '../auth.js'
import { useLang } from '../i18n.jsx'

// A "Chronos" button beside the language flag, to the Chronos page. The page
// works without an account too (it is kept in the browser then); signed in, the
// tooltip names the account.
function AccountLink() {
  const { t, lang } = useLang()
  const { user, loading } = useUser()
  if (loading) return null
  const label = user ? t('accountOpenMemory', user.login) : t('memoryLine')
  return (
    <a className="account-link" href={`/memory.html?lang=${lang}`} title={label} aria-label={label}>
      {t('chronosTitle')}
    </a>
  )
}

export default memo(AccountLink)
