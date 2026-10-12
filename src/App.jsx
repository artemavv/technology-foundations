import { useEffect, useRef, useState } from 'react'
import Card from './components/Card.jsx'
import TimelineBar from './components/TimelineBar.jsx'
import UnitsBar from './components/UnitsBar.jsx'
import { layoutTimeline } from './timeScale.js'

export default function App() {
  const [cards, setCards] = useState(null)
  const [units, setUnits] = useState([])
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  )
  const scrollRef = useRef(null)

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
  const sorted = [...cards].sort((a, b) => b.mya - a.mya)
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
              <Card key={card.id} card={card} left={card.x} />
            ))}
          </div>
        </div>
      </div>
      <UnitsBar
        units={units}
        scrollLeft={scrollLeft}
        viewportWidth={viewportWidth}
        mapTime={mapTime}
      />
    </div>
  )
}