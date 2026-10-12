# Technology Foundations

A simple website showing a timeline of events that enabled modern technology, from the Big Bang to 2500 BC. Scroll horizontally through the timeline and read event cards.

Built with React and Vite. Card and timeline content lives in `public/data/*.json`; card pictures are in `public/pictures/`. These two directories are git-ignored, so content edits stay out of the repository history. Sample content is kept in `seed/`; `npm run seed` (run automatically before `dev` and `build`) copies any missing files into `public/` without overwriting existing ones.

## Development

```
npm install
npm run dev      # start the dev server
npm run build    # production build
```

## Content and the seed script

Card content (`public/data/` and `public/pictures/`) is git-ignored, so edits to it never enter the repository history. A sample copy is tracked in `seed/` so a fresh clone still has something to show.

`npm run seed` (`scripts/seed.js`) copies `seed/data` and `seed/pictures` into `public/`:

- It only copies files that are missing in `public/`; existing files are never overwritten, so local edits are safe.
- It runs automatically before `npm run dev` and `npm run build`.
- To reset a file to its sample version, delete it from `public/` and run `npm run seed`.
- New cards and pictures stay local. To make them part of the sample set, copy them into `seed/` yourself.

## Changelog

### 0.1

- Event cards arranged chronologically on a non-linear time scale; adjacent cards are at most half a viewport apart.
- Timeline bar with date markings (above the content), and a units bar (below content) displaying current eon/era
- Each card title has an anchor, so cards can be linked.
- Optional Wikipedia icon on each card
- Optional Sources icon on cards, expanding a numbered list of source URLs
