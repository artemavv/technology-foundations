// Admin page: the cards proposed by visitors (stored as 'pending'), newest first.
// Each proposal can be approved (published), edited, or rejected (deleted).
// A proposal is written in the visitor's language, so the editor also offers
// the default language, to add the missing text while reviewing.
import { useEffect, useState } from 'react'
import { adminCredentials, deleteCard, fetchPending, saveCard, sourcesToText, verifyAdmin } from './admin.js'
import PictureField from './components/PictureField.jsx'
import RichText from './components/RichText.jsx'
import { useLang, wikipediaUrl } from './i18n.jsx'

// text of a translatable field in one language ('' if missing); a plain string is the default language's
const textIn = (field, code, def) =>
  typeof field === 'string' ? (code === def ? field : '') : (field?.[code] ?? '')

const asMap = (field, def) => (typeof field === 'string' ? { [def]: field } : { ...(field ?? {}) })

// the languages a proposal has any text in, in the order of languages.json
const writtenIn = (card, codes, def) =>
  codes.filter((c) => textIn(card.title, c, def) || textIn(card.contents, c, def))

// a title for messages: the default language's, else any
const titleOf = (card, def) => {
  const titles = asMap(card.title, def)
  return titles[def] || Object.values(titles).find(Boolean) || card.id
}

// newest first; proposals without a timestamp (older ones) come last, newest of them first
const newestFirst = (list) =>
  [...list].reverse().sort((a, b) => (b.submitted ?? '').localeCompare(a.submitted ?? ''))

const when = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

// the fields as the API takes them, unchanged (used to approve without editing)
const fieldsOf = (card, def) => ({
  title: asMap(card.title, def),
  contents: asMap(card.contents, def),
  wikipedia: asMap(card.wikipedia, def),
  time: card.time,
  sources: sourcesToText(card.sources).split('\n'),
})

function Preview({ card, codes, def }) {
  const { t, languages } = useLang()
  const sources = card.sources ?? []
  return (
    <>
      <div className="tr-grid">
        {writtenIn(card, codes, def).map((code) => {
          const wiki = wikipediaUrl(textIn(card.wikipedia, code, def), code)
          return (
            <div className="tr-card" key={code}>
              <h3>
                {textIn(card.title, code, def) || <span className="tr-missing">{t('notTranslated')}</span>}
                <span className="pr-lang">{languages.find((l) => l.code === code)?.label ?? code}</span>
              </h3>
              <RichText text={textIn(card.contents, code, def)} />
              {wiki && (
                <p>
                  <a href={wiki} target="_blank" rel="noopener noreferrer">
                    {wiki}
                  </a>
                </p>
              )}
            </div>
          )
        })}
      </div>
      {sources.length > 0 && (
        <div className="pr-sources">
          {t('sources')}:
          <ol>
            {sources.map((src) => {
              const { url, title } = typeof src === 'string' ? { url: src } : src
              return (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {title || url}
                  </a>
                </li>
              )
            })}
          </ol>
        </div>
      )}
      {(card.photo || card.illustration) && (
        <div className="pr-pictures">
          {[card.photo, card.illustration].filter(Boolean).map((name) => (
            <img key={name} src={`/pictures/${name}`} alt="" />
          ))}
        </div>
      )}
    </>
  )
}

