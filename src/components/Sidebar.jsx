import { useEffect, useRef, useState } from 'react'
import { formatKya } from '../format.js'
import { textOn } from '../color.js'
import BlockModal from './BlockModal.jsx'
import { useLang } from '../i18n.jsx'

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
  const { pick, t } = useLang()
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
    <aside className="sidebar" aria-label={t('blocks')}>
      <div className="sidebar-header">
        <span>{t('blocks')}</span>
        {creds && (
          <button
            type="button"
            className="sidebar-btn"
            title={t('addBlock')}
            aria-label={t('addBlock')}
            onClick={() => setAdding(true)}
          >
            +
          </button>
        )}
        <button
          type="button"
          className="sidebar-btn"
          title={t('hideSidebar')}
          aria-label={t('hideSidebar')}
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
              title={`${formatKya(b.kya)} · ${pick(cats[b.category]?.label) || b.category}`}
            >
              {pick(b.title)}
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
