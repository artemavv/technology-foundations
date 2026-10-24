import { useCallback, useEffect, useRef, useState } from 'react'
import Card from './components/Card.jsx'
import SpecialCard from './components/SpecialCard.jsx'
import TimelineBar from './components/TimelineBar.jsx'
import UnitsBar from './components/UnitsBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import AccountLink from './components/AccountLink.jsx'
import LangSwitcher from './components/LangSwitcher.jsx'
import TimeNavMenu from './components/TimeNavMenu.jsx'
import { useLang } from './i18n.jsx'
import EditModal from './components/EditModal.jsx'
import { fetchPending } from './admin.js'
import { useAdmin } from './auth.js'
import { formatAge } from './format.js'
import { anchorTarget } from './anchors.js'
import { loadSpecialCards, startIndex } from './specialCards.js'
import { CARD_WIDTH, END_MYA, SCARD_WIDTH, START_X, layoutTimeline } from './timeScale.js'

const NAV_JUMP_X = 100 // where the menu puts the card, from the left of the stage
const OPENING_X = 200 // where a page opened without an anchor puts the opening card: the card before it shows a little

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
  const [nav, setNav] = useState([]) // time navigation entries: [{ card: id, title }]
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
  const admin = useAdmin() === true
  const scrollRef = useRef(null)
  const cursorMyaRef = useRef(null) // last age under the cursor line
  const [measured, setMeasured] = useState(false) // the stage width is known, so card positions are final
  const jumpedRef = useRef(false) // the URL's anchor was handled on load
  const jumpRef = useRef(null) // scrolls to the card named by the URL's anchor; set on every render

  // pending cards are visible to admins only
  useEffect(() => {
    if (admin) fetchPending().then(setPending).catch(() => {})
  }, [admin])

  const positionedCache = useRef(new Map()) // see `positioned` below
  const onDeleted = useCallback((id) => {
    setCards((prev) => prev.filter((c) => c.id !== id))
    setPending((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // a saved/approved/added card lands in the list matching its status
  const onSaved = useCallback((updated) => {
    const others = (list) => list.filter((c) => c.id !== updated.id)
    setCards((prev) =>
      updated.status === 'pending' ? others(prev) : [...others(prev), updated],
    )
    setPending((prev) =>
      updated.status === 'pending' ? [...others(prev), updated] : others(prev),
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/data/cards.json').then((r) => r.json()),
      fetch('/data/timeline.json').then((r) => r.json()),
      // the sidebar is optional: a missing file just means no blocks
      fetch('/data/blocks.json').then((r) => r.json()).catch(() => []),
      fetch('/data/cats.json').then((r) => r.json()).catch(() => ({})),
      // optional, like on the phone: a missing file means no menu button
      fetch('/data/nav.json').then((r) => r.json()).catch(() => []),
      loadSpecialCards(),
    ]).then(([cardData, unitData, blockData, catData, navData, specialData]) => {
      if (!cancelled) {
        setScards(specialData)
        setCards(cardData)
        setUnits(unitData)
        setBlocks(blockData)
        setCats(catData)
        setNav(Array.isArray(navData) ? navData : [])
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

  // Open at the card named by the URL (#card-<id>), or at the opening card without
  // one: the browser can't do it, as the cards are drawn after the data loads and
  // sit in a scroller of their own. The layout depends on the stage width, so wait
  // until it is measured.
  useEffect(() => {
    if (!cards || !measured || jumpedRef.current) return
    jumpedRef.current = true
    jumpRef.current?.(false, true)
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
    { start: Boolean(scards.start), end: Boolean(scards.end), startIndex: startIndex(scards.start, sorted) },
  )
  // age under the cursor line; kept after the mouse leaves the stage so the
  // sidebar doesn't reset when the user moves over to it
  if (mouseX !== null) cursorMyaRef.current = mapX(scrollLeft + mouseX)
  const cursorMya = cursorMyaRef.current
  // keep each card's object while neither it nor its position changed, so memo(Card) can skip it
  const positioned = sorted.map((card, i) => {
    const old = positionedCache.current.get(card.id)
    if (old && old.src === card && old.card.x === xs[i]) return old.card
    const next = { ...card, x: xs[i] }
    positionedCache.current.set(card.id, { src: card, card: next })
    return next
  })
  // Scroll the card named by the URL's anchor to the left of the stage. With
  // `onlyIfHidden` a card that is already fully on screen stays put (clicking a
  // card's own title changes the anchor too).
  jumpRef.current = (onlyIfHidden, orStart = false) => {
    const el = scrollRef.current
    const anchored = anchorTarget()
    const target = anchored ?? (orStart ? { special: true, key: 'start' } : null)
    if (!el || !target) return
    const x = target.special
      ? { start: startCardX, end: endCardX }[target.key]
      : positioned.find((c) => c.id === target.key)?.x
    if (x === undefined || x === null) return
    const width = target.special ? SCARD_WIDTH : CARD_WIDTH
    if (onlyIfHidden && x >= el.scrollLeft && x + width <= el.scrollLeft + el.clientWidth) return
    el.scrollLeft = Math.max(0, x - (anchored ? START_X : OPENING_X))
  }

  // the menu's jump: the card goes to the left of the stage, even if it is already on
  // screen, but far enough in for its date label to clear the menu button
  const goTo = (id) => {
    const x = positioned.find((c) => c.id === id)?.x
    if (x === undefined) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollRef.current?.scrollTo({ left: Math.max(0, x - NAV_JUMP_X), behavior: calm ? 'auto' : 'smooth' })
  }
  // navigation entries whose card exists
  const navItems = nav
    .map((entry) => ({ title: entry.title, card: cards.find((c) => c.id === entry.card) }))
    .filter((entry) => entry.card)
  // the entry on screen: the last one whose card has reached the scroll position a jump
  // gives it (the end of the timeline limits how far a jump can scroll)
  const maxScroll = scrollRef.current ? scrollRef.current.scrollWidth - scrollRef.current.clientWidth : Infinity
  const current = navItems
    .filter(({ card }) => {
      const x = positioned.find((c) => c.id === card.id)?.x
      return x !== undefined && scrollLeft >= Math.min(x - NAV_JUMP_X, maxScroll) - 2
    })
    .pop()?.card.id

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
                  admin={admin}
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
          admin={admin}
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
      <AccountLink />
      <LangSwitcher />
      <TimeNavMenu items={navItems} onGo={goTo} current={current} />
      {!sidebarEnabled ? null : sidebarOpen ? (
        <Sidebar
          blocks={blocks}
          cats={cats}
          cursorKya={cursorMya === null ? null : cursorMya * 1000}
          admin={admin}
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