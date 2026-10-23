// The card named by the URL fragment: #card-<id> for a card, #scard-start or
// #scard-end for a special card (the anchors of the card titles). Returns
// { special, key, elementId } or null.
export function anchorTarget(hash = window.location.hash) {
  let id
  try {
    id = decodeURIComponent(hash.replace(/^#/, ''))
  } catch {
    return null // malformed escape
  }
  const m = id.match(/^(card|scard)-(.+)$/)
  return m ? { special: m[1] === 'scard', key: m[2], elementId: id } : null
}
