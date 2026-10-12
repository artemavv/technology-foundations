import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { saveCard, wikipediaUrl } from '../admin.js'

export default function EditModal({ card, creds, onSaved, onClose }) {
  const [title, setTitle] = useState(card.title)
  const [time, setTime] = useState(card.time)
  const [contents, setContents] = useState(card.contents)
  const [sources, setSources] = useState((card.sources ?? []).join('\n'))
  const [wikipedia, setWikipedia] = useState(wikipediaUrl(card.wikipedia))
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
      const updated = await saveCard(creds, card.id, {
        title,
        time,
        contents,
        sources: sources.split('\n'),
        wikipedia,
      })
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit card">
      <form className="edit-form" onSubmit={submit}>
        <h2>Edit card</h2>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Date
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g. 12 Gya, 300 Mya, 233 Kya, 3200 BC"
            required
          />
          <span className="edit-hint">A bare number means years ago.</span>
        </label>
        <label>
          Description
          <textarea
            rows={6}
            value={contents}
            onChange={(e) => setContents(e.target.value)}
            required
          />
        </label>
        <label>
          Sources (one URL per line)
          <textarea
            rows={4}
            value={sources}
            onChange={(e) => setSources(e.target.value)}
          />
        </label>
        <label>
          Wikipedia link
          <input
            type="url"
            value={wikipedia}
            onChange={(e) => setWikipedia(e.target.value)}
            placeholder="https://en.wikipedia.org/wiki/…"
          />
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
