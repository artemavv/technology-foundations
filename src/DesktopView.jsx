import { useEffect, useRef, useState } from 'react'
import Card from './components/Card.jsx'
import TimelineBar from './components/TimelineBar.jsx'
import UnitsBar from './components/UnitsBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import LangSwitcher from './components/LangSwitcher.jsx'
import { useLang } from './i18n.jsx'
import EditModal from './components/EditModal.jsx'
import { adminCredentials, fetchPending, verifyAdmin } from './admin.js'
import { formatKya } from './format.js'
import { layoutTimeline } from './timeScale.js'

export default function DesktopView() {
  const { t } = useLang()
  const [cards, setCards] = useState(null)
  const [units, setUnits] = useState([])
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  )
  const [blocks, setBlocks] = useState([])
  const [cats, setCats] = useState({})
  // the Tech Units sidebar is hidden unless the page was loaded with ?tf=on
  const sidebarEnabled = new URLSearchParams(window.location.search).get('tf') === 'on'
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (!sidebarEnabled) return false
    try {
      return localStorage.getItem('sidebar') !== 'closed'
    } catch {
      return true
    }
  })
  const [mouseX, setMouseX] = useState(null) // pointer x within the stage, or null
  const [pending, setPending] = useState([])
  const [adding, setAdding] = useState(false)
  const [creds, setCreds] = useState(null)
  const scrollRef = useRef(null)
  const cursorMyaRef = useRef(null) // last age under the cursor line

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
      // the sidebar is optional: a missing file just means no blocks
      fetch('/data/blocks.json').then((r) => r.json()).catch(() => []),
      fetch('/data/cats.json').then((r) => r.json()).catch(() => ({})),
    ]).then(([cardData, unitData, blockData, catData]) => {
      if (!cancelled) {
        setCards(cardData)
        setUnits(unitData)
        setBlocks(blockData)
        setCats(catData)
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

  // the stage width changes with the window and with the sidebar
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    measureViewport()
    const observer = new ResizeObserver(measureViewport)
    observer.observe(el)
    return () => observer.disconnect()
  }, [cards])

  const setSidebar = (open) => {
    setSidebarOpen(open)
    try {
      localStorage.setItem('sidebar', open ? 'open' : 'closed')
    } catch {
      // remembering the choice is optional
    }
  }

  if (!cards) {
    return <div className="loading">{t('loading')}</div>
  }

  // oldest first = descending mya, leftmost
  const sorted = [...cards, ...pending].sort((a, b) => b.mya - a.mya)
  const { xs, contentWidth, mapTime, mapX } = layoutTimeline(
    sorted.map((c) => c.mya),
    viewportWidth,
  )
  // age under the cursor line; kept after the mouse leaves the stage so the
  // sidebar doesn't reset when the user moves over to it
  if (mouseX !== null) cursorMyaRef.current = mapX(scrollLeft + mouseX)
  const cursorMya = cursorMyaRef.current
  const positioned = sorted.map((card, i) => ({ ...card, x: xs[i] }))

  return (
    <div className={`app${sidebarOpen ? ' sidebar-open' : ''}`}>
      <div className="main">
      <div
        className="stage"
        onMouseMove={(e) => setMouseX(e.clientX - e.currentTarget.getBoundingClientRect().left)}
        onMouseLeave={() => setMouseX(null)}
      >
      {mouseX !== null && (
        <>
          <div className="cursor-line" style={{ left: mouseX }} />
          <div
            className="cursor-label"
            style={{ left: Math.min(Math.max(mouseX, 40), viewportWidth - 40) }}
          >
            
            {/* the timeline ends at 2500 BC (4.5 Kya) */}
            {formatKya(Math.max(cursorMya, 0.0045) * 1000, 3)}
          </div>
        </>
      )}
      <div
        className="stage-scroll"
        ref={scrollRef}
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
      >
        <div className="stage-content" style={{ width: `calc(${contentWidth}px + var(--sidebar-reserve))` }}>
          <TimelineBar mapTime={mapTime} />
          <div className="cards-row">
            {positioned.map((card) => (
              <div className="card-col" key={card.id} style={{ left: card.x }}>
                <Card
                  card={card}
                  creds={creds}
                  onSaved={onSaved}
                  onDeleted={onDeleted}
                />
                <div className="card-tail" />
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
      <button
        type="button"
        className="add-card"
        title={t('addCard')}
        aria-label={t('addCard')}
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
      <LangSwitcher />
      {!sidebarEnabled ? null : sidebarOpen ? (
        <Sidebar
          blocks={blocks}
          cats={cats}
          cursorKya={cursorMya === null ? null : cursorMya * 1000}
          creds={creds}
          onAdded={(b) => setBlocks((prev) => [...prev, b])}
          onClose={() => setSidebar(false)}
        />
      ) : (
        <button
          type="button"
          className="sidebar-open-btn"
          title={t('showSidebar')}
          aria-label={t('showSidebar')}
          onClick={() => setSidebar(true)}
        >
          ☰
        </button>
      )}
    </div>
  )
}