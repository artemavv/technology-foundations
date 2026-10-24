# PF

A simple website showing a timeline of events that enabled modern technology, from the Big Bang to 2500 BC. Users scroll through the timeline and view event cards.

## Event card

- time: 375 Mya
- title: Tiktaalik emerges
- contents: Tiktaalik is a transitional animal between a fish and a tetrapod. Its front fins show arm-like skeletal structures more akin to those of a crocodile, including a shoulder, elbow and wrist.
- photo: tiktaalik.jpg (optional; pictures are hosted on the local server)

## User interface (desktop)

- Main screen: event cards arranged chronologically left to right. All cards share the same width but vary in height.
- Timeline bar above the main screen, left to right, non-linear: date markings like Gya, Mya, 10000 BC.
- Below the main screen: labels of the eon/era/period units currently on screen; each unit has a different background color.
- Scrolling moves everything on screen horizontally together:
  - forward in time -> cards move from right to left
  - backward in time -> cards move from left to right
- Optional static sidebar, unaffected by scrolling; toggleable visible/hidden.

## Tech stack

- React + HTML
- card pictures served from the local server
- no login needed to read the timeline; optional user accounts (login and password only, admin approval) for the Memory line and training (see Accounts)
- minimalist interface

## Features

- cards edited via a simple admin interface (separate page, admins only)
- each card title has an anchor, making it linkable
- accounts, chronos (a second set of cards: date + short title, optionally linked to a card), the Memory line page and training statistics

## Phases

- phase 1: desktop MVP; iron out timeline, card display, and scrolling
- phase 2: admin interface + sidebar
- phase 3: optional — users can add their own cards
- accounts phase: user accounts, chronos, Memory line, training mode (details of training still to be worked out; each training run must update the user's statistics)

## To be planned

- how to store card and timeline content; should be editable locally with a simple tool until an online card editor exists

## Content editing

- Always make new card content edits in `public/data/` (the live, git-ignored content), not in `seed/data/`. `seed/` only provides sample files that `npm run seed` copies into `public/` when they are missing; it never overwrites existing ones.

## Accounts

- Accounts, personal chronos, selections and training runs live in SQLite, `data/app.db` (git-ignored, not served). It is live data: never edit it by hand; change the schema only by appending a migration to `server/db.js`.
- Global chronos are managed in the database (admin page `/chronos.html`); `public/data/chronos.json` (sample in `seed/data/`) is only imported once, into an empty database.
- Users have a `pending` / `approved` status; admins approve on `/users.html`. Admins are accounts with `is_admin` set, created only with `npm run create-admin -- <login> <password>`; everyone, admins included, signs in on `/login.html` and uses the session cookie (no admin credentials in URLs or env vars). Admin API routes rely on `req.pfAdmin`, set by `server/accountsApi.js`, which must stay registered before `adminApi`.
- `npm run build && npm run smoke` tests the accounts API against a temporary database.

## Deploy

- Connect: `ssh aruba` (`root@80.211.129.208`, Ubuntu, Apache 2.4.58, ufw 80/443 open). Other vhosts exist on this server — do not touch them.
- Accounts need `better-sqlite3` (native; same Node version as `npm ci`; `build-essential` + `python3` if no prebuilt binary). The Apache vhost must send `X-Forwarded-Proto: https` (`RequestHeader set X-Forwarded-Proto "https"`) and keep the Host (`ProxyPreserveHost On`); back up `data/app.db`.
