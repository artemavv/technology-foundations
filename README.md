# Technology Foundations

## About this project

Technology Foundations is a timeline page that tells the story of how modern technology became possible, starting from the Big Bang and ending around 2500 BC. It follows the chain of events that made everything else possible: the first atoms, the Earth, the first life, animals, the first humans and their tools, fire, farming and writing.

You move along a timeline by scrolling, and each event is a small card with a short explanation, picture, and links to read more.

The page is adapted to computer and phone screens, and it is available in English, Russian, Italian, German and Spanish.


## Technical overview

Built with React and Vite. Card and timeline content is placed in `public/data/*.json`; card pictures are in `public/pictures/`. 

## Development

```
npm install
npm run dev      # start the dev server
npm run build    # production build
```

## Sample content and the seed script

Sample content is placed in `seed/` .

`npm run seed` (`scripts/seed.js`) copies `seed/data` and `seed/pictures` into `public/`:

- It only copies files that are missing in `public/`; existing files are never overwritten, so local edits are safe.
- It runs automatically before `npm run dev` and `npm run build`.
- To reset a file to its sample version, delete it from `public/` and run `npm run seed`.

## Admin access

Set credentials in `.env.local` (git-ignored; the server reads them, the browser never does):

```
ADMIN_LOGIN=your-login
ADMIN_PASSWORD=your-password
```

Open the site with `?login=your-login&password=your-password` in the URL. In Edim mode every card shows an **E** icon that opens edit form. Saving rewrites `public/data/cards.json`. With no credentials configured, the admin API is off.

The API (`server/adminApi.js`) is a Vite plugin, so it runs under `npm run dev` and `npm run preview`. Credentials in a URL end up in browser history and server logs, so use this only on a trusted machine or network.

## Translation management page

With the same `login` and `password` parameters, open `/translations.html` (e.g. `http://localhost:5173/translations.html?login=…&password=…`). It lists all published cards, oldest first, in two columns: a source language and a translation language, chosen in the dropdowns at the top (picking the language already chosen in the other dropdown swaps them). **Edit** under a row turns it into two side-by-side forms with a single **Save**. Title, description and Wikipedia link are edited per language; the date, sources and pictures are shared by all languages, so they are editable in the source form only. Pending cards are not listed. Each non-default language of a card has a translation status, **Completed** or **Pending**, set in its form; pending translations are shown with a light yellow background. English (the default language) is always completed. It is stored as `"langStatus": { "ru": "pending" }` on the card; a language without an entry is completed, so existing data needs no change, and a language with no text has no status. The status only marks the work for admins; the public site shows pending translations like any other. Like the rest of the admin API, it works under `npm run dev` and `npm run preview`.

## Proposals page

With the same `login` and `password` parameters, open `/proposals.html` (e.g. `http://localhost:5173/proposals.html?login=…&password=…`). It lists the cards proposed by visitors (stored as pending in `data/pending.json`), newest first, each with its date, submission time, text, Wikipedia link, sources and pictures. For each proposal an admin can:

- **Approve**: publish it as it is; it then appears on the timeline and on the translations page.
- **Edit**: change the date, sources, pictures and, per language, the title, description and Wikipedia link. Visitors write in the language they are viewing, so the editor also offers the default language to add the missing text; a warning shows while a proposal has none. **Save** keeps it pending, **Approve** saves and publishes.
- **Reject**: delete it, with its pictures, after a confirmation.

Proposals made before this page existed have no submission time and are listed last. It uses the existing admin API (`GET /api/pending`, `PUT /api/cards/:id` with `approve`, `DELETE /api/cards/:id`).

## Special cards

Two special cards frame the timeline: the **opening card** (`start`) stands before the card named by its `before` (see below), and the **closing card** (`end`) after the last one. A freshly opened page, with no `#anchor` in the URL, scrolls to the opening card (on desktop a little in from the left edge, so the end of the previous card shows), and the visitor can scroll on in both directions. They have only a title and a description: no date, Wikipedia link, sources or pictures. They are wider than ordinary cards and have a bigger header; on a phone they use the full width of the list.

They live in `public/data/scards.json` (sample in `seed/data/`), with the same per-language maps as cards:

```json
{
  "start": { "before": "control-of-fire", "title": { "en": "…", "ru": "…" }, "contents": { "en": "…", "ru": "…" } },
  "end": { "title": { "en": "…" }, "contents": { "en": "…" } }
}
```

