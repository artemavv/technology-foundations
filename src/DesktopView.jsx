import { useEffect, useRef, useState } from 'react'
import Card from './components/Card.jsx'
import SpecialCard from './components/SpecialCard.jsx'
import TimelineBar from './components/TimelineBar.jsx'
import UnitsBar from './components/UnitsBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import LangSwitcher from './components/LangSwitcher.jsx'
import { useLang } from './i18n.jsx'
import EditModal from './components/EditModal.jsx'
import { adminCredentials, fetchPending, verifyAdmin } from './admin.js'
import { formatAge } from './format.js'
import { anchorTarget } from './anchors.js'
import { loadSpecialCards } from './specialCards.js'
import { CARD_WIDTH, END_MYA, SCARD_WIDTH, START_X, layoutTimeline } from './timeScale.js'

export default function DesktopView() {
  const { t } = useLang()
  const [cards, setCards] = useState(null)
  const [units, setUnits] = useState([])
  const [scards, setScards] = useState({}) // special cards: { start?, end? }
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
  const [measured, setMeasured] = useState(false) // the stage width is known, so card positions are final
  const jumpedRef = useRef(false) // the URL's anchor was handled on load
  const jumpRef = useRef(null) // scrolls to the card named by the URL's anchor; set on every render

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
      loadSpecialCards(),
    ]).then(([cardData, unitData, blockData, catData, specialData]) => {
      if (!cancelled) {
        setScards(specialData)
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
      setMeasured(true)
    }
  }

  // Open at the card named by the URL (#card-<id>): the browser can't do it, as
  // the cards are drawn after the data loads and sit in a scroller of their own.
  // The layout depends on the stage width, so wait until it is measured.
  useEffect(() => {
    if (!cards || !measured || jumpedRef.current) return
    jumpedRef.current = true
    jumpRef.current?.(false)
  }, [cards, measured])

  // later changes of the anchor (back/forward, a pasted link) scroll there too
  useEffect(() => {
    const onHash = () => jumpRef.current?.(true)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
  const { xs, contentWidth, mapTime, mapX, startCardX, endCardX } = layoutTimeline(
    sorted.map((c) => c.mya),
    viewportWidth,
    { start: Boolean(scards.start), end: Boolean(scards.end) },
  )
  // age under the cursor line; kept after the mouse leaves the stage so the
  // sidebar doesn't reset when the user moves over to it
  if (mouseX !== null) cursorMyaRef.current = mapX(scrollLeft + mouseX)
  const cursorMya = cursorMyaRef.current
  const positioned = sorted.map((card, i) => ({ ...card, x: xs[i] }))
  // Scroll the card named by the URL's anchor to the left of the stage. With
  // `onlyIfHidden` a card that is already fully on screen stays put (clicking a
  // card's own title changes the anchor too).
  jumpRef.current = (onlyIfHidden) => {
    const el = scrollRef.current
    const target = anchorTarget()
    if (!el || !target) return
    const x = target.special
      ? { start: startCardX, end: endCardX }[target.key]
      : positioned.find((c) => c.id === target.key)?.x
    if (x === undefined || x === null) return
    const width = target.special ? SCARD_WIDTH : CARD_WIDTH
    if (onlyIfHidden && x >= el.scrollLeft && x + width <= el.scrollLeft + el.clientWidth) return
    el.scrollLeft = Math.max(0, x - START_X)
  }

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
            
            {/* the timeline ends at 2500 BC */}
            {formatAge(Math.max(cursorMya, END_MYA))}
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
            {startCardX !== null && (
              <div className="card-col scard-col" style={{ left: startCardX, width: SCARD_WIDTH }}>
                <SpecialCard which="start" card={scards.start} />
                <div className="card-tail" />
              </div>
            )}
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
            {endCardX !== null && (
              <div className="card-col scard-col" style={{ left: endCardX, width: SCARD_WIDTH }}>
                <SpecialCard which="end" card={scards.end} />
                <div className="card-tail" />
              </div>
            )}
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