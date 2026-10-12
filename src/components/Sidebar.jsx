import { useEffect, useRef, useState } from 'react'
import { formatKya } from '../format.js'
import BlockModal from './BlockModal.jsx'

// readable text color (black/white) for a hex background
function textOn(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#1f2937' : '#fff'
}

const BLOCK_H = 36
const GAP = 8
// When fewer than LOW of the list height is free below the last shown block,
// the stack shifts up until HIGH of the height is free again.
const LOW = 0.2
const HIGH = 0.7

// Upward shift (px) of the stack for `count` shown blocks. Replaying the
// blocks one by one keeps it a pure function of the count, so going back
// undoes the same shifts.
function stackOffset(count, listHeight) {
  const step = BLOCK_H + GAP
  let offset = 0
  for (let k = 1; k <= count; k++) {
    const free = listHeight - (k * step - GAP - offset)
    if (free < LOW * listHeight) offset = k * step - GAP - (1 - HIGH) * listHeight
  }
  return offset
}

// cursorKya: age under the timeline's cursor line (thousands of years ago), or
// null before the cursor has been used. A block shows once the cursor has
// crossed its age left-to-right (cursorKya <= block.kya) and hides again when
// the cursor crosses back. Shown blocks stack from the top, oldest first.
export default function Sidebar({ blocks, cats, cursorKya, creds, onAdded, onClose }) {
  const [adding, setAdding] = useState(false)
  const [listHeight, setListHeight] = useState(600)
  const listRef = useRef(null)

  // hidden blocks wait just below the visible area and slide up from there
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setListHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const sorted = [...blocks].sort((a, b) => b.kya - a.kya) // oldest first
  const shownCount =
    cursorKya === null ? 0 : sorted.filter((b) => cursorKya <= b.kya).length
  const offset = stackOffset(shownCount, listHeight)
  return (
    <aside className="sidebar" aria-label="Blocks">
      <div className="sidebar-header">
        <span>Blocks</span>
        {creds && (
          <button
            type="button"
            className="sidebar-btn"
            title="Add a block"
            aria-label="Add a block"
            onClick={() => setAdding(true)}
          >
            +
          </button>
        )}
        <button
          type="button"
          className="sidebar-btn"
          title="Hide sidebar"
          aria-label="Hide sidebar"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <ul className="block-list" ref={listRef}>
        {sorted.map((b, i) => {
          const color = cats[b.category]?.color ?? '#9ca3af'
          const shown = i < shownCount // the shown blocks are a prefix of the list
          return (
            <li
              key={b.id}
              className={`block${shown ? ' shown' : ''}`}
              style={{
                background: color,
                color: textOn(color),
                top: shown ? i * (BLOCK_H + GAP) - offset : listHeight,
              }}
              title={`${formatKya(b.kya)} · ${cats[b.category]?.label ?? b.category}`}
            >
              {b.title}
            </li>
          )
        })}
      </ul>
      {adding && (
        <BlockModal
          cats={cats}
          creds={creds}
          onSaved={onAdded}
          onClose={() => setAdding(false)}
        />
      )}
    </aside>
  )
}
