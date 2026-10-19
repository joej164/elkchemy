# Elkchemy

Elkchemy is a woodland merge puzzle. The app opens on a home screen, a painted woodland scene with the elk, and four choices: Play (generated puzzles), Levels (seven handcrafted levels, any of which can be started), Music / Scores (clarinet and ukulele arrangements of the game music), and Release notes (a short player-facing history of what changed; the internal record is [docs/release-notes.md](docs/release-notes.md)). Every other screen has a Home button.

## Generated puzzles

Play offers two modes, each with a small set of choices:

- **Merge to goals:** make the shown goal items (1, 2 or 3 goals, each a different family) at tier 3 or 4 of 4. Leftover pieces do not matter once the goals are on the board.
- **Merge down to one:** one family; finish with exactly one item, at exactly the target tier (3 or 4 of 4).

Everything needed starts on the board; there is no supply. Boards are 4x4 to 8x8, sized from the number of pieces, with working space. Every piece belongs to a goal family. Generation (`src/generator.ts`) builds each goal backwards from 3→1 and 5→2 merges, shuffles the pieces with a seeded generator, then plays a winning sequence on the actual board with the real rules and replays it through the game's status checks before offering the puzzle. If no candidate verifies within a fixed limit, the menu shows an error instead of an unverified puzzle. The winning sequence is never shown.

Retry restarts the same puzzle; New puzzle makes a different one with the same settings; Undo takes back the last action. New puzzle and Home ask before discarding an attempt. Generated puzzles never announce a loss after a fatal choice; only when the goal is unmet and no family has three items at a mergeable tier left (scattered matches still count) do they show "No merges left—Undo, Retry, or New Puzzle." and lock the board. Dropping an item onto a matching one that cannot merge does nothing and does not use up Undo. Nothing is saved; reloading returns to the home screen.

Each puzzle shows a reproduction ID such as `v1-goals-t4-g2-1nqrzv7`: generator version, mode, target tier as shown, goal count, and a base-36 seed. It sits under the controls in a read-only field with a Copy button; "Copied" appears only after the clipboard write succeeds. If copying fails, the whole ID is left selected (and tapping the field selects it) so it can be copied by hand. To rebuild a reported puzzle in code or a test: `const { config, seed } = parsePuzzleId(id)!; generatePuzzle(config, seed);` (from `src/generator.ts`). Changing what an ID produces requires bumping `GENERATOR_VERSION`; IDs from other versions are rejected.

## Handcrafted levels

Seven levels (`src/levels.ts`). Levels on the home screen lists them all; tap any to play it. The one the sequence has reached is marked "Up next".

1. Sprouting Grove: make Grove, tier 3 of 4 (forgiving intro).
2. Songbird Chorus: make Song, tier 3 of 4; plain 3-merges suffice.
3. Lone Elk: place all supply and leave exactly one item (elk only; a 5-merge strands a leftover).
4. Crystal Fives: make Crystal, tier 4 of 4 with exactly enough crystals; it needs two 5-merges, and any 3-merge of tier-1 or tier-2 crystals makes it unreachable.
5. The Faraway Grove: a 12x16 scrolling board; have Grove, Song, Elk and Crystal, each tier 4 of 4, on the board at once. Each target shows its own completion; plain 3-merges suffice, with spare supply. Pan by dragging empty ground; for far moves, tap an item, pan, then tap its destination.
6. The Hidden Hollow: a 7x7 map in three areas.
   - **Start:** you begin in Mossy Clearing; Songbird Glade and Crystal Hollow are locked, shaded, and signed with what opens them.
   - **Unlocking:** each locked area has a wooden gate showing what opens it.
     - Make Grove tier 3 of 4 in the Clearing, and the Glade's gate glows. Tap it, or press Enter or Space on it, or use the Unlock Songbird Glade button.
     - Then make Song tier 3 of 4 in the Glade and open Crystal Hollow the same way.
     - Unlocking uses up nothing and never happens on its own. A gate for an area that isn't next does nothing, and dragging across a gate pans the board.
   - **Goal:** Crystal tier 4 of 4 in the Hollow, which needs one 5→2 merge.
   - **Areas:** items never leave their own area, and only an area's own items count toward its unlock or goal.
   - **Failure:** only when no unlock is ready and no merge toward the current target is left: "No useful merges left—Undo or Retry."
