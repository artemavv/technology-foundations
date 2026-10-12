# Technology Foundations

A simple website showing a timeline of events that enabled modern technology, from the Big Bang to 2500 BC. Scroll horizontally through the timeline and read event cards.

Built with React and Vite. Card and timeline content lives in `public/data/*.json`; card pictures are in `public/pictures/`.

## Development

```
npm install
npm run dev      # start the dev server
npm run build    # production build
```

## Changelog

### 0.1

- Event cards arranged chronologically on a non-linear time scale; adjacent cards are at most half a viewport apart.
- Timeline bar with date markings (above the content), and a units bar (below content) displaying current eon/era
- Each card title has an anchor, so cards can be linked.
- Optional Wikipedia icon on each card
- Optional Sources icon on cards, expanding a numbered list of source URLs
