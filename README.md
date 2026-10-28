# How it began

## About this project

"How it began" is a timeline page that tells the story of how modern technology became possible, starting from the Big Bang and ending around 2500 BC. It follows the chain of events that made everything else possible: the first atoms, the Earth, the first life, animals, the first humans and their tools, fire, farming and writing.

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

An admin is an account with the admin flag, signed in on `/login.html` like any user (the session is an HttpOnly cookie). Admin accounts are never created by registration; create one, or reset its password, on the machine that holds the database:

```
npm run create-admin -- <login> <password>
```

(`node scripts/create-admin.js`; it uses `data/app.db`, or `$DB_PATH`.) Choose a strong password: the command accepts any, and warns below 6 characters. Admin accounts are not listed on the accounts page and cannot be deleted or revoked there. When signed in as an admin, every card shows an **E** icon that opens the edit form. Saving rewrites `public/data/cards.json`.

The API (`server/adminApi.js`, with the sessions in `server/accountsApi.js`) is a Vite plugin, so it runs under `npm run dev` and `npm run preview`. The old `ADMIN_LOGIN` / `ADMIN_PASSWORD` variables and the `?login=&password=` URL parameters are no longer used; remove them from `.env.local`.

## Translation management page

As a signed-in admin, open `/translations.html`. It lists all published cards, oldest first, in two columns: a source language and a translation language, chosen in the dropdowns at the top (picking the language already chosen in the other dropdown swaps them). **Edit** under a row turns it into two side-by-side forms with a single **Save**. Title, description and Wikipedia link are edited per language; the date, sources and pictures are shared by all languages, so they are editable in the source form only. Pending cards are not listed. Each non-default language of a card has a translation status, **Completed** or **Pending**, set in its form; pending translations are shown with a light yellow background. English (the default language) is always completed. It is stored as `"langStatus": { "ru": "pending" }` on the card; a language without an entry is completed, so existing data needs no change, and a language with no text has no status. The status only marks the work for admins; the public site shows pending translations like any other. Like the rest of the admin API, it works under `npm run dev` and `npm run preview`.

## Proposals page

As a signed-in admin, open `/proposals.html`. It lists the cards proposed by visitors (stored as pending in `data/pending.json`), newest first, each with its date, submission time, text, Wikipedia link, sources and pictures. For each proposal an admin can:

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

## User accounts and the Memory line

