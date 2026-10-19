# Elkchemy — open work

Updated October 19, 2026. This is the project backlog, not authorization to implement every item. Keep Claude handoffs small; Codex plans and reviews, Opus coordinates Sonnet implementation agents, and the operator copy/pastes prompts. Do not commit, push, or deploy without authorization.

Design context lives in [docs/game-vision.md](docs/game-vision.md) (the broader vision and idea pool; context, not a backlog). Completed work, its verification, and known limitations are recorded in [docs/release-notes.md](docs/release-notes.md). This file stays the single task list.

## Owner decisions (October 18, 2026)

These resolve older conflicting entries below.

1. Generated puzzles come before connected-region (unlockable-room) gameplay, to give Alisha more to play.
2. Do not save unfinished boards. Later persistence may cover settings, completed puzzles, and bookmarked seeds.
3. Returning home, followed by finding her friends, is a committed, evolving story direction. Specific plot details remain exploratory; story implementation is outside the current milestone.
4. The earlier gameplay freeze is lifted; Alisha's feedback (more levels, replayability) informed the generated-puzzle milestone.

## Release documentation

- [x] Add release notes/history recording each release's changes, verification, and known limitations; distinguish implemented work from published releases: [docs/release-notes.md](docs/release-notes.md). Earlier published builds are not backfilled; their details stay in Current baseline and the sections below.
- [x] Published the generated-puzzle release notes as build `20261018-232855` and recorded live-site verification. Continue recording build IDs and verification for future deployments.
- [x] Add a Release notes / History entry on the game's main page so players can see what changed: the home screen's Release notes page (`src/ui/ReleaseNotes.tsx`), plain-language and separate from the internal record. Published in `20261018-235203`.
- [x] Checked the newest in-game release-notes entry and published the internal entry under build `20261018-235203`; repeat for future releases.
- [x] Once the generated-puzzle scope was complete, its results were recorded in the release notes, outstanding work was carried into this backlog, references were updated, and `docs/next-release.md` was removed. `docs/game-vision.md` remains the ongoing vision document.

## Current baseline

- Release build `20261019-175745`: The Hidden Cache's resource area is now a concealed part of one irregular clearing: plain forest with a faint clue at E2 until the D1 plate reveals E2 and the pocket. Codex reviewed; owner authorized commit → push → deploy. See Connected regions below and [docs/release-notes.md](docs/release-notes.md).
- Level 8 release build `20261019-171209`: The Hidden Cache, a clearing whose hidden alcove shares its items, and a clarinet case to open. Codex reviewed; owner authorized commit → push → deploy. Physical-iPad playtesting follows publication. See Connected regions below and [docs/release-notes.md](docs/release-notes.md).
- Previous deployment `20261019-163932` (commit `d271347`): cell art placed by insets, so ordinary items and the backpack fit their cells. The owner reports the build and confirms the fix on the physical iPad; Claude checked only that the live `/version.json` reports it.
- Previous deployment `20261019-162807` (commit `47bf582`): a bare padlock on completed Rune Gates tiles, and a closed backpack that opens on collection.
- Previous deployment `20261019-161758` (commit `b95a4b1`): the Rune Gates tile and backpack visual pass, and the level's in-game Release notes entry.
- Previous deployment `20261019-132651` (commit `99bbd6d`): level 7, The Rune Gates (experimental), and four Hidden Hollow gate fixes. See Connected regions below and [docs/release-notes.md](docs/release-notes.md).
- Previous deployment `20261019-055257`: tappable wooden gates on The Hidden Hollow's locked areas. See Connected regions below and [docs/release-notes.md](docs/release-notes.md).
- Previous deployment `20261019-052826`: level 6, The Hidden Hollow, the first connected-region level (three areas unlocked in order), and a Levels page that can start any level. See Connected regions below and [docs/release-notes.md](docs/release-notes.md).
- Previous deployment `20261019-021029` (live `/version.json` checked October 18, 2026): gameplay background behind levels and generated puzzles; board layout unchanged, but the cheering characters are largely behind the controls (open decision under Gameplay presentation).
- Previous deployment `20261019-011024`: woodland Home and Alisha Play artwork (full-scene backgrounds with HTML controls; Chromium-checked at phone and iPad sizes). See [docs/release-notes.md](docs/release-notes.md).
- Published in `20261019-011024`: Music / Scores page with clarinet and ukulele arrangements of both loops. See [docs/release-notes.md](docs/release-notes.md).
- Previous deployment `20261018-235203`: home screen with the elk artwork, Play / Levels / Release notes; "No merges left" for generated puzzles; Undo fix; compact Puzzle ID with Copy. See [docs/release-notes.md](docs/release-notes.md).
- Published build `20261018-232855`: the generated-puzzle milestone (start menu, two seeded puzzle modes, Retry/New puzzle). Changes and verification: [docs/release-notes.md](docs/release-notes.md); open work: Generated puzzles below.
- Previous deployment: `20261018-195510` on the existing Firebase site: five levels plus default-off background music and a mute button. The Faraway Grove still has its 12×16 board and four simultaneous targets. This uses the ordinary build; the earlier standalone `/sandbox.html` is no longer shipped. The owner explicitly wants iPad tests on this site, without another environment.

