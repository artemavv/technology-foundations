// Copy the sample content from seed/ into public/ for any file that is
// missing there. Existing files are never overwritten, so local edits are safe.
import { cpSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

for (const dir of ['data', 'pictures']) {
  cpSync(resolve(root, 'seed', dir), resolve(root, 'public', dir), {
    recursive: true,
    force: false,
    errorOnExist: false,
  })
}
console.log('Seeded missing content into public/')
