import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n.jsx'

// Flags are inline SVG (emoji flags don't render on every platform). Each is
// [viewBox, shapes]; a language without an entry shows its code instead.
const FLAGS = {
  en: [
    '0 0 60 30',
    <>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30 0V30M0 15H60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0V30M0 15H60" stroke="#C8102E" strokeWidth="6" />
    </>,
  ],
  ru: [
    '0 0 3 2',
    <>
      <rect width="3" height="2" fill="#fff" />
      <rect y="0.667" width="3" height="0.667" fill="#0039A6" />
      <rect y="1.333" width="3" height="0.667" fill="#D52B1E" />
    </>,
  ],
  it: [
    '0 0 3 2',
    <>
      <rect width="1" height="2" fill="#009246" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#CE2B37" />
    </>,
  ],
  de: [
    '0 0 3 2',
    <>
      <rect width="3" height="0.667" fill="#000" />
      <rect y="0.667" width="3" height="0.667" fill="#DD0000" />
      <rect y="1.333" width="3" height="0.667" fill="#FFCE00" />
    </>,
  ],
  es: [
    '0 0 3 2',
    <>
      <rect width="3" height="2" fill="#AA151B" />
      <rect y="0.5" width="3" height="1" fill="#F1BF00" />
    </>,
  ],
}

function Flag({ code }) {
  const flag = FLAGS[code]
  if (!flag) return <span className="flag-code">{code.toUpperCase()}</span>
  return (
    <svg viewBox={flag[0]} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {flag[1]}
    </svg>
  )
}

// A circle with the current flag; click to list the other languages as circles.
export default function LangSwitcher() {
  const { lang, languages, setLang, t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  if (languages.length < 2) return null
  const current = languages.find((l) => l.code === lang)
  return (
    <div className="lang-switcher" ref={ref}>
      <button
        type="button"
        className="lang-flag current"
        title={`${t('language')}: ${current.label}`}
        aria-label={`${t('language')}: ${current.label}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Flag code={lang} />
      </button>
      {open && (
        <ul className="lang-menu">
          {languages
            .filter((l) => l.code !== lang)
            .map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  className="lang-flag"
                  title={l.label}
                  aria-label={l.label}
                  onClick={() => {
                    setLang(l.code)
                    setOpen(false)
                  }}
                >
                  <Flag code={l.code} />
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
