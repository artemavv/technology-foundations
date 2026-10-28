import logo from '../assets/icon-43.png'
import { useLang } from '../i18n.jsx'

// Breadcrumb heading of the user pages: the site logo (the <h1>, a link to the timeline) >
// "Chronos" (the pages below are its sub-pages) > the sub-page, if this is one.
// The page being shown is the <h2>. The separators (">") are drawn in CSS before each step, so that a
// separator wraps together with the step it leads to.
export default function SiteHeading({ sub }) {
  const { t, lang } = useLang()
  return (
    <div className="site-heading">
      <h1>
        <a href={`/?lang=${lang}`} title={t('siteTitle')}>
          <img className="site-logo" src={logo} width="43" height="26" alt={t('siteTitle')} />
        </a>
      </h1>
      {sub ? (
        <>
          <a className="site-heading-parent" href={`/memory.html?lang=${lang}`}>
            {t('memoryLine')}
          </a>
          <h2>{sub}</h2>
        </>
      ) : (
        <h2>{t('memoryLine')}</h2>
      )}
    </div>
  )
}