7. The Rune Gates (experimental): three small rooms in forest terrain, joined by passages closed by rune gates.
   - **Pressure Hall:** put exactly Grove tier 2 of 4 and Song tier 2 of 4 on the two pressure plates at once; the elk may stay.
   - **Stone Chamber:** merge its crystals down to one Crystal tier 3 of 4, alone on the stone.
   - **Gates:** each opens by itself on the move that meets its tiles, a plain move included, and consumes nothing. Opening is a checkpoint: the items on those tiles stay fixed (a small padlock) and Undo can't go back past it.
   - **Goal:** the Treasure Nook hides a disc-golf backpack until its gate opens. It appears closed; tap it (or press Enter or Space on it) to open it and win.
   - **Failure:** none; the level can't be stranded. Items never leave their room.

Winning offers Next level (after the last level: play again from level 1). Progress is kept in memory only: the Levels page and the home screen note show where the sequence is up to, and reloading starts at level 1.

## Rules and controls

- Drag an item (or tap it, then tap a destination). Dropping onto a matching item merges its connected matching group: Merge 3 for 1 upgraded item; merge 5 for 2.
- Dropping onto a different item swaps them. Merges only happen on drop.
- Levels only: press "Add supply" to place the next item in a random empty cell. Placement is seeded, so Undo then Add supply again lands in the same place, and Retry replays the same sequence.
- Undo reverses the last action; Retry restarts the current level or puzzle.
- Level status is exact within the supported resource bounds (`src/status.ts`): single-item and distinct-family multi-item goals use resource counts; Leave one uses an exact per-tier merge check and needs two free cells beyond all items and supply. Handcrafted levels 1–5 report a loss as soon as the goal becomes unreachable; generated puzzles report one only when no merges are left.
- Region levels (`src/regions.ts`): rectangular areas that split the board exactly and unlock in order, each when its item (that tier or higher) is in a named earlier area. The session enforces them: no drops into or out of locked areas or across area borders, merge groups stop at borders, and Unlock (the button, or the next area's gate) is an ordinary undoable move; a gate's unlock names its area, and the session refuses it unless that area is next. They have no supply, and the goal is one item in the last area. Their status counts each area's own items and reports a loss only when nothing useful can change. Room levels (a treasure goal) instead leave empty terrain between rectangular rooms; each later room opens by itself when marked tiles in an earlier room hold exact items (pressure plates, or a stone that must hold its room's only item), as a checkpoint that fixes those items and clears Undo; they never report a loss. Other region configurations are rejected with an "Unsupported region level" error.
- Tap "?" next to the title for a short how-to-play dialog.
- Boards larger than the screen scroll inside a framed viewport with finger-sized (64px) tiles. Drag an item to move it; drag empty ground to pan; a tap never pans or drops. Center board recenters; arrow keys scroll the focused cell into view. Levels 1–4 are 4x4 and fit without scrolling; level 5 scrolls. Generated boards up to 8x8 fit iPad screens in Chromium checks (except slight scrolling at 1024x768 landscape). Whenever a board overflows its frame, the status banner and Help show how to pan.

## Large-board navigation test

Level 5, The Faraway Grove, is the playable 12x16 scrolling board at the normal app address, https://elkchemy.web.app/ (Levels on the home screen). It ships through the ordinary build and requires all four families at tier 4 simultaneously. Unlocking areas is level 6, The Hidden Hollow (a 7x7 map that pans on phones and fits on iPads).

For local navigation experiments, `npm run dev` also serves `/sandbox.html`, a separate test board with items in distant corners (it also opens on the home screen; choose Levels). That standalone test page is excluded from the ordinary production build; its earlier temporary Firebase deployment has been replaced by the five-level app.