A missing file, or a card without any text, simply leaves that card out. `before` is optional: the id of the card the opening card goes before (here the 1 Mya card, so it also comes before that card's date marking on phones); without it, or if no such card exists, the opening card is the very first item. The oldest tick (13.8 Gya) then sits on the first card, and the newest one (2500 BC) follows the closing card. The special cards are edited on the translations page, which has a separate row for each (the opening one before the card it goes before, the closing one after the last card); saving there keeps `before` with a form for the title and description only. Behind it is `PUT /api/scards/start` or `/api/scards/end` (admin only).

## Languages

`public/data/languages.json` lists the languages (`[{ "code": "en", "label": "English" }, …]`); the first is the default and the fallback. The seed ships English (default), Russian, Italian, German and Spanish. To add one, append an entry and add a block for its code in `src/strings.js` (interface text; English is used for missing keys).

Translatable fields are maps from language code to text: card `title`, `contents` and `wikipedia`, block `title`, category `label` (`cats.json`) and unit `label` (`timeline.json`). Example: `"title": { "en": "Earth forms", "de": "Entstehung der Erde" }`. Everything else (dates, pictures, sources) is shared by all languages. Date units stay Gya / Mya / Kya / BC in every language.

- If the chosen language has no text, the default language is shown (cards get a small marker). A Wikipedia link falls back the same way; a bare article title opens in that language's Wikipedia edition (`de.wikipedia.org/wiki/…`).
- The language is taken from `?lang=de`, then the remembered choice, then the browser language, then the default. The address bar is kept in sync: `?lang=` always shows the language on screen (other parameters and the `#anchor` stay), so a copied URL or card link, e.g. `/?lang=ru#card-first-possible-fire`, opens in that language. A link's language is not remembered; only picking a flag is. The switcher is a flag circle at the top right; click it to pick another flag (flags for other language codes need an entry in `src/components/LangSwitcher.jsx`; without one the code is shown).
- Admin forms edit the current language only: switch language, then edit. Saving merges that language into the card and leaves the others alone; clearing a field removes that translation (not allowed for the last one). The API rejects plain strings for these fields. Older data files that still hold plain strings keep displaying (read as the default language) and are converted when the card is next saved.
- Visitor-submitted cards are stored in the language the visitor was viewing.

## Changelog

### 0.7.0

- The page has a site name, "How it began" (translated: "Как всё началось", "Come tutto è iniziato", "Wie alles begann", "Cómo empezó todo"), as a hidden `<h1>` in the phone header: it is not shown, but stays in the page for screen readers and search engines. The same text is the page title (and, on the admin pages, its prefix). It is the `siteTitle` string in `src/strings.js`.
- Translation management page for admins (`/translations.html`): all cards side by side in two languages, edited together.
- Time navigation on phones: a small clock button at the top right opens a list of jump points, each with the date of a card and a short title (Universe, Earth, Life, …). The list is `public/data/nav.json` (sample in `seed/data/`): `[{ "card": "<card id>", "title": { "en": "Earth", "ru": "Земля" } }, …]`, in the order shown. Entries whose card does not exist are skipped, and a missing file means no button. The button is hidden at the top of the page and appears (fixed, in the corner of the language switcher) once the language switcher has scrolled out of view.
- Time navigation on desktop: a clock button in the top left corner (opposite the language switcher) opens a menu down the left edge with the same list as on phones, from the same `public/data/nav.json`. Picking an item scrolls that card to the left of the timeline and closes the menu; so do Escape and a click outside it. Without `nav.json` there is no button. On desktop and phones alike, the entry for the part of the timeline on screen is highlighted in the list (the last one whose card has been reached; on phones, judged at the date counter's line).
- Linking to a card: opening a URL with a card anchor, e.g. `/#card-first-possible-fire` (or `#scard-start` / `#scard-end` for the special cards), scrolls to that card, on both desktop and phones; changing the anchor later does the same. On desktop the card goes to the left of the stage, and a card that is already fully visible stays put, so clicking a card's own title does not move the view.
- Proposals page for admins (`/proposals.html`): review the cards proposed by visitors, with approve, edit and reject. New proposals are stored with a submission time.
- Two special cards (title and text only), wider and with bigger headers, edited on the translations page: the opening card before the "Control of fire" card (position set by `before` in `scards.json`) and the closing card after the last card. The page opens scrolled to the opening card; the 2500 BC tick sits just outside the closing card.

### 0.6.0

- Minor polish and fixes 

### 0.5.0

- Separate mobile view for screens up to 700px wide (`?view=mobile` / `?view=desktop` forces one for testing). The timeline runs top to bottom with cards at a fixed distance from each other.

### 0.4.1

- The sources list on a card shows page titles instead of raw URLs (the URL is still the link target and tooltip).
- In the edit form, enter sources one per line as `URL` or `URL (title)`. A line without a title gets the page's `<title>`, fetched by the server on submit.

### 0.4

- Now it is multilingual: English (default), Russian, Italian, German and Spanish. 

### 0.3

- A thin cursor line follows the mouse cursor behind the cards, with the date at that position (Gya, Mya or Kya) shown on top of it.
- Added sidebar blocks to show important technology foundations.
- Admins can add blocks with a **+** button in the sidebar.

### 0.2

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
