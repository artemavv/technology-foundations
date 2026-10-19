import { useLang } from '../i18n.jsx'
import { textOn } from '../color.js'

// units have an optional level: 0 eon/era (default), 1 period, 2 epoch; one row each unless `rows` says otherwise
const ROW_HEIGHT = 26

export default function UnitsBar({ units, scrollLeft, viewportWidth, mapTime }) {
  const { pick } = useLang()
  const viewRight = scrollLeft + viewportWidth
  const visible = units
    .map((u) => {
      const a = mapTime(u.startMya)
      const b = mapTime(u.endMya)
      return { ...u, x1: Math.min(a, b), x2: Math.max(a, b) }
    })
    .filter((u) => u.x2 >= scrollLeft && u.x1 <= viewRight)

  return (
    <div className="units-bar">
      {visible.length === 0 && <span className="units-empty">—</span>}
      {visible.map((u) => (
        <span
          key={u.id}
          className="unit-chip"
          style={{
            background: u.color,
            color: textOn(u.color),
            top: (u.level ?? 0) * ROW_HEIGHT,
            bottom: 'auto',
            height: (u.rows ?? 1) * ROW_HEIGHT,
            // clip to the left screen edge so the title stays visible while the unit is on screen
            left: Math.max(u.x1 - scrollLeft, 0),
            width: u.x2 - Math.max(u.x1, scrollLeft),
          }}
        >
          {pick(u.label)}
        </span>
      ))}
    </div>
  )
}
