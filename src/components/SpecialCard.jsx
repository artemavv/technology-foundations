import { memo } from 'react'
import { useLang } from '../i18n.jsx'
import RichText from './RichText.jsx'

// A special card: just a title and a text, no date, links or pictures. The view
// supplies the positioning wrapper. `which` is 'start' or 'end'; the title is
// linkable like any card's (#scard-start / #scard-end).
function SpecialCard({ which, card }) {
  const { pick, has, def, languages, lang, t } = useLang()
  const defLabel = languages.find((l) => l.code === def)?.label ?? def
  const anchor = `scard-${which}`
  return (
    <article className={`card scard scard-${which}`} id={anchor}>
      <h2 className="card-title scard-title">
        <a href={`#${anchor}`}>{pick(card.title)}</a>
        {lang !== def && !(has(card.title) && has(card.contents)) && (
          <span className="card-fallback" title={t('fallbackTip', defLabel)}>
            {def.toUpperCase()}
          </span>
        )}
      </h2>
      <RichText className="card-contents" text={pick(card.contents)} />
    </article>
  )
}

export default memo(SpecialCard)
