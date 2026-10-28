import { useState } from 'react'
import { saveChrono } from '../admin.js'
import { useLang } from '../i18n.jsx'

// For admins, under the list of chronos: add a global chrono that is not linked to a card
// (a title in each language, the first one required, and a date).
export default function AdminChronoForm({ onAdded }) {
  const { t, languages } = useLang()
  const empty = () => Object.fromEntries(languages.map((l) => [l.code, '']))
  const [titles, setTitles] = useState(empty)
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      onAdded(await saveChrono(null, { title: titles, date }))
      setTitles(empty())
      setDate('')
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <form className="tr-form chrono-form admin-chrono-form" onSubmit={submit}>
      <h3>{t('chronosAdd')}</h3>
      {languages.map((l, i) => (
        <label key={l.code}>
          <span>
            {t('chronosTitleIn', l.label ?? l.code)}
            {i === 0 && <span className="required" aria-hidden="true"> *</span>}
          </span>
          <input
            value={titles[l.code]}
            onChange={(e) => setTitles({ ...titles, [l.code]: e.target.value })}
            maxLength={80}
            required={i === 0}
          />
        </label>
      ))}
      <label>
        <span>
          {t('date')}
          <span className="required" aria-hidden="true"> *</span>
        </span>
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder={t('datePlaceholder')}
          required
        />
        <span className="edit-hint">{t('dateHint')}</span>
      </label>
      {error && <p className="edit-error" role="alert">{error}</p>}
      <div className="edit-buttons">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  )
}
