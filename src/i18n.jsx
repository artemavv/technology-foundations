// Language selection and text lookup. Translatable data fields are maps
// ({ en: "…", de: "…" }); a bare string (older data) counts as the default
// language. The first entry of languages.json is the default and the fallback.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { STRINGS } from './strings.js'

const FALLBACK_LANGS = [{ code: 'en', label: 'English' }]
const Ctx = createContext(null)
export const useLang = () => useContext(Ctx)

const initialLang = (codes) => {
  const wanted = [new URLSearchParams(window.location.search).get('lang')]
  try {
    wanted.push(localStorage.getItem('lang'))
  } catch {
    // the remembered choice is optional
  }
  for (const l of navigator.languages ?? []) wanted.push(l.split('-')[0])
  return wanted.find((c) => c && codes.includes(c.toLowerCase()))?.toLowerCase() ?? codes[0]
}

// Wikipedia value (bare article title or full URL) -> link in `lang`'s edition.
export const wikipediaUrl = (value, lang = 'en') =>
  !value
    ? ''
    : /^https?:\/\//.test(value)
      ? value
      : `https://${lang}.wikipedia.org/wiki/${value}`

export function LangProvider({ children }) {
  const [languages, setLanguages] = useState(null)
  const [lang, setLangState] = useState(null)

  useEffect(() => {
    fetch('/data/languages.json')
      .then((r) => r.json())
      .catch(() => FALLBACK_LANGS)
      .then((list) => {
        const langs = Array.isArray(list) && list.length ? list : FALLBACK_LANGS
        setLanguages(langs)
        setLangState(initialLang(langs.map((l) => l.code)))
      })
  }, [])

  useEffect(() => {
    if (lang) document.documentElement.lang = lang
  }, [lang])

  // Keep ?lang= in the address bar equal to the language shown, so that copying
  // the URL (or a card title's link) shares the language. replaceState adds no
  // history entry and leaves the other parameters and the #anchor alone. Only the
  // switcher remembers a choice: following a shared link does not.
  useEffect(() => {
    if (!lang) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('lang') === lang) return
    url.searchParams.set('lang', lang)
    window.history.replaceState(window.history.state, '', url)
  }, [lang])

  const value = useMemo(() => {
    if (!lang) return null
    const def = languages[0].code
    const own = (field) => {
      if (typeof field === 'string') return lang === def ? field : undefined
      return field?.[lang] || undefined
    }
    const dict = STRINGS[lang] ?? {}
    return {
      lang,
      def,
      languages,
      setLang: (code) => {
        setLangState(code)
        try {
          localStorage.setItem('lang', code)
        } catch {
          // optional
        }
      },
      // text in the current language, else the default language, else ''
      pick: (field) =>
        own(field) ??
        (typeof field === 'string' ? field : field?.[def]) ??
        '',
      has: (field) => own(field) !== undefined,
      // text in the current language only (what the edit form edits)
      own: (field) => own(field) ?? '',
      defaultText: (field) => (typeof field === 'string' ? field : (field?.[def] ?? '')),
      wikiHref: (field) => {
        if (typeof field === 'string') return wikipediaUrl(field, def)
        if (field?.[lang]) return wikipediaUrl(field[lang], lang)
        return field?.[def] ? wikipediaUrl(field[def], def) : ''
      },
      t: (key, ...args) => {
        const v = dict[key] ?? STRINGS.en[key] ?? key
        return typeof v === 'function' ? v(...args) : v
      },
    }
  }, [lang, languages])

  if (!value) return null
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