Built with React, TypeScript and Vite. Game rules live in `src/board.ts`, `src/session.ts`, `src/regions.ts` and `src/status.ts`; puzzle generation in `src/generator.ts`; the UI is in `src/ui/`.

Open work, verification gaps, and the deferred campaign story are tracked in [TODO.md](TODO.md). The broader game vision is in [docs/game-vision.md](docs/game-vision.md); completed work, verification, and known limitations (including the generated-puzzle release `20261018-232855`) are in [docs/release-notes.md](docs/release-notes.md).

## Creative direction

Elkchemy is a surprise for Alisha, nicknamed Elk. She enjoys sci-fi (especially Doctor Who), 1940s fashion, classic Hollywood films, watching YouTube videos, disc golf, and playing ukulele and clarinet. Keep these preferences available in future Claude handoffs. They are creative references, not requests to add every theme or feature.

Potential directions include whimsical original time-travel touches, vintage glamour and Art Deco accents, and warm clarinet/ukulele music with subtle spacey textures. Keep the woodland setting and approved elk artwork coherent. Use original melodies, characters, names, and imagery rather than copying Doctor Who or film assets. The current music files are first drafts; these preferences should inform later revisions and listening review.

Campaign direction (committed, details still exploratory): first a lost woodland elk merges her way through different universes to get home; once home, she discovers her friends are lost and sets out to rescue them. See [TODO.md](TODO.md) and [docs/game-vision.md](docs/game-vision.md). Story implementation is not current scope.

## Approved artwork

The approved Elkchemy app icon and visual reference is `artwork/elkchemy-icon-v1.png`: a friendly golden elk with leafy antlers, a musical sparkle, and a forest-green background. Its generation prompt is beside it. This original is not shipped; the app only ships the resized icons below. The home screen shows `public/icons/icon-512.png`.

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

## Music

The header's Music button starts or mutes quiet, looping background music. It starts off on each page load and downloads no audio until enabled. The approved Woodland Stroll loop plays generally; Songbird Chorus (and a generated single-goal Song puzzle) uses Curious Clearing. Each track is fetched and decoded once per page session, not streamed continuously. Music stays enabled across level transitions and pauses while the app is hidden. Returning resumes it if enabled; if playback is blocked, tap Music again. Loading/playback failures leave gameplay usable and show a retry control. Use the device volume for adjustment. Sound effects are not implemented yet.

Music / Scores on the home screen shows playable arrangements of both loops as separate one-page parts for B♭ clarinet (written a major second up) and ukulele (concert-pitch chords, notation, and TAB), each with print and SVG download links, plus both parts as editable MusicXML. They are generated from `artwork/music/score.json` with `npm run music:scores` (Verovio, a dev dependency); see [docs/music/README.md](docs/music/README.md). The recordings themselves are synthesized and unchanged.

Chromium checks cover decoding, loop configuration, mute/resume, level switching, simulated visibility changes, failure/retry, and a delayed load completing after mute. Physical iPad/Safari playback, perceived volume, and real background interruptions still need testing.

## Updates

The footer shows the running build id. "Check for updates" fetches the deployed `/version.json` on demand (never automatically) and compares it with the build id compiled into the app; if it differs, "Update now" reloads the app, which returns to the home screen and discards the current attempt. There is no service worker, so the app is not available offline.

Hosting headers (`firebase.json`): HTML, `manifest.webmanifest` and `version.json` use `Cache-Control: no-cache` (always revalidated); hashed files under `/assets/` are cached for a year (`immutable`). Icons use Firebase defaults.

The build id defaults to a UTC timestamp (`YYYYMMDD-HHMMSS`); set `ELKCHEMY_BUILD_ID` to override it, e.g. `ELKCHEMY_BUILD_ID=v1 npm run build`.

## Deploy

```bash
firebase deploy --only hosting --project elkchemy
```
