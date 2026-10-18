# Elkchemy

Elkchemy is a woodland merge puzzle on a 4x4 board. This build has five handcrafted levels, played in order (`src/levels.ts`):

1. Sprouting Grove: make Grove, tier 3 of 4 (forgiving intro).
2. Songbird Chorus: make Song, tier 3 of 4; plain 3-merges suffice.
3. Lone Elk: place all supply and leave exactly one item (elk only; a 5-merge strands a leftover).
4. Crystal Fives: make Crystal, tier 4 of 4 with exactly enough crystals; it needs two 5-merges, and any 3-merge of tier-1 or tier-2 crystals makes it unreachable.
5. The Faraway Grove: a 12x16 scrolling board; have Grove, Song, Elk and Crystal, each tier 4 of 4, on the board at once. Each target shows its own completion; plain 3-merges suffice, with spare supply. Pan by dragging empty ground; for far moves, tap an item, pan, then tap its destination.

Winning offers Next level (after the last level: play again from level 1). Progress is kept in memory only; reloading starts at level 1.

- Drag an item (or tap it, then tap a destination). Dropping onto a matching item merges its connected matching group: Merge 3 for 1 upgraded item; merge 5 for 2.
- Dropping onto a different item swaps them. Merges only happen on drop.
- Press "Add supply" to place the next item in a random empty cell. Placement is seeded, so Undo then Add supply again lands in the same place, and Retry replays the same sequence.
- Undo reverses the last action; Retry restarts the current level.
- Status is exact within the supported resource bounds (`src/status.ts`): single-item and distinct-family multi-item goals use resource counts; Leave one uses an exact per-tier merge check and needs two free cells beyond all items and supply.
- Tap "?" next to the title for a short how-to-play dialog.
- Boards larger than the screen scroll inside a framed viewport with finger-sized (64px) tiles. Drag an item to move it; drag empty ground to pan; a tap never pans or drops. Center board recenters; arrow keys scroll the focused cell into view. Levels 1–4 are 4x4 and fit without scrolling; level 5 scrolls.

## Large-board navigation test

Level 5, The Faraway Grove, is the playable 12x16 scrolling board at the normal app address, https://elkchemy.web.app/. It ships through the ordinary build and requires all four families at tier 4 simultaneously. Unlocking is not implemented yet.

For local navigation experiments, `npm run dev` also serves `/sandbox.html`, a separate test board with items in distant corners. That standalone test page is excluded from the ordinary production build; its earlier temporary Firebase deployment has been replaced by the five-level app.

Built with React, TypeScript and Vite. Game rules live in `src/board.ts`, `src/session.ts` and `src/status.ts`; the UI is in `src/ui/`.

Open work, verification gaps, and the deferred campaign story are tracked in [TODO.md](TODO.md).

## Creative direction

Elkchemy is a surprise for Alisha, nicknamed Elk. She enjoys sci-fi (especially Doctor Who), 1940s fashion, classic Hollywood films, watching YouTube videos, and playing ukulele and clarinet. Keep these preferences available in future Claude handoffs. They are creative references, not requests to add every theme or feature.

Potential directions include whimsical original time-travel touches, vintage glamour and Art Deco accents, and warm clarinet/ukulele music with subtle spacey textures. Keep the woodland setting and approved elk artwork coherent. Use original melodies, characters, names, and imagery rather than copying Doctor Who or film assets. The current music files are first drafts; these preferences should inform later revisions and listening review.

Future campaign idea: first a lost woodland elk merges her way through different universes to get home; once home, she discovers her friends are lost and sets out to rescue them. See [TODO.md](TODO.md) for the two-part story and possible worlds. This is deferred, not current implementation scope; continue with the initial woodland puzzle and music plan for now.

## Approved artwork

The approved Elkchemy app icon and visual reference is `artwork/elkchemy-icon-v1.png`: a friendly golden elk with leafy antlers, a musical sparkle, and a forest-green background. Its generation prompt is beside it. This original is not shipped; the app only ships the resized icons below.

Use this exact artwork for the iPad Home Screen icon and reuse it in future UI work, such as the welcome screen or header. Resize `artwork/elkchemy-icon-v1.png` rather than regenerating it, and start any future resizes from that file. Keep important features visible under rounded icon masks.

Icons resized from `artwork/elkchemy-icon-v1.png` (opaque forest-green background, square corners; the OS applies its own rounding):

- `public/icons/apple-touch-icon.png` (180×180, Apple touch icon)
- `public/icons/icon-192.png` and `public/icons/icon-512.png` (web manifest icons)
- `public/icons/favicon-32.png` (32×32 favicon)

They are linked from `index.html` and `public/manifest.webmanifest` (name "Elkchemy", standalone display). There is no service worker yet, so the game does not work offline.

## Setup

```bash
npm install
```

## Development

Starts the local dev server (Vite prints the URL). Run tests with `npm test`.

```bash
npm run dev
```

## Build & Preview

```bash
npm run build
npm run preview
```

## Updates

The footer shows the running build id. "Check for updates" fetches the deployed `/version.json` on demand (never automatically) and compares it with the build id compiled into the app; if it differs, "Update now" reloads the app, which restarts from level 1. There is no service worker, so the app is not available offline.

Hosting headers (`firebase.json`): HTML, `manifest.webmanifest` and `version.json` use `Cache-Control: no-cache` (always revalidated); hashed files under `/assets/` are cached for a year (`immutable`). Icons use Firebase defaults.

The build id defaults to a UTC timestamp (`YYYYMMDD-HHMMSS`); set `ELKCHEMY_BUILD_ID` to override it, e.g. `ELKCHEMY_BUILD_ID=v1 npm run build`.

## Deploy

```bash
firebase deploy --only hosting --project elkchemy
```
