import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../i18n.jsx'
import Card from './Card.jsx'

// A timeline card shown in a popup, read-only and with all its text.
export default function CardModal({ card, onClose }) {
  const { t, pick } = useLang()

  useEffect(() => {
    const onKey = (e) => {
      // a picture or sources popup opened from the card closes first
      if (e.key === 'Escape' && document.querySelectorAll('.modal-backdrop').length === 1) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={pick(card.title)}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button type="button" className="modal-close" aria-label={t('close')} onClick={onClose}>
        ×
      </button>
      <div className="card-modal">
        <Card card={card} sourcesModal />
      </div>
    </div>,
    document.body,
  )
}
