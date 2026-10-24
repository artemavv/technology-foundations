import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../auth.js'
import { useLang } from '../i18n.jsx'

// Add or edit one of the user's own chronos: a title, a date and an optional description.
export default function ChronoModal({ chrono, onSaved, onClose }) {
  const { t } = useLang()
  const [title, setTitle] = useState(chrono?.title ?? '')
  const [date, setDate] = useState(chrono?.time ?? '')
  const [description, setDescription] = useState(chrono?.description ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const fields = { title, date, description }
      onSaved(
        chrono
          ? await api('PUT', `/api/me/personal/${chrono.id}`, fields)
          : await api('POST', '/api/me/personal', fields),
      )
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const heading = t(chrono ? 'memoryEditTitle' : 'memoryAddTitle')
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={heading}>
      <form className="edit-form" onSubmit={submit}>
        <h2>{heading}</h2>
        <label>
          {t('title')}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required autoFocus />
        </label>
        <label>
          {t('date')}
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder={t('datePlaceholder')}
            required
          />
          <span className="edit-hint">{t('dateHint')}</span>
        </label>
        <label>
          {t('memoryDescriptionOptional')}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={1000} />
        </label>
        {error && <p className="edit-error" role="alert">{error}</p>}
        <div className="edit-buttons">
          <button type="button" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