// Edit form: a text form per language (the proposal's languages and the default
// one), then the fields shared by all languages.
function Editor({ card, codes, def, creds, busy, onBusy, onError, onSubmit, onCancel }) {
  const { t, languages } = useLang()
  const shown = codes.filter((c) => c === def || writtenIn(card, codes, def).includes(c))
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      shown.map((code) => [
        code,
        {
          title: textIn(card.title, code, def),
          contents: textIn(card.contents, code, def),
          wikipedia: wikipediaUrl(textIn(card.wikipedia, code, def), code),
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
  const set = (code, patch) => setValues((v) => ({ ...v, [code]: { ...v[code], ...patch } }))

  const submit = (e, approve) => {
    e.preventDefault()
    const each = (key) => Object.fromEntries(shown.map((c) => [c, values[c][key]]))
    onSubmit(
      {
        title: each('title'),
        contents: each('contents'),
        wikipedia: each('wikipedia'),
        time: shared.time,
        sources: shared.sources.split('\n'),
        photo: shared.photo,
        illustration: shared.illustration,
      },
      approve,
    )
  }

  return (
    <form
      className="tr-edit"
      onSubmit={(e) => submit(e, false)}
      onKeyDown={(e) => e.key === 'Escape' && !busy && onCancel()}
    >
      <div className="tr-grid">
        {shown.map((code) => (
          <div className="tr-form" key={code}>
            <h3>{languages.find((l) => l.code === code)?.label ?? code}</h3>
            <label>
              {t('title')}
              <input value={values[code].title} onChange={(e) => set(code, { title: e.target.value })} />
            </label>
            <label>
              {t('description')}
              <textarea
                rows={8}
                value={values[code].contents}
                onChange={(e) => set(code, { contents: e.target.value })}
              />
              <span className="edit-hint">{t('descriptionHint')}</span>
            </label>
            <label>
              {t('wikipediaLink')}
              <input
                type="url"
                value={values[code].wikipedia}
                onChange={(e) => set(code, { wikipedia: e.target.value })}
                placeholder={`https://${code}.wikipedia.org/wiki/…`}
              />
            </label>
          </div>
        ))}
      </div>
      <div className="tr-form">
        <label>
          {t('date')}
          <input
            value={shared.time}
            onChange={(e) => setShared((s) => ({ ...s, time: e.target.value }))}
            placeholder={t('datePlaceholder')}
            required
          />
          <span className="edit-hint">{t('dateHint')}</span>
        </label>
        <label>
          {t('sourcesField')}
          <textarea
            rows={4}
            value={shared.sources}
            onChange={(e) => setShared((s) => ({ ...s, sources: e.target.value }))}
          />
        </label>
        {[
          ['photo', t('photo'), t('photoHint')],
          ['illustration', t('illustration'), t('illustrationHint')],
        ].map(([key, label, hint]) => (
          <PictureField
            key={key}
            label={label}
            hint={hint}
            value={shared[key]}
            onChange={(name) => setShared((s) => ({ ...s, [key]: name }))}
            creds={creds}
            disabled={busy}
            onBusy={onBusy}
            onError={onError}
          />
        ))}
      </div>
      <div className="edit-buttons">
        <button type="button" onClick={onCancel} disabled={busy}>
          {t('cancel')}
        </button>
        <button type="submit" disabled={busy}>
          {busy ? t('saving') : t('save')}
        </button>
        <button type="button" className="primary" disabled={busy} onClick={(e) => submit(e, true)}>
          {t('approve')}
        </button>
      </div>
    </form>
  )
}

function Proposal({ card, creds, codes, def, onChanged, onApproved, onRejected }) {
  const { t, languages } = useLang()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const written = writtenIn(card, codes, def)
  const defLabel = languages.find((l) => l.code === def)?.label ?? def

  const run = async (job) => {
    setBusy(true)
    setError('')
    try {
      await job()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  // saving keeps the proposal pending; approving also publishes it
  const submit = (fields, approve) =>
    run(async () => {
      const saved = await saveCard(creds, card.id, fields, approve)
      if (approve) onApproved(card, saved)
      else {
        onChanged(saved)
        setEditing(false)
      }
    })
  const approve = () => run(async () => onApproved(card, await saveCard(creds, card.id, fieldsOf(card, def), true)))
  const reject = () => {
    if (!window.confirm(t('confirmReject', titleOf(card, def)))) return
    return run(async () => {
      await deleteCard(creds, card.id)
      onRejected(card)
    })
  }

  return (
    <section className="tr-row pr-item" id={card.id}>
      <div className="pr-meta">
        <span className="pr-date">{card.time}</span>
        {card.submitted && when(card.submitted) && <span>{t('proposalSubmitted', when(card.submitted))}</span>}
      </div>
      {!written.includes(def) && <p className="pr-warn">{t('noDefaultText', defLabel)}</p>}
      {editing ? (
        <Editor
          card={card}
          codes={codes}
          def={def}
          creds={creds}
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          onSubmit={submit}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <Preview card={card} codes={codes} def={def} />
          <div className="edit-buttons">
            <button type="button" className="danger" onClick={reject} disabled={busy}>
              {t('reject')}
            </button>
            <button type="button" onClick={() => setEditing(true)} disabled={busy}>
              {t('edit')}
            </button>
            <button type="button" className="primary" onClick={approve} disabled={busy}>
              {t('approve')}
            </button>
          </div>
        </>
      )}
      {error && <p className="edit-error" role="alert">{error}</p>}
    </section>
  )
}

export default function ProposalsPage() {
  const { t, languages, def } = useLang()
  const codes = languages.map((l) => l.code)
  const [creds] = useState(adminCredentials)
  const [admin, setAdmin] = useState(null) // null = checking
  const [proposals, setProposals] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    document.title = `PF — ${t('proposalsTitle')}`
  }, [t])

  useEffect(() => {
    if (!creds) return setAdmin(false)
    verifyAdmin(creds).then(setAdmin)
  }, [creds])

  useEffect(() => {
    if (admin) fetchPending(creds).then((list) => setProposals(newestFirst(list)))
  }, [admin, creds])

  const without = (card) => setProposals((list) => list.filter((c) => c.id !== card.id))
  const changed = (card) => setProposals((list) => list.map((c) => (c.id === card.id ? card : c)))

  if (admin === null) return <p className="loading">{t('loading')}</p>
  if (!admin) return <p className="loading">{t('adminsOnly')}</p>
  return (
    <div className="tr-page">
      <header className="tr-header">
        <h1>
          {t('proposalsTitle')}
          {proposals && <span className="pr-count">{proposals.length}</span>}
        </h1>
      </header>
      {notice && <p className="pr-notice" role="status">{notice}</p>}
      {!proposals && <p className="loading">{t('loading')}</p>}
      {proposals?.length === 0 && <p className="loading">{t('noProposals')}</p>}
      {proposals?.map((card) => (
        <Proposal
          key={card.id}
          card={card}
          creds={creds}
          codes={codes}
          def={def}
          onChanged={changed}
          onApproved={(old) => {
            setNotice(t('proposalApproved', titleOf(old, def)))
            without(old)
          }}
          onRejected={(old) => {
            setNotice(t('proposalRejected', titleOf(old, def)))
            without(old)
          }}
        />
      ))}
    </div>
  )
}
