import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../i18n.jsx'

// Mobile time navigation: a small circle button; opens a list of jump points,
// each the date of a card with a short title. `items` = [{ title, card }];
// `onGo(cardId)` scrolls to the card. The button is hidden unless `shown`.
export default function TimeNav({ items, onGo, shown }) {
  const { pick, t } = useLang()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (items.length === 0) return null
  return (
    <>
      <button
        type="button"
        className={`m-nav-btn${shown ? '' : ' m-nav-hidden'}`}
        title={t('timeNav')}
        aria-label={t('timeNav')}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={t('timeNav')}
            onClick={() => setOpen(false)}
          >
            <div className="nav-modal" onClick={(e) => e.stopPropagation()}>
              <h2>{t('timeNav')}</h2>
              <button type="button" className="sources-close" aria-label={t('close')} onClick={() => setOpen(false)}>
                ×
              </button>
              <ul>
                {items.map(({ title, card }) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="nav-link"
                      onClick={() => {
                        setOpen(false)
                        onGo(card.id)
                      }}
                    >
                      <span className="nav-time">{card.time}</span>
                      <span className="nav-title">{pick(title)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
