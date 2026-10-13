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

## Admin access

Set credentials in `.env.local` (git-ignored; the server reads them, the browser never does):

```
ADMIN_LOGIN=your-login
ADMIN_PASSWORD=your-password
```

Open the site with `?login=your-login&password=your-password` in the URL. If the server accepts them, every card gets an **E** icon that opens a form for the title, description, sources and Wikipedia link. Saving rewrites `public/data/cards.json`. With no credentials configured, the admin API is off.

The API (`server/adminApi.js`) is a Vite plugin, so it runs under `npm run dev` and `npm run preview`. Credentials in a URL end up in browser history and server logs, so use this only on a trusted machine or network.

## Sidebar blocks

The right-hand sidebar reveals blocks from `public/data/blocks.json` (`id`, `title`, `kya` — thousands of years ago, e.g. `13800000` for 13.8 Gya — and `category`), oldest first. Block colors come from `public/data/cats.json` (`{ "<category>": { "label": "…", "color": "#rrggbb" } }`); edit that file to add or recolor categories. Admins get a **+** in the sidebar header to add blocks (title up to 40 characters, start date in the same formats as cards, and a category).

## Languages

`public/data/languages.json` lists the languages (`[{ "code": "en", "label": "English" }, …]`); the first is the default and the fallback. The seed ships English (default), Russian, Italian, German and Spanish. To add one, append an entry and add a block for its code in `src/strings.js` (interface text; English is used for missing keys).

Translatable fields are maps from language code to text: card `title`, `contents` and `wikipedia`, block `title`, category `label` (`cats.json`) and unit `label` (`timeline.json`). Example: `"title": { "en": "Earth forms", "de": "Entstehung der Erde" }`. Everything else (dates, pictures, sources) is shared by all languages. Date units stay Gya / Mya / Kya / BC in every language.

- If the chosen language has no text, the default language is shown (cards get a small marker). A Wikipedia link falls back the same way; a bare article title opens in that language's Wikipedia edition (`de.wikipedia.org/wiki/…`).
- The language is taken from `?lang=de`, then the remembered choice, then the browser language, then the default. The switcher is a flag circle at the top right; click it to pick another flag (flags for other language codes need an entry in `src/components/LangSwitcher.jsx`; without one the code is shown).
- Admin forms edit the current language only: switch language, then edit. Saving merges that language into the card and leaves the others alone; clearing a field removes that translation (not allowed for the last one). The API rejects plain strings for these fields. Older data files that still hold plain strings keep displaying (read as the default language) and are converted when the card is next saved.
- Visitor-submitted cards are stored in the language the visitor was viewing.

## Changelog

### 0.4

- Multilingual: English (default), Russian, Italian, German and Spanish. Card, block, category and unit text, plus the interface, follow the selected language, with fallback to English. Admins edit one language at a time.
- The sidebar is now titled "Tech Factors" ("Технофакторы" in Russian). It sits below the timeline, which spans the full width.
- Each card has a thin gray vertical line on its left, from the timeline bar down to the bottom panel; the cards' left corners are square.

### 0.3

- A thin cursor line follows the mouse cursor behind the cards, with the date at that position (Gya, Mya or Kya) shown on top of it.
- Added sidebar blocks to show important technology foundations.
- Admins can add blocks with a **+** button in the sidebar.

### 0.2

- Card descriptions show paragraphs (blank line = new paragraph) and markdown links `[text](https://…)`, which open in a new tab.
- Admins can upload a card photo and illustration (JPEG, PNG or WebP, up to 2 MB each) in the edit form; visitors are told to paste image URLs into the description.
- Admins can delete a card from the edit form; its pictures are removed too unless another card still uses them.
- Add new cards: a **+** button for everyone opens the edit form. Admin cards are published at once; other visitors' cards are `pending` (orange, admin-only) until an admin clicks **Approve** in the edit form. Pending cards are stored in `data/pending.json` (git-ignored, never served to visitors), with a per-IP limit of 5 submissions per hour.
- Admin mode: with valid `login` and `password` GET parameters, cards get an **E** icon that opens an edit form (title, description, sources, Wikipedia link). Changes are saved to `public/data/cards.json` by a server-side API.

### 0.1

- Event cards arranged chronologically on a non-linear time scale; adjacent cards are at most half a viewport apart.
- Timeline bar with date markings (above the content), and a units bar (below content) displaying current eon/era
- Each card title has an anchor, so cards can be linked.
- Optional Wikipedia icon on each card
- Optional Sources icon on cards, expanding a numbered list of source URLs
