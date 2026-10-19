# Elkchemy — release notes and history

Each entry records what changed, how it was verified, and known limitations. **Unreleased** entries are implemented in the repository but not published to https://elkchemy.web.app/; published entries name their build id. Open work lives in [TODO.md](../TODO.md); the longer-term direction is in [game-vision.md](game-vision.md). Player-facing release history is available from the home screen.

Earlier published builds are not backfilled here. The previous build, `20261018-195510`, has five handcrafted levels and optional looping music; its verification is recorded in TODO.md under Current baseline and Audio.

## Unreleased — Gameplay background (October 18, 2026)

Not committed or deployed; production remains `20261019-011024`. Backgrounds only; merge, goal and victory animations are separate tasks.

### Changes

- Handcrafted levels and generated puzzles now show the cheering woodland behind the board, with the elk and Alisha at its lower right. It uses Codex's web copies of `artwork/gameplay/woodland-cheering-*-v1.png` in `src/assets/art/`. The originals, the archive, and the canonical Alisha reference are unchanged (hashes match).
- Reuses `SceneArt` (new optional `className`): a fixed, decorative (`alt=""`) full-screen picture, portrait art in portrait orientation. In game screens it always fills the screen (`cover`), anchored right and 60% down, which keeps both characters fully in frame at every checked size; a 20% dim sits over it.
- Readability without layout changes: otherwise transparent controls (Music, help, Home, Copy, Check for updates, the in-progress banner) get a dark fill, and text drawn on the art (title, level label, supply hint, Puzzle ID label, build and update status) gets a tight dark plate made with `box-shadow`, so no element changes height. Disabled buttons use an opaque version of their earlier faded look instead of `opacity`, so the art does not show through them.
- The game layout, board sizing, tiles, panning, gestures, rules, audio and Home/Play artwork are unchanged. No animations, dependencies or persistence were added.

### Verification

- 380 tests (game render tests now check the background sources and empty alt), typecheck, and production build pass.
- Claude, Playwright Chromium against the production build at 390×844, 844×390, 820×1180, 1180×820, 1024×1366, 1366×1024 and 1024×768, for handcrafted level 1 and a fixed-seed generated puzzle (`v1-goals-t4-g3-7`, 7×7):
  - The correct composition was selected each time: portrait art at the three portrait sizes, landscape art at the four landscape sizes. Home and Play still load their own art.
  - Board position, size and tile size, board pan state, and page height were identical to the same build without the background, measured beforehand. There was no horizontal overflow, and no visible button or input was under 44px.
  - Text contrast, measured from a screenshot with the text hidden, against each text colour and taking the worst 5% of background pixels without shadows: at least 6.2:1 for every checked text in view. This covered the title, level label, hint, banner, Music, help, Home, Copy, Puzzle ID label, build and Check for updates. Text below the fold at phone sizes was not measured. Before the dark plates were added, text drawn on the art measured 1.3–3.6:1.
  - Character visibility was sampled on a 24×24 grid over the characters' bounding box, which was estimated by eye from the artwork, counting points not covered by the board, panels, buttons, banner or text. The characters were 100% in frame at every size. The visible share (top / bottom of page scroll) was:

    | Size | Level 1 | Generated puzzle |
    | --- | --- | --- |
    | 390×844 | 9/16% | 19/27% |
    | 844×390 | 79/64% | 71/59% |
    | 820×1180 | 26/35% | 22/32% |
    | 1180×820 | 41% | 53% |
    | 1024×1366 | 59% | 49/56% |
    | 1366×1024 | 60% | 71% |
    | 1024×768 | 33% | 42% |

    Anchoring 60% down was chosen over 0%, 40%, 50%, 70%, 80% and 100%: 50% showed slightly more at 820×1180 and 1024×1366 but cropped the characters' feet at 1024×1366.
- Interaction (production build):
  - Level 1 at 820×1180 with reduced motion emulated: tap-to-move, drag-to-move, Undo, Retry, and a merge all worked; the existing reduced-motion fade applied to merge effects, and the background had no animations. Home asked for confirmation and returned home.
  - The generated 7×7 puzzle at 390×844 and 844×390: dragging empty ground panned the board viewport, by (50, 40) px, without moving the page or the board. At 390×844 tap, scroll, tap moved an item across the board, Undo and Retry restored the start, the page still scrolled to its bottom, and Home asked and returned.
  - No console errors.
