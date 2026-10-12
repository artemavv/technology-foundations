import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createCard, deleteCard, saveCard, uploadPicture, wikipediaUrl } from '../admin.js'

const NEW_CARD = { title: '', time: '', contents: '', sources: [], wikipedia: '' }

// card = null -> add a new card (anyone; pending unless creds are admin's)
export default function EditModal({ card, creds, onSaved, onDeleted, onClose }) {
  const isNew = !card
  card = card ?? NEW_CARD
  const isPending = card.status === 'pending'
  const [submitted, setSubmitted] = useState(false)
  const [title, setTitle] = useState(card.title)
  const [time, setTime] = useState(card.time)
  const [contents, setContents] = useState(card.contents)
  const [sources, setSources] = useState((card.sources ?? []).join('\n'))
  const [wikipedia, setWikipedia] = useState(wikipediaUrl(card.wikipedia))
  const [pictures, setPictures] = useState({
    photo: card.photo ?? '',
    illustration: card.illustration ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e, approve = false) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const fields = {
      title,
      time,
      contents,
      sources: sources.split('\n'),
      wikipedia,
      ...(creds ? pictures : {}), // only admins can attach pictures
    }
    try {
      if (isNew) {
        const created = await createCard(creds, fields)
        if (creds) {
          onSaved(created)
          onClose()
        } else {
          setSubmitted(true) // pending: not visible until an admin approves
        }
        return
      }
      onSaved(await saveCard(creds, card.id, fields, approve))
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (submitted) {
    return createPortal(
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Card submitted">
        <div className="edit-form">
          <h2>Thank you!</h2>
          <p>Your card was submitted and will appear once an admin approves it.</p>
          <div className="edit-buttons">
            <button type="button" className="primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  const pickPicture = (key) => async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setSaving(true)
    setError('')
    try {
      const name = await uploadPicture(creds, file)
      setPictures((p) => ({ ...p, [key]: name }))
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${card.title}" and its pictures? This cannot be undone.`)) return
    setSaving(true)
    setError('')
    try {
      await deleteCard(creds, card.id)
      onDeleted(card.id)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={isNew ? 'Add card' : 'Edit card'}>
      <form className="edit-form" onSubmit={submit}>
        <h2>{isNew ? 'Add card' : isPending ? 'Edit pending card' : 'Edit card'}</h2>
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
          <span className="edit-hint">
            A blank line starts a new paragraph. Links: [text](https://…)
          </span>
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
        {creds ? (
          <>
            {[
              ['photo', 'Photo', 'Shown on the card; 640×360 (16:9) works best.'],
              ['illustration', 'Illustration', 'Shown full-screen from the I icon.'],
            ].map(([key, label, hint]) => (
              <div className="edit-photo" key={key}>
                {label}
                {pictures[key] && <img src={`/pictures/${pictures[key]}`} alt="" />}
                <div className="edit-photo-buttons">
                  <label className="file-button">
                    {pictures[key] ? 'Replace…' : 'Upload…'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={pickPicture(key)}
                      disabled={saving}
                    />
                  </label>
                  {pictures[key] && (
                    <button
                      type="button"
                      onClick={() => setPictures((p) => ({ ...p, [key]: '' }))}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <span className="edit-hint">
                  {hint} JPEG, PNG or WebP, up to 2 MB. Applied on Save.
                </span>
              </div>
            ))}
          </>
        ) : (
          isNew && (
            <p className="edit-hint">
              Want to add images? Paste the image URLs into the description.
            </p>
          )
        )}
        {error && <p className="edit-error" role="alert">{error}</p>}
        <div className="edit-buttons">
          {!isNew && creds && (
            <button
              type="button"
              className="danger"
              onClick={remove}
              disabled={saving}
            >
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={isPending ? '' : 'primary'} disabled={saving}>
            {saving ? 'Saving…' : isNew && !creds ? 'Submit' : 'Save'}
          </button>
          {isPending && (
            <button
              type="button"
              className="primary"
              disabled={saving}
              onClick={(e) => submit(e, true)}
            >
              Approve
            </button>
          )}
        </div>
      </form>
    </div>,
    document.body,
  )
}
