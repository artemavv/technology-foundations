// Add a chrono for every published card that has none yet: linked to the card and
// titled with the card's own short title (in every language the card has).
//   node scripts/chronos-from-cards.js [--dry-run]
// Uses data/app.db (or $DB_PATH) and public/data/. Safe to run again: cards that
// already have a chrono are left alone. On a database that has never started a
// server, the sample chronos (public/data/chronos.json) are imported first, exactly
// as the first start would, so they are not added on top of these later.
import { readFile } from 'node:fs/promises'
import { bootstrapChronos, chronosFromCards } from '../server/chronosApi.js'
import { openDb } from '../server/db.js'

const read = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return fallback
    throw e
  }
}

const dryRun = process.argv.includes('--dry-run')
const cards = await read('public/data/cards.json', [])
const codes = (await read('public/data/languages.json', [])).map((l) => l?.code).filter(Boolean)
const langs = codes.length ? codes : ['en']

const db = await openDb(process.env.DB_PATH ?? 'data/app.db')
// a dry run does everything, then rolls it back, so its numbers are those of a real run
db.exec('BEGIN')
const imported = bootstrapChronos(db, await read('public/data/chronos.json', null), langs, cards)
if (imported !== null) console.log(`${dryRun ? 'Would import' : 'Imported'} ${imported} sample chronos from public/data/chronos.json`)
const { added, skipped } = chronosFromCards(db, cards, langs)
for (const s of skipped) console.warn(`Skipped ${s.id}: ${s.error}`)
const total = db.prepare('SELECT COUNT(*) n FROM chronos WHERE owner_id IS NULL').get().n
db.exec(dryRun ? 'ROLLBACK' : 'COMMIT')
db.close()
console.log(`${dryRun ? 'Would add' : 'Added'} ${added} chronos from ${cards.length} cards; ${total} shared chronos in the database`)