- Not verified: physical iPad/Safari and Home Screen mode, including the fixed background while the page scrolls under Safari's toolbar, real touch, and sharpness on the 12.9-inch iPad Pro (the art is 1672px on its long side). Chromium emulation does not establish them.

### Known limitations

- **Open layout conflict (owner decision).** Both compositions put the characters at the lower right, which is where the existing layouts put the controls: the right-hand column on landscape iPads (≥900px wide), and the full-width board and controls in portrait. As a result much of the characters is hidden; on phones in portrait they are almost entirely behind the board and controls. Fixing this needs new character placement in the art or a game-layout change, both outside this chunk.
- The light dim and text plates slightly mute the art; plates are visible as small dark chips behind text.

## 20261019-011024 — Woodland Home and Play artwork (October 18, 2026)

Published October 18, 2026 with owner authorization, alongside the Music scores entry below (same build `20261019-011024`).

### Changes

- **Home** is now the full woodland scene with the four-legged elk (`artwork/home/woodland-home-*-v1.png`), replacing the enlarged icon. **Play** shows Alisha's scene (`artwork/play/alisha-elk-play-landscape-v4.png`, `alisha-elk-play-portrait-v1.png`). The canonical reference and archive were not used or touched.
- Web delivery copies (WebP, quality 80, original pixel sizes, 257–305 KB each) were made by Codex in `src/assets/art/` (see its README); originals unchanged. Vite imports them as hashed `/assets/` files, which Firebase already serves as immutable.
- `src/ui/SceneArt.tsx`: a fixed full-screen `<picture>`; the portrait art in portrait orientation, the landscape art otherwise. Portrait art always fits the screen's width and landscape art its height, so characters are never cropped. The other direction is cropped around a per-screen focal point or, on screens more elongated than 16:9, filled with the art's sampled edge colour with a short fade.
- Landscape: controls sit in a right-hand column (`clamp(320px, 40vw, 460px)`) over a dark scrim. Portrait: controls sit at the bottom, and the page's top padding is computed so they always start below the character's feet; when they don't fit, the page scrolls rather than covering the character.
- Home: title, Play and Levels side by side, and Music / Scores in the dark area. Release notes and Music are chips in the top corners. Build and Check for updates stay in the existing footer. Play: ‹ Home and Music in the top corners (stacked top-right on phones, clear of the antlers). The "Play" heading moved into the settings panel, and Tier and Goals share a row when there is room. Play still opens the settings before a puzzle starts.
- All controls and text remain HTML. Game screens, Scores, Release notes, music, updates, recordings and gameplay are unchanged. The in-game history gains a "Woodland scenes" entry.

### Verification

- 380 tests (the Home and Play render tests now check the scene sources, alt text, scene class and Play heading), typecheck, and production build pass.
- Claude, Playwright Chromium against the production build (`vite preview`) at 390×844, 844×390, 820×1180, 1180×820, 1024×1366, 1366×1024 and 1024×768, Home and Play. A script mapped each character's bounding box (estimated by eye from the artwork) through the computed `object-fit`/`object-position`. At every size the whole character, antlers included, was on screen and no control or panel intersected it; no buttons or options were under 44×44px, and there was no horizontal overflow. Home never scrolled. Screenshots inspected at every size.
- Puzzle and Levels board widths were unchanged by the new layout (708px at 820×1180, matching the earlier record).
- Flow at 820×1180: Music on at Home stays on into Play; Merge down to one → Start puzzle → board → Home; Levels → Home; Music / Scores → Home; Release notes (new entry) → Home; Music off; Check for updates → "You're up to date." No console errors.
- Contrast was checked visually, not measured. Chips and Music / Scores use an 80%-opaque dark fill; by calculation, gold text on that fill over pure white stays above about 5.5:1. The title relies on a text shadow over the darker art and scrim.
- Not verified: physical iPad/Safari and Home Screen mode, including the fixed background with Safari's dynamic toolbar, `dvh`/`cqw` behaviour, and image sharpness on high-density screens. Chromium emulation does not establish them.

