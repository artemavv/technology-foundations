// Fill in missing titles of card sources by fetching the pages.
//   node scripts/source-titles.js [cards.json ...]   (default: seed and public cards)
// Sources are rewritten as { url, title? }; existing titles are kept.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fetchTitle } from '../server/pageTitle.js'

const files = process.argv.length > 2 ? process.argv.slice(2) : ['seed/data/cards.json', 'public/data/cards.json']

for (const file of files.filter(existsSync)) {
  const cards = JSON.parse(readFileSync(file, 'utf8'))
  for (const card of cards) {
    if (!card.sources) continue
    card.sources = await Promise.all(
      card.sources.map(async (s) => {
        const src = typeof s === 'string' ? { url: s } : s
        if (src.title) return src
        const title = await fetchTitle(src.url)
        console.log(`${title ? 'ok  ' : 'FAIL'} ${src.url} ${title}`)
        return title ? { url: src.url, title } : src
      }),
    )
  }
  writeFileSync(file, JSON.stringify(cards, null, 2) + '\n')
  console.log(`updated ${file}`)
}
