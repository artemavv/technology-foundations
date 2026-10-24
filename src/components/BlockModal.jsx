import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createBlock } from '../admin.js'
import { useLang } from '../i18n.jsx'

export default function BlockModal({ cats, onSaved, onClose }) {
  const { lang, pick, t } = useLang()
  const keys = Object.keys(cats)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [category, setCategory] = useState(keys[0] ?? '')
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
      onSaved(await createBlock({ title: { [lang]: title }, time, category }))
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('addBlockForm', lang.toUpperCase())}>
      <form className="edit-form" onSubmit={submit}>
        <h2>{t('addBlockForm', lang.toUpperCase())}</h2>
        <label>
          {t('blockTitleField')}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
            placeholder={t('blockTitlePlaceholder')}
            required
          />
        </label>
        <label>
          {t('startDate')}
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder={t('datePlaceholder')}
            required
          />
        </label>
        <label>
          {t('category')}
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            {keys.map((k) => (
              <option key={k} value={k}>
                {pick(cats[k].label) || k}
              </option>
            ))}
          </select>
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
