import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

  const articleRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  // Desktop: a card may use at most 90% of the column height. When the full text
  // is taller, `fit` is that limit; the card collapses, and when expanded it
  // grows to the limit and the text scrolls.
  const [fit, setFit] = useState(null)
  const contents = pick(card.contents)
  const multiPara = /\S\s*\n\s*\n\s*\S/.test(String(contents ?? ''))
  const collapsed = fit != null && multiPara && !expanded

  const measure = () => {
    const el = articleRef.current
    const col = el?.parentElement
    if (!el || !col?.classList.contains('card-col') || showSources) return
    // measure the full text, then restore the class before paint
    const wasCollapsed = el.classList.contains('collapsed')
    const prevMax = el.style.maxHeight // React's inline style; put it back below
    const text = el.querySelector('.card-contents')
    const prevTop = text?.scrollTop ?? 0 // unclamped while measuring; restore below
    el.classList.remove('collapsed')
    el.style.maxHeight = 'none'
    const limit = Math.round(col.clientHeight * 0.9)
    const tooTall = el.offsetHeight > limit
    el.style.maxHeight = prevMax
    if (wasCollapsed) el.classList.add('collapsed')
    if (text) text.scrollTop = prevTop
    setFit(tooTall ? limit : null)
  }
  useLayoutEffect(measure, [contents, card.photo, showSources, expanded])
  // the observer lives for the card's lifetime: re-creating it on each render
  // fires an initial callback, i.e. a re-measure on every mouse move
  const measureRef = useRef(measure)
  measureRef.current = measure
  useEffect(() => {
    const col = articleRef.current?.parentElement
    if (!col?.classList.contains('card-col')) return
    const observer = new ResizeObserver(() => measureRef.current())
    observer.observe(col)
    return () => observer.disconnect()
  }, [])

  // Expanded desktop card: drag the text up/down with the mouse to scroll it.
  const scrolling = fit != null && expanded
  useEffect(() => {
    const el = scrolling && articleRef.current?.querySelector('.card-contents')
    if (!el) return
    let startY = 0
    let startTop = 0
    let pressed = false
    let dragging = false
    const down = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      pressed = true
      dragging = false
      startY = e.clientY
      startTop = el.scrollTop
    }
    const move = (e) => {
      if (!pressed) return
      const dy = e.clientY - startY
      if (!dragging && Math.abs(dy) < 4) return
      if (!dragging) {
        dragging = true
        el.setPointerCapture(e.pointerId)
        el.classList.add('dragging')
      }
      el.scrollTop = startTop - dy
    }
    const up = () => {
      pressed = false
      if (!dragging) return
      dragging = false
      el.classList.remove('dragging')
      // a drag that started on a link must not follow it
      const swallow = (e) => {
        e.preventDefault()
        e.stopPropagation()
      }
      el.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => el.removeEventListener('click', swallow, true), 0)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [scrolling, contents])

  const expand = (e) => {
    if (collapsed && !e.target.closest('a, button')) setExpanded(true)
  }

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
      ref={articleRef}
      className={`card${card.status === 'pending' ? ' pending' : ''}${collapsed ? ' collapsed' : ''}${fit != null && expanded ? ' expanded' : ''}`}
      style={fit != null && expanded ? { maxHeight: fit } : undefined}
      id={anchor}
      onClick={expand}
    >
      {card.photo && (
        <img src={`/pictures/${card.photo}`} alt="" loading="lazy" onLoad={measure} />
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
      <RichText className="card-contents" text={contents} />
      {collapsed && (
        <button
          type="button"
          className="card-more"
          onClick={() => setExpanded(true)}
        >
          {t('showMore')}
        </button>
      )}
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
