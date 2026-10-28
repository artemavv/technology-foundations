// The Players page: nicknames with their points, best first.
//   GET /api/players   public: [{ nickname, competition, memory }], ordered by competition points,
//                      then memory points, then nickname
// Competition points are users.competition_points (earned in exam runs). Memory points are the
// chronos a user has marked as known, their own included. Only approved, non-admin accounts
// with a nickname are listed, and only the nickname is shown, never the login.
import { send } from './http.js'

export function playersRoutes(ctx, req, res, url) {
  if (url !== '/api/players' || req.method !== 'GET') return false
  const players = ctx.db
    .prepare(
      `SELECT u.nickname, u.competition_points AS competition,
              (SELECT COUNT(*) FROM user_known k WHERE k.user_id = u.id) AS memory
       FROM users u
       WHERE u.status = 'approved' AND u.is_admin = 0 AND u.nickname IS NOT NULL
       ORDER BY competition DESC, memory DESC, u.nickname_key`,
    )
    .all()
  send(res, 200, { players })
  return true
}
