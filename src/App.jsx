import { useEffect, useRef, useState } from 'react'
import Card from './components/Card.jsx'
import TimelineBar from './components/TimelineBar.jsx'
import UnitsBar from './components/UnitsBar.jsx'
import EditModal from './components/EditModal.jsx'
import { adminCredentials, fetchPending, verifyAdmin } from './admin.js'
import { layoutTimeline } from './timeScale.js'

export default function App() {
  const [cards, setCards] = useState(null)
  const [units, setUnits] = useState([])
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  )
  const [pending, setPending] = useState([])
  const [adding, setAdding] = useState(false)
  const [creds, setCreds] = useState(null)
  const scrollRef = useRef(null)

  // admin = login/password GET params that the server accepts
  useEffect(() => {
    const c = adminCredentials()
    if (!c) return
    verifyAdmin(c).then((ok) => {
      if (!ok) return
      setCreds(c)
      fetchPending(c).then(setPending) // pending cards are visible to admins only
    })
  }, [])

  const onDeleted = (id) => {
    setCards((prev) => prev.filter((c) => c.id !== id))
    setPending((prev) => prev.filter((c) => c.id !== id))
  }

  // a saved/approved/added card lands in the list matching its status
  const onSaved = (updated) => {
    const others = (list) => list.filter((c) => c.id !== updated.id)
    setCards((prev) =>
      updated.status === 'pending' ? others(prev) : [...others(prev), updated],
    )
    setPending((prev) =>
      updated.status === 'pending' ? [...others(prev), updated] : others(prev),
    )
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/data/cards.json').then((r) => r.json()),
      fetch('/data/timeline.json').then((r) => r.json()),
    ]).then(([cardData, unitData]) => {
      if (!cancelled) {
        setCards(cardData)
        setUnits(unitData)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // wheel scrolls the timeline horizontally (forward in time on scroll down)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      el.scrollLeft += e.deltaY + e.deltaX
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [cards])

  const measureViewport = () => {
    const el = scrollRef.current
    if (el) {
      setViewportWidth(el.clientWidth)
      setScrollLeft(el.scrollLeft)
    }
  }

  useEffect(() => {
    measureViewport()
    const onResize = () => measureViewport()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [cards])

  if (!cards) {
    return <div className="loading">Loading timeline…</div>
  }

  // oldest first = descending mya, leftmost
  const sorted = [...cards, ...pending].sort((a, b) => b.mya - a.mya)
  const { xs, contentWidth, mapTime } = layoutTimeline(
    sorted.map((c) => c.mya),
    viewportWidth,
  )
  const positioned = sorted.map((card, i) => ({ ...card, x: xs[i] }))

  return (
    <div className="app">
      <div
        className="stage-scroll"
        ref={scrollRef}
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
      >
        <div className="stage-content" style={{ width: contentWidth }}>
          <TimelineBar mapTime={mapTime} />
          <div className="cards-row">
            {positioned.map((card) => (
              <Card
                key={card.id}
                card={card}
                left={card.x}
                creds={creds}
                onSaved={onSaved}
                onDeleted={onDeleted}
              />
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="add-card"
        title="Add a card"
        aria-label="Add a card"
        onClick={() => setAdding(true)}
      >
        +
      </button>
      {adding && (
        <EditModal
          card={null}
          creds={creds}
          onSaved={onSaved}
          onClose={() => setAdding(false)}
        />
      )}
      <UnitsBar
        units={units}
        scrollLeft={scrollLeft}
        viewportWidth={viewportWidth}
        mapTime={mapTime}
      />
    </div>
  )
}