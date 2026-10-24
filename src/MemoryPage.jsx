// Memory line: every chrono (a date with a short title), oldest first. A signed-in
// user puts chronos on their own memory line, adds chronos of their own, and trains
// on their memory line. With `mine` (the My chronos page) only the user's own memory
// line is listed: the chronos they put on it plus their own.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, logout, useUser } from './auth.js'
import AdminNav from './components/AdminNav.jsx'
import CardModal from './components/CardModal.jsx'
import ChronoModal from './components/ChronoModal.jsx'
import LangSwitcher from './components/LangSwitcher.jsx'
import { useLang } from './i18n.jsx'

const byAge = (a, b) => b.mya - a.mya || a.id - b.id

// `mine`: on the My chronos page every row is on the user's memory line, so there is no
// toggle (and no highlight); a chrono is taken off with a Remove button on the right, and
// can be marked as known (left out of training) with the green tick toggle
const Tick = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const Trash = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
)

function Row({ chrono, mine, busy, onToggle, onKnown, onEdit, onDelete, onOpenCard }) {
  const { pick, t } = useLang()
  const title = chrono.personal ? chrono.title : pick(chrono.title)
  return (
    <li className={`memory-row${chrono.selected && !mine ? ' memory-on' : ''}${mine && chrono.known ? ' memory-known' : ''}`}>
      {!mine && !chrono.personal && (
        <button
          type="button"
          className="chrono-toggle"
          aria-pressed={chrono.selected}
          aria-label={t(chrono.selected ? 'memoryRemoveFromLine' : 'memoryAddToLine', title)}
          title={t(chrono.selected ? 'memoryRemoveFromLine' : 'memoryAddToLine', title)}
          disabled={busy}
          onClick={() => onToggle(chrono)}
        >
          {chrono.selected ? '✓' : '+'}
        </button>
      )}
      {!mine && chrono.personal && <span className="chrono-toggle chrono-own" aria-hidden="true">★</span>}
      <span className="nav-time">{chrono.time}</span>
      <span className="memory-text">
        {chrono.cardId ? (
          <button
            type="button"
            className="memory-card"
            aria-haspopup="dialog"
            title={t('memoryOpenCard')}
            aria-label={t('memoryOpenCard')}
            onClick={() => onOpenCard(chrono.cardId)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="3" width="16" height="18" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <span className="memory-card-slot" aria-hidden="true" />
        )}
        <span className="memory-main">
          <span className="nav-title">{title}</span>
          {chrono.personal && <span className="tr-badge">{t('memoryMine')}</span>}
          {!mine && chrono.selected && chrono.known && <span className="tr-badge tr-badge-known">{t('memoryKnown')}</span>}
          {chrono.description && <span className="memory-description">{chrono.description}</span>}
        </span>
      </span>
      {(chrono.personal || mine) && (
        <span className={`memory-actions${chrono.personal ? '' : ' memory-actions-inline'}`}>
          {mine && (
            <button
              type="button"
              className="memory-known-btn icon-btn"
              aria-pressed={chrono.known}
              aria-label={t(chrono.known ? 'memoryUnmarkKnown' : 'memoryMarkKnown', title)}
              title={t(chrono.known ? 'memoryUnmarkKnown' : 'memoryMarkKnown', title)}
              onClick={() => onKnown(chrono)}
              disabled={busy}
            >
              <Tick />
            </button>
          )}
          {chrono.personal ? (
            <>
              <button type="button" onClick={() => onEdit(chrono)} disabled={busy}>
                {t('edit')}
              </button>
              <button type="button" className="danger" onClick={() => onDelete(chrono)} disabled={busy}>
                {t('memoryDelete')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="icon-btn memory-trash-btn"
              aria-label={t('memoryRemoveFromLine', title)}
              title={t('memoryRemoveFromLine', title)}
              onClick={() => onToggle(chrono)}
              disabled={busy}
            >
              <Trash />
            </button>
          )}
        </span>
      )}
    </li>
  )
}

export default function MemoryPage({ mine = false }) {
  const { t, lang } = useLang()
  const { user, loading } = useUser()
  const [data, setData] = useState(null) // { chronos, personal }
  const [modal, setModal] = useState(null) // null | { chrono? }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shownCard, setShownCard] = useState(null)
  const cardsRef = useRef(null) // cards.json, fetched when the first card is opened

  useEffect(() => {
    document.title = `${t('siteTitle')} — ${t(mine ? 'myChronos' : 'memoryLine')}`
  }, [t, mine])

  useEffect(() => {
    if (loading) return
    if (!user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.replace(`/login.html?next=${next}`)
      return
    }
    api('GET', '/api/memory')
      .then(setData)
      .catch((err) => setError(err.status === 401 ? t('memorySessionEnded') : t('memoryLoadFailed')))
  }, [loading, user, t])

  const items = useMemo(() => {
    const all = [...(data?.chronos ?? []), ...(data?.personal ?? [])].sort(byAge)
    return mine ? all.filter((c) => c.selected) : all
  }, [data, mine])
  // on the user's memory line, and of those the ones training will ask about (not known)
  const mineCount = useMemo(
    () => (data ? data.chronos.filter((c) => c.selected).length + data.personal.length : 0),
    [data],
  )
  const trainCount = useMemo(
    () => (data ? data.chronos.filter((c) => c.selected && !c.known).length + data.personal.filter((c) => !c.known).length : 0),
    [data],
  )

  const setSelected = useCallback((id, selected) => {
    setData((d) => ({ ...d, chronos: d.chronos.map((c) => (c.id === id ? { ...c, selected } : c)) }))
  }, [])

  // optimistic: flip at once, put it back if the server refuses
  const toggle = async (chrono) => {
    const selected = !chrono.selected
    setError('')
    setSelected(chrono.id, selected)
    try {
      await api(selected ? 'PUT' : 'DELETE', `/api/me/selected/${chrono.id}`)
    } catch (err) {
      setSelected(chrono.id, !selected)
      setError(err.message)
    }
  }

  // optimistic, like toggle
  const setKnown = useCallback((chrono, known) => {
    const flip = (list) => list.map((c) => (c.id === chrono.id ? { ...c, known } : c))
    setData((d) => ({ ...d, chronos: flip(d.chronos), personal: flip(d.personal) }))
  }, [])
  const toggleKnown = async (chrono) => {
    const known = !chrono.known
    setError('')
    setKnown(chrono, known)
    try {
      await api(known ? 'PUT' : 'DELETE', `/api/me/known/${chrono.id}`)
    } catch (err) {
      setKnown(chrono, !known)
      setError(err.message)
    }
  }

  const saved = (chrono) =>
    setData((d) => ({
      ...d,
      personal: [...d.personal.filter((c) => c.id !== chrono.id), chrono].sort(byAge),
    }))

  const remove = async (chrono) => {
    if (!window.confirm(t('memoryConfirmDelete', chrono.title))) return
    setBusy(true)
    setError('')
    try {
      await api('DELETE', `/api/me/personal/${chrono.id}`)
      setData((d) => ({ ...d, personal: d.personal.filter((c) => c.id !== chrono.id) }))
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const openCard = async (id) => {
    setError('')
    try {
      cardsRef.current ??= await fetch('/data/cards.json').then((r) => r.json())
      const card = cardsRef.current.find((c) => c.id === id)
      if (card) setShownCard(card)
      else setError(t('memoryCardLoadFailed'))
    } catch {
      setError(t('memoryCardLoadFailed'))
    }
  }

  if (loading || !user) return <p className="loading">{t('loading')}</p>
  return (
    <div className="tr-page memory-page">
      <LangSwitcher />
      <header className="tr-header">
        <h1>{t(mine ? 'myChronos' : 'memoryLine')}</h1>
        {user.isAdmin && <AdminNav />}
        <div className="memory-account">
          <a href={`/?lang=${lang}`}>{t('memoryBackToTimeline')}</a>
          <span>{user.login}</span>
          <button type="button" onClick={() => logout().then(() => window.location.assign('/login.html'))}>
            {t('accountLogOut')}
          </button>
        </div>
      </header>
      <div className="memory-toolbar">
        <a className="memory-sublink" href={`/${mine ? 'memory' : 'my-chronos'}.html?lang=${lang}`}>
          {t(mine ? 'memoryLine' : 'myChronos')}
        </a>
        <button type="button" onClick={() => setModal({})}>
          {t('memoryAdd')}
        </button>
        <button
          type="button"
          className="primary"
          disabled={trainCount === 0}
          title={trainCount === 0 ? t(mineCount === 0 ? 'memoryTrainEmpty' : 'memoryTrainAllKnown') : undefined}
          onClick={() => window.location.assign(`/train.html?lang=${lang}`)}
        >
          {t('memoryTrain', trainCount)}
        </button>
      </div>
      {error && <p className="edit-error" role="alert">{error}</p>}
      {!data && !error && <p className="loading">{t('loading')}</p>}
      {data && items.length === 0 && (
        <p className="loading">{t(mine ? 'memoryEmptyMine' : 'memoryEmpty')}</p>
      )}
      <ul className="memory-list">
        {items.map((c) => (
          <Row
            key={c.id}
            chrono={c}
            mine={mine}
            busy={busy}
            onToggle={toggle}
            onKnown={toggleKnown}
            onEdit={(chrono) => setModal({ chrono })}
            onDelete={remove}
            onOpenCard={openCard}
          />
        ))}
      </ul>
      {shownCard && <CardModal card={shownCard} onClose={() => setShownCard(null)} />}
      {modal && <ChronoModal chrono={modal.chrono} onSaved={saved} onClose={() => setModal(null)} />}
    </div>
  )
}
