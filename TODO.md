# Elkchemy — open work

Updated October 18, 2026. This is the project backlog, not authorization to implement every item. Keep Claude handoffs small; Codex plans and reviews, Opus coordinates Sonnet implementation agents, and the operator copy/pastes prompts. Do not commit, push, or deploy without authorization.

## Current baseline

- Latest deployment: `20261018-195510` on the existing Firebase site: five levels plus default-off background music and a mute button. The Faraway Grove still has its 12×16 board and four simultaneous targets. This uses the ordinary build; the earlier standalone `/sandbox.html` is no longer shipped. The owner explicitly wants iPad tests on this site, without another environment.

- The reviewed five-level build passes 276 tests, typecheck, and production build. Codex played through all five levels in Chromium and verified that the deployed HTML, version, JavaScript, and CSS match the build. Production cache headers were checked in an earlier release.
- The owner completed the first four levels and the earlier scrolling test board on iPad, confirmed that the update button worked, and approved the Home Screen icon. Level 5's four-target UI and its owner/wife playtest remain pending.
- The owner approved both original synthesized music loops. Background playback and the mute button are now implemented directly by Codex at the owner's request, without Claude delegation. The owner reported the latest playtest went well: freeze gameplay changes pending Alisha's feedback; audio is the only currently authorized addition.
- No game-state persistence, offline support, generated levels, or remote diagnostics exists yet.

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
- [ ] Create and review local supply/merge sounds, a five-merge bonus cue, and win feedback. Current files are music loops only.
- [x] Implement mute/audio controls and quiet mixing. Eight focused tests cover lazy initialization, looping, mute/unmute, simulated backgrounding, delayed-load cancellation, track changes, failure/retry, and disposal. Chromium confirms actual audio decoding and running/suspended context state, level transition without duplicate contexts, cached track reuse, and continued gameplay after a forced network failure. The control is at least 44px tall in iPad layouts and phone width.
- [x] Audio release verification: 284 tests, typecheck, and production build pass. The live `20261018-195510` build starts with Music off, decodes and loops the approved woodland WAV when enabled, and suspends its audio context when muted. Subjective listening and actual iPad interruption behavior remain unverified.
- [ ] Verify audible volume, seamless looping, mute, and real background/interruption recovery on physical iPad Safari and Home Screen mode; headless Chromium cannot establish subjective audio quality.
- [x] Integrate the approved local WAV files without streaming or external services. Both files ship under `public/audio/` and are loaded on demand. Offline launch/caching remains a separate task.
- [ ] Music can later draw more strongly on clarinet, ukulele, vintage cinema, and subtle sci-fi textures. Do not replace the current initial direction solely to add the deferred campaign themes.

## Physical iPad and interaction checks

- [x] Shared WSL browser tooling: Playwright MCP `0.0.83` is registered in both Codex and Claude user configuration, using headless Chromium and isolated sessions. Browser binaries and Linux libraries are installed. After the WSL reload, Codex used its actual MCP tools to open the live app and verify level 1 of 4, build `20261018-184955`, and 16 board cells; Claude's CLI connection check also succeeded. No app dependency was added. Full browser gameplay checks remain separate below.

- [ ] Confirm the published build number in the existing Home Screen app. Verify Check for updates detects a subsequent release, Update now loads it without reinstallation, and relaunch does not regress to an old build. Updating currently restarts the puzzle.
- [ ] Verify the help dialog under real touch: open/close, backdrop dismissal, portrait/landscape, focus behavior, and VoiceOver as available.
- [ ] Recheck drag preview accuracy, pointer capture, tap-to-move, page scrolling outside the board, random supply, merge effects, and undo/retry on the physical iPad. Chromium automation is not Safari validation.
- [ ] Verify Undo, Retry, and future level transitions cancel any active drag cleanly.
- [ ] Add a brief visual arrival cue for random supply so sighted players can locate the new item; keep the destination marker removed.
- [ ] Improve elk item artwork that the owner read as a cow; keep it consistent with the approved elk mascot.
- [ ] Reuse the approved mascot in future welcome/header UI where it fits without crowding the board. Approved source: `artwork/elkchemy-icon-v1.png`.

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
- [ ] Next task: start in a 4x4 clearing and unlock regions of the larger board. No pinch zoom or momentum yet.

## Large-board navigation — Codex review fixes verified

The 12-column × 16-row dev sandbox is implemented at `/sandbox.html` and excluded from production. Codex independently reran 261 tests, typecheck, and build, inspected portrait/landscape screenshots, verified Chromium touch-emulated panning without page movement or selection, and won normal level 1 and advanced to level 2 through actual UI taps.

