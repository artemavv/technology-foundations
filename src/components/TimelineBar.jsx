import { MARKINGS } from '../markings.js'

export default function TimelineBar({ mapTime }) {
  return (
    <div className="timeline-bar">
      {MARKINGS.map((m) => {
        const x = mapTime(m.mya)
        // a marking too close to the left edge is left-aligned so its label stays on screen
        return (
        <div
          key={m.label}
          className={`timeline-mark${x < 80 ? ' at-start' : ''}`}
          style={{ left: x }}
        >
          <div className="tick" />
          <div className="label">{m.label}</div>
        </div>
        )
      })}
    </div>
  )
}