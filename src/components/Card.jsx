import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../i18n.jsx'
import RichText from './RichText.jsx'
import EditModal from './EditModal.jsx'

const SITES = [
  { host: /(^|\.)wikipedia\.org$/i, word: 'Wikipedia', icon: 'W', cls: 'wiki' },
  { host: /(^|\.)(youtube\.com|youtu\.be)$/i, word: 'YouTube', icon: 'Y', cls: 'yt' },
]

function siteOf(url) {
  try {
    const host = new URL(url).hostname
    return SITES.find((s) => s.host.test(host))
  } catch {
    return undefined
  }
}

// "Tiktaalik - Wikipedia" -> "Tiktaalik"
const stripSite = (label, word) =>
  label.replace(new RegExp(`\\s*[-–—|:·]?\\s*${word}\\s*$`, 'i'), '').trim() || label

// The sources list; inline under the card (desktop) or in a popup (sourcesModal).
function SourcesList({ sources, id }) {
  const { t } = useLang()
  return (
    <section className="card-sources" id={id}>
      <h3>{t('sources')}</h3>
      <ol>
        {sources.map((src) => {
          const { url, title: label } = typeof src === 'string' ? { url: src } : src
          const site = siteOf(url)
          const text = label && site ? stripSite(label, site.word) : label
          return (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
                {text || url}
                {site && (
                  <span className={`src-icon ${site.cls}`} aria-label={site.word} title={site.word}>
                    {site.icon}
                  </span>
                )}
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
      {card.illustration && (
        <button
          type="button"
          className="card-thumb"
          title={t('illustration')}
          aria-label={t('illustrationFor', title)}
          aria-haspopup="dialog"
          onClick={() => setShowIllustration(true)}
        >
          <img src={`/pictures/${card.illustration}`} alt="" loading="lazy" />
        </button>
      )}
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
