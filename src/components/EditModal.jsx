import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createCard, deleteCard, saveCard, uploadPicture } from '../admin.js'
import { useLang, wikipediaUrl } from '../i18n.jsx'

const NEW_CARD = { title: {}, time: '', contents: {}, sources: [], wikipedia: {} }

// card = null -> add a new card (anyone; pending unless creds are admin's)
export default function EditModal({ card, creds, onSaved, onDeleted, onClose }) {
  const { lang, def, own, pick, defaultText, t } = useLang()
  const code = lang.toUpperCase()
  const isNew = !card
  card = card ?? NEW_CARD
  const isPending = card.status === 'pending'
  const [submitted, setSubmitted] = useState(false)
  const [title, setTitle] = useState(own(card.title))
  const [time, setTime] = useState(card.time)
  const [contents, setContents] = useState(own(card.contents))
  const [sources, setSources] = useState(
    (card.sources ?? [])
      .map((s) => (typeof s === 'string' ? s : s.title ? `${s.url} (${s.title})` : s.url))
      .join('\n'),
  )
  const [wikipedia, setWikipedia] = useState(wikipediaUrl(own(card.wikipedia), lang))
  const [pictures, setPictures] = useState({
    photo: card.photo ?? '',
    illustration: card.illustration ?? '',
  })
  // a translation may be left empty (the card then falls back to the default language)
  const required = isNew || lang === def
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
    // only the current language is sent; the server merges it into the card
    const fields = {
      title: { [lang]: title },
      time,
      contents: { [lang]: contents },
      sources: sources.split('\n'),
      wikipedia: { [lang]: wikipedia },
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
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('cardSubmitted')}>
        <div className="edit-form">
          <h2>{t('thanks')}</h2>
          <p>{t('submitted')}</p>
          <div className="edit-buttons">
            <button type="button" className="primary" onClick={onClose}>
              {t('close')}
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
    if (!window.confirm(t('confirmDelete', pick(card.title)))) return
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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={isNew ? t('formAddCard', code) : t('formEditCard', code)}>
      <form className="edit-form" onSubmit={submit}>
        <h2>
          {isNew
            ? t('formAddCard', code)
            : isPending
              ? t('formEditPending', code)
              : t('formEditCard', code)}
        </h2>
        <label>
          {t('title')}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={lang === def ? '' : defaultText(card.title)}
            required={required}
          />
        </label>
        <label>
          {t('date')}
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder={t('datePlaceholder')}
            required
          />
          <span className="edit-hint">{t('dateHint')}</span>
        </label>
        <label>
          {t('description')}
          <textarea
            rows={6}
            value={contents}
            onChange={(e) => setContents(e.target.value)}
            placeholder={lang === def ? '' : defaultText(card.contents)}
            required={required}
          />
          <span className="edit-hint">{t('descriptionHint')}</span>
        </label>
        <label>
          {t('sourcesField')}
          <textarea
            rows={4}
            value={sources}
            onChange={(e) => setSources(e.target.value)}
          />
        </label>
        <label>
          {t('wikipediaLink')}
          <input
            type="url"
            value={wikipedia}
            onChange={(e) => setWikipedia(e.target.value)}
            placeholder={`https://${lang}.wikipedia.org/wiki/…`}
          />
          {lang !== def && <span className="edit-hint">{t('wikipediaHint')}</span>}
        </label>
        {creds ? (
          <>
            {[
              ['photo', t('photo'), t('photoHint')],
              ['illustration', t('illustration'), t('illustrationHint')],
            ].map(([key, label, hint]) => (
              <div className="edit-photo" key={key}>
                {label}
                {pictures[key] && <img src={`/pictures/${pictures[key]}`} alt="" />}
                <div className="edit-photo-buttons">
                  <label className="file-button">
                    {pictures[key] ? t('replace') : t('upload')}
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
                      {t('remove')}
                    </button>
                  )}
                </div>
                <span className="edit-hint">
                  {hint} {t('pictureLimits')}
                </span>
              </div>
            ))}
          </>
        ) : (
          isNew && (
            <p className="edit-hint">
              {t('pasteImages')}
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
              {t('delete')}
            </button>
          )}
          <button type="button" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </button>
          <button type="submit" className={isPending ? '' : 'primary'} disabled={saving}>
            {saving ? t('saving') : isNew && !creds ? t('submit') : t('save')}
          </button>
          {isPending && (
            <button
              type="button"
              className="primary"
              disabled={saving}
              onClick={(e) => submit(e, true)}
            >
              {t('approve')}
            </button>
          )}
        </div>
      </form>
    </div>,
    document.body,
  )
}
