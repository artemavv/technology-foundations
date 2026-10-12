// date markings along the timeline, oldest first (descending mya)
const MARKINGS = [
  { mya: 13800, label: '13.8 Gya' },
  { mya: 4540, label: '4.54 Gya' },
  { mya: 2500, label: '2.5 Gya' },
  { mya: 541, label: '541 Mya' },
  { mya: 252, label: '252 Mya' },
  { mya: 66, label: '66 Mya' },
  { mya: 7, label: '7 Mya' },
  { mya: 2.6, label: '2.6 Mya' },
  { mya: 1, label: '1 Mya' },
  { mya: 0.012, label: '10000 BC' },
  { mya: 0.0052, label: '3200 BC' },
  { mya: 0.0000045, label: '2500 BC' },
]

export default function TimelineBar({ mapTime }) {
  return (
    <div className="timeline-bar">
      {MARKINGS.map((m) => (
        <div
          key={m.label}
          className="timeline-mark"
          style={{ left: mapTime(m.mya) }}
        >
          <div className="tick" />
          <div className="label">{m.label}</div>
        </div>
      ))}
    </div>
  )
}