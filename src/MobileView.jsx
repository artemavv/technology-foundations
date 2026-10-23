import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Card from './components/Card.jsx'
import SpecialCard from './components/SpecialCard.jsx'
import TimeNav from './components/TimeNav.jsx'
import LangSwitcher from './components/LangSwitcher.jsx'
import { useLang } from './i18n.jsx'
import { formatKya } from './format.js'
import { textOn } from './color.js'
import { MARKINGS } from './markings.js'
import { myaAt, posAt } from './mobileScale.js'
import { anchorTarget } from './anchors.js'
import { loadSpecialCards } from './specialCards.js'

const COUNTER_LINE = 0.33 // the date counter reads the timeline this far down the screen
const COUNTER_MIN_SCROLL = 50 // px; the counter stays hidden near the top
const MIN_MYA_SHOWN = 0.0045 // the timeline ends at 2500 BC
const NAV_OFFSET = 56 // px left above a card jumped to, clear of the date counter

// Cards oldest first with the date markings in between: each marking goes
// above the first card that is not older than it. The special cards are the
// first and last items, so the oldest marking follows the start card and the
// last one (2500 BC) follows the end card.
function interleave(cards, scards) {
  const items = []
  const marks = [...MARKINGS]
  if (scards.start) items.push({ scard: { which: 'start', card: scards.start } })
  for (const card of cards) {
    while (marks.length && marks[0].mya >= card.mya) {
      items.push({ mark: marks.shift() })
    }
    items.push({ card })
  }
  if (scards.end) items.push({ scard: { which: 'end', card: scards.end } })
  return [...items, ...marks.map((mark) => ({ mark }))]
}

const sameAnchors = (a, b) =>
  a.length === b.length && a.every((x, i) => x.mya === b[i].mya && x.pos === b[i].pos)

// Units for the mobile rail: the eons as they are, then (Phanerozoic) the
// smallest subdivision available, i.e. an epoch where there is one, else the period
function railUnits(units) {
  const fine = units.filter((u) => u.level && u.startMya <= 541)
  return units
    .filter((u) => (!u.level && u.endMya >= 541) || fine.includes(u))
    .filter(
      (u) =>
        !u.level ||
        !fine.some((v) => v.level > u.level && v.startMya <= u.startMya && v.endMya >= u.endMya),
    )
}

// Vertical strip of the eons/eras on screen, aligned with the cards
function UnitsRail({ units, anchors, scrollY, viewportHeight }) {
  const { pick } = useLang()
  return (
    <div className="m-units" aria-hidden="false">
      {railUnits(units).map((u) => {
        const y1 = posAt(anchors, u.startMya)
        const y2 = posAt(anchors, u.endMya)
        if (y1 === null) return null
        // clip to the screen so the label stays readable on long units
        const top = Math.max(y1 - scrollY, 0)
        const bottom = Math.min(y2 - scrollY, viewportHeight)
        if (bottom - top <= 0) return null
        return (
          <span key={u.id} className="m-unit" style={{ background: u.color, color: textOn(u.color), top, height: bottom - top }}>
            {pick(u.label)}
          </span>
        )
      })}
    </div>
  )
}

