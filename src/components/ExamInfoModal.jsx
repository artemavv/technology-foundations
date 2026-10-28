import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../i18n.jsx'
import { EXAM_MAX, EXAM_MIN, EXAM_MS } from '../training.js'

// Shown instead of starting an exam when a guest clicks the button (the exam is for accounts) or there
// are too few memorized chronos: says so, and how the exam works.
export default function ExamInfoModal({ guest, onClose }) {
  const { t, lang } = useLang()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t('examTitle')}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="edit-form exam-info">
        <h2>{t('examTitle')}</h2>
        {guest ? (
          <p className="exam-info-need">
            {t('examGuest')}{' '}
            <a href={`/login.html?lang=${lang}&next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
              {t('accountLogIn')}
            </a>
          </p>
        ) : (
          <p className="exam-info-need">{t('examNeedMin', EXAM_MIN)}</p>
        )}
        <h3>{t('examRulesTitle')}</h3>
        <ul>
          <li>{t('examRule1', EXAM_MAX)}</li>
          <li>{t('examRule2', EXAM_MS / 1000)}</li>
          <li>{t('examRule3')}</li>
        </ul>
        <div className="edit-buttons">
          <button type="button" className="primary" onClick={onClose} autoFocus>
            {t('close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
