// Admin page: every card, oldest first, in two columns (source language |
// translation language). "Edit" turns a row into two forms that are saved
// together. Date, sources and pictures are shared by all languages, so only the
// source form edits them.
import { useEffect, useState } from 'react'
import { adminCredentials, saveCard, sourcesToText, verifyAdmin } from './admin.js'
import PictureField from './components/PictureField.jsx'
import RichText from './components/RichText.jsx'
import { useLang, wikipediaUrl } from './i18n.jsx'

// text of a translatable field in one language ('' if missing); a plain string is the default language's
const textIn = (field, code, def) =>
  typeof field === 'string' ? (code === def ? field : '') : (field?.[code] ?? '')

// 'completed' or 'pending'; the default language is always completed, and so is a language with no entry
const statusOf = (card, code, def) => (code === def ? 'completed' : (card.langStatus?.[code] ?? 'completed'))

const remembered = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const remember = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // optional
  }
}

function CardView({ card, code, def }) {
  const { t } = useLang()
  const title = textIn(card.title, code, def)
  const contents = textIn(card.contents, code, def)
  if (!title && !contents) return <div className="tr-card tr-missing">{t('notTranslated')}</div>
  const pending = statusOf(card, code, def) === 'pending'
  return (
    <div className={pending ? 'tr-card tr-pending' : 'tr-card'}>
      <h3>
        {title || <span className="tr-missing">{t('notTranslated')}</span>}
        {pending && <span className="tr-badge">{t('statusPending')}</span>}
      </h3>
      {contents ? <RichText text={contents} /> : <p className="tr-missing">{t('notTranslated')}</p>}
    </div>
  )
}

// One language's fields. `shared` holds the language-independent values.
function LangForm({ code, def, card, values, onChange, shared, editable, creds, saving, onBusy, onError }) {
  const { t, languages } = useLang()
  const label = languages.find((l) => l.code === code)?.label ?? code
  const required = code === def // a translation may be left empty
  return (
    <div className={values.status === 'pending' ? 'tr-form tr-pending' : 'tr-form'}>
      <h3>{label}</h3>
      {code !== def && (
        <label>
          {t('translationStatus')}
          <select value={values.status} onChange={(e) => onChange({ status: e.target.value })}>
            <option value="completed">{t('statusCompleted')}</option>
            <option value="pending">{t('statusPending')}</option>
          </select>
        </label>
      )}
      <label>
        {t('title')}
        <input
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={code === def ? '' : textIn(card.title, def, def)}
          required={required}
        />
      </label>
      <label>
        {t('date')}
        <input
          value={shared.time}
          onChange={(e) => shared.set({ time: e.target.value })}
          placeholder={t('datePlaceholder')}
          readOnly={!editable}
          required
        />
        <span className="edit-hint">{editable ? t('dateHint') : t('sharedHint')}</span>
      </label>
      <label>
        {t('description')}
        <textarea
          rows={8}
          value={values.contents}
          onChange={(e) => onChange({ contents: e.target.value })}
          placeholder={code === def ? '' : textIn(card.contents, def, def)}
          required={required}
        />
        <span className="edit-hint">{t('descriptionHint')}</span>
      </label>
      <label>
        {t('sourcesField')}
        <textarea
          rows={4}
          value={shared.sources}
          onChange={(e) => shared.set({ sources: e.target.value })}
          readOnly={!editable}
        />
        {!editable && <span className="edit-hint">{t('sharedHint')}</span>}
      </label>
      <label>
        {t('wikipediaLink')}
        <input
          type="url"
          value={values.wikipedia}
          onChange={(e) => onChange({ wikipedia: e.target.value })}
          placeholder={`https://${code}.wikipedia.org/wiki/…`}
        />
        {code !== def && <span className="edit-hint">{t('wikipediaHint')}</span>}
      </label>
      {[
        ['photo', t('photo'), t('photoHint')],
        ['illustration', t('illustration'), t('illustrationHint')],
      ].map(([key, name, hint]) => (
        <PictureField
          key={key}
          label={name}
          hint={hint}
          value={shared[key]}
          onChange={(file) => shared.set({ [key]: file })}
          creds={creds}
          readOnly={!editable}
          disabled={saving}
          onBusy={onBusy}
          onError={onError}
        />
      ))}
    </div>
  )
}