Visitors can register with a login, a nickname (shown in competition tables instead of the login; unique, case-insensitive) and a password. A new account is `pending` until an admin approves it; only approved accounts can log in. Signed-in users change their nickname and password on `/profile.html` (a password change needs the current password and ends the user's other sessions). Sessions use an HttpOnly cookie (30 days); passwords are stored as scrypt hashes. Accounts, personal chronos and training statistics are kept in SQLite, in `data/app.db` (git-ignored, never served; set `DB_PATH` to use another file). The database is created and migrated automatically on the first account request. **Back up `data/app.db`** (it runs in WAL mode, so copy `app.db-wal` and `app.db-shm` along with it, or stop the server first). It needs the `better-sqlite3` package, a native module: `npm ci` normally downloads a prebuilt binary; if that fails on the server, install `build-essential` and `python3`. The Node version that runs the site must be the one `npm ci` was run with.

- **Chronos** are short dated titles (a title per language and a date), a second set next to the cards. A chrono may be linked to a card and then follows the card's date; one without a card has a date of its own. Admins manage them on `/chronos.html`. On the first start with an empty database, `public/data/chronos.json` (sample: `seed/data/chronos.json`) is imported once; after that the database rules and the file is not read again. `npm run chronos-from-cards` (`scripts/chronos-from-cards.js`, `-- --dry-run` to only count) adds a chrono for every published card that has none yet, linked to the card and titled with the card's own title in every language it has; it is safe to run again, e.g. after new cards are published.
- **Memory line** (`/memory.html`): all chronos, oldest first. The **+** / **✓** button puts a chrono on, or takes it off, the user's own memory line. Users can also add chronos of their own (title, date, optional description; not linked to a card, visible only to them). The **My chronos** link opens a separate page (`/my-chronos.html`) with the user's own memory line only: the chronos they selected plus their own. A **Known** toggle on each row marks a chrono as known: it is shown dimmed there and left out of training until the toggle is switched off. Taking a chrono off the memory line forgets that it was known. **Start** begins training on that set.
- **Visitors without an account** can use the Memory line, My chronos and training too: their selection, their known marks and a short list of finished runs are kept in the browser (`localStorage`, key `pf_guest`; in memory only if the browser blocks it), not on the server. They get the global chronos from the public `GET /api/chronos`, and cannot add chronos of their own (that needs an account). Clearing the site data, or another browser, starts from an empty memory line; nothing is carried over when they later log in. Both kinds of storage sit behind the same calls in `src/memoryStore.js`.
- **Training** (`/train.html`, the big **Start** button on the Memory line and My chronos pages): the user's own memory line, one chrono at a time in random order. Only the title is shown; the user types a number, picks a unit (**Gya**, **Mya**, **Kya** or **BC**) and presses **Check**. **Enter** on an empty number field shows the answer (the button then reads **Show answer**); it is recorded as skipped, which is neither correct nor incorrect: it is left out of the run's score and of the statistics (which report skipped ones separately), and the page moves on after 2 seconds, as after a correct answer. A comma works as the decimal point. If a wrong "years ago" answer would have been right as the same number of years BC (the two differ by 2000), a note under the result says so. A number above 2000 hides the unit buttons and reads "years ago": it is taken as a plain number of years (`YEARS_ABOVE` in `src/training.js`); at 2000 or less the buttons are back, with the unit chosen before. From the number field, **Tab** moves to the units, where the **←** / **→** keys change the selected unit and **Enter** checks. The right date is then shown, and an answer within 5 % of the real age counts as correct (`TOLERANCE` in `src/training.js`; years BC count back from AD 2000, as on the timeline). **Next** goes on; after a correct answer it does so by itself after 2 seconds (`AUTO_NEXT_MS`), while a wrong one waits for **Next**. **Mark as known** (under the buttons) marks the current chrono as known, so it no longer appears in training, and goes on to the next one without recording an answer for it. If all the chronos are known, **Start** is disabled and the Training page says so. The run ends after the last chrono or with **Finish**. Every answer is recorded in a training run (`/api/training/runs…`), and `/api/me/stats` returns totals; only finished runs with at least one answer count in the statistics. A run that is left unfinished is not counted.
- **Accounts page** for admins (`/users.html`): approve or reject new accounts, revoke or delete existing ones.
- The round account icon next to the language flag opens the Memory line (signed-out visitors get a browser-stored memory line; a **Log in** link is on the page).

Behind a reverse proxy the cookie gets the `Secure` flag only if the proxy sends `X-Forwarded-Proto: https` (Apache: `RequestHeader set X-Forwarded-Proto "https"`, needs `mod_headers`), or if `COOKIE_SECURE=1` is set. The proxy must also keep the visitor's `Host` (`ProxyPreserveHost On`) or send `X-Forwarded-Host`, because state-changing requests check that `Origin` matches it.

Run `npm run build && npm run smoke` to test the accounts, chronos and training API against a temporary database.

## Languages

`public/data/languages.json` lists the languages (`[{ "code": "en", "label": "English" }, …]`); the first is the default and the fallback. The seed ships English (default), Russian, Italian, German and Spanish. To add one, append an entry and add a block for its code in `src/strings.js` (interface text; English is used for missing keys).

Translatable fields are maps from language code to text: card `title`, `contents` and `wikipedia`, block `title`, category `label` (`cats.json`) and unit `label` (`timeline.json`). Example: `"title": { "en": "Earth forms", "de": "Entstehung der Erde" }`. Everything else (dates, pictures, sources) is shared by all languages. Date units stay Gya / Mya / Kya / BC in every language.

- If the chosen language has no text, the default language is shown (cards get a small marker). A Wikipedia link falls back the same way; a bare article title opens in that language's Wikipedia edition (`de.wikipedia.org/wiki/…`).
- The language is taken from `?lang=de`, then the remembered choice, then the browser language, then the default. The address bar is kept in sync: `?lang=` always shows the language on screen (other parameters and the `#anchor` stay), so a copied URL or card link, e.g. `/?lang=ru#card-first-possible-fire`, opens in that language. A link's language is not remembered; only picking a flag is. The switcher is a flag circle at the top right; click it to pick another flag (flags for other language codes need an entry in `src/components/LangSwitcher.jsx`; without one the code is shown).
- Admin forms edit the current language only: switch language, then edit. Saving merges that language into the card and leaves the others alone; clearing a field removes that translation (not allowed for the last one). The API rejects plain strings for these fields. Older data files that still hold plain strings keep displaying (read as the default language) and are converted when the card is next saved.
- Visitor-submitted cards are stored in the language the visitor was viewing.

## Changelog

### 0.8.0

- Visitors without an account can put chronos on a memory line, mark them as known and train; this is kept in the browser (`localStorage`). Own chronos still need an account.
- User accounts (login and password; `pending` until an admin approves them), with a login and registration page (`/login.html`) and an accounts page for admins (`/users.html`).
- A visitor's marks (the chronos put on the list and the known ones, kept in the browser) move to the account on its first sign-in, if the account's list is still empty (`POST /api/me/import-guest`, called by the login page); the browser copy is then cleared. Training runs and stars made as a visitor are not carried over.
- Exam (`Exam (N)` button on My chronos, signed-in users only; `/train.html?mode=exam`): a training-like run over the memorized (known) chronos that are not passed yet, the 50 most recently memorized, and at least 5 of them (below that the button looks inactive and opens a popup with the rules); 7 seconds per question (what is typed by then is checked, an empty field loses the question), no showing answers. The server grades the answers; each chrono answered correctly is passed for good (`user_passed`, big green star in the list) and earns 1 competition point. Exam answers don't count for the training stars.
- Players (`/players.html`, linked in the top right of the Chronos and My chronos pages, left of the nickname or the Log in button): public list of nicknames with their points, ordered by competition points, then memory points; the first three get gold, silver and bronze medals. Memory points = chronos the user has marked as known, their own included. Competition points (`users.competition_points`) will come from exam runs, not implemented yet.
- Chronos (a second set of dated short titles, optionally linked to cards) and the Memory line page (`/memory.html`): select chronos, add your own. Your own memory line is on a separate page, My chronos (`/my-chronos.html`).
- Training (`/train.html`): the user's chronos one by one in random order, answered with a number and a unit (Gya / Mya / Kya / BC); every run and answer is recorded for per-user statistics. Chronos can be marked as known (**Mark as known** in training, or the **Known** toggle on My chronos) to leave them out.
- `npm run chronos-from-cards` adds a chrono, linked to the card and titled with its title, for every published card that has none.
- Accounts are stored in SQLite (`data/app.db`); `better-sqlite3` is a new dependency.

### 0.7.0

- Translation management page for admins (`/translations.html`): all cards side by side in two languages, edited together.
- Time navigation on phones and desktop
- Cards with several paragraphs show only the first one on phones, with a "Read more" link that expands the card and a "Show less" link that collapses it again (on desktop this applies to cards taller than the column, as before, and now also has "Show less").
- Linking to a card: opening a URL with a card anchor, e.g. `/#card-first-possible-fire` (or `#scard-start` / `#scard-end` for the special cards), scrolls to that card, on both desktop and phones; 
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