Codex release verification: 380 tests, typecheck, and a fresh production build passed. Independent Chromium review covered all seven requested Home/Play viewports, orientation-specific artwork, 44px controls, no horizontal overflow, Home without scrolling, and Play/puzzle/Levels/history navigation. Separate score parts printed as one page each on A4 and Letter; the complete Scores page printed as four pages with print media enabled. Live build `20261019-011024` was verified after deployment: Home and Alisha Play artwork loaded, a puzzle started, all four instrument parts appeared, and their SVG links returned 200. Physical Safari/device and instrument-performance limitations remain.

### Known limitations

- Play scrolls on phones: 65px at 390×844 (Start puzzle stays visible; only the footer is below the fold) and 286px at 844×390 (Start is below the fold). The earlier Play page also scrolled at 844×390.
- At 4:3 landscape the Play settings panel covers part of the scene's centre-right (rune stones and trees); the basket remains visible.
- The art is 1672px on its long side, so it is upscaled on 12.9-inch iPads (2732px wide at 2×) and may look soft there.

## 20261019-011024 — Music scores (October 18, 2026)

Published October 18, 2026 with owner authorization in build `20261019-011024`.

### Changes

- **Music / Scores.** A home-screen button opens a page with playable arrangements of Woodland Stroll and Curious Clearing as separate one-page parts: a B♭ clarinet part and a ukulele part (chord symbols, notation, and TAB) for each song, four bars per line. Each part has "Open … part to print" and "Download … part (SVG)" links; each song also offers both parts together as MusicXML for notation apps (the optional combined score). Music controls stay available, and Home returns. Songs come from a small `SONGS` list in `src/ui/Scores.tsx`.
- **Generated scores.** `artwork/music/scores.mjs` (`npm run music:scores`) reads `artwork/music/score.json`, writes the editable MusicXML to `docs/music/`, and engraves one SVG per part with Verovio 6.3.0 (new pinned dev dependency, LGPL-3.0, build-time only; not in the app bundle). Output is deterministic. The app imports the files by URL, so the build ships them as hashed assets and the repository keeps one copy. The game audio is unchanged.
- **Arrangement.** The exact recorded melodies, tempos, and eight-bar loops with repeats, tempo marks, and bar numbers. Clarinet written a major second up with transposed key signatures (D → E major, G → A major); syncopations tied across beats. Ukulele at concert pitch with chord symbols, notation, and G–C–E–A TAB, using first-position seventh-chord shapes simplified from the recordings' ninth and slash chords; strum patterns (down on each beat; down, down-up, down, down-up) instead of the recorded arpeggios; the recorded bass line is omitted. Each part is labelled as an arrangement of the synthesized recording. Choices and a chord table: `docs/music/README.md`.
- In-game release notes gain a "Sheet music" entry. `artwork/music/README.md` no longer says playback is unimplemented.

### Verification

- 380 automated tests, typecheck, and production build pass. Twelve tests read the committed MusicXML with an independent parser and match every clarinet note's concert pitch, start, and length to `score.json` (ties merged); check the written key and transposition, full 4/4 bars on every staff, tempo and repeats; check each ukulele chord symbol against the simplified recording harmony, each strum against its four chord tones, and TAB strings and frets against G–C–E–A tuning and the notation staff; and check each part SVG (eight bars, two lines, labels, page-fitting shape). Corrupting a melody pitch or a chord root made them fail. Render tests cover the page links and the home entry.
- Engraving inspected as rendered images in Chromium during development; fixed a clipped credit line, oversized strum text, an unjustified last line, chord symbols too close to the clarinet staff, and nondeterministic SVG ids.
- Printing, from real Chromium print output (PDFs at A4 and Letter, 0.4-inch margins): each of the four parts opened on its own prints as exactly one page, scaled to page width (staff about 6.5 mm) and centred vertically; printing the Music / Scores page gives exactly four pages, one complete part per page, with no clipping and no blank pages. Before this fix, printing the page gave seven pages for two songs, which an earlier note here had wrongly described as one song per page.
- Earlier Chromium checks of the page (before splitting into parts): navigation, link responses, byte-identical downloads, and music staying on across screens. The on-screen size of the new part images was not re-measured after the split.
- Not verified: Safari or physical iPad display and printing, the MusicXML download on iPad, and playing the arrangements on real instruments.

