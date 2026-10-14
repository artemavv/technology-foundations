import { useEffect, useState } from 'react'
import DesktopView from './DesktopView.jsx'
import MobileView from './MobileView.jsx'

const MOBILE_QUERY = '(max-width: 700px)'

// ?view=mobile / ?view=desktop forces a view (for testing)
function useIsMobile() {
  const forced = new URLSearchParams(window.location.search).get('view')
  const [matches, setMatches] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  if (forced === 'mobile') return true
  if (forced === 'desktop') return false
  return matches
}

export default function App() {
  return useIsMobile() ? <MobileView /> : <DesktopView />
}