// Both forms of a row; remounted (edits reset) when a language dropdown changes.
function RowEditor({ card, src, tr, def, creds, onSaved, onClose }) {
  const { t } = useLang()
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      [src, tr].map((code) => [
        code,
        {
          title: textIn(card.title, code, def),
          contents: textIn(card.contents, code, def),
          wikipedia: wikipediaUrl(textIn(card.wikipedia, code, def), code),
          status: statusOf(card, code, def),
        },
      ]),
    ),
  )
  const [shared, setShared] = useState({
    time: card.time,
    sources: sourcesToText(card.sources),
    photo: card.photo ?? '',
    illustration: card.illustration ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const both = (key) => ({ [src]: values[src][key], [tr]: values[tr][key] })
    try {
      onSaved(
        await saveCard(creds, card.id, {
          title: both('title'),
          contents: both('contents'),
          wikipedia: both('wikipedia'),
          // the default language is always completed
          langStatus: Object.fromEntries(
            [src, tr].filter((c) => c !== def).map((c) => [c, values[c].status]),
          ),
          time: shared.time,
          sources: shared.sources.split('\n'),
          photo: shared.photo,
          illustration: shared.illustration,
        }),
      )
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const form = (code) => (
    <LangForm
      code={code}
      def={def}
      card={card}
      values={values[code]}
      onChange={(patch) => setValues((v) => ({ ...v, [code]: { ...v[code], ...patch } }))}
      shared={{ ...shared, set: (patch) => setShared((s) => ({ ...s, ...patch })) }}
      editable={code === src}
      creds={creds}
      saving={saving}
      onBusy={setSaving}
      onError={setError}
    />
  )

  return (
    <form
      className="tr-edit"
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && !saving && onClose()}
    >
      <div className="tr-grid">
        {form(src)}
        {form(tr)}
      </div>
      {error && <p className="edit-error" role="alert">{error}</p>}
      <div className="edit-buttons">
        <button type="button" onClick={onClose} disabled={saving}>
          {t('cancel')}
        </button>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  )
}

function Row({ n, card, src, tr, def, creds, onSaved }) {
  const { t } = useLang()
  const [editing, setEditing] = useState(false)
  return (
    <section className="tr-row" id={card.id}>
      <div className="tr-time">
        <span className="tr-num">{n}</span>
        {card.time}
      </div>
      {editing ? (
        <RowEditor
          key={`${src}|${tr}`}
          card={card}
          src={src}
          tr={tr}
          def={def}
          creds={creds}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="tr-grid">
            <CardView card={card} code={src} def={def} />
            <CardView card={card} code={tr} def={def} />
          </div>
          <div className="edit-buttons">
            <button type="button" onClick={() => setEditing(true)}>
              {t('edit')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export default function TranslationsPage() {
  const { t, languages, def } = useLang()
  const codes = languages.map((l) => l.code)
  const [creds] = useState(adminCredentials)
  const [admin, setAdmin] = useState(null) // null = checking
  const [cards, setCards] = useState(null)
  const [failed, setFailed] = useState(false)
  const [langs, setLangs] = useState(() => {
    const q = new URLSearchParams(window.location.search)
    const pick = (name, key) =>
      [q.get(name), remembered(key)].find((c) => c && codes.includes(c))
    const src = pick('from', 'trFrom') ?? def
    const tr = pick('to', 'trTo')
    return { src, tr: tr && tr !== src ? tr : (codes.find((c) => c !== src) ?? src) }
  })

  useEffect(() => {
    document.title = `PF — ${t('translationsTitle')}`
  }, [t])

  useEffect(() => {
    if (!creds) return setAdmin(false)
    verifyAdmin(creds).then(setAdmin)
  }, [creds])

  useEffect(() => {
    if (!admin) return
    fetch('/data/cards.json')
      .then((r) => r.json())
      .then((list) => setCards([...list].sort((a, b) => b.mya - a.mya)))
      .catch(() => setFailed(true))
  }, [admin])

  // picking the language already chosen in the other dropdown swaps the two
  const choose = (which, code) => {
    const other = which === 'src' ? 'tr' : 'src'
    const next = { ...langs, [which]: code }
    if (langs[other] === code) next[other] = langs[which]
    setLangs(next)
    remember('trFrom', next.src)
    remember('trTo', next.tr)
  }

  const saved = (card) => setCards((list) => list.map((c) => (c.id === card.id ? card : c)))

  const select = (which, name) => (
    <label>
      {name}
      <select value={langs[which]} onChange={(e) => choose(which, e.target.value)}>
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  )

  if (admin === null) return <p className="loading">{t('loading')}</p>
  if (!admin) return <p className="loading">{t('adminsOnly')}</p>
  return (
    <div className="tr-page">
      <header className="tr-header">
        <h1>{t('translationsTitle')}</h1>
        <div className="tr-selects">
          {select('src', t('sourceLanguage'))}
          {select('tr', t('translationLanguage'))}
        </div>
      </header>
      {failed && <p className="edit-error">{t('loadFailed')}</p>}
      {!cards && !failed && <p className="loading">{t('loading')}</p>}
      {cards?.map((card, i) => (
        <Row key={card.id} n={i + 1} card={card} src={langs.src} tr={langs.tr} def={def} creds={creds} onSaved={saved} />
      ))}
    </div>
  )
}
