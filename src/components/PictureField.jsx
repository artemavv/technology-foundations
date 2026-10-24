import { useState } from 'react'
import { uploadPicture } from '../admin.js'
import { useLang } from '../i18n.jsx'

// Upload / replace / remove control for a card picture. `value` is the stored
// file name ('' = none). With `readOnly` it only shows the current picture.
export default function PictureField({ label, hint, value, onChange, readOnly, disabled, onBusy, onError }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)

  const pick = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    onBusy?.(true)
    onError?.('')
    try {
      onChange(await uploadPicture(file))
    } catch (err) {
      onError?.(err.message)
    }
    setBusy(false)
    onBusy?.(false)
  }

  return (
    <div className="edit-photo">
      {label}
      {value && <img src={`/pictures/${value}`} alt="" />}
      {!readOnly && (
        <>
          <div className="edit-photo-buttons">
            <label className="file-button">
              {value ? t('replace') : t('upload')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={pick}
                disabled={disabled || busy}
              />
            </label>
            {value && (
              <button type="button" onClick={() => onChange('')} disabled={disabled || busy}>
                {t('remove')}
              </button>
            )}
          </div>
          <span className="edit-hint">
            {hint} {t('pictureLimits')}
          </span>
        </>
      )}
    </div>
  )
}
