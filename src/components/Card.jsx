import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { wikipediaUrl } from '../admin.js'
import EditModal from './EditModal.jsx'

export default function Card({ card, left, creds, onSaved }) {
  const anchor = `card-${card.id}`
  const [showSources, setShowSources] = useState(false)
  const sources = card.sources ?? []
  const [editing, setEditing] = useState(false)
  const [showIllustration, setShowIllustration] = useState(false)
  const sourcesId = `${anchor}-sources`

  useEffect(() => {
    if (!showIllustration) return
    const onKey = (e) => e.key === 'Escape' && setShowIllustration(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showIllustration])

  return (
    <article className="card" id={anchor} style={{ left }}>
      {card.photo && (
        <img src={`/pictures/${card.photo}`} alt="" loading="lazy" />
      )}
      <div className="card-time">{card.time}</div>
      <h2 className="card-title">
        <a href={`#${anchor}`}>{card.title}</a>
      </h2>
      <p className="card-contents">{card.contents}</p>
      <div className="card-actions">
        {card.wikipedia && (
          <a
            className="card-icon"
            href={wikipediaUrl(card.wikipedia)}
            target="_blank"
            rel="noopener noreferrer"
            title="Read on Wikipedia"
            aria-label={`${card.title} on Wikipedia`}
          >
            W
          </a>
        )}
        {card.illustration && (
          <button
            type="button"
            className="card-icon"
            title="Illustration"
            aria-label={`Illustration for ${card.title}`}
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
            title="Sources"
            aria-label={`Sources for ${card.title}`}
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
            title="Edit card"
            aria-label={`Edit ${card.title}`}
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
          onClose={() => setEditing(false)}
        />
      )}
      {showSources && sources.length > 0 && (
        <section className="card-sources" id={sourcesId}>
          <h3>Sources</h3>
          <ol>
            {sources.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={url}
                >
                  {url}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
      {showIllustration &&
        createPortal(
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={card.title}
            onClick={() => setShowIllustration(false)}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => setShowIllustration(false)}
            >
              ×
            </button>
            <img
              src={`/pictures/${card.illustration}`}
              alt={card.title}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </article>
  )
}
