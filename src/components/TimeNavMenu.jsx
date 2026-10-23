import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n.jsx'
import { NavList } from './TimeNav.jsx'

// Desktop time navigation: a clock button in the top left corner that opens a
// menu down the left edge with the same jump list as the phone modal.
// `items` = [{ title, card }]; `onGo(cardId)` scrolls to the card; `current` is
// the id of the entry on screen.
export default function TimeNavMenu({ items, onGo, current }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Escape or a click outside closes it (the stage stays usable, so no backdrop)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  if (items.length === 0) return null
  return (
    <div ref={ref}>
      <button
        type="button"
        className="d-nav-btn"
        title={t('timeNav')}
        aria-label={t('timeNav')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      </button>
      {open && (
        <nav className="nav-menu" aria-label={t('timeNav')}>
          <h2>{t('timeNav')}</h2>
          <NavList
            items={items}
            current={current}
            onPick={(id) => {
              setOpen(false)
              onGo(id)
            }}
          />
        </nav>
      )}
    </div>
  )
}
