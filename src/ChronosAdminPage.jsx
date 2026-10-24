// Admin page: the shared chronos. A chrono follows the date of the card it is linked
// to; one without a card has a date of its own.
import { useEffect, useMemo, useState } from 'react'
import { deleteChrono, fetchChronos, saveChrono } from './admin.js'
import { useAdmin } from './auth.js'
import AdminNav from './components/AdminNav.jsx'
import AdminOnly from './components/AdminOnly.jsx'
import { useLang } from './i18n.jsx'

const byAge = (a, b) => b.mya - a.mya || a.id - b.id

function ChronoForm({ chrono, cards, onSaved, onCancel }) {
  const { t, languages, pick } = useLang()
  const [titles, setTitles] = useState(() =>
    Object.fromEntries(languages.map((l) => [l.code, chrono?.title?.[l.code] ?? ''])),
  )
  const [cardId, setCardId] = useState(chrono?.cardId ?? '')
  const [date, setDate] = useState(chrono && !chrono.cardId ? chrono.time : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      onSaved(await saveChrono(chrono?.id ?? null, { title: titles, ...(cardId ? { cardId } : { date }) }))
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="tr-form chrono-form" onSubmit={submit}>
      {languages.map((l) => (
        <label key={l.code}>
          {t('chronosTitleIn', l.label ?? l.code)}
          <input
            value={titles[l.code]}
            onChange={(e) => setTitles({ ...titles, [l.code]: e.target.value })}
            maxLength={80}
          />
        </label>
      ))}
      <label>
        {t('chronosCard')}
        <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
          <option value="">{t('chronosNoCard')}</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.time} — {pick(c.title)}
            </option>
          ))}
        </select>
        {cardId && <span className="edit-hint">{t('chronosFollows')}</span>}
      </label>
      {!cardId && (
        <label>
          {t('date')}
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder={t('datePlaceholder')}
            required
          />
        </label>
      )}
      {error && <p className="edit-error" role="alert">{error}</p>}
      <div className="edit-buttons">
        <button type="button" onClick={onCancel} disabled={saving}>
          {t('cancel')}
        </button>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  )
}

export default function ChronosAdminPage() {
  const { t, pick } = useLang()
  const admin = useAdmin() // null = checking
  const [chronos, setChronos] = useState(null)
  const [cards, setCards] = useState([])
  const [editing, setEditing] = useState(null) // chrono id, or 'new'
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = `${t('siteTitle')} — ${t('chronosTitle')}`
  }, [t])

  useEffect(() => {
    if (!admin) return
    fetchChronos()
      .then(setChronos)
      .catch((err) => setError(err.message))
    fetch('/data/cards.json')
      .then((r) => r.json())
      .then((list) => setCards([...list].sort(byAge)))
      .catch(() => setCards([]))
  }, [admin])

  const items = useMemo(() => (chronos ? [...chronos].sort(byAge) : []), [chronos])

  const saved = (chrono) => {
    // reload: the list also carries how many users have each chrono
    fetchChronos().then(setChronos)
    setEditing(null)
    return chrono
  }

  const remove = async (chrono) => {
    if (!window.confirm(t('chronosConfirmDelete', pick(chrono.title)))) return
    setError('')
    try {
      await deleteChrono(chrono.id)
      setChronos((list) => list.filter((c) => c.id !== chrono.id))
    } catch (err) {
      setError(err.message)
    }
  }

  if (admin === null) return <p className="loading">{t('loading')}</p>
  if (!admin) return <AdminOnly />
  return (
    <div className="tr-page">
      <header className="tr-header">
        <h1>{t('chronosTitle')}</h1>
        <AdminNav />
        <button type="button" className="primary" onClick={() => setEditing('new')} disabled={editing === 'new'}>
          {t('chronosAdd')}
        </button>
      </header>
      {error && <p className="edit-error" role="alert">{error}</p>}
      {!chronos && !error && <p className="loading">{t('loading')}</p>}
      {editing === 'new' && (
        <section className="tr-row">
          <ChronoForm cards={cards} onSaved={saved} onCancel={() => setEditing(null)} />
        </section>
      )}
      {items.map((c) => (
        <section className="tr-row" key={c.id}>
          {editing === c.id ? (
            <ChronoForm chrono={c} cards={cards} onSaved={saved} onCancel={() => setEditing(null)} />
          ) : (
            <div className="chrono-admin-row">
              <span className="nav-time">{c.time}</span>
              <span className="memory-text">
                <span className="nav-title">{pick(c.title)}</span>
                {c.cardId && <span className="tr-time">{t('chronosLinked', c.cardId)}</span>}
                {c.cardMissing && <span className="tr-badge">{t('chronosCardMissing')}</span>}
                <span className="tr-time">{t('chronosUsers', c.users)}</span>
              </span>
              <span className="memory-actions">
                <button type="button" onClick={() => setEditing(c.id)}>
                  {t('edit')}
                </button>
                <button type="button" className="danger" onClick={() => remove(c)}>
                  {t('usersDelete')}
                </button>
              </span>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
