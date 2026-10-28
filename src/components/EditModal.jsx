import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createCard, deleteCard, fetchChronos, saveCard, saveChrono, sourcesToText } from '../admin.js'
import { useLang, wikipediaUrl } from '../i18n.jsx'
import PictureField from './PictureField.jsx'

const NEW_CARD = { title: {}, time: '', contents: {}, sources: [], wikipedia: {} }

// card = null -> add a new card (anyone; pending unless the user is an admin)
export default function EditModal({ card, admin, onSaved, onDeleted, onClose }) {
  const { lang, def, own, pick, defaultText, t } = useLang()
  const code = lang.toUpperCase()
  const isNew = !card
  card = card ?? NEW_CARD
  const isPending = card.status === 'pending'
  const [submitted, setSubmitted] = useState(false)
  const [title, setTitle] = useState(own(card.title))
  const [time, setTime] = useState(card.time)
  const [contents, setContents] = useState(own(card.contents))
  const [sources, setSources] = useState(sourcesToText(card.sources))
  const [wikipedia, setWikipedia] = useState(wikipediaUrl(own(card.wikipedia), lang))
  const [pictures, setPictures] = useState({
    photo: card.photo ?? '',
    illustration: card.illustration ?? '',
  })
  // Admins also set the title of the card's chrono (empty: the card's title). Its current value
  // is fetched; until it is there (or if that fails) the field is not sent, so nothing is overwritten.
  // A card whose chrono was deleted gets a Create chrono button instead. A new or pending card
  // gets its chrono when it is published.
  const [chronoTitle, setChronoTitle] = useState('')
  const [chronoState, setChronoState] = useState(isNew || isPending ? 'exists' : 'loading') // | 'missing' | 'failed'
  useEffect(() => {
    if (!admin || isNew || isPending) return
    fetchChronos()
      .then((list) => {
        const chrono = list.filter((c) => c.cardId === card.id).sort((a, b) => a.id - b.id)[0]
        const text = chrono?.title?.[lang] ?? ''
        // a title equal to the card's own means "use the card's title": shown as empty
        setChronoTitle(text === own(card.title) ? '' : text)
        setChronoState(chrono ? 'exists' : 'missing')
      })
      .catch(() => setChronoState('failed'))
  }, [])

  const createChrono = async () => {
    setSaving(true)
    setError('')
    try {
      const titles = typeof card.title === 'string' ? { [def]: card.title } : card.title
      await saveChrono(null, {
        title: Object.fromEntries(Object.entries(titles).map(([code, text]) => [code, text.slice(0, 80)])),
        cardId: card.id,
      })
      setChronoTitle('')
      setChronoState('exists')
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }
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
      ...(admin ? pictures : {}), // only admins can attach pictures
      ...(admin && chronoState === 'exists' ? { chrono: { [lang]: chronoTitle } } : {}),
    }
    try {
      if (isNew) {
        const created = await createCard(fields)
        if (admin) {
          onSaved(created)
          onClose()
        } else {
          setSubmitted(true) // pending: not visible until an admin approves
        }
        return
      }
      onSaved(await saveCard(card.id, fields, approve))
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

  const remove = async () => {
    if (!window.confirm(t('confirmDelete', pick(card.title)))) return
    setSaving(true)
    setError('')
    try {
      await deleteCard(card.id)
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
        {admin &&
          (chronoState === 'missing' ? (
            <div className="edit-chrono-missing">
              <span className="edit-hint">{t('chronoMissing')}</span>
              <button type="button" onClick={createChrono} disabled={saving}>
                {t('chronoCreate')}
              </button>
            </div>
          ) : (
            <label>
              {t('chronoTitle')}
              <input
                value={chronoTitle}
                onChange={(e) => setChronoTitle(e.target.value)}
                placeholder={title}
                maxLength={80}
                disabled={chronoState !== 'exists'}
              />
              <span className="edit-hint">{t('chronoTitleHint')}</span>
            </label>
          ))}
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
        {admin ? (
          <>
            {[
              ['photo', t('photo'), t('photoHint')],
              ['illustration', t('illustration'), t('illustrationHint')],
            ].map(([key, label, hint]) => (
              <PictureField
                key={key}
                label={label}
                hint={hint}
                value={pictures[key]}
                onChange={(name) => setPictures((p) => ({ ...p, [key]: name }))}
                disabled={saving}
                onBusy={setSaving}
                onError={setError}
              />
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
          {!isNew && admin && (
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
            {saving ? t('saving') : isNew && !admin ? t('submit') : t('save')}
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
