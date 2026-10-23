// The special cards (public/data/scards.json): { start, end }, each with a
// per-language title and contents. `start` comes before the first card, or before
// the card named by its optional `before` (a card id), and `end` after the last one. A missing file, or a card without any text, just means
// that card is not shown.
export const SPECIAL_KEYS = ['start', 'end']

const filled = (map) =>
  typeof map === 'string' ? Boolean(map) : Object.values(map ?? {}).some(Boolean)

export function loadSpecialCards() {
  return fetch('/data/scards.json')
    .then((r) => r.json())
    .catch(() => ({}))
    .then((all) =>
      Object.fromEntries(
        SPECIAL_KEYS.filter((k) => filled(all?.[k]?.title) || filled(all?.[k]?.contents)).map((k) => [
          k,
          all[k],
        ]),
      ),
    )
}

// Index, in `sorted` (cards oldest first), of the card the start card goes before:
// the one named by `before`, or 0 (the very beginning) when it is not set or not found.
export const startIndex = (start, sorted) =>
  Math.max(0, sorted.findIndex((c) => c.id === start?.before))
