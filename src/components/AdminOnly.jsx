import { useLang } from '../i18n.jsx'

// Shown on an admin page to anyone who is not signed in as an admin.
export default function AdminOnly() {
  const { t } = useLang()
  const next = encodeURIComponent(window.location.pathname + window.location.search)
  return (
    <p className="loading">
      {t('adminsOnly')} <a href={`/login.html?next=${next}`}>{t('accountLogIn')}</a>
    </p>
  )
}
