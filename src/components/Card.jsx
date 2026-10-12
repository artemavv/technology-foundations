import { useState } from 'react'

export default function Card({ card, left }) {
  const anchor = `card-${card.id}`
  const [showSources, setShowSources] = useState(false)
  const sources = card.sources ?? []
  const sourcesId = `${anchor}-sources`
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
            href={`https://en.wikipedia.org/wiki/${card.wikipedia}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Read on Wikipedia"
            aria-label={`${card.title} on Wikipedia`}
          >
            W
          </a>
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
      </div>
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
    </article>
  )
}
