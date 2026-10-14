import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../i18n.jsx'
import RichText from './RichText.jsx'
import EditModal from './EditModal.jsx'

// The sources list; inline under the card (desktop) or in a popup (sourcesModal).
function SourcesList({ sources, id }) {
  const { t } = useLang()
  return (
    <section className="card-sources" id={id}>
      <h3>{t('sources')}</h3>
      <ol>
        {sources.map((src) => {
          const { url, title: label } = typeof src === 'string' ? { url: src } : src
          return (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
                {label || url}
              </a>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// Renders just the card; the view supplies the positioning wrapper.
function Card({ card, creds, onSaved, onDeleted, sourcesModal = false }) {
  const { pick, has, def, languages, lang, wikiHref, t } = useLang()
  const title = pick(card.title)
  const defLabel = languages.find((l) => l.code === def)?.label ?? def
  const anchor = `card-${card.id}`
  const [showSources, setShowSources] = useState(false)
  const sources = card.sources ?? []
  const [editing, setEditing] = useState(false)
  const [showIllustration, setShowIllustration] = useState(false)
  const sourcesId = `${anchor}-sources`

  const popupOpen = showIllustration || (sourcesModal && showSources)
  useEffect(() => {
    if (!popupOpen) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setShowIllustration(false)
      setShowSources(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [popupOpen])

  return (
    <article
      className={`card${card.status === 'pending' ? ' pending' : ''}`}
      id={anchor}
    >
      {card.photo && (
        <img src={`/pictures/${card.photo}`} alt="" loading="lazy" />
      )}
      <div className="card-time">
        {card.time}
        {lang !== def && !(has(card.title) && has(card.contents)) && (
          <span className="card-fallback" title={t('fallbackTip', defLabel)}>
            {def.toUpperCase()}
          </span>
        )}
      </div>
      <h2 className="card-title">
        <a href={`#${anchor}`}>{title}</a>
      </h2>
      <RichText className="card-contents" text={pick(card.contents)} />
      <div className="card-actions">
        {wikiHref(card.wikipedia) && (
          <a
            className="card-icon"
            href={wikiHref(card.wikipedia)}
            target="_blank"
            rel="noopener noreferrer"
            title={t('readOnWikipedia')}
            aria-label={t('wikipediaOn', title)}
          >
            W
          </a>
        )}
        {card.illustration && (
          <button
            type="button"
            className="card-icon"
            title={t('illustration')}
            aria-label={t('illustrationFor', title)}
            aria-haspopup="dialog"
            onClick={() => setShowIllustration(true)}
          >
            I
          </button>
        )}
        {sources.length > 0 && (
          <button
            type="button"
            className="card-icon"
            title={t('sources')}
            aria-label={t('sourcesFor', title)}
            aria-expanded={showSources}
            aria-controls={sourcesId}
            onClick={() => setShowSources((v) => !v)}
          >
            S
          </button>
        )}
        {creds && (
          <button
            type="button"
            className="card-icon"
            title={t('editCard')}
            aria-label={t('editFor', title)}
            aria-haspopup="dialog"
            onClick={() => setEditing(true)}
          >
            E
          </button>
        )}
      </div>
      {editing && (
        <EditModal
          card={card}
          creds={creds}
          onSaved={onSaved}
          onDeleted={onDeleted}
          onClose={() => setEditing(false)}
        />
      )}
      {showSources && sources.length > 0 && !sourcesModal && (
        <SourcesList sources={sources} id={sourcesId} />
      )}
      {showSources &&
        sources.length > 0 &&
        sourcesModal &&
        createPortal(
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={t('sourcesFor', title)}
            onClick={() => setShowSources(false)}
          >
            <div className="sources-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="sources-close"
                aria-label={t('close')}
                onClick={() => setShowSources(false)}
              >
                ×
              </button>
              <SourcesList sources={sources} id={sourcesId} />
            </div>
          </div>,
          document.body,
        )}
      {showIllustration &&
        createPortal(
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={() => setShowIllustration(false)}
          >
            <button
              type="button"
              className="modal-close"
              aria-label={t('close')}
              onClick={() => setShowIllustration(false)}
            >
              ×
            </button>
            <img
              src={`/pictures/${card.illustration}`}
              alt={title}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </article>
  )
}

export default memo(Card)
