import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createBlock } from '../admin.js'

export default function BlockModal({ cats, creds, onSaved, onClose }) {
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
      onSaved(await createBlock(creds, { title, time, category }))
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add block">
      <form className="edit-form" onSubmit={submit}>
        <h2>Add block</h2>
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
            placeholder="2–3 words"
            required
          />
        </label>
        <label>
          Start date
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g. 12 Gya, 300 Mya, 233 Kya, 3200 BC"
            required
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            {keys.map((k) => (
              <option key={k} value={k}>
                {cats[k].label ?? k}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="edit-error" role="alert">{error}</p>}
        <div className="edit-buttons">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