### Known limitations

- Each part fills only the top part of its printed page (eight bars); standalone prints are centred vertically.
- On phones, each part scrolls sideways inside its frame rather than shrinking.
- Verovio draws rhythm stems on the TAB staff as well as the notation staff, and does not render chord-diagram boxes. No PDF downloads.
- The recording's bass line and arpeggio figure are not arranged; the ukulele strums simplified seventh chords.

## 20261018-235203 — Home screen, "No merges left", Undo fix, Copy ID (October 18, 2026)

Published October 18, 2026 with owner authorization; source changes remain uncommitted. Owner-confirmed follow-ups to the generated-puzzle release.

### Changes

- **Home screen.** The app opens on a home screen showing the approved elk artwork (the existing 512px resize of `artwork/elkchemy-icon-v1.png`, `public/icons/icon-512.png`; nothing regenerated), with Play (the existing puzzle mode/settings screen), Levels (the handcrafted levels; a note shows where they continue once past level 1), and Release notes. Music and Check for updates stay available. Play and Release notes have a "‹ Home" button; the game screens' Menu button is now Home, with the same discard warning. Updating now says it returns to the home screen.
- **Player-facing release notes** (`src/ui/ReleaseNotes.tsx`): a short, plain-language history, newest first, separate from this internal record. This completes the deferred "main page" history entry.
- **"No merges left—Undo, Retry, or New Puzzle."** (owner-approved wording). Generated puzzles report this, as a lost state, only when the goal is unmet and no family has three or more items at one tier below the maximum (board plus any supply). With free moves and swaps any three such items can be gathered and merged, so scattered matches do not count as stuck; maximum-tier items never merge; three is the smallest group for either the 3→1 or 5→2 rule. A fatal choice that leaves merges available still reports nothing. In this state the board is locked like a handcrafted loss; Undo, Retry, New Puzzle, and Home remain available. The level flag was renamed from `detectLoss` to `earlyLoss`. Handcrafted levels are unchanged.
- **Compact puzzle ID.** The half-width "Puzzle ID" panel is replaced by a read-only field with an adjacent Copy button below the Home button; the goal panel now spans the full info row. Copy writes the full ID with the Clipboard API and shows "Copied" (and announces it) only after the write succeeds, reverting after two seconds. If the write fails or the API is unavailable, the whole ID is selected in the field and a short note says to copy it by hand; tapping the field also selects all of it.
- **Undo defect fixed.** Dropping an item onto an identical item that cannot merge (for example one of a pair onto the other) changed nothing on the board but was recorded as a move, replacing the single Undo step; the next Undo then restored the same board and appeared to do nothing. Such drops are now ignored (no move, no Undo change; a tap selection is cleared). Undo remains single-step by design.

### Undo investigation (reported ID `v1-goals-t3-g1-z7hukc`)

The puzzle has five Elk tier 1 and one Elk tier 2; the goal, Elk tier 3, needs one 5→2 merge. A 3→1 merge instead leaves two tier-1 and two tier-2 Elk, with no merges possible. In the published build that dead end stayed "playing"; plain Undo did restore the previous board. The defect above reproduced on the same dead end: dropping one tier-2 Elk onto the other (or a tier-1 onto its pair) and then pressing Undo left the board unchanged, after which Undo was disabled. Pressing Undo twice in a row also does nothing the second time, because Undo is single-step. Which of these the owner hit is not confirmed; the owner's exact move sequence is unknown.

### Verification

