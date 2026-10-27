// Memory line: every chrono (a date with a short title), oldest first. A visitor puts
// chronos on their own memory line and trains on it; a signed-in user's memory line is
// kept on the server and they can add chronos of their own, a visitor's is kept in the
// browser (memoryStore.js) and holds global chronos only. With `mine` (the My chronos page) only the user's own memory
// line is listed: the chronos they put on it plus their own.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, logout, useUser } from './auth.js'
import AdminNav from './components/AdminNav.jsx'
import CardModal from './components/CardModal.jsx'
import SiteHeading from './components/SiteHeading.jsx'
import ChronoModal from './components/ChronoModal.jsx'
import { useLang } from './i18n.jsx'
import { storeFor } from './memoryStore.js'

const byAge = (a, b) => b.mya - a.mya || a.id - b.id

// `mine`: on the My chronos page every row is on the user's memory line, so there is no
// toggle (and no highlight); a chrono is taken off with a Remove button on the right, and
// can be marked as known (left out of training) with the green box on the far left
const Trash = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
)

const Pencil = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1zM14 7l3 3" />
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
      {mine && (
        <button
          type="button"
          className="memory-known-btn"
          aria-pressed={chrono.known}
          aria-label={t(chrono.known ? 'memoryUnmarkKnown' : 'memoryMarkKnown', title)}
          title={t(chrono.known ? 'memoryUnmarkKnown' : 'memoryMarkKnown', title)}
          onClick={() => onKnown(chrono)}
          disabled={busy}
        >
          <span aria-hidden="true">{'\u039E'}</span>
        </button>
      )}
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
        ) : chrono.personal ? (
          // an own chrono has no card, so its icon slot holds the Edit button
          <button
            type="button"
            className="memory-card memory-edit-btn"
            aria-haspopup="dialog"
            title={t('edit')}
            aria-label={`${t('edit')}: ${title}`}
            onClick={() => onEdit(chrono)}
            disabled={busy}
          >
            <Pencil />
          </button>
        ) : (
          <span className="memory-card-slot" aria-hidden="true" />
        )}
        <span className="memory-main">
          {chrono.personal ? (
            // the title of an own chrono opens the editor too (the pencil is the keyboard-friendly way in)
            <span
              className="nav-title memory-title-edit"
              title={t('edit')}
              onClick={() => !busy && onEdit(chrono)}
            >
              {title}
            </span>
          ) : (
            <span className="nav-title">{title}</span>
          )}
          {chrono.personal && <span className="tr-badge">{t('memoryMine')}</span>}
          {!mine && chrono.selected && chrono.known && <span className="tr-badge tr-badge-known">{t('memoryKnown')}</span>}
          {chrono.description && <span className="memory-description">{chrono.description}</span>}
        </span>
      </span>
      {(chrono.personal || mine) && (
        <span className="memory-actions memory-actions-inline">
          {chrono.personal ? (
            <button
              type="button"
              className="icon-btn memory-delete-btn"
              aria-label={`${t('memoryDelete')}: ${title}`}
              title={`${t('memoryDelete')}: ${title}`}
              onClick={() => onDelete(chrono)}
              disabled={busy}
            >
              <Trash />
            </button>
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
  const store = storeFor(user)
  const cardsRef = useRef(null) // cards.json, fetched when the first card is opened

  useEffect(() => {
    document.title = `${t('siteTitle')} — ${t(mine ? 'myChronos' : 'memoryLine')}`
  }, [t, mine])

  useEffect(() => {
    if (loading) return
    store
      .load()
      .then(setData)
      .catch((err) => setError(err.status === 401 ? t('memorySessionEnded') : t('memoryLoadFailed')))
  }, [loading, store, t])

  const items = useMemo(() => {
    // the full list holds the global chronos only; own ones are on My chronos
    if (!mine) return [...(data?.chronos ?? [])].sort(byAge)
    return [...(data?.chronos ?? []), ...(data?.personal ?? [])].sort(byAge).filter((c) => c.selected)
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
      await store.setSelected(chrono.id, selected)
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
      await store.setKnown(chrono.id, known)
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

  if (loading) return <p className="loading">{t('loading')}</p>
  return (
    <div className="tr-page memory-page">
      <header className="tr-header">
        <SiteHeading sub={mine ? t('myChronos') : undefined} />
        {user?.isAdmin && <AdminNav />}
        <div className={`memory-account${user ? '' : ' memory-guest'}`}>
          {user ? (
            <>
              <a className="memory-profile" href={`/profile.html?lang=${lang}`} title={t('profileTitle')}>
                @{user.nickname ?? user.login}
              </a>
              <button type="button" onClick={() => logout().then(() => window.location.assign('/login.html'))}>
                {t('accountLogOut')}
              </button>
            </>
          ) : (
            <a href={`/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
              {t('accountLogIn')}
            </a>
          )}
        </div>
      </header>
      {!mine && <p className="memory-note">{t('memoryIntro')}</p>}
      <div className="memory-toolbar">
        <a
          className={`memory-train-btn memory-mine-btn`}
          href={`/${mine ? 'memory' : 'my-chronos'}.html?lang=${lang}`}
        >
          {mine ? t('allChronos') : mineCount > 0 ? `${t('myChronos')} (${mineCount})` : t('myChronos')}
        </a>
        {mine && user && (
          <button type="button" className="memory-add-btn" onClick={() => setModal({})}>
            {t('memoryAdd')}
          </button>
        )}
        {mine &&
          (data && trainCount > 0 ? (
            <a className="memory-train-btn" href={`/train.html?lang=${lang}`}>
              {t('trainStart')}
            </a>
          ) : (
            // nothing to train on: a disabled button, and the tooltip says why
            <button
              type="button"
              className="memory-train-btn"
              disabled
              title={data ? t(mineCount === 0 ? 'memoryTrainEmpty' : 'memoryTrainAllKnown') : undefined}
            >
              {t('trainStart')}
            </button>
          ))}
      </div>
      {!user && (
        <p className="memory-note">
          {/* the text in [brackets] is the link to the registration form */}
          {t('memoryGuestNote').split(/\[([^\]]+)\]/).map((part, i) =>
            i % 2 ? (
              <a key={i} href={`/login.html?mode=register&next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
                {part}
              </a>
            ) : (
              part
            ),
          )}
        </p>
      )}
      {mine && items.length > 0 && (
        <p className="memory-note">
          {/* the Xi is drawn in a box, like the known button in the rows */}
          {t('memoryKnownNote')
            .split(/(\u039E)/)
            .map((part, i) =>
              part === '\u039E' ? (
                <span key={i} className="xi-mark">
                  {part}
                </span>
              ) : (
                part
              ),
            )}
        </p>
      )}
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
