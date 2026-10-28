// Players: nicknames with their competition and memory points, best first. Open to everyone.
import { useEffect, useState } from 'react'
import { api, useUser } from './auth.js'
import AdminNav from './components/AdminNav.jsx'
import SiteHeading from './components/SiteHeading.jsx'
import { useLang } from './i18n.jsx'

const MEDALS = [
  ['\u{1F947}', 'medalGold'],
  ['\u{1F948}', 'medalSilver'],
  ['\u{1F949}', 'medalBronze'],
]

export default function PlayersPage() {
  const { t } = useLang()
  const { user } = useUser()
  const [players, setPlayers] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = `${t('siteTitle')} \u2014 ${t('playersTitle')}`
  }, [t])

  useEffect(() => {
    api('GET', '/api/players')
      .then((r) => setPlayers(r.players))
      .catch(() => setError(t('playersLoadFailed')))
  }, [t])

  return (
    <div className="tr-page players-page">
      <header className="tr-header">
        <SiteHeading sub={t('playersTitle')} />
        {user?.isAdmin && <AdminNav />}
      </header>
      {error && <p className="edit-error" role="alert">{error}</p>}
      {players && players.length === 0 && <p className="memory-note">{t('playersEmpty')}</p>}
      {players && players.length > 0 && (
        <table className="players-table">
          <thead>
            <tr>
              <td colSpan="2" />
              <th scope="col">{t('playersCompetition')}</th>
              <th scope="col">{t('playersMemory')}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.nickname}>
                <td className="players-place">{i + 1}</td>
                <td className="players-nick">
                  {p.nickname}
                  {MEDALS[i] && (
                    <span className="players-medal" role="img" aria-label={t(MEDALS[i][1])} title={t(MEDALS[i][1])}>
                      {MEDALS[i][0]}
                    </span>
                  )}
                </td>
                <td className="players-points">{p.competition}</td>
                <td className="players-points">{p.memory}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