- 365 automated tests (up from 354; several existing tests were also rewritten for the new rule), typecheck, and production build pass. New tests cover the reported ID (stuck path, "No merges left", Undo, continuing to a win, Undo after a win, single-step limit), the no-op drop keeping the Undo step (confirmed to fail without the fix), scattered matches, maximum-tier items, unspent supply, greedy play across 60 seeds reaching "No merges left" only when no merge can be arranged, the home and Play screens, and release notes free of internal terms.
- Claude, Playwright Chromium against the production build: home → Play → Home, Release notes → Home, Play → puzzle → Home, Levels → win level 1 → Next → Home (continue note) → resume. The reported ID (seeded through a test-only override of the browser's random source) reproduced its board; the 3→1 dead end showed "No merges left—Undo, Retry, or New Puzzle." with a locked board and Undo available; Undo restored the start board; an ordinary move, then a pair drop, then Undo restored the pre-move board and play continued to a win; scattered tier-1 Elk with none adjacent stayed playing; Retry restored the start; the winning sequence won and Undo after the win returned to playing; New Puzzle and Home worked from the stuck state. Layout at 390×844, 844×390, 820×1180, 1180×820, 1024×1366, 1366×1024, and 1024×768: no horizontal scroll, all buttons and options at least 44px, the home screen fits without scrolling on every iPad size and phone portrait; release notes scroll on shorter screens. The standard-iPad game layout is unchanged (708px board frame at 820×1180). Music toggles from home. No console errors.
- Compact puzzle ID (Chromium, production build): Copy put the exact ID on the clipboard (read back) and showed "Copied" only after the write; with a 600ms delayed write the label stayed "Copy" until it resolved; with a rejected write no success text appeared, the failure note was visible, the whole ID was selected, and a manual copy (Ctrl+C) produced the ID; repeated clicks in the field kept the whole ID selected. With the longest possible ID (`v1-goals-t4-g3-1z141z3`), the full ID was visible and the field and Copy button were 44px tall, on one line, inside the controls, at 360×740, 390×844, 844×390, 820×1180, 1180×820, 1024×1366, 1366×1024, and 1024×768; no horizontal page scroll except a pre-existing 1px overflow of the in-game title row at 360px. Two new unit tests cover success only after a resolved write, and failure on rejection or a missing Clipboard API (367 tests in total).
- Not verified: physical iPad/Safari, including touch, the Copy button's clipboard access and tap-to-select in Safari and Home Screen mode, the home artwork's sharpness on high-density screens, and the reported 12.9-inch iPad Pro sizing issue.

Codex release verification: 367 tests, typecheck, and production build passed. Independent Chromium checks confirmed exact clipboard contents, rejected-write selection/fallback, and 44px field/button heights at phone and iPad sizes. Firebase Hosting deployment succeeded; the live site reports `20261018-235203` and serves the expected JavaScript asset. Live home artwork, release history, puzzle startup, and Copy clipboard contents were checked.

### Known limitations

- Handcrafted levels still announce a loss as soon as resource counts make the goal unreachable; whether they should switch to the "No merges left" rule is undecided.
- A generated puzzle can be unwinnable while merges remain; by design nothing is shown until no merges are left.
- The home artwork reuses the 512px icon, which may look slightly soft on very high-density screens at its 320px size.
- The newest in-game release-notes entry was checked at deployment: October 18, 2026, “A home for the elk”.

## 20261018-232855 — Generated puzzles (October 18, 2026)

Published to the existing Firebase Hosting site on October 18, 2026, with owner authorization. Source changes remain uncommitted. A reduced first milestone to give Alisha more to play: a replayable generate → play → retry or new-puzzle loop on the existing merge rules. Campaign and story work come later.

Owner decisions applied: generated puzzles come before connected-region gameplay; unfinished boards are never saved (later persistence may cover settings, completed puzzles, and bookmarked seeds); returning home and then finding her friends is the committed story direction, with plot details exploratory; the earlier gameplay freeze is lifted.

### Changes

- **Start menu.** The app opens on a menu. Play offers *Merge to goals* (make 1–3 goal items, each a different family, at tier 3 or 4 of 4; leftovers are fine) or *Merge down to one* (one family; finish with exactly one item at exactly the target tier, 3 or 4 of 4). Levels keeps the five handcrafted levels with in-memory progress. Music, help, updates, and board navigation are unchanged.
- **Seeded generation** (`src/generator.ts`, version 1). Each goal is built backwards by random 3→1 and 5→2 splits within a piece budget (goals: 5–8 pieces per goal at tier 3, 8–12 at tier 4; down to one: 6–9 and 9–14). Pieces are shuffled by the seed onto a square board of side `max(4, ceil(sqrt(n + ceil(n/2) + 2)))`, 4×4 to 8×8. Only goal families appear, starting tiers are mixed, every goal needs at least two merges, and there is no supply.
- **Validation with the real rules.** The merge plan is played on the actual shuffled board with `drop()` (moves and swaps gather an isolated group, then the 3- or 5-merge), and that sequence is replayed through the session and status rules: `playing` until the last move, `won` at it. Merge down to one is won only by exactly one item of the target family and tier (`leaveOne` with a target item). At most 20 candidates per seed; otherwise generation throws and the menu shows an error, never an unverified puzzle. The winning sequence is never shown.
- **Reproduction ID** on the puzzle screen, selectable with one tap, e.g. `v1-goals-t4-g2-1nqrzv7` (generator version, mode, shown tier, goal count, base-36 seed). `parsePuzzleId` and `generatePuzzle` rebuild it; pinned IDs in tests catch generator changes made without a version bump.
- **Replay loop.** Retry restores the exact initial board; New puzzle uses a fresh seed with the same settings; the existing single-step Undo works; after a win, New puzzle is the main button. New puzzle and Menu ask before discarding an attempt that has moves. Nothing persists across reloads, and there is no browser/app-close warning.
- **No early failure in generated play.** Generated puzzles report only `playing` or `won`. Handcrafted levels keep their immediate count-based loss reports.
- **Panning guidance follows the layout.** The pan hint (status banner) and the panning bullet in Help now appear whenever the board actually overflows its viewport, measured on load and resize, instead of only for boards larger than 8×8. This was a Codex review fix: 5×5 boards at phone width and 8×8 boards at 1024×768 had overflowed without guidance.
- Copy: help, objective, and status text name the target for Merge down to one, omit supply when there is none, and say "both" for two goals. Update now says it returns to the menu.

### Deliberately excluded

Campaign and story, connected rooms and gates, new recipes or tiers, resupply in generated puzzles, bookmarks/history screens, statistics, accounts, saved boards, a seed-entry screen, About/Settings screens, new audio or animation, automatic update notices, diagnostics, hints, and larger difficulty controls.

### Verification

- 354 automated tests (70 new), typecheck, and production build pass. New tests cover every supported configuration over 60 seeds each (witness replay through the session, 3- and 5-merge coverage, mixed starting tiers, target families only), exact-one/target-tier checks against a brute force, determinism, pinned boards, ID parsing, unsupported settings, witness-search failure, and no loss reports after stranding merges.
- Claude, Playwright Chromium against the production build: both modes completed by real taps (Merge to goals tier 4 with two goals, twice; Merge down to one at tier 4 and tier 3) and once by drags; each board matched its ID regenerated from source; status became `won` only at the last move. Undo after a win, Retry, New puzzle (warning cancelled and accepted), Menu, Help, music, and handcrafted level 1 → Next level → Menu → resume worked. A stranded board stayed playable without a loss banner. The worst-case 8×8 board had 68–87px tiles without board scrolling at 820×1180, 1180×820, 1024×1366, 1366×1024, 768×1024, 744×1133, and 1133×744, with buttons at least 44px and no horizontal page scroll. After the panning fix, the guidance appeared exactly when the board overflowed: 5×5 at 390×844 (and not at 820×1180, including after resizing back), 8×8 at 1024×768 (and not at 768×1024), the 12×16 sandbox, and not on a 4×4 level at phone width. No console errors.
- Codex independently re-ran the tests, typecheck, and build, completed both modes in Chromium, and confirmed Undo, Retry, and New puzzle.
- Not verified: physical iPad/Safari, including touch play, one-tap ID selection, the discard confirmation in Home Screen mode, and the reported 12.9-inch iPad Pro sizing issue. Chromium emulation does not establish them.

Live deployment check: Firebase Hosting reported release complete; Codex verified `/version.json` and the displayed build as `20261018-232855`, the expected JavaScript asset, the Play menu, and successful puzzle startup in both modes. Full completion checks were performed against the production build before deployment.

### Known limitations

- A stuck player in a generated puzzle gets no signal; what "useful actions exhausted" should mean is undecided.
- Difficulty is untuned: both modes use exact inventories (no spare pieces), and the five-for-two merge is not taught explicitly.
- At 1024×768 landscape an 8×8 board sits at the 64px tile minimum and scrolls slightly; panning guidance and Center board appear.
- IDs from other generator versions are rejected; reproduction across future versions is unresolved.
- Undo is single-step, as before.
