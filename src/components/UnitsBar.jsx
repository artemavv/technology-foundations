import { useLang } from '../i18n.jsx'

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
            left: u.x1 - scrollLeft,
            width: u.x2 - u.x1,
          }}
        >
          {pick(u.label)}
        </span>
      ))}
    </div>
  )
}