export default function MobileView() {
  const { lang, t } = useLang()
  const [cards, setCards] = useState(null)
  const [units, setUnits] = useState([])
  const [scards, setScards] = useState({}) // special cards: { start?, end? }
  const [nav, setNav] = useState([]) // time navigation entries: [{ card: id, title }]
  const [anchors, setAnchors] = useState([])
  const [scrollY, setScrollY] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight)
  const listRef = useRef(null)
  const headerRef = useRef(null)
  // the language switcher (in the header) is off screen: the time navigation button takes its corner
  const [switcherGone, setSwitcherGone] = useState(false)
  const jumpedRef = useRef(false) // the URL's anchor was handled on load
  const jumpRef = useRef(null) // scrolls to the card named by the URL's anchor; set on every render

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/data/cards.json').then((r) => r.json()),
      fetch('/data/timeline.json').then((r) => r.json()),
      loadSpecialCards(),
      // the navigation is optional: a missing file just means no button
      fetch('/data/nav.json').then((r) => r.json()).catch(() => []),
    ]).then(([cardData, unitData, specialData, navData]) => {
      if (!cancelled) {
        setScards(specialData)
        setNav(Array.isArray(navData) ? navData : [])
        setCards(cardData)
        setUnits(unitData)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // throttled to one update per frame
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setScrollY(window.scrollY)
      setViewportHeight(window.innerHeight)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // Card positions on the page, measured after layout. Card heights vary with
  // the language and window width, so re-measure when any of them changes.
  const measure = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const next = [...list.querySelectorAll('[data-mya]')].map((el) => ({
      mya: Number(el.dataset.mya),
      pos: el.getBoundingClientRect().top + window.scrollY,
    }))
    setAnchors((prev) => (sameAnchors(prev, next) ? prev : next))
  }, [])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    measure()
    const observer = new ResizeObserver(measure)
    // special cards are not time anchors, but their height moves everything below
    list.querySelectorAll('[data-mya], [data-scard]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [cards, lang, measure])

  // the header exists once the cards have loaded
  useEffect(() => {
    if (!cards) return
    const switcher = headerRef.current?.querySelector('.lang-switcher')
    if (!switcher) return setSwitcherGone(true) // a single language: no switcher to make room for
    const observer = new IntersectionObserver(([entry]) => setSwitcherGone(!entry.isIntersecting))
    observer.observe(switcher)
    return () => observer.disconnect()
  }, [cards])

  // Open at the card named by the URL (#card-<id>): the browser can't do it, as
  // the cards are drawn after the data loads. Later anchor changes scroll there too.
  useLayoutEffect(() => {
    if (!cards || jumpedRef.current) return
    jumpedRef.current = true
    jumpRef.current?.()
  }, [cards])

  useEffect(() => {
    const onHash = () => jumpRef.current?.()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // scroll to an element (a card's anchor id), keeping the date marking above it in view
  const scrollToAnchor = (elementId, smooth) => {
    let el = document.getElementById(elementId)?.closest('.m-item')
    if (!el) return
    if (el.previousElementSibling?.classList.contains('m-mark')) el = el.previousElementSibling
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET,
      behavior: smooth && !calm ? 'smooth' : 'auto',
    })
  }
  const goTo = (id) => scrollToAnchor(`card-${id}`, true)
  jumpRef.current = () => {
    const target = anchorTarget()
    if (target) scrollToAnchor(target.elementId, false)
  }

  if (!cards) return <div className="loading">{t('loading')}</div>

  const items = interleave([...cards].sort((a, b) => b.mya - a.mya), scards)
  // navigation entries whose card exists
  const navItems = nav
    .map((entry) => ({ title: entry.title, card: cards.find((c) => c.id === entry.card) }))
    .filter((entry) => entry.card)
  const mya = myaAt(anchors, scrollY + viewportHeight * COUNTER_LINE)
  // the counter takes the color of the eon/era on screen; before the first one it stays light blue
  const unit = mya === null ? null : railUnits(units).find((u) => mya <= u.startMya && mya > u.endMya)

  return (
    <div className="m-app">
      <header className="m-header" ref={headerRef}>
        <h1>PF</h1>
        <LangSwitcher />
      </header>
      <TimeNav items={navItems} onGo={goTo} shown={switcherGone} />
      {mya !== null && scrollY >= COUNTER_MIN_SCROLL && (
        <div
          className="m-counter"
          style={unit ? { background: unit.color, color: textOn(unit.color) } : undefined}
        >
          {formatKya(Math.max(mya, MIN_MYA_SHOWN) * 1000, 3)}
        </div>
      )}
      <main className="m-list" ref={listRef}>
        {items.map((item) =>
          item.scard ? (
            <div className="m-item" key={`scard-${item.scard.which}`} data-scard={item.scard.which}>
              <SpecialCard which={item.scard.which} card={item.scard.card} />
            </div>
          ) : item.card ? (
            <div className="m-item" key={item.card.id} data-mya={item.card.mya}>
              <Card card={item.card} creds={null} sourcesModal />
            </div>
          ) : (
            <div className="m-mark" key={item.mark.label}>
              {item.mark.label}
            </div>
          ),
        )}
      </main>
      <UnitsRail units={units} anchors={anchors} scrollY={scrollY} viewportHeight={viewportHeight} />
    </div>
  )
}
