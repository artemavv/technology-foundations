# PF

A simple website showing a timeline of events that enabled modern technology, from the Big Bang to 2500 BC. Users scroll through the timeline and view event cards.

## Current state

- Greenfield repo: no code yet. This file is the spec; build from it.

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
- no login or registration
- minimalist interface

## Features

- cards edited via a simple admin interface (separate page, admins only)
- each card title has an anchor, making it linkable

## Phases

- phase 1: desktop MVP; iron out timeline, card display, and scrolling
- phase 2: admin interface + sidebar
- phase 3: optional — users can add their own cards

## To be planned

- how to store card and timeline content; should be editable locally with a simple tool until an online card editor exists