- The reviewed five-level build passes 276 tests, typecheck, and production build. Codex played through all five levels in Chromium and verified that the deployed HTML, version, JavaScript, and CSS match the build. Production cache headers were checked in an earlier release.
- The owner completed the first four levels and the earlier scrolling test board on iPad, confirmed that the update button worked, and approved the Home Screen icon. Level 5's four-target UI and its owner/wife playtest remain pending.
- The owner approved both original synthesized music loops. Background playback and the mute button are now implemented directly by Codex at the owner's request, without Claude delegation. The owner reported the latest playtest went well. The gameplay freeze that followed it is lifted (owner decision 4).
- No game-state persistence, offline support, or remote diagnostics exists yet. Generated puzzles are live in build `20261018-232855`.

## Generated puzzles (Play menu) — published 20261018-232855

What was built, how it was verified, and its limitations: [docs/release-notes.md](docs/release-notes.md) (build `20261018-232855`). Generator `src/generator.ts`, version 1; reproduce a reported ID with `generatePuzzle(parsePuzzleId(id).config, parsePuzzleId(id).seed)`.

- [x] Start menu with Merge to goals / Merge down to one, seeded generation validated by replaying a real winning sequence, selectable reproduction ID, Retry / New puzzle / Undo, and no early loss in generated play.
- [x] Codex review fix: panning guidance (banner and Help) follows the board's measured overflow, so 5×5 boards at phone width and 8×8 boards at 1024×768 now show it. Chromium-checked.
- [ ] Physical iPad/Safari (Chromium emulation does not establish this): touch play through both modes, the puzzle ID's Copy button (clipboard write and "Copied" feedback) and tap-to-select fallback in the read-only field, the discard `confirm` in Safari and Home Screen mode, layout on Alisha's 12.9-inch iPad Pro, and finger comfort on 7×7/8×8 boards.
- [x] Deployed build `20261018-232855` with owner authorization; verified live build, menu, and both mode startups.
- [ ] Gather owner and Alisha playtest feedback.
- [ ] Difficulty tuning from playtesting: piece budgets, how often 5→2 splits are required, board density, and whether Merge to goals should include spare pieces so it is more relaxed than Merge down to one (currently both use exact inventories; goal mode tolerates leftovers only when the player's merge choices create them). Spatial scattering is not logical difficulty.
- [x] Failure behavior for generated puzzles (owner-approved, published in `20261018-235203`): "No merges left—Undo, Retry, or New Puzzle." appears only when the goal is unmet and no family has three or more items at a mergeable tier; scattered matches still count; nothing is shown after a fatal choice while merges remain. The board locks; Undo, Retry, New Puzzle, and Home stay available.
- [x] Puzzle ID shown compactly (unreleased): a read-only field with an adjacent Copy button below Home, replacing the half-width panel; the goal panel now spans the info row. Chromium-checked at phone and iPad sizes.
- [ ] At 360px width the in-game title row (title, Music, ?) overflows the page by about 1px. Pre-existing; not caused by the ID row.
- [ ] Decide whether handcrafted levels should also switch from their immediate count-based loss (for example Crystal Fives' 3-merge traps) to the "No merges left" rule.
- [x] Undo investigation for `v1-goals-t3-g1-z7hukc` (unreleased fix): a drop onto an identical item that cannot merge was recorded as a move and replaced the single Undo step, so the next Undo appeared to do nothing. Such drops are now ignored. Plain Undo on the stuck path already worked. Undo stays single-step by design; a second press does nothing.
- [ ] Ask the owner, if useful, whether the reported Undo failure followed a drop onto a matching item that did not merge, or a second Undo press; the exact sequence is unconfirmed.
- [ ] At 1024×768 landscape (older iPads) an 8×8 board sits at the 64px tile minimum and scrolls slightly (guidance and Center board now appear). Revisit only if physical-iPad feedback finds it awkward.
- [ ] Teach the five-for-two merge more clearly. Help states the rule, but neither the handcrafted levels nor generated puzzles teach it, and generated puzzles often require it.
- [ ] Seed reproduction across generator versions remains open: older-version IDs are currently rejected. Options include keeping old generator versions or recording puzzle definitions.
- Next candidates from the milestone handoff, not a committed schedule: better five-merge teaching (above); user-initiated diagnostic reports following the other app's pattern (Diagnostics below); automatic update detection with manual application (Physical iPad checks below); persistence of settings, completed puzzles, and bookmarked seeds (Persistence below); then connected-region gameplay and narrative exploration (sections below).

## Gameplay presentation — approved follow-up, small chunks

- [x] Create the accepted woodland gameplay direction with the elk and Alisha cheering at the edge; prepare `src/assets/art/woodland-cheering-landscape-v1.webp` (314212 bytes), preserving the PNG and canonical reference. Implementation research is in `artwork/gameplay/README.md`.
- [x] Integrate the gameplay background (published in `20261019-021029`): `woodland-cheering-landscape-v1` / `-portrait-v1` behind handcrafted levels and generated puzzles, by orientation, with Home and Play art unchanged. Chromium against the production build at seven phone/iPad sizes: board position, size, tiles, pan state and page height identical to the pre-change build; no horizontal overflow; all buttons and inputs at least 44px; measured text contrast at least 6.2:1; characters never cropped. Details: [docs/release-notes.md](docs/release-notes.md).
- [ ] Owner decision: the cheering characters sit where the game's controls are, so most of them are hidden at most sizes (visible: 9–27% on phone portrait, 22–35% at 820×1180, 33–71% on landscape iPads, 59–79% at 844×390). Options: accept as decoration; new art with the characters where the layouts leave room (for example under the board on landscape iPads, or a small cameo near the title); or a deliberate game-layout change. Not changed in this chunk.
- [ ] Check the gameplay background on the physical iPad (Safari and Home Screen mode, both orientations): readability, the fixed background while the page scrolls, and sharpness on the 12.9-inch iPad Pro.
- [ ] Extend existing merge effects with nonblocking travel and a distinct five-piece flourish; preserve both five-merge outputs, cancellation and reduced-motion behavior.
- [ ] Add brief goal-completion/victory feedback. Independent cheering-character reactions need separate assets; the accepted background has flattened characters. Do not enlarge this into an animation framework.

## Level variety — implemented; further wife/difficulty feedback pending

- [x] Review and integrate three additional handcrafted levels after the intro: a forgiving musical item goal, a Leave one puzzle, and a tighter Crystal five-merge challenge.
- [x] Support explicit goal types: create a specified upgraded item; or exhaust supply and finish with exactly one object.
- [x] Establish separate win/loss detection for Leave one, including stranded incompatible families. It requires board items plus unspent supply to leave two cells free, so three-merges can be isolated. Independent count-search comparisons pass; larger/tighter boards remain outside scope.
- [x] Validate a winning path for every level through actual session rules and seeded random supply. Preserve meaningful losing-path, undo, and retry tests.
- [x] Add level name/number, Next level after a win, retry of the current level, and replay after the final level. Progression stays in memory for this round.
- [x] Make help, goal text, and status messages follow the active objective and family rather than always referring to trees/Grove.
- [x] Browser progression, replay, and Leave one winning paths pass; the owner reported all four original levels beatable on iPad.
- [ ] Gather Alisha's feedback on Crystal Fives' difficulty; its two required five-merges and immediate losing traps may need further teaching.

## Audio — approved for prototype integration

- [x] Owner listened to and approved `public/audio/woodland-stroll.wav` and `public/audio/curious-clearing.wav` for prototype integration. Scores, renderer, and notes are in `artwork/music/`; richer instruments and longer arrangements can be explored later.
- [x] Add optional background music after approval: default-off header toggle, quiet Web Audio looping of the woodland track, with Curious Clearing on the Song level. No initialization or audio requests until enabled; decoded tracks reused within the page session. Reload returns to off.
- [x] Clarinet and ukulele arrangements (unreleased): Music / Scores on the home screen shows Woodland Stroll and Curious Clearing as separate one-page parts for B♭ clarinet (written a major second up) and ukulele (concert-pitch chord symbols, notation, G–C–E–A TAB), with print and SVG download links per part and both parts as MusicXML. Chromium print PDFs: one page per part at A4 and Letter; the scores page prints exactly four pages. Generated from `score.json` by `artwork/music/scores.mjs` (`npm run music:scores`, Verovio dev dependency); choices and checks in `docs/music/README.md`. Audio unchanged.
- [ ] Play the arrangements on real clarinet and ukulele, and check the parts on the physical iPad: Safari display and printing, and the MusicXML download.
- [ ] Optional score follow-ups, only if wanted: a one-bar-per-line phone layout, chord-diagram boxes, PDF output, or a bass part.
- [ ] Create and review local supply/merge sounds, a five-merge bonus cue, and win feedback. Current files are music loops only.
- [x] Implement mute/audio controls and quiet mixing. Eight focused tests cover lazy initialization, looping, mute/unmute, simulated backgrounding, delayed-load cancellation, track changes, failure/retry, and disposal. Chromium confirms actual audio decoding and running/suspended context state, level transition without duplicate contexts, cached track reuse, and continued gameplay after a forced network failure. The control is at least 44px tall in iPad layouts and phone width.
- [x] Audio release verification: 284 tests, typecheck, and production build pass. The live `20261018-195510` build starts with Music off, decodes and loops the approved woodland WAV when enabled, and suspends its audio context when muted. Subjective listening and actual iPad interruption behavior remain unverified.
- [ ] Verify audible volume, seamless looping, mute, and real background/interruption recovery on physical iPad Safari and Home Screen mode; headless Chromium cannot establish subjective audio quality.
- [x] Integrate the approved local WAV files without streaming or external services. Both files ship under `public/audio/` and are loaded on demand. Offline launch/caching remains a separate task.
- [ ] Music can later draw more strongly on clarinet, ukulele, vintage cinema, and subtle sci-fi textures. Do not replace the current initial direction solely to add the deferred campaign themes. Clarinet stays the primary identity; ukulele or guitar can support it, with occasional harmonica as a family touch. Music should suit each area's setting and tone. Inspect `artwork/music/` (the current synthesized renderer) before choosing a different production approach.

## Physical iPad and interaction checks

- [ ] Post-reset layout investigation: owner reports the game looks good on his standard iPad, but scaling on Alisha's 12.9-inch iPad Pro leaves excessive empty space at the bottom. Check the actual device viewport, orientation, Home Screen/browser mode, and board sizing before changing CSS. Orientation and screenshot were not supplied; cause is unverified. Preserve the working standard-iPad layout. This is a recorded feedback item, not a request to change layout immediately.

- [x] Shared WSL browser tooling: Playwright MCP `0.0.83` is registered in both Codex and Claude user configuration, using headless Chromium and isolated sessions. Browser binaries and Linux libraries are installed. After the WSL reload, Codex used its actual MCP tools to open the live app and verify level 1 of 4, build `20261018-184955`, and 16 board cells; Claude's CLI connection check also succeeded. No app dependency was added. Full browser gameplay checks remain separate below.

- [ ] Confirm the published build number in the existing Home Screen app. Verify Check for updates detects a subsequent release, Update now loads it without reinstallation, and relaunch does not regress to an old build. Updating currently returns to the start menu (home screen once the unreleased changes ship) and discards the current attempt.
- [ ] Supporting follow-up: detect updates automatically and advertise them with a badge or similar. Applying an update stays a deliberate button press; never silently replace the game during play.
- [ ] Verify the help dialog under real touch: open/close, backdrop dismissal, portrait/landscape, focus behavior, and VoiceOver as available.
- [ ] Recheck drag preview accuracy, pointer capture, tap-to-move, page scrolling outside the board, random supply, merge effects, and undo/retry on the physical iPad. Chromium automation is not Safari validation.
- [ ] Verify Undo, Retry, New puzzle, Menu, and level transitions cancel any active drag cleanly.
- [ ] Add a brief visual arrival cue for random supply so sighted players can locate the new item; keep the destination marker removed.
- [ ] Improve elk item artwork that the owner read as a cow; keep it consistent with the approved elk mascot.
- [x] Reuse the approved mascot on the home screen (published in `20261018-235203`). Superseded by the woodland Home scene below. Header use in the game screens is still open.
- [x] Woodland Home and Alisha Play artwork (unreleased): full-screen scenes from `src/assets/art/` WebP copies, with controls in the right-hand column (landscape) or below the character (portrait). Chromium checks passed at seven phone and iPad sizes for character clearance, 44px targets, no horizontal overflow, Home without scrolling, and an unchanged board. Details: [docs/release-notes.md](docs/release-notes.md).
- [ ] Check the Home and Play scenes on the physical iPad (both orientations, Safari and Home Screen mode): cropping, the fixed background with the toolbar, sharpness on the 12.9-inch iPad Pro (the art is upscaled there), and owner approval of the control placement.
- [ ] Optional, only if wanted: reduce Play scrolling on phones (65px at 390×844; 286px at 844×390).

## Level 5: The Faraway Grove — implemented, owner/wife playtest pending

- [x] 12x16 level after Crystal Fives requiring Grove, Song, Elk and Crystal at tier 4 of 4 simultaneously (`items` goal; each target evaluated with the single-item feasibility on its own family, so targets must have distinct families). Forgiving: plain 3-merges suffice, with one spare supply item per family. Per-target completion display; brief large-board control hints in banner/help. Ships in the normal build.
- [x] Codex review: 276 tests, typecheck, and production build passed. Independent Playwright Chromium UI run won levels 1–4, entered level 5, completed all targets with progress 1/2/3/4, undid and restored first-target completion, and replayed to level 1; no page errors. Portrait screenshot inspected. Published on existing Firebase Hosting for owner/wife testing.
- [ ] Physical iPad/Safari playtest: panning and tap-pan-tap over long distances, four-goal display legibility, and whether the level is fun rather than tedious.

## Large-board navigation — implemented, owner iPad test pending

- [x] 12x16 board in a scrollable viewport with 64px minimum tiles; 4x4 levels unchanged (fit, no scrolling, no Center button). Drag item = move/merge/swap; drag empty ground = pan; taps stay taps; follow-up clicks suppressed; Escape, pointer cancel and release outside drop nothing; gestures cancel on session changes. Keyboard focus scrolls into view; Center board control. Dev-only `/sandbox.html` (excluded from builds).
- [x] Verified: 261 tests, typecheck, production build (no sandbox in `dist/`). Playwright Chromium at 820x1180, 1180x820 and 1440x900 with mouse-driven pointer events: panning, tap vs pan, scrolled drop accuracy with a 3-cell merge preview, Escape cancel, release outside, tap-to-move across pans, keyboard focus visibility, centering, supply/undo/retry, no page overflow, level 1 win then Next level. No console errors.
- [ ] Physical iPad/Safari: touch panning vs item drag, `touch-action` blocking page scroll only on the board, pointer capture/cancel under real touch, follow-up click suppression, and comfort of 64px tiles. Chromium mouse events are not Safari touch verification.
- [ ] Decide whether dragging an item near the viewport edge should auto-scroll. Not built: distant moves currently use tap, pan, tap (or several drags).
- [x] Codex fixes: a gesture interrupted by a session change (keyboard Add supply/Undo/Retry mid-drag or mid-pan) suppresses only its own follow-up click; the next tap works. Center board moved below the viewport (44px tall); on the sandbox in portrait the page now scrolls slightly. Playwright-checked in Chromium.
- [x] Start in a 4x4 clearing and unlock regions of the larger board: level 6, The Hidden Hollow (published `20261019-052826`); see Connected regions below. No pinch zoom or momentum yet.

## Large-board navigation — Codex review fixes verified

The 12-column × 16-row dev sandbox is implemented at `/sandbox.html` and excluded from production. Codex independently reran 261 tests, typecheck, and build, inspected portrait/landscape screenshots, verified Chromium touch-emulated panning without page movement or selection, and won normal level 1 and advanced to level 2 through actual UI taps.

- [x] Fix interrupted-gesture follow-up clicks in `src/ui/Board.tsx`. Codex independently verified active drags interrupted by Add supply, Undo, and Retry, including a 700ms delay before release: no ghost or selection remains, and the next real tap works. All 261 tests, typecheck, and build pass after the fix.
- [x] Move Center board out of the playable viewport and give it at least a 44px touch target. Codex independently measured 44px and no board overlap or sideways page overflow at 820×1180 and 1180×820.
- [x] Ignore `.playwright-mcp/` screenshots/logs without deleting unrelated test artifacts.
- [x] Owner completed the large-board test on iPad and reported that scrolling and moving worked well (October 18). This confirms basic navigation through a completed game, not every cancellation/accessibility edge case. Testing used https://elkchemy.web.app/sandbox.html on the existing Firebase site.
- [ ] Investigate if it recurs: owner saw an apparently larger tile in the lower-right area and merged it away before a screenshot. Codex did not reproduce it in Chromium; all cells measured 64×64px in portrait/landscape. Cause remains unknown.
- [x] Implemented the agreed larger handcrafted level (published `20261019-052826`): a 4×4 clearing, two unlockable regions, visible non-consuming unlock requirements, and a final objective in the last region. Win/loss reasoning for locked resources and prerequisites is region-aware. See Connected regions below.
- Edge auto-scroll is deferred for the first navigation test; use tap-pan-tap for distant moves, then decide from physical iPad feedback whether to add it. The earlier plan to defer procedural generation until the unlocking level was playtested is superseded by owner decision 1.

## Replayable puzzles and larger boards

- [x] Add seeded generated puzzles from a constructive method and replay each winning witness using actual rules. Generated puzzles have no supply, so random supply is not involved. See Generated puzzles above.
- [x] Provide New puzzle and Retry same puzzle with varied families and layouts and two objective types.
- [ ] Gradual difficulty and progression across generated puzzles (see difficulty tuning above).
- [ ] Preserve relaxed play with meaningful losing choices beyond the forgiving tutorials.
- [ ] Resolve feasibility detection before introducing genuine space constraints. The current evaluator only supports rectangular boards where board items plus unspent supply fit within capacity; it must not silently evaluate unsupported levels. (Generated puzzles do not use it for status; their solvability comes from the replayed witness.)
- [x] Larger scrolling boards: see Large-board navigation above.
- [ ] Later candidates from the vision, not committed: five-star tiers (new art and rules), more goals than families, more puzzle types and special mechanics, cross-family recipes, full hints. Better teaching of the five-for-two merge comes first.

## Connected regions — first experiment published 20261019-052826, playtest pending

From [docs/game-vision.md](docs/game-vision.md); investigate and prototype before relying on it for the campaign. Changes, authored solution, design rationale, verification and limitations: [docs/release-notes.md](docs/release-notes.md) (build `20261019-052826` — The Hidden Hollow).

- [x] Level 6, The Hidden Hollow: a 7×7 map split into Mossy Clearing (4×4, open), Songbird Glade (3×4) and Crystal Hollow (7×3). Each area's sign shows its unlock item before it opens. An explicit, undoable Unlock button consumes nothing. Goal: Crystal tier 4 of 4 in the Hollow. Data model: rectangular `regions` on the level definition (`src/regions.ts`); unsupported configurations throw.
- [x] Settled boundary applied as "items never leave their region": the session refuses moves, swaps and merges across region borders and into locked regions, merge groups stop at borders, and goals and keys count only in their own open region. Transferable ownership was not added.
- [x] Region-level status: no early loss. "No useful merges left—Undo or Retry." appears only when no unlock is ready and no open area can still merge toward its target. It is exhaustively checked to be exact on this level.
- [x] Owner request (October 18): a Levels page lists every level and can start any of them; none are gated, since nothing is saved.
- [x] On-board gates (published `20261019-055257`; owner-approved).
  - Each locked area carries a wooden gate showing its requirement; it glows (steadily under reduced motion) when that area is next and ready.
  - A tap or Enter/Space on the gate unlocks through the session. The session refuses a gate that isn't for the next area, and the Unlock button stays.
  - Dragging across a gate pans and never unlocks.
  - Details and Chromium results: [docs/release-notes.md](docs/release-notes.md).
- [ ] Owner and Alisha playtest of The Hidden Hollow: whether the gates make unlocking understandable without a tutorial, whether the Hollow's required 5 → 2 merge (the only losing choice) is fair, and whether the map is worth extending.
- [ ] Physical iPad/Safari: touch panning from locked areas and across gates, gate taps under real touch (tap vs. small drags), gate readability, VoiceOver reading of gates and cell labels, Home Screen mode.
- [x] Player-facing in-game Release notes entry for the level and the Levels page ("The Hidden Hollow", shipped in `20261019-052826`).
- [x] In-game Release notes line for the gates: "Open the woodland gates" is in `src/ui/ReleaseNotes.tsx`.
- [ ] Optional, only if wanted: at 844×390 the Hollow's gate (300px) is wider than the 228px board view, and on phones the Glade's gate hides most of its locked pieces.
- [ ] Optional, only if wanted: at 844×390 the 234px-tall board viewport cannot show the whole 4×4 Clearing at once; a phone-landscape layout change would be separate work.
- [x] Hidden Hollow gate fixes from the Codex review of `6a200fd`: visible focus after a keyboard unlock, a clear focus halo on a ready gate, a meaningful lost-state gate test, and these release-note statements (published `20261019-132651`).
- [x] Level 7, The Rune Gates (experimental, published `20261019-132651`). Three rooms in terrain, with rune gates in the passages: pressure plates (exact items, together), then a stone (one exact item, nothing else in its room), then a hidden disc-golf backpack to tap. Gates open on the move that meets them, and opening is a checkpoint (tile items fixed, Undo cleared). It never reports a loss and can't be stranded. Details, winning line and checks: [docs/release-notes.md](docs/release-notes.md).
- [x] Codex review of the Rune Gates and Hollow fixes.
- [x] Owner playtest of The Rune Gates (October 19): the gate and path design looks nice and works.
- [x] Visual pass the owner requested after reviewing the original art (published `20261019-161758`): completed plate and stone tiles keep their item and badge inside the marked square, and the backpack is drawn open with discs inside and two beside it. Codex found no blocking code issue.
- [x] In-game Release notes entry for The Rune Gates (`src/ui/ReleaseNotes.tsx`, dated October 19, 2026; published `20261019-161758`).
- [x] Owner review of `20261019-161758`: the completed tiles still looked bigger than their tiles. Owner-requested corrections (published `20261019-162807`): the lock badge replaced by a bare 14px padlock in the corner, item art at an explicit inset inside the ring, and the backpack shown closed until collected, then open with its discs. Chromium-checked at 390×844 and 820×1180; details in [docs/release-notes.md](docs/release-notes.md).
- [x] Owner review of `20261019-162807` on the physical iPad, portrait and landscape: likes the closed → open bag. Ordinary item art and the open bag still looked larger than their cells, while items on marked tiles were the right size.
- [x] Fix (published `20261019-163932`, commit `d271347`): all cell art is placed by insets, like marked tiles, instead of percentage sizes inside the cell button; Chromium-checked at iPad portrait, landscape and phone sizes. Cause and checks: [docs/release-notes.md](docs/release-notes.md).
- [x] Committed, pushed and deployed with owner authorization as `20261019-163932`.
- [x] Owner confirmed on the physical iPad that the sizing fix works (owner report; Claude has no Safari check).
- [x] Level 8, The Hidden Cache (owner-approved design; release build `20261019-171209`). A clearing, a hidden alcove behind a rune gate, and a separate final room. Pressure plates open each gate with exact items, as checkpoints.
  - The alcove `joins` the clearing's room: once open, items move, swap and merge between them; it stays `hidden` (no tiles, items or labels) until then. Separate rooms stay separate.
  - The final room holds a clarinet case that opens to an assembled clarinet and wins.
  - 470 tests, typecheck and build pass; Chromium-checked at 390×844, 844×390, 820×1180, 1180×820 and 1024×768. Details: [docs/release-notes.md](docs/release-notes.md).
- [x] Codex review of level 8; independent checks recorded in release notes.
- Owner authorized level 8 release in this order: commit → push → deploy (`20261019-171209`).
- [x] Owner review of `20261019-171209`: the alcove was too obvious (silhouette, name, gate and path). Approved direction: a concealed extension of one irregular room with a subtle clue.
- [x] Concealed revision (release build `20261019-175745`):
  - the pocket and its E2 link are plain forest with one lighter foliage cluster at E2;
  - D1 reveals both as one irregular clearing, with E2 as ordinary floor and one outline;
  - no advance text names the pocket.
  - A region `link` cell replaces the pocket's passage.
  - 471 tests, typecheck and build pass; Chromium-checked at 390×844, 844×390, 820×1180 and 1180×820. Details: [docs/release-notes.md](docs/release-notes.md).
- [x] Codex review of the concealed revision; independent checks recorded in release notes.
- Owner authorized commit → push → deploy the revision (`20261019-175745`).
- [ ] Owner judgment on the E2 clue: subtle enough, or too subtle, on the iPad.
- [ ] Owner and Alisha playtest of The Hidden Cache: whether the unmergeable crystal pair and the clue lead to the discovery, whether the revealed shape reads as one clearing, and the clarinet case art.
- [ ] Physical iPad/Safari for The Hidden Cache: touch across the clearing, E2 and pocket, panning from concealed forest, case activation, VoiceOver labels.
- [ ] Alisha playtest of The Rune Gates: whether plates, the stone and checkpoints are clear without instructions.
- [ ] Physical iPad/Safari for The Rune Gates: touch on plates and the backpack, panning from terrain, VoiceOver labels; Chromium was checked at 820×1180 and 390×844 only.
- Option for future levels, not an implementation request (owner, October 19, 2026): longer paths between rooms.
- [ ] If rooms with real choices are wanted, design a room-aware loss rule first; room levels currently never report a loss.
- [ ] Decide from playtesting whether to build more region levels, generated multi-room puzzles, or neither. Not built: non-rectangular areas, out-of-order unlocks, supply in region levels, transfers between separate rooms (The Hidden Cache's pocket is part of its clearing's room, not a transfer), elk movement, unlock sounds.

- [ ] Larger maps of smaller connected rooms, paths, and clearings (not necessarily rectangles), opened by merged runes, keys, tunnels, machines, or bridges. Bombs opening barriers were an example, not a committed recipe.
- [ ] Settled resource boundary: items may only be consumed or used toward objectives within their room of origin; movement between rooms (if any) and merging must not bypass that. Whether keys are consumed is a per-mechanic detail.
- [ ] Resupply as a world object (for example a chest in an unlocked cave) rather than an always-available button. The Hidden Cache tries a simpler form: authored resources in a concealed part of the clearing, revealed by a plate, with no chest or random contents. The whole puzzle needs at least one winning sequence; wrong choices may still fail. Do not require every gate to be independently solvable in every state.
- [ ] Optional: the elk walks through cleared routes automatically and waits at the next obstacle; cutscenes between sections.

## Diagnostics and feedback — proposed, not yet implemented

- [ ] Adapt the inspected `../jotation` workflow rather than inventing a separate backend: bounded local event log, explicit report upload via anonymous Firebase Auth and Firestore Lite, and operator retrieval through `gcloud`/Firestore REST.
- [ ] Capture build, level or puzzle ID (seed, mode, configuration, generator version), objective, board, supply position, RNG state, recent actions, errors, and an optional feedback note. Logging failures must never affect gameplay.
- [ ] Player flow from the vision: tap Report a problem / Send diagnostics, add a note, and explicitly send. Confirm the other app's actual Firestore code and configuration and which technical details it sends. Diagnostic file export/import is unnecessary for now.
- [ ] Start with manual Send report and local copy/download fallback. No automatic uploads or background synchronization by default. Usage summaries can be a separate task.
- [ ] Use bounded payloads and create-only rules; browsers cannot read/list/edit/delete reports. Preserve report IDs and payloads across uncertain retries; show success only after acknowledgement.
- [ ] Inspect Elkchemy's actual Firebase Auth/database configuration before proposing changes. Keep the project on the free plan; no billing upgrade is authorized.
- [ ] Adapt Jotation's fetch-report script to Elkchemy and verify authorized retrieval. Do not copy Jotation project IDs, credentials, or reports into this project.
- [ ] Test log bounds, storage/network failures, upload acknowledgement/retries, and security rules before enabling collection.

## Persistence and offline use — deferred behind testing updates and level variety

- Owner decision 2: never save or restore an unfinished board. Leaving a puzzle discards the attempt (the app already asks first after a move); replaying starts from the initial state. This supersedes the earlier plan to resume board, supply, RNG state, and undo.
- [ ] When justified, add versioned, validated local saves of settings (including the last menu choices and audio), completed level and puzzle IDs, bookmarked seeds, and later campaign milestones. Completed history and bookmarks are separate; an unfinished puzzle may be worth bookmarking. Store compact IDs, not boards.
- [ ] Handle malformed or unavailable storage gracefully; provide a deliberate reset-progress action.
- [ ] Later ideas, not commitments: local player profiles without cloud sign-in; save export/import (validated, versioned; investigate iPad sharing before promising a share sheet); statistics by mode, lifetime completions, and a reset-statistics action. Cloud accounts, sign-in, remote backup, and sync are not needed now.
- [ ] Add production offline caching for app code and required local art/audio after a successful load, with a safe update strategy compatible with the existing update controls.
- [ ] Verify cold offline Home Screen launch, resumed play, and later updates on a physical iPad.
- [ ] Complete README instructions for HTTPS hosting, iPad Add to Home Screen, updates, saved progress/reset (once it exists), offline behavior, current rules, and known limitations.

## Future campaign — story direction only

Committed, evolving direction (owner decision 3): first she returns home, then she sets out to find her friends. Plot specifics below remain exploratory, and story implementation is outside the generated-puzzle milestone. Fuller notes: [docs/game-vision.md](docs/game-vision.md).

1. **Finding home:** a woodland elk gets lost and merges her way through different universes to return home. The journey introduces the mechanics, worlds, and her personality. The woodland prototype can become the opening chapter. How she is displaced (an incident, kidnapping, time or space warp) is undecided.
2. **Finding her friends:** once home, Elk discovers her friends are lost across those universes. She sets out again to find and rescue them, giving later worlds a clear purpose.

Returning home is the first satisfying stopping point; the opening should end properly, with generated puzzles sustaining play until a later update brings a new event. Working title Elkchemy; **Elkchemy: Echoes of Home** is the selected subtitle for a later reveal (do not spoil it on the opening menu). A released arc should feel complete even if development stops; tease future areas only with that in mind.

Possible worlds include whimsical sci-fi/time travel, music, and 1940s fashion/classic Hollywood. Alisha (Elk) also enjoys YouTube videos, disc golf, and playing ukulele and clarinet. These are personal creative references, not requirements to force into every level. Use original characters, melodies, names, and imagery; Doctor Who is an inspiration for her tastes, not licensed game content.

- [ ] Develop campaign characters, rescued friends, world order, and story presentation only after the small puzzle prototype is enjoyable. Emotional depth (attachment, friendship, loss, hope) without becoming too dark; branching, hard choices, and changing allegiances are exploratory, not requirements.
- [ ] Presentation ideas, none selected: title screen featuring the approved elk, scenes with illustrated backgrounds, portraits, timed text, layered motion, particles, and music; advance/skip/replay. Subtle changes to title art, home scene, and music can mark progress. A short victory celebration is a possible later capability demo.
- [ ] Explore distinct local item families, visual styles, and music per world, without expanding the current implementation handoff.

## Delivery boundary

- [ ] Before Alisha's first test, complete an owner playtest/fix pass covering varied puzzles, clear onboarding and goals, satisfying feedback/audio as approved, and reliable iPad behavior. Confirm which persistence/offline features are ready and describe remaining limitations honestly.
- No ads, purchases, subscriptions, energy timers, real-time waiting, accounts required for play, multiplayer, complex economy, or permanent camp in the current prototype scope. Earned in-game currency was only an idea, never tied to real money.