- [x] Fix interrupted-gesture follow-up clicks in `src/ui/Board.tsx`. Codex independently verified active drags interrupted by Add supply, Undo, and Retry, including a 700ms delay before release: no ghost or selection remains, and the next real tap works. All 261 tests, typecheck, and build pass after the fix.
- [x] Move Center board out of the playable viewport and give it at least a 44px touch target. Codex independently measured 44px and no board overlap or sideways page overflow at 820×1180 and 1180×820.
- [x] Ignore `.playwright-mcp/` screenshots/logs without deleting unrelated test artifacts.
- [x] Owner completed the large-board test on iPad and reported that scrolling and moving worked well (October 18). This confirms basic navigation through a completed game, not every cancellation/accessibility edge case. Testing used https://elkchemy.web.app/sandbox.html on the existing Firebase site.
- [ ] Investigate if it recurs: owner saw an apparently larger tile in the lower-right area and merged it away before a screenshot. Codex did not reproduce it in Chromium; all cells measured 64×64px in portrait/landscape. Cause remains unknown.
- [ ] After navigation fixes and owner feedback, implement the agreed larger handcrafted level with an initial 4×4 clearing, two unlockable regions, visible non-consuming unlock requirements, and a final woodland objective. Extend win/loss reasoning to account for locked resources and unlock prerequisites before integrating it.
- Edge auto-scroll is deferred for the first navigation test; use tap-pan-tap for distant moves, then decide from physical iPad feedback whether to add it. Procedural generation is deferred until the larger exploration/unlocking level has been playtested.

## Replayable puzzles and larger boards — deferred until exploration is tested

- [ ] Add seeded generated puzzles from constructive methods or known solvable templates; replay each generated winning witness using actual rules, including random supply.
- [ ] Provide New puzzle and Retry same puzzle, with varied families, layouts, and objectives and gradual difficulty.
- [ ] Preserve relaxed play with meaningful losing choices beyond the forgiving tutorials.
- [ ] Resolve feasibility detection before introducing genuine space constraints. The current evaluator only supports rectangular boards where board items plus unspent supply fit within capacity; it must not silently evaluate unsupported levels.
- [x] Larger scrolling boards: see Large-board navigation above.

## Diagnostics and feedback — proposed, not yet implemented

- [ ] Adapt the inspected `../jotation` workflow rather than inventing a separate backend: bounded local event log, explicit report upload via anonymous Firebase Auth and Firestore Lite, and operator retrieval through `gcloud`/Firestore REST.
- [ ] Capture build, level/seed, objective, board, supply position, RNG state, recent actions, errors, and an optional feedback note. Logging failures must never affect gameplay.
- [ ] Start with manual Send report and local copy/download fallback. No automatic uploads or background synchronization by default. Usage summaries can be a separate task.
- [ ] Use bounded payloads and create-only rules; browsers cannot read/list/edit/delete reports. Preserve report IDs and payloads across uncertain retries; show success only after acknowledgement.
- [ ] Inspect Elkchemy's actual Firebase Auth/database configuration before proposing changes. Keep the project on the free plan; no billing upgrade is authorized.
- [ ] Adapt Jotation's fetch-report script to Elkchemy and verify authorized retrieval. Do not copy Jotation project IDs, credentials, or reports into this project.
- [ ] Test log bounds, storage/network failures, upload acknowledgement/retries, and security rules before enabling collection.

## Persistence and offline use — deferred behind testing updates and level variety

- [ ] Add versioned, validated local saves and local progress when longer play/campaigns justify them. Resume board, current level, supply, RNG state, and undo correctly.
- [ ] Handle malformed or unavailable storage gracefully; provide a deliberate reset-progress action.
- [ ] Add production offline caching for app code and required local art/audio after a successful load, with a safe update strategy compatible with the existing update controls.
- [ ] Verify cold offline Home Screen launch, resumed play, and later updates on a physical iPad.
- [ ] Complete README instructions for HTTPS hosting, iPad Add to Home Screen, updates, saves/reset, offline behavior, current rules, and known limitations.

## Future campaign — story direction only

The current story idea has two parts, rather than choosing between getting home and rescuing friends:

1. **Finding home:** a woodland elk gets lost and merges her way through different universes to return home. The journey introduces the mechanics, worlds, and her personality. The woodland prototype can become the opening chapter.
2. **Finding her friends:** once home, Elk discovers her friends are lost across those universes. She sets out again to find and rescue them, giving later worlds a clear purpose.

Possible worlds include whimsical sci-fi/time travel, music, and 1940s fashion/classic Hollywood. Alisha (Elk) also enjoys YouTube videos and playing ukulele and clarinet. These are personal creative references, not requirements to force into every level. Use original characters, melodies, names, and imagery; Doctor Who is an inspiration for her tastes, not licensed game content.

- [ ] Develop campaign characters, rescued friends, world order, and story presentation only after the small puzzle prototype is enjoyable.
- [ ] Explore distinct local item families, visual styles, and music per world, without expanding the current implementation handoff.

## Delivery boundary

- [ ] Before Alisha's first test, complete an owner playtest/fix pass covering varied puzzles, clear onboarding and goals, satisfying feedback/audio as approved, and reliable iPad behavior. Confirm which persistence/offline features are ready and describe remaining limitations honestly.
- No ads, purchases, subscriptions, energy timers, real-time waiting, accounts required for play, multiplayer, complex economy, or permanent camp in the current prototype scope.
