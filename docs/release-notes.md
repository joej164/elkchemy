# Elkchemy — release notes and history

Each entry records what changed, how it was verified, and known limitations. **Unreleased** entries are implemented in the repository but not published to https://elkchemy.web.app/; published entries name their build id. Open work lives in [TODO.md](../TODO.md); the longer-term direction is in [game-vision.md](game-vision.md). Player-facing release history is available from the home screen.

Earlier published builds are not backfilled here. The previous build, `20261018-195510`, has five handcrafted levels and optional looping music; its verification is recorded in TODO.md under Current baseline and Audio.

## 20261020-010722 — Merge to treasure: a first recipe and chest (October 19, 2026)

Published release build `20261020-010722`, implemented by Claude; independent Codex review completed. Owner authorized commit → push → deploy. Physical iPad/Safari and owner playtesting are not yet available.

Live deployment verification: Firebase Hosting reported release complete. Chromium confirmed build `20261020-010722`, expected JavaScript `index-DKstMove.js`, player-facing history and treasure-mode startup. Completed `v2-treasure-woodland-9ix` through pointer clicks, crafting, chest opening and final merge to a win. No console errors or warnings. Release commit `bf7f7e4`.

### Design (first slice)

- **A third generated mode, Merge to treasure.** Merge to goals, Merge down to one and the handcrafted levels are unchanged.
- **Recipe as data** (`src/recipes.ts`): stable ID `woodland`, "Woodland chest".
  - Ingredients: 1 × Grove, tier 3 of 5 and 1 × Crystal, tier 3 of 5.
  - The container is a chest holding 3 × Elk, tier 3 of 5. Their merge, Elk, tier 4 of 5, is the goal.
  - Only one recipe ships. Crafting and opening are generic over the recipe's data; the chest is not an item or a tier.
- **Flow:**
  1. Merge the starting pieces (only the ingredients' families, below their tiers) into the ingredients.
  2. Press **Craft chest** on the recipe sign. It's enabled only once every ingredient is on the board at its exact family and tier. Crafting consumes every remaining piece of the ingredient families, spares included, and stands the chest where the first ingredient (Grove) was, first in reading order. It's an ordinary move: Undo un-crafts.
  3. Tap the chest (Enter/Space on its cell). Its three Elk go on the chest's cell and the two nearest empty cells (by distance, then reading order). If there are too few empty cells, nothing changes and nothing is lost; generated boards are always empty apart from the chest by then. Opening is a checkpoint that clears Undo; the chest is gone, so it can't open twice.
  4. Merge the three Elk: the single Elk, tier 4 of 5 wins. Crafting and opening never win.
- **Retry** restores the original puzzle, with no chest. The chest's cell takes no drops.
- **Status:** no early loss. "No merges left" appears only if no merge can be arranged, Craft isn't ready and no chest is closed.
- **Recipe sign** (in the goal panel above the board): "1× Grove + 1× Crystal → chest → 3× Elk", parts dimmed until done (ticked when ready), Craft chest (44px) and "Goal: make Elk, tier 4 of 5". Each part has a spoken label. On phones the pictures shrink to 36px so the recipe stays on one line at 390px; it wraps to two at 360px.
- **Text:**
  - The banner gives each stage: the ingredients needed; "Ready: press Craft chest…"; "Tap the Woodland chest to open it."; "Merge the three Elk…".
  - Announcements: "Crafted the Woodland chest. Tap it to open it." and "Opened the Woodland chest: three Elk, tier 3 of 5."
  - Help explains the mode. Play offers the mode with no tier or goal choice.
- **Sounds** (existing cues and path): crafting plays the completion cue and opening the discovery cue, never the victory cue. The final merge plays its merge sound; Undo and Retry play nothing.
- **Generation and IDs:**
  - Each ingredient is decomposed like a tier-3 goal (5–8 pieces, no spares) on the existing board sizing (5 × 5 or 6 × 6).
  - The winning line merges to exactly the ingredients, then crafts, opens and merges, and is replayed through the session and status rules before a puzzle is returned. Witness steps may now be `{ action: 'craft' | 'open' }`.
  - IDs read `v2-treasure-woodland-<seed>`, and the definition carries the recipe.
  - No version bump: no existing ID names this mode, and goals/one generation is untouched (pinned v1/v2 boards still pass). Version 1 rejects treasure IDs.

### Verification (Claude)

- **Automated:** 580 tests (16 new in `tests/treasure.test.tsx`), typecheck, production build and `git diff --check` pass.
  - Ingredient eligibility: exact tier, family, missing.
  - Consumption, spares included, with other families kept.
  - Chest placement and refused drops.
  - Undo after crafting; the checkpoint on opening; Retry.
  - Deterministic content cells; no space → no change; no second opening.
  - Win only on the final merge.
  - Status at each stage, including Craft-ready with no merges.
  - The banner per stage.
  - 43 seeds won through the controller, with exactly the ingredients left before crafting.
  - IDs, parsing and rejection.
  - Cues, the sign, the chest's label and the Play screen.
- **Generation survey:** 1000 seeds, no failures, at most 11.4ms per puzzle.
- **Playwright Chromium against the production build** (local build `20261020-005937`, seed pinned in the page: `v2-treasure-woodland-9ix`):
  - **820×1180, by real clicks and taps:**
    - Craft disabled at first; merges to the ingredients; Craft.
    - Undo (chest gone, Craft ready again); Craft; tap the chest (three Elk, Undo disabled).
    - Retry (15 starting pieces back); then the full win: "Goal complete! You made Elk, tier 4 of 5 from the Woodland chest."
    - Announcements as above.
  - **1180×820, 844×390, 390×844 and 360×740:** the sign inside its panel, Craft 140×44, Play choices at least 44px. No horizontal overflow or console errors.
  - At 64px tiles, phones pan the 5 × 5 board slightly, as for existing 5 × 5 puzzles.
- **Not verified:** physical iPad/Safari, VoiceOver, and whether the mode is clear and fun (owner playtest).

### Independent Codex review

- 580 tests, typecheck, production build and diff checks passed independently.
- Compared 800 existing v1/v2 puzzles with the committed generator: definitions and winning paths unchanged. Adding treasure within v2 does not reinterpret existing IDs.
- Production Chromium: completed the ingredient merges by pointer clicks, crafted, undid crafting, crafted again, opened by keyboard Enter (Undo disabled), and won by the final merge. Retry restored playing with Undo disabled.
- Five phone/iPad viewports had no horizontal overflow or console errors; Craft was 44px tall. At 820×1180, Undo/Retry ended at 1150.66px and Home at 1206.66px, requiring page scrolling. Physical iPad/Safari, VoiceOver and subjective clarity/fun remain unverified.
- No gameplay blocker found. The all-ingredient-family consumption rule is disclosed in the banner/help and now README; it is specific to this first slice, not a settled policy for future recipes. README now covers the third mode, opening checkpoint, placement, failure exception and treasure IDs.
- No gameplay changes, commit, push or deployment during review/documentation updates. Release preparation added player-facing history after explicit owner authorization.

### Known limitations

- **Page height:** the sign is taller than the usual goal panel (118px at 820×1180). Undo and Retry stay on screen there (bottom 1151px), but Home is further below the fold than in the other modes.
- **One fixed recipe:** every puzzle uses it, and variety comes from the pieces' decomposition and placement.
- **Spares:** Craft consumes them; there is no reward for avoiding them.

## 20261020-004342 — Generated puzzles: tier 5, bigger boards and spare pieces (October 19, 2026)

Published release build `20261020-004342`, implemented by Claude (phase 1 of the generated-puzzle expansion); independently reviewed by Codex. Owner authorized commit → push → deploy. Physical iPad/Safari and the owner's difficulty feedback are not yet available.

Live deployment verification: Firebase Hosting reported release complete. Chromium confirmed build `20261020-004342`, JavaScript asset `index-BwjV3gQg.js`, the new history entry and tier-5 startup in both generated modes with v2 IDs. No console errors or warnings. Release commit `4dc92ac`.

### Findings

- **Two matching pieces side by side and a third elsewhere:** chance, not a generator bias. Over 400 seeds per setting, the share of same-tier sets with an adjacent pair matched the same pieces scattered uniformly at random: 93/94%, 66/66%, 74/75%, 99/99% and 86/84%. Validation and witness construction don't skew it. The pattern is common because plans make exact sets of 3 or 5 on boards 43–54% full. Scattering further would change nothing that matters, so placement stays uniform; variety comes from tier 5, bigger inventories and spare pieces.
- **A fifth tier can't change existing play.** Bounding each family's reachable total per room (a 5 → 2 merge gains at most 6/5 per tier) shows that no handcrafted level and no version-1 generated puzzle can ever make three tier-4 items of one family. Only the wording changes.

### Changes

- **Five tiers** (owner choice: one scale everywhere):
  - `MAX_TIER` is 4. Tier 4 merges into tier 5, which never merges.
  - Every label reads "of 5", for example "Crystal, tier 4 of 5", in levels 1–9 too. Their pieces, goals and rules are unchanged.
  - Tier-5 art reuses each family's tier-4 drawing on a gold radiance, with five pips. No new asset files.
- **Generator version 2** (`src/generator.ts`), for new puzzles:
  - Tier 5 targets in both modes, with 1–3 goals. Play offers Tier 3, 4 or 5 of 5.
  - Piece budgets for tier 5: 11–16 per goal (Merge to goals) and 14–20 (Merge down to one).
  - Boards up to 10 × 10 (version 1: 8 × 8), still sized from the piece count by the existing rule (at least a third of the cells free).
  - Tier 5 with three goals is mostly 9 × 9, which fits at 820×1180 without panning; phones pan as they already do for 8 × 8.
  - **Merge to goals:** up to two spare pieces per goal, of that goal's family, at a tier its plan merges. Some sets then hold more than a merge needs, so the player chooses which to merge, or makes a 5 → 2 merge instead. Spares may be left over, as any leftover may in this mode.
  - **Merge down to one:** keeps exact counts (no spares), so its 3-or-5 choices stay decisive.
- **Puzzle IDs:**
  - New IDs read `v2-…`.
  - `v1-…` IDs still parse and reproduce their original boards byte for byte. Version 1 keeps its tiers 3 and 4, its 8 × 8 limit and no spares, and draws the same random numbers. The pinned and reported v1 boards are unchanged.
  - `v1-…-t5` is rejected. The UI still shows IDs read-only, for reports.
- Winning lines are still built backwards and replayed through the real session and status rules before a puzzle is returned. Generation still throws after 20 failed candidates.

### Verification (Claude)

- **Automated:** 564 tests (13 new or rewritten), typecheck, production build and `git diff --check` pass.
  - The tier-4 → tier-5 merge, and tier 5 never merging.
  - Five-tier brute-force agreement for Merge down to one (6,240 counts).
  - Tier-5 art and labels.
  - Every setting, tier 5 included, over 60 seeds: winning paths replayed, exact single finish in Merge down to one, and boards within 10 × 10.
  - Spares only in version-2 Merge to goals (at most two per goal).
  - Tier 5 bigger with longer lines than tier 4.
  - v1/v2 parsing; pinned v1 and v2 boards; the reported v1 puzzle.
- **Generation survey**, 1000 seeds per setting: no failures; at most 13.8ms per puzzle. Tier 5 with three goals: 9 × 9 (874), 8 × 8 (123), 10 × 10 (3), with about 35-move winning lines.
- **Playwright Chromium against the production build** (`vite preview`, local build `20261020-002935`):
  - **820×1180:**
    - `v2-one-t5-1kbye2b` won by its winning line ("Only Elk, tier 5 of 5 remains", drawn with the radiance); Undo and Retry restored the start.
    - `v2-goals-t5-g3-16t14y9` (seed pinned in the page): 9 × 9 at 70px tiles, no panning; won in 38 moves with three tier-5 items; Undo after the win returned to play.
  - **1180×820:** 65px tiles, no panning.
  - **390×844 and 844×390:** 64px tiles; dragging empty ground panned the board. In phone landscape it moved less than the pointer in automation; the panning code is unchanged.
  - All sizes: no horizontal overflow, Play choices and buttons at least 44px, no console errors or warnings.
  - At 820×1180, Home's bottom edge is 5px below the window, the same as an existing Tier-3 three-goal puzzle (pre-existing).
- **Not verified:** physical iPad/Safari, and whether tier 5 and the spares feel richer or just longer (owner playtest).

### Independent Codex review

- 564 tests, typecheck, production build and diff checks passed independently.
- Compared 800 version-1 puzzles against the committed generator: full puzzle data and winning paths matched exactly. Handcrafted room/family inventory bounds prevent three tier-4 items from being produced, so the higher merge limit does not change existing level play.
- Production Chromium: both tier-5 modes won by pointer clicks; Undo returned to play and Retry cleared Undo. Four phone/iPad viewports had no horizontal overflow or console errors. Confirmed the reported Home-button bottom edge at 1185px in an 1180px viewport; physical iPad/Safari and difficulty remain unverified.
- Corrected README/TODO reproduction examples to pass the parsed generator version, and updated README tier, board-size and spare-piece descriptions. No gameplay changes during review.
- Release preparation: player-facing history entry added and release build assigned following explicit owner authorization.

### Known limitations

- Placement is still uniform, so pairs plus a third remain common, by design.
- Spares make Merge to goals easier as well as more open; they are not distractors.
- The in-game Release notes include “Bigger puzzles, five-dot goals”.

## 20261019-210331 — Approved music and sound effects integration (October 19, 2026)

Published release build `20261019-210331`. Owner authorized commit → push → deploy after local verification. The owner explicitly authorized direct Codex implementation and bounded Codex delegation for this audio task only.

Live release verification: Firebase Hosting reported release complete. Chromium confirmed `/version.json` and the footer build, expected JavaScript asset `index-DWN050Lw.js`, the new player-facing history, both controls initially off, level-9 startup, a real-pointer merge with decoded effect, and Woodland Journey decoding/looping with both audio contexts running. No console errors or warnings. Release commits: `3a5c864` and `1cdcaad`.

### Agreed design

- Level 9 starts with Woodland Journey. Tapping a fixed item, selecting an item or successfully acting on an item inside the playable palace selects Crystal Palace; tapping a fixed item, selecting an item or successfully acting in a woodland room returns to Woodland Journey. Opening the palace, camera travel and arbitrary panning do not change tracks. Other levels retain their existing assignments. Music stays default off, with a short gentle transition and sample-contiguous looping.
- Sound effects have an independent toggle, default off on reload as confirmed by the owner. Neither option initializes or fetches audio before it is enabled, and enabling one must not fetch the other's files. Settings are not persisted.
- Successful three- and five-piece merges use their respective cues; concealed terrain reveals use discovery; gate openings and branch completions use completion; opening final treasure uses case-victory. An ordinary puzzle win retains its merge cue. At most one cue per action, in priority order: treasure victory > discovery > completion > merge. Opening three entrances together or completing the third branch and opening the palace gives one completion cue.
- The palace completion cue starts at its visible gate-opening stage, or immediately under reduced motion. Cancelling the visual sequence also stops active effects and invalidates pending playback, including a cue still downloading. Undo, Retry, startup, selection and rendering do not replay effects. At most three effect voices play together; disabling effects stops them promptly. Audio failures and timing never determine game progress.
- Ship only the two approved full loops and five approved effects as new production audio. Keep their source scores, renderers and measurements; preserve the original tracks. No new dependency, persistence or unrelated camera/focus fix.

### Verification and limitations

- Final integrated verification: 531 tests, typecheck, production build and `git diff --check` pass. SHA-256 checks confirm all seven new production WAVs are byte-for-byte copies of the approved sources.
- Production-build Playwright Chromium at 820×1180: a full level-9 win; merge-three, discovery, completion and case-victory decoded; Undo and Retry did not replay cues. Board sequences used DOM clicks for off-screen cells; controls used native browser actions. This verifies handler/event integration, not real touch or pointer geometry for those board moves.
- At 820×1180, controls stayed visible through the win (lowest edge 1160.42px). Five phone/iPad viewport sizes had no horizontal overflow, with audio buttons at least 44px tall. Phone page scrolling remains allowed.
- Reduced-motion opening produced exactly one immediate completion cue. With completion's response deliberately held until the visible opening, Center board cancelled the sequence; releasing the response decoded the file but started zero voices. This covers cancellation after the opening callback, as well as earlier camera-stage cancellation covered by automated tests.
- Both generated modes reached a win via witness sequences applied with DOM clicks, exercising three- and five-piece merge cues. Undo and Retry in goal mode started zero effects. A fresh final production build also passed a real-pointer initial three-piece merge on level 9.
- Initially zero audio contexts or audio requests. Effects alone loaded no music; Music alone loaded only the selected Woodland Stroll track. Disabling either option suspended only its own context while the other kept running. A deliberately corrupt effects response showed retry while gameplay stayed playing with Undo enabled; removing the failed response and retrying recovered playback.
- Final-build selection and fixed-item taps switched actual decoded loops Woodland Journey → Crystal Palace → Woodland Journey (70.2439s → 56.4706s → 70.2439s); arbitrary panning started zero new tracks. The fixed Starting Glade item provides a woodland return even after its items are fixed. No console errors or warnings were observed.

Browser decoding, loading and context checks cannot establish subjective mixing, seamlessness to a listener, physical-iPad/Safari behavior or actual background interruptions. Owner listening and real-device checks follow a separately authorized deployment; local iPad testing is not an available route.

## 20261019-203516 — Smooth camera pans and a visible palace opening (October 19, 2026)

Release build `20261019-203516`, implemented by Claude after the owner's physical-iPad feedback on `20261019-200030`. Codex reviewed and independently verified 515 tests, typecheck, build, smooth Songbird pan, palace travel/glow/opening and Retry; no console errors. Owner authorized commit → push → deploy with the keyboard-focus issue deferred: after a keyboard-triggered palace opening, focus remains on the old branch and an arrow key can snap back. Physical iPad/Safari remains unverified.

Owner response after deployment: the camera behavior is good. No device, browser or specific interaction checks were supplied with that response; the physical-device limitations below remain open.

### Owner feedback (physical iPad, build `20261019-200030`)

- Opening Songbird Glade jumped the view abruptly.
- Revealing Fern Glade's concealed part also jumped abruptly.
- Completing the third branch in Crystal Glade opened the palace gate off-screen, and the owner did not notice anything happen.

### Decision

- The palace opening is now shown: the view pans smoothly to the palace gate, all three lit symbols glow, the gate visibly opens, then the view moves on into the palace if needed. This **supersedes** the published rule that branch completions and the palace opening keep the view where it is (see View under `20261019-200030`).
- No button, popup or extra text. The banner, checklist and live announcements are unchanged, and they still say the palace is open as soon as the move is made.

### Changes

- **Smooth automatic pans** (`src/ui/camera.ts`, `src/ui/Board.tsx`): a small `requestAnimationFrame` tween with ease-in-out, from 250ms to 700ms by distance. Only the board viewport scrolls, never the page. The same helper replaces every automatic reveal's jump, so levels 6–9 all pan smoothly. Destinations are unchanged: the opened region is still centred, clamped to the board.
  - Unchanged: the start view, Retry (still instant), Undo (no move), and the three branches opening together (no move).
  - A keyboard gate unlock (level 6) pans so the newly focused cell is in view, instead of a second focus scroll.
- **What moves the view** (`viewCue`, pure): Retry → the start view, instantly; a single region opened → pan to it; the move that opens the sealed palace → the palace opening. One action gives at most one cue.
- **The palace opening** (level 9), by stage:
  1. **Travel:** the view pans to the gate, or to the gate and palace together where both fit (iPad sizes). Meanwhile the gate is drawn closed and the palace sealed.
  2. **Glow (800ms):** the gate is ringed in gold, and its three lit medallions swell and glow twice.
  3. **Opening (600ms):** the gate is drawn open, its bars fading back into the stones; the palace interior appears with the existing gold outline glow.
  4. **Into the palace:** the view moves the least needed to show the whole palace (phones only); the stages end.
  - Overall about 1.9s on iPad sizes and 2.4s on a phone.
  - Only the drawing is held back. The session (and so Undo checkpoints, Retry, the case gating and the rules) has the palace open from the move itself. The gate's label and the announcements say "open" throughout. With no stage playing, the board draws the session as it is.
- **Cancellation:** a press, drag, wheel or key on the board, Center board, or a resize stops a camera move where the view is, and an unfinished palace opening settles at once on the open palace.
  - A new action (Retry included) or leaving the level cancels everything pending.
  - The camera also stops if anything else scrolls the board meanwhile.
  - Nothing replays later.
- **Reduced motion:** every automatic move is a single instant jump. The palace opening shows no stages: the gate is drawn open with its three lit symbols, static, and the view jumps once to where the opening would end.
- `RuneGate` takes an `opening` flag; the CSS animates the existing gate art. No new art, audio or animation library.

### Verification (Claude)

- **Automated:** 515 tests (13 new), typecheck, production build and `git diff --check` pass.
  - `tests/palace.test.tsx`: the palace cue only on the third branch, in all six orders, by drags and by taps; the hub and discovery cues; none for the three branches opening, Undo or the case; Retry → start.
  - `tests/camera.test.ts`:
    - pans pass through many positions, never back, and land exactly;
    - the stage order and timing;
    - stopped mid-pan or mid-glow, nothing more happens;
    - a foreign scroll stops the camera where the player left it;
    - reduced motion shows no stages and jumps once;
    - levels 6–8 keep their cues.
  - `tests/navigation.test.ts`: centring and least-movement reveal.
- **Playwright Chromium against the production build** (`vite preview`, local build `20261019-202005`), sampling the viewport's scroll position every frame:
  - **820×1180:**
    - Songbird Glade: 216px in 365ms through 20 positions, at most 28px a frame.
    - Fern discovery: 432px diagonally in 429ms through 24 positions.
    - The three branches opening moved nothing.
    - **Crystal Glade last**, gate off-screen: the pan took 537ms through 28 positions (≤49px a frame); the gate and palace were in view through the glow and opening; settled by about 1.95s.
    - Retry after the win, and Retry during travel and during the glow: the start view at once, unchanged for 2.5s, the gate closed, no symbols lit, the palace sealed again.
    - A mouse drag during the Songbird pan and during the palace pan: the view stayed where the drag left it, with no later snap; the palace settled open on pointer-down.
    - An arrow key mid-pan: the camera stopped, the palace settled, and the focus ring (4px) stayed visible and in view.
    - Resizing to landscape mid-pan: the camera stopped and the palace settled.
    - Home mid-event: a fresh level on return.
  - **1180×820, Fern Glade last:**
    - The palace pan took 496ms through 28 positions; the gate was in view through the glow and opening; settled by about 1.93s.
    - Songbird Glade ends exactly where the old instant centring put it.
  - **390×844, Woodland Lodge last:**
    - The gate was centred through the glow and stayed in view for 817ms after the opening began (its animation is 600ms).
    - The view then panned into the palace, which ended wholly in view; settled by about 2.4s.
    - Hub and discovery pans: 25 and 28 positions.
  - **Reduced motion (820×1180):** every automatic move was a single jump. The palace went straight from closed to open with no stages, its cells were there on the first frame, and there were no gate or symbol animations.
  - **Levels 6–8 at 390×844:**
    - The Rune Gates, The Hidden Cache's pocket and nook: smooth pans (17–19 positions, 316–351ms), each area wholly in view at the end.
    - The Hidden Hollow's keyboard gate unlock: a smooth pan with the focused cell visible and in view.
  - No horizontal overflow, page scroll or console errors/warnings. Controls and layout are unchanged (no layout CSS changed).
- **Not verified:** physical iPad/Safari, touch, VoiceOver and Home Screen mode. Chromium emulation does not establish them.

### Known limitations

- After a palace opening made from the keyboard, the focused cell in the completed branch is off-screen. The next arrow key brings it back with the existing instant focus scroll.
- On phones, the gate leaves the view when the camera moves into the palace, after it has opened.
- During travel and glow (about 1.3s), the palace interior is drawn sealed, and its cells can't be tapped until any press on the board settles it.
- Under reduced motion, the newly opened palace's outline still does the existing single gold fade that every room level uses.
- The tween does not use Safari's native smooth scrolling. Its feel on a physical iPad is unverified.

## 20261019-200030 — Level 9, The Crystal Palace, and a scrolling Levels window (October 19, 2026)

Release build `20261019-200030`. Owner-approved design; implemented by Claude and reviewed independently by Codex. Owner authorized commit → push → deploy. Physical iPad/Safari remains unverified.

Codex verification: 502 tests, typecheck, production build and diff checks pass. Full Chromium wins at 820×1180, 1180×820 and 390×844; 30 measured portrait states keep controls visible with about 20px minimum clearance. Palace concealment/reveal, branch switching, case activation, Undo and Retry pass, with no horizontal overflow or console errors. Approved music and effects are retained as source assets only; integration is deferred.

### Changes

- **Map** (`PALACE_LEVEL`, `src/levels.ts`): a 16 × 16 board, columns A–P and rows 1–16. Tiers below are player-facing. Tiles stay 64px and the board pans; it is never shrunk to fit.
  - **Starting Glade** (B8–E11, open): three Grove tier 1. Grove tier 2 on E8 opens the rune gate at F10 to Songbird Glade.
  - **Songbird Glade** (G8–J11, the hub): three Song tier 1, two Song tier 2. Song tier 3 on J8 opens the gates to all three branches on one move, as one checkpoint: I7 (Fern Glade), K9 (Crystal Glade) and I12 (Woodland Lodge).
  - **Fern Glade** (G3–J6): three Grove 1, two Crystal 1, two Song 1.
    - Grove 2 on J3 reveals its concealed part (L3–N5: one Crystal 1, two Crystal 2, one Song 1) and the link K4 together.
    - Crystal 3 on I6 and Song 2 on J6, both exact, complete it.
  - **Crystal Glade** (L8–O11): three Crystal 1, two Crystal 2, two Crystal 3. Crystal 4 on O11 completes it.
  - **Woodland Lodge** (G13–J16): three Song 1, two Song 2. Song 3 on J16 completes it. Log walls and a shingled roof edge fill the terrain around it. There is no case in the lodge.
  - **Crystal Palace** (A1–D5): the seven-piece Crystal chain, three Song 1 and two Song 2.
    - Until it opens, its interior is sealed: blank crystal floor under the locked shade and dashed outline, with no items, marked tiles, cell labels, focus, taps or drops. Its exterior (walls, spires, path, gate and symbols) stays visible, so it still reads as a sealed palace, not forest. The opening move reveals the floor, items and both marked tiles together. Retry seals it again.
    - Crystal walls with spires fill E1–E6, A6, C6 and D6, visible from the start as a hint.
    - A forest path leads from the hub's G8 through G7, F7–B7 and B6.
    - Its rune gate at F7 carries three symbols (fern, crystal, musical note). Each lights when Fern Glade, Crystal Glade or Woodland Lodge is completed, in any order; the third completion opens the gate on the same move.
    - Crystal 4 on D1 and Song 3 on D2 reveal a closed ukulele case on C5, as a checkpoint. Tap it (or press Enter or Space) to open it: a whole ukulele inside, and the win.
  - Every inventory is a plain three-for-one chain with never five alike, so there is no five-merge and no wrong choice. Room levels never report a loss, and this one can't be stranded.
- **Winning line** (local (row, column) from each area's top-left; also in the `src/levels.ts` comment and `tests/palace.test.tsx`):
  - Starting Glade: (1,2)→(0,1), (0,1)→(0,3).
  - Songbird Glade: (1,2)→(0,1), (0,1)→(2,0), (2,0)→(0,3).
  - Then the three branches, in any order:
    - Crystal Glade: (1,2)→(0,1), (0,1)→(2,0), (2,0)→(3,0), (3,0)→(3,3).
    - Woodland Lodge: (1,2)→(0,1), (0,1)→(2,0), (2,0)→(3,3).
    - Fern Glade (its concealed part is local columns 5–7): (1,2)→(0,1), (0,1)→(0,3) reveals; (0,5)→(2,0), (2,0)→(2,5), (2,5)→(3,2), (0,7)→(1,0), (1,0)→(3,3).
  - Crystal Palace: (1,2)→(0,1), (0,1)→(2,0), (2,0)→(3,0), (3,0)→(0,3), (4,3)→(4,1), (4,1)→(3,3), (3,3)→(1,3); tap (4,2).
- **Model** (`src/regions.ts`, `src/session.ts`):
  - Why: the single ordered `unlocked` index can't express branches completed in any order, or a region that needs three completions.
  - `LevelDefinition.tasks`: each task is a set of marked tiles in one region. On the move that leaves every plate's exact item on it, the task is done for good. That move is a checkpoint: the plate items are fixed and Undo is cleared. A partly filled task fixes nothing.
  - The session records `done`, the tasks done so far. Undo snapshots include it, and Retry clears it.
  - In a level with tasks, every later region opens by a `TaskUnlock`: when all of its `tasks` are done. Progress is read from `done`, never from item counts.
  - Levels 6–8 keep the ordered `unlocked` index and its rules unchanged. `isOpen`, `isFixed` and `applyDrop` branch once on whether the level has tasks; `nextLocked` is null for task levels.
  - A treasure goal may name a `task`: the treasure stays absent, and can't be collected, until that task is done.
  - Room levels' treasure cell now refuses drops, so the case always has room. This changes nothing in levels 7–8, whose treasure rooms hold no items.
  - The palace is a `hidden` building: hidden regions are not cells until they open (no labels, focus or drops). A hidden building is drawn sealed (`.sealed` floor tiles and its locked outline) instead of as forest, which stays the presentation of Fern Glade's concealed part.
  - Routes: a `TaskUnlock` has a gate cell (`passage`) and optional scenery `path` cells, leading from room `from`; a hidden joined region keeps its `link` instead. A region may be a `building` (`lodge` or `palace`); this is scenery only.
  - Validation (`validateTasks`) covers:
    - task indices, and each task's plates lying in its region on cells of their own;
    - no task already done at the start;
    - each task's region opening only by earlier tasks, so every task is reachable;
    - one region needing several tasks, each with its own symbol;
    - routes as free, connected terrain joining the right rooms;
    - the treasure's task lying in the treasure's region.
  - Resource boundaries are unchanged. Fern Glade and its concealed part (with K4) are one room; every other area is its own room.
- **Board** (`src/ui/Board.tsx`, `src/ui/app.css`):
  - Path cells draw the path out of each side they connect.
  - The sealed gate is the existing rune gate with a row of three symbol medallions over it, dark until lit gold.
  - Buildings fill the terrain around them with log walls and roof shingles (the lodge) or crystal blocks with spires (the palace), clear of playable tiles.
  - A locked room with a joined part (Fern Glade) is now darkened like any locked room; until now, only open rooms had joined parts.
  - Every region a checkpoint opens glows once.
  - In room levels, the first tab stop is the first open cell (Starting Glade, not the locked palace in the corner). Retry moves a tab stop that sits on a now-locked cell back there. Levels 7–8 start on A1 as before.
- **View:**
  - The level starts on Starting Glade, and opening the hub brings it into view.
  - Opening the three branches keeps the view on the hub.
  - The Fern discovery brings the concealed part into view.
  - Branch completions keep the view where it is. So does the palace opening, which is announced instead.
  - Retry returns to the start view.
  - The rule (`src/ui/controller.ts`): a checkpoint brings a region into view only when it opens exactly one region that needs just that one task.
- **Text:**
  - After the hub opens, the next-area panel becomes a compact checklist. It has Fern Glade, Crystal Glade and Woodland Lodge, each with its symbol (lit once done) and a lock, the items it needs now with their exact tier ("tier 2 of 4"), or ✓. Assistive technology hears each row in full, for example "Fern Glade: needs Grove, tier 2 of 4". A Crystal Palace row shows "n of 3" or "Open".
  - The banner is short and names no required order, leaving each branch's needs to the checklist:
    - with all three to do: "Complete the three branches in any order to open Crystal Palace.";
    - with two: "Complete Fern Glade and Woodland Lodge in either order to open Crystal Palace.";
    - with one, its need: "Complete Fern Glade to open Crystal Palace: put Grove, tier 2 of 4 on its marked tile."
  - Before discovery, Fern Glade asks only for its Grove item; nothing names or describes the concealed part until it is found.
  - "More of Fern Glade has been revealed." leads the banner only on the discovery move, and "Crystal Palace is open: put Crystal, tier 4 of 4 and Song, tier 3 of 4 on its marked tiles." appears only on the move that opens it; neither repeats afterwards. On a discovery move with Fern Glade the last branch, the banner names it without its needs, which the checklist shows. Both keep the banner to two lines at 820×1180. The live announcements keep their full wording.
  - **Layout, on this level only** (other levels unchanged), so its controls stay on an iPad's screen:
    - the room hint "Gates open by themselves and stay open" and its row are never shown; Help explains the gates, and levels 7 and 8 keep the hint;
    - the vertical gaps between the page's areas are 8px instead of 14px (`.app.has-checklist`);
    - the checklist is tighter: 2px vertical padding, no row gap, and 22px rows and need icons (24px before);
    - the hub-stage banner counts the branches instead of naming them (the checklist names them): "Put Song, tier 3 of 4 on the pressure plate in Songbird Glade to open the rune gates to all three branches.";
    - once won, Home sits beside "Play again from level 1" instead of in a row of its own, above Undo and Retry, so the win adds no row;
    - the win message is one line: "Goal complete! You found a ukulele in the case."
    - Text sizes, tile sizes and the board viewport are unchanged.
  - Announcements, for example: "Woodland Lodge is complete: its musical note is lit on the gate to Crystal Palace. The rune gate to Crystal Palace opened." and "A closed ukulele case appeared in Crystal Palace."
  - Help explains that marked tiles open gates or complete the three branches in any order, each lighting its symbol.
- **Prize:** `UkuleleCaseArt` (`src/ui/ItemArt.tsx`), drawn in code like the other prizes.
  - Closed: a ukulele-shaped hard case with a handle and gold latches.
  - Open: the lid raised behind, and a whole ukulele on the red lining (body, sound hole, bridge, four strings, fretted neck, headstock with four pegs).
  - Level 7's backpack and level 8's clarinet are unchanged.
- **Levels page** (`src/ui/LevelPicker.tsx`): the list scrolls in its own window while the title and Home stay in place. The page is bounded to the screen, the window shrinks to fit the list when it can, and the current entry is centred when the page opens. Styling, names, numbers and tap targets are unchanged; nothing new is saved.
- **In-game release note:** "The Crystal Palace", dated October 19, 2026.
- **Tests updated for the new shape:** the session snapshot now includes `done`, and there are nine levels (`tests/session.test.ts`, `tests/levels.test.ts`, `tests/regions.test.ts`).

### Verification (Claude)

- **Automated:** 501 tests (30 new), typecheck and production build pass.
  - `tests/palace.test.tsx` (29):
    - the layout, the inventories and the exact plate tiers;
    - the whole winning line, through session rules;
    - all six branch orders, with the palace sealed after zero, one and two completions and open after three;
    - the three branches opening together, with the concealed part and palace still closed;
    - partial work left in one branch while others are completed;
    - the concealed part and K4: unusable before discovery, then moves, swaps and three- and five-merges through K4;
    - separate rooms refusing every cross-room drop, including routes and terrain;
    - a two-plate task completing only on its second exact plate, with nothing fixed before then;
    - every checkpoint fixing its items and clearing Undo, with the next move getting a fresh Undo back to it;
    - the case absent, then closed, opened, and closed again by Undo; Retry resetting everything;
    - task-level validation errors;
    - the controller's view rule and announcements;
    - the banner and Help at each stage, with nothing concealed named early;
    - the board and checklist markup.
  - A Levels-window markup test (`tests/helpButton.test.tsx`) and the ukulele art test (`tests/itemArt.test.tsx`).
  - Mutation checks: opening the palace on any one branch failed 11 tests; checkpoints not clearing Undo failed 11; letting the case's cell take items failed 1.
- **Playwright Chromium against the production build** (`vite preview`):
  - **820×1180, taps:** a full win in the order Lodge, Crystal, Fern.
    - The hub view, and the hub glowing as it opens.
    - The checklist after the hub; the three gates opening together with the view unchanged.
    - Partial work in Crystal Glade, then switching to the lodge and back.
    - The discovery: before it, the concealed part and K4 are forest; after it, one outline, the glow, and the concealed part brought into view.
    - A partly filled Fern task not fixed, with Undo available.
    - The palace opening on the third completion with the view unchanged, and the announcement.
    - The case cell refusing a drop before the reveal; Enter opening the case, with a visible focus ring.
    - Undo closing the case; Retry restoring the start view, the clue, no fixed items and the first tab stop in Starting Glade.
    - Case art 6px inside its cell.
  - **820×1180, a second run:** a fresh Undo after the branches checkpoint, Help before and after discovery, and Space opening the case.
  - **1180×820, mouse drags:** a full win in the order Fern, Lodge, Crystal. Dragging forest panned, and Center board recentred.
  - **390×844, taps and keyboard:** a full win in the order Crystal, Fern, Lodge.
    - Starting Glade fully in view at the start.
    - Keyboard: Tab, arrows and Enter played the hub's opening, with focus kept, visible, on the fixed plate. Arrows crossed terrain into the hub.
    - The concealed part and K4 fully in view after discovery; Retry returned to Starting Glade.
  - **844×390 and 1024×1366:** start views checked.
  - **Progression:** level 8 → Next level → level 9, and Home's note says levels continue at level 9.
  - **Levels page** at 820×1180, 844×390, 390×844, 1180×820, 1024×1366 and 360×640:
    - no page overflow either way, with the title and Home outside the window;
    - the current entry (1, 5 and 9 checked) in view, and the wheel scrolling the list, not the page;
    - picking level 9 starts it.
  - Screenshots of the start, hub, branches, discovery, palace and win at three sizes, plus close-ups of the gate symbols (unlit, partly lit, open) and of both case states.
  - Levels 6–8 start as before: tab stops, gates and markup unchanged.
  - No console warnings or errors, no horizontal page overflow, and no control outside the board under 44px.
- **Codex review fixes, re-verified** (sealed palace interior; shorter branch banner):
  - Automated: 502 tests, typecheck, production build and diff checks pass.
  - The new rendering test covers the sealed palace with zero, one and two branches done:
    - its 20 tiles are blank and `aria-hidden`, with no palace cells, labels, items or case;
    - it is still a locked, outlined room with its crystal walls;
    - nothing in it can be picked up or previewed;
    - the third branch reveals its items, both marked tiles and the empty case cell together, glowing once, with the case still absent until the final plates;
    - Retry seals it again.
  - Updated text tests cover the short banners, the one-time discovery and palace lines, and the checklist's visible tiers and full accessible needs. Without the palace's `hidden` flag, 2 tests fail.
  - Chromium against the production build:
    - 820×1180: the sealed and opened palace inspected; the third completion (Lodge last) revealed the palace with the view unchanged.
    - 1180×820: a full win in the order Lodge, Fern, Crystal, with the view unchanged on the third completion (Crystal last). The case was absent until the final plate; Undo closed it; Retry re-sealed the palace and returned to the start view and tab stop.
    - 390×844: a full win; ArrowUp from B8 doesn't enter the sealed palace.
    - The checklist rows stay inside the panel at 360, 390, 820 and 1180 widths. On phones, Fern's two needs stack rather than wrapping its name.
    - No console warnings or errors, and no horizontal overflow (except the known 1px title row at 360px).
  - Layout at 820×1180, branch stage, scrolled to the top:
    - the banner is two lines (68px) in every branch state measured: three left, one done, the discovery move, after discovery, and Fern last;
    - Undo and Retry are fully visible (bottom 1162 of 1180);
    - Home was not (1170–1218, 38px below the fold), before the layout adjustment below. Before this fix the banner ran to three or four lines, and on the discovery move Undo and Retry were 4px clipped.
- **Layout** (the level-9 changes listed under Text), checked in Chromium against the production build:
  - **820×1180**, 90 states, each measured with the page scrolled to the top:
    - three orders (Crystal, Lodge, Fern; Fern, Crystal, Lodge; Lodge, Fern, Crystal);
    - after every move from the start through the starting and hub puzzles, the branches, Fern's discovery and completion, the palace opening and puzzle, and the case reveal;
    - then the win, Undo and Retry.
    - Undo, Retry and Home are fully visible in every state, with no horizontal overflow. The lowest control's bottom edge (clearance to 1180):
      - start, starting-puzzle first move and Retry: 1145 (35px);
      - every hub, branch, discovery, palace-opening and palace-puzzle state: 1155 (25px);
      - case revealed, and Undo from the win: 1143 (37px);
      - win: 1160 (20px).
    - Retry restores the start layout exactly (1145).
    - The page still scrolls about 60–76px, but only for the build and update footer below Home.
  - **Before this pass**, Home ended at 1193 (start), 1225 (hub open), 1173 (branches) and 1247 (win).
  - **Where the space came from:** the hint row 30px; the 8px gaps 18px; the two-line hub banner 21px; at the win, Home beside "Play again" 56px and the one-line win message 12px.
  - **Why a control moved:** spacing and text alone couldn't fit the win, because its next-level button adds a 64px row. Putting Home beside it was the smallest change that removes no control and keeps the board viewport.
  - **Checklist:** the exact tiers stay visible at 13.6px ("tier 3 of 4", "tier 2 of 4"), and each row still gives its full requirement to assistive technology (": needs Crystal, tier 3 of 4 and Song, tier 2 of 4"). Rows stay inside the panel at 390 and 820, and Fern's two needs now fit on one line at 390.
  - **390×844 and 1180×820:** full wins, with no hint at any stage. Tiles stay 64px, case art stays 6px inside its cell, and no control outside the board is under 44px.
    - On the win, "Play again from level 1" wraps to two lines beside Home (both 66px tall), and the row reads cleanly.
    - At 1180×820 the controls end by 517 of 820 at every stage.
  - **Levels 7 and 8** keep their hint, 14px gaps, and a full-width next-level button with Home below it.
  - No console warnings or errors, and no horizontal overflow.
  - 502 tests, typecheck, production build and diff checks pass. The text tests follow the trimmed banners, the hub banner and the win message. The hint and win layout are checked only in the browser: static rendering can't reach those states.
- **Not verified:** physical iPad/Safari, VoiceOver and Home Screen mode. Chromium emulation does not establish them. Owner and Alisha playtests are pending.

### Known limitations

- **Page height:** at 820×1180, Undo, Retry and Home fit without scrolling in every measured state, with at least 20px to spare in Chromium (the win). Safari's toolbars and fonts may differ. Level 9's win puts Home beside the next-level button, unlike other levels.
- **Phone landscape** (844×390): the board viewport shows about three tiles across, so Starting Glade is centred but not entirely in view, as with the earlier region levels.
- **Palace walls:** the palace sits in the board's corner, so it has walls only on its right and bottom sides.
- **Small symbols:** the gate's medallions are about 19px on 64px tiles; the checklist gives the same status in text.
- **Case cell:** before the case appears, its cell refuses drops, which a player might notice as an odd floor tile.
- **No loss rule:** room levels never report a loss; exact inventories keep this one from being stranded.

## 20261019-175745 — The Hidden Cache: a concealed part of the clearing (October 19, 2026)

Release build `20261019-175745`; owner authorized commit → push → deploy. After deployment the owner responded positively to the revision (October 19, 2026). This records only that response, not any particular device check. The owner found the published alcove too obvious: its silhouette, name, gate and path announced another room. The approved direction makes the resource area a concealed extension of one irregular room, with a subtle clue. Implemented by Claude; reviewed by Codex. Independent verification: 471 tests, typecheck, production build and diff checks passed; Chromium full wins at 390×844, 820×1180 and 1180×820, including reveal, playable E2, checkpoints, clarinet case, Undo and Retry. No page overflow or console warnings/errors. Physical iPad/Safari remains unverified.

### Changes

- **Before discovery:**
  - The pocket (F1–G3) and the tile linking it to the clearing (E2) are drawn as the ordinary green-dot forest. There is no gate, path, outline, rock silhouette or sign.
  - The only clue: at E2, one foliage cluster is a slightly lighter, yellower green (`.terrain.is-clue`). No glow, lock, arrow or door.
  - These cells are plain decorative terrain: no buttons, labels, focus, taps or drops. Arrow keys skip them, and a drag on them pans.
- **Discovery:**
  - Grove tier 2 on the D1 plate reveals E2 and the pocket together, on the same move, as a checkpoint: the Grove item is fixed and Undo is cleared, and later moves get a fresh Undo.
  - E2 becomes one ordinary floor tile of the clearing.
  - The clearing, E2 and pocket get a single outline with no internal border. Each revealed tile glows once (the existing unlock effect).
  - On boards that pan, the pocket is scrolled into view.
- **Unchanged:**
  - starting pieces, the pocket's crystals and both plate requirements;
  - shared ownership between clearing and pocket, now including E2;
  - the separate Lantern Nook with its rune gate and Crystal tier 3 plate;
  - every cross-room prohibition, and the clarinet case, Undo and Retry.
  - Retry hides E2 and the pocket again, restores the clue and the starting view, closes the nook and restores the starting pieces.
- **Model** (`src/regions.ts`):
  - A region may have a `link`: one cell outside its rectangle that belongs to it. The link is hidden, opened and owned with the region, through `inRegion`.
  - A link is allowed only on a hidden region that `joins` another. It must be a free cell beside both regions, and it replaces a passage: `PlateUnlock.passage` is now optional, and a region needs exactly one of the two.
  - Session rules are unchanged: E2 accepts moves, swaps and merges like any open cell of the room, and merge groups pass through it.
- **Rendering** (`src/ui/Board.tsx`, `src/ui/app.css`):
  - A hidden region's cells render as terrain, the link with the clue; the rock silhouette and name plate are gone.
  - A room with a joined part is outlined edge by edge around its open cells (`.room-edge`, with small notch fillers at inside bends) instead of per-region rectangles. Levels without joined regions keep their rectangles.
  - Cell labels name the room, so revealed cells read "Fern Clearing".
- **Text** (nothing names or describes the pocket before discovery):
  - Banner: "Put Grove, tier 2 of 4 on the marked tile." The next-step panel reads "Marked tile in Fern Clearing / Needs Grove, tier 2 of 4".
  - Help now counts the visible rune gates ("open the rune gate…"). Its checkpoint line reads "A marked tile that has done its job is a checkpoint…".
  - Help adds "More of Fern Clearing has been revealed: items move, swap and merge anywhere in it" only after discovery; Help now receives the open-region count.
  - After discovery the banner adds "More of Fern Clearing has been revealed, with more items to use," and the live region announces "More of Fern Clearing was revealed, with more items to use."
  - The in-game "The Hidden Cache" note, first published in `20261019-171209`, is reworded so it no longer describes an alcove. The published build still shows the old wording until the next deploy.
  - Level 7's text is unchanged.
- **Names:** the pocket region is now "Fern Clearing pocket", an internal name that is never shown. The level title is unchanged.

### Verification (Claude)

- **Automated:** 471 tests, typecheck and production build pass.
  - `tests/cache.test.ts` (16):
    - layout and the link's validation (missing link, link plus passage, link not beside both regions, link on a visible or unjoined region, link on an item-goal level);
    - the winning sequence through session rules, with exact items;
    - before discovery, E2 and the pocket take no drops, give none, refuse collection, and stay out of merge groups;
    - discovery as a checkpoint, with a fresh Undo;
    - moves and swaps onto and off E2, and a five-merge whose group runs from the clearing through E2 into the pocket;
    - the nook blocking transfers from clearing, E2 and pocket;
    - the case, Undo and Retry;
    - text before and after discovery, with no text before it matching alcove, pocket, cache, hidden, secret or resource.
  - Two rewritten rendering tests in `tests/helpButton.test.tsx`:
    - before discovery: 27 plain terrain tiles plus the clue at E2, no cells, labels or outline for the pocket, the clearing outlined as a rectangle, and only the nook's rune gate;
    - after discovery: E2 and pocket cells labelled Fern Clearing, seven reveal glows, one outline with four notches, and no internal border;
    - the case states, Undo and Retry.
  - One test-typing change in `tests/rooms.test.ts`.
  - Mutation checks: dropping the link from `inRegion` failed 6 tests; dropping the notches failed the outline test.
- **Playwright Chromium against the production build** (`vite preview`):
  - The browser check found a bug, now fixed: absolutely positioned grid items with only a start line stretch to the board's far edge, so the first outline pieces made the board overflow (wrongly showing the pan hint at 820×1180). They now span one cell.
  - **820×1180, mouse drags:**
    - before discovery, drags and taps on the clue and pocket did nothing;
    - the reveal by a plain move added E2 and six pocket cells, with seven glows, disabled Undo, and the new banner, panel and announcement;
    - pocket → E2 and E2 → clearing moves, an Undo, and a pocket ⇄ E2 swap all worked;
    - a merge group through E2 was previewed and merged;
    - the authored steps 3–5 worked, then the case opened and won; Undo closed it, and Enter opened it;
    - with focus on E2, Retry re-concealed E2 and the pocket, restored the clue, moved the tab stop to A1 and closed the nook;
    - arrow keys crossed E2 when revealed and skipped it when hidden;
    - Help before and after discovery read as above.
  - **390×844, taps:** a drag on the clue tile panned the board. The reveal scrolled E2 and the whole pocket into view, and the nook's opening did the same for the nook. A full win, Undo, and Retry to the exact start view.
  - **844×390, taps:** the same, except no concealed tile is in view at the start there, so panning from one wasn't exercised.
  - **1180×820, taps:** the whole map fits; a full win.
  - **Screenshots** of start and revealed maps at all four sizes, plus close-ups of the clue against plain terrain and of a bend in the outline. Concealed areas look like the rest of the forest, and the revealed shape reads as one room.
  - **Sizing at 820×1180:** ordinary items, pocket items, an item on E2 and the case (closed and open) were 6px inside their cells, and plate items 13px inside.
  - **Level 7:** gates, backpack and text unchanged, with no edge outline. Level 6 is unchanged.
  - No horizontal page overflow, no control outside the board under 44px, and no console errors or warnings.
- **Not verified:** physical iPad/Safari, VoiceOver and Home Screen mode; Chromium emulation does not establish them. Also unverified: whether the clue is subtle enough, or too subtle, on the real screen; that is the owner's call.

### Known limitations

- The clue sits at the right edge of the phone-portrait start view, and outside the start view in phone landscape.
- Inside bends of the outline are square (3px fillers), not rounded.
- Tapping concealed terrain doesn't clear a selection, like any terrain.
- Room levels still never report a loss; exact inventories keep this level from being stranded.

## 20261019-171209 — Level 8, The Hidden Cache (October 19, 2026)

Release build `20261019-171209`. Owner-approved design; implemented by Claude and reviewed by Codex. Owner authorized commit → push → deploy on October 19, 2026. Physical-iPad playtesting follows publication. On review, the owner found the alcove too obvious; an unreleased revision (above) conceals it.

### Changes

- **Map** (`CACHE_LEVEL`, `src/levels.ts`): a 7×7 board in terrain. Columns A–G and rows 1–7; tiers below are player-facing.
  - **Fern Clearing** (A1–D4, open): three Grove tier 1 and two Crystal tier 1. The crystal pair can't merge on its own, a sign that something is missing.
  - **Hidden Alcove** (F1–G3): one Crystal tier 1 and two Crystal tier 2, behind a rune gate at E2. It opens by itself when the plate at D1 holds exactly Grove tier 2.
  - **Lantern Nook** (B6–C7): a separate room behind a rune gate at C5, holding a closed clarinet case at B7. It opens by itself when the plate at C4 holds exactly Crystal tier 3.
  - Both are pressure plates (other items may stay in the room), not the stone's no-leftovers rule. Each opening is a checkpoint, as in The Rune Gates: the plate item is fixed, Undo is cleared, and later moves get a fresh single Undo.
- **Winning sequence:** C2 → B1 merge; B1 → D1 opens the alcove; F1 → A3 merge; A3 → F3 merge; F3 → C4 opens the nook; tap B7. In code coordinates (row, column from 0): (1,2)→(0,1), (0,1)→(0,3), (0,5)→(2,0), (2,0)→(2,5), (2,5)→(3,2), tap (6,1).
- **Room ownership, separate from opening** (`src/regions.ts`, `src/session.ts`):
  - A region may `joins` an earlier region: it is part of that region's room. A drop may move, swap or merge between open regions of one room; merge groups grow only through open regions of the source's room and never take a fixed item.
  - Every other region is still its own room. Nothing moves, swaps or merges between separate rooms, including the nook and every earlier level, even with all gates open.
  - Opening still follows each region's own unlock and list order.
  - Validation allows `joins` and `hidden` only on later regions of room levels. A joined region must name an earlier region that joins nothing. A stone can't be in a room with a joined part, since it counts only its own region's items.
  - Terrain and passages stay scenery. Placement inside a room is unrestricted, with no pathfinding.
- **Hidden until opened** (`hidden` on a region; `src/ui/Board.tsx`, `src/ui/app.css`):
  - Until it opens, the alcove's six cells are placeholders under a solid rock silhouette showing only its outline and a small name plate. Its rune gate stays visible.
  - The hidden cells aren't buttons: no labels, focus, taps or drops, and arrow keys skip them like terrain. A drag starting on the silhouette pans.
  - If Retry hides the cell holding the board's tab stop, the tab stop returns to the first cell.
  - Opening reveals the alcove's tiles and items at once, with no collection step. On boards that pan, the opened area is scrolled into view, and Retry restores the starting view (both existing behaviour).
  - The nook keeps the level-7 look: darkened, tiles visible, case hidden until it opens.
- **Treasure:** the treasure goal takes an optional `prize`; the default is the disc-golf backpack. Level 8 has a clarinet case:
  - closed (latched, with a gold note) until tapped or activated with Enter or Space;
  - then open, showing one assembled clarinet: mouthpiece and reed, barrel, two keyed joints and a bell, resting across the case lining.
  - It is drawn in code in the same SVG style as the backpack. The cell and goal panel follow the session's `collected` state. Undo closes it with the nook still open; Retry hides it again. Level 7's backpack and all of its text are unchanged.
- **Text:**
  - Goal: "Goal: find the clarinet case in Lantern Nook".
  - Banner, once the alcove is open: "… Items move and merge between Fern Clearing and Hidden Alcove."
  - Help: "Hidden Alcove is part of Fern Clearing's room: once its gate opens, items move, swap and merge between the two." The stone sentence appears only on levels with a stone.
  - The live region announces "Its items join Fern Clearing's" when the alcove opens, and "Opened the clarinet case: an assembled clarinet is inside."
  - Cell labels: "clarinet case, closed, tap to open", then "open, an assembled clarinet inside".
- **Levels and notes:** level 8 is on the Levels page and in normal progression, after level 7; winning it offers "Play again from level 1". Level 7 → level 8 is covered by the `nextLevelIndex` test but wasn't clicked through in the browser. The in-game Release notes gain a "The Hidden Cache" entry.
- **Not built:** supply buttons, chests, random contents, new puzzle modes, a room-aware loss rule, or distinct door artwork (the alcove door reuses the rune gate).
- **Names** (Fern Clearing, Hidden Alcove, Lantern Nook) were chosen by Claude; the owner may rename them.

### Verification (Claude)

- **Automated:** 470 tests (18 new), typecheck and production build pass.
  - `tests/cache.test.ts` (15):
    - layout, inventories and validation;
    - the full winning sequence through session rules, with each step's exact item;
    - the hidden alcove taking no drops, giving none and refusing collection before it opens;
    - exact-tier and wrong-plate refusals, and opening on a plain move or a swap;
    - both checkpoints, with fixed items, cleared Undo, and a fresh Undo that keeps the gate open;
    - moves and swaps both ways between clearing and alcove;
    - the nook blocking transfers, swaps and merges from both areas;
    - case collect, Undo and Retry;
    - a synthetic level where a joined alcove touches its clearing: a merge group spans the border only once it is open;
    - taps on the hidden alcove doing nothing, a tap-only win, and the text, including unchanged Rune Gates help.
  - Rendering, two tests in `tests/helpButton.test.tsx`: the hidden alcove leaks no cell, label or item; reveal; the case closed, open, after Undo and after Retry.
  - Art, one test in `tests/itemArt.test.tsx`: both prizes, closed and open, as one safe SVG each.
  - Three level-count assertions were updated.
  - Mutation checks: dropping the open-region check from merge groups failed the adjacent-alcove test; restoring the old same-region drop rule failed 8 of the 15 new tests.
- **Playwright Chromium against the production build** (`vite preview`):
  - **820×1180, mouse drags:**
    - a drag onto the hidden alcove, a tap on it, and select-then-tap did nothing;
    - step 1 merged;
    - step 2, a plain move, opened the alcove with its unlock glow, disabled Undo and fixed the grove, which then wouldn't drag;
    - an alcove → clearing move, a clearing → alcove tap-tap swap and an alcove → clearing drag swap each worked, and each was undone with the alcove still open;
    - the step-3 drag previewed a merge spanning both areas;
    - steps 3–5 gave the stated items and opened the nook, disabling Undo;
    - the case was closed in the room and goal panel; a tap opened both and won ("Play again from level 1");
    - Undo closed it with both gates open; Enter, and Space, opened it again;
    - after focusing an alcove cell, Retry restored the start (six hidden cells, closed gates, no padlocks, no case) and moved the tab stop to A1;
    - ArrowRight from D2 stayed put while the alcove was hidden.
  - **390×844, taps:** full win. Opening scrolled the whole alcove, then the whole nook, into view. Dragging terrain, and the hidden silhouette, panned the board without moving the page. Retry, with or without moves, returned to the exact start view. The name plate fit inside the silhouette (wrapping to two lines).
  - **844×390:** full win. Each opened area fit fully in view. Dragging empty ground panned. Retry returned to the start view (the Clearing only partly fits there, as on levels 6 and 7).
  - **1180×820, taps:** full win with the whole map in view, 85px tiles.
  - **1024×768, keyboard only:** full win with arrows and Enter. Once open, arrows crossed the terrain into the alcove and through the nook's passage, and focus showed on the case.
  - **Sizing at 820×1180:** ordinary items, alcove items and the case (closed and open) were 6px inside their cells; items on both plates were 13px inside. Each SVG matched its box. Close-ups of the closed and open case and the open board were inspected.
  - **Level 7:** the backpack was closed on reveal, opened and won, closed again after Undo and hidden after Retry, with unchanged text. Level 6 still rendered 49 cells, 2 gates and locked labels, and its art was 6px in.
  - At every size checked: no horizontal page overflow, no control outside the board under 44px, and no console errors or warnings.
- **Not verified:** physical iPad/Safari (touch, VoiceOver, Home Screen mode); Chromium emulation does not establish them. Also unverified: 1024×1366 and 1366×1024, and playtesting.

Codex independently verified 470 tests, typecheck, production build and diff checks; Chromium wins at 1024×1366, 1366×1024 and 390×844, level 7 → Next level → level 8, checkpoints, shared resources, case activation, Undo and Retry. No page overflow or console warnings/errors. Physical iPad/Safari and VoiceOver remain unverified.

### Known limitations

- On phones the alcove starts outside the board view; its rune gate and the next-gate panel name it, and opening it scrolls it into view.
- Tapping the hidden silhouette doesn't clear a selection, like tapping terrain.
- Room levels still never report a loss. Exact inventories make this level impossible to strand; real choices across rooms would need a room-aware loss rule.

## 20261019-163932 — Cell art placed by insets, so items and the backpack fit their cells on iPad (October 19, 2026)

Published as build `20261019-163932` from commit `d271347`. **Owner report:** the production build is `20261019-163932`, and on the physical iPad the sizing fix works. **Claude's check:** on October 19, 2026, the live `/version.json` reported `20261019-163932`. Nothing else about the deployment was rechecked. Implemented by Claude.

- **Owner's physical iPad report** on `20261019-162807`, in both portrait and landscape: on The Rune Gates, ordinary item art looked larger than its cell, as did the open backpack, but an item moved onto a marked pressure or stone tile looked the correct size. The owner likes the closed → open bag; that behaviour and its artwork are kept.
- **Cause.** Two sizing paths were compared:
  - Ordinary cell art (and the backpack) was in normal flow inside the cell's `<button>`, sized `width/height: 100%` of the button's content box. That box's height comes only from the grid row and `aspect-ratio`, so the art depended on how the browser resolves percentage sizes inside a button.
  - Marked-tile art was absolutely positioned with insets (since `47bf582`), which gives it a definite size from the cell's own box.

  Same artwork, and the owner saw only the percentage path drawn too large, so iPad Safari evidently resolves it differently from Chromium. Chromium draws both correctly: before and after, ordinary art measured 6px inside the cell. The exact WebKit mechanism wasn't reproduced, because WebKit isn't installed for Playwright here. Grid tracks were not the cause: cells always measured exactly their track.
- **Fix** (`src/ui/app.css`, one rule):
  - all cell art now uses the inset path, `.cell-art { position: absolute; inset: 4px }`, where 4px equals the cell padding, so ordinary art keeps the same box as before;
  - marked tiles override only the inset, to 11px.

  No artwork, locks, layout or mechanics changed, and nothing is clipped.
- **Checks** (Claude): typecheck, 452 tests and production build pass. One Playwright Chromium pass against the production build, at 820×1180 and 1180×820 (iPad portrait and landscape) and 390×844 (phone):
  - Measured relative to the cell: an ordinary item (the elk), the marked grove and stone crystal, and the closed and open backpack. Each `.cell-art` box and SVG matched and lay inside the cell: 6px in for ordinary art and the bag, 13px in on marked tiles.
  - Close-up screenshots looked right.
  - The bag was closed on reveal; collecting it opened it and won; Undo closed it; Retry hid it.
  - Level 1 and The Hidden Hollow measured unchanged (art 6px inside the cell), and level 1 looked unchanged.
  - No page overflow and no console errors.
- **Not verified by Claude:** physical iPad/Safari. The owner has since reported, on build `20261019-163932`, that the fix works on the physical iPad.

## 20261019-162807 — Rune Gates: bare padlock on completed tiles, and a backpack that opens on collection (October 19, 2026)

Published October 19, 2026 in build `20261019-162807`, from commit `47bf582`. Requested by the owner after reviewing build `20261019-161758`, where the fixed tree, bird and tier-3 crystal still looked bigger than their tiles. Implemented by Claude. On the physical iPad the owner liked the closed → open bag, but ordinary item art and the open bag still overran their cells (fixed in `20261019-163932` above).

- **Completed tiles.** In Chromium the cells were never larger than their 64px (phone) or 92px (iPad) grid tracks, and the art was already smaller than on plain tiles; what reached the tile's frame was the dark round lock badge with its gold border. Now:
  - the badge is gone: a bare 14px padlock (dark brown, no background, border, halo or padding) is tucked inside the ring's top-right corner;
  - the item is placed at an explicit 11px inset inside the ring (38px on a 64px tile, 66px on a 92px tile, 5px clear of the ring) instead of being sized from the button's padding, so its size doesn't depend on how a browser lays out button padding.

  Empty-tile requirement markers, the badge on an occupied tile before its gate opens, and the fixed-item rules are unchanged.
- **Backpack opens on collection.** The final room reveals a closed backpack: zipped lid, handle, pocket, no discs. Tapping it, or Enter or Space, opens it (lid back, discs inside, two beside it) and wins. The session's `collected` state chooses the art, in the room and in the goal panel, which also shows the closed bag until then. Labels read "closed, tap to collect", then "open, collected". Undo closes it again with the room still open; Retry hides it again. No animation.
- **Unchanged:** room layout, requirements, checkpoints and cross-room rules.
- **Checks** (Claude): typecheck, 452 tests (1 new rendering test: hidden, closed, open, Undo and Retry states, and three bare padlocks with no badges) and production build pass. Playwright Chromium against the production build, at 390×844 and 820×1180:
  - In the completed state, close-up screenshots showed the tree, bird and crystal inside their rings, visibly smaller than the elk on its plain tile, each with only the small padlock. Measured: cells exactly their grid track, art 5px and lock 3px inside the ring, no badges.
  - On room reveal, the bag was closed in the room and the goal panel. Collecting it by Enter (390×844) or tap (820×1180) opened both and won. Undo closed it again with the gate still open. Retry hid it, closed both gates, removed the padlocks and restored the starting view.
  - No horizontal page overflow and no console errors.
- **Not verified:** physical iPad/Safari. WebKit isn't installed for Playwright here, so Safari's rendering of the tiles is unchecked; the owner's Safari report was not reproduced in Chromium.

## 20261019-161758 — Rune Gates tile and backpack visual pass, and its in-game release note (October 19, 2026)

Published October 19, 2026 in build `20261019-161758`, from commit `b95a4b1`. The owner reviewed the published art and requested these changes; Claude implemented them, and Codex reviewed the CSS and backpack changes and found no blocking code issue. On review, the owner found the completed tiles still looked oversized (see `20261019-162807` above).

- **Completed tiles fit their square.** The item on a pressure plate or the stone, and its corner badge (the needed item, then a padlock), now sit inside the tile's bronze or slate ring instead of spilling over it. The ring, its colours and the empty-tile ghost are unchanged.
- **Open backpack.** The treasure is redrawn open, with its lid folded back, three discs standing inside and two lying beside it.
- **In-game Release notes.** A "The Rune Gates" entry (October 19, 2026) describes the level: three rooms connected by rune gates, marked tiles that open the next gate by themselves, opening fixing those items and clearing Undo, Retry restarting everything, and the disc-golf backpack to collect. Build `20261019-132651` shipped without one.
- **Unchanged:** the layout, rules and gameplay text.
- **Checks** (Claude): 451 tests, typecheck and production build passed for the visual changes. In Playwright Chromium against the production build, at 390×844 and 820×1180, the completed plates and stone kept their art and badge at least 1px inside the ring; the open backpack showed when its gate opened, and a tap won. No horizontal page overflow and no console errors. The release-note entry was checked by typecheck only. Physical iPad/Safari is unchecked.

## 20261019-132651 — Level 7, The Rune Gates (experimental), and four Hidden Hollow gate fixes (October 19, 2026)

Published October 19, 2026 in build `20261019-132651`, from commit `99bbd6d`. Implemented by Claude and reviewed by Codex.

Owner playtest (October 19, 2026): the gate and path design looks nice and works. Longer paths between rooms are an option for future levels, not an implementation request. After reviewing the original art, the owner requested the tile and backpack changes published in `20261019-161758`.

### The Rune Gates (level 7, experimental)

- **Map** (`RUNE_LEVEL`, `src/levels.ts`): a 7×7 board with three rooms in forest terrain, joined by one-cell passages, each closed by a rune gate drawn in SVG (two standing stones with glowing bars between them). The gates are scenery, not controls or signs over the rooms. Locked rooms are only darkened.
  - **Pressure Hall** (3×3, open): three Grove tier 1 of 4, three Song tier 1 of 4 and an Elk. Its two pressure plates need exactly Grove tier 2 of 4 and Song tier 2 of 4, both at once; the elk may stay.
  - **Stone Chamber** (3×3): three Crystal tier 1 of 4 and two Crystal tier 2 of 4. Its stone needs exactly Crystal tier 3 of 4, with nothing else left in the room.
  - **Treasure Nook** (2×2): hides a disc-golf backpack until its gate opens. Tapping it, or Enter or Space on it, collects it and wins.
- **Winning line** (row, column from 0), as drags or tap-then-tap:
  1. (1,2)→(0,1) merge;
  2. (0,1)→(0,2);
  3. (2,1)→(2,0) merge;
  4. (2,0)→(2,2), a plain move, opens the first gate;
  5. (1,4)→(2,4);
  6. (3,6)→(3,4) merge;
  7. (1,6)→(3,5) merge;
  8. (3,5)→(2,5), a plain move, opens the second gate;
  9. tap (6,4).
- **Rules, all enforced by the session** (`src/regions.ts`, `src/session.ts`):
  - **Opening:** a gate opens by itself as part of the drop that meets its tiles; a plain move counts. Tiles match family and tier exactly. Opening consumes nothing.
  - **Checkpoint:** opening clears the Undo step, so Undo can't close a gate or return to the earlier room state; later moves build a fresh Undo step. The items on an opened gate's tiles are fixed: they can't move, swap, receive a drop or join a merge group, and they show a padlock badge. Other items stay movable in their room.
  - **Treasure:** collecting it is one ordinary undoable move. Retry restores the start: closed gates, no fixed items, hidden backpack and the starting view.
  - **Room boundary:** as in The Hidden Hollow, nothing moves, swaps or merges across rooms, even with every gate open. Terrain and passages are not cells: they take no drops, pan when dragged, and arrow keys skip them.
- **Data model:** the existing regions, extended rather than replaced.
  - A region's `unlock` is either the Hollow's item unlock or a plate unlock: pressure plates or one stone, the room they are in, and the passage cell for the gate.
  - The level goal can be `{ kind: 'treasure', at }`, and the session records whether it has been `collected`.
  - Room levels may leave empty terrain outside their regions. Validation rejects anything else: plates outside their room, a passage not between both rooms, items on terrain, or a misplaced treasure.
- **No loss state.** Room levels never report "lost". This level can't be stranded: each Hall family has exactly three tier-1 pieces (one merge, no overshoot), and the Chamber's pieces can only merge to one Crystal tier 3 of 4. A future room with real choices would need a room-aware loss rule.
- **Text:**
  - The banner names the next step, for example "Put Grove, tier 2 of 4 and Song, tier 2 of 4 on the pressure plates in Pressure Hall to open the rune gate to Stone Chamber."
  - The side panel shows the next gate and its needs, and Help explains plates, stones and checkpoints.
  - Cell labels name plates, stones and fixed items. A cell holding the hidden backpack reads as an ordinary locked, empty cell.
  - There is no Unlock button on this level.
- **Not built:** chests, beam routing, recipes, walking characters, procedural rooms and new audio.

### Hidden Hollow gate fixes (from the Codex review of `6a200fd`)

1. **Visible focus after a keyboard unlock.** After the opened area is centred and its first cell focused, the cell is scrolled into view when its focus ring shows; focused cells keep a 10px scroll margin for the ring. A pointer unlock keeps the centred view as before.
2. **Ready-gate focus.** A focused ready gate keeps the shared dark halo under the white outline, with the glow outside it, throughout the pulse and when the glow is steady under reduced motion.
3. **Lost-state test.** The gate test now uses a lost state whose next area's key is made. It checks that `canUnlock` is false, and that both a gate unlock and the Unlock button leave the state unchanged.
4. **Documentation.** TODO.md and the 20261019-055257 limitations below said the in-game gates entry was missing. "Open the woodland gates" is in `src/ui/ReleaseNotes.tsx`, and both statements are corrected.

### Verification

- 451 tests (12 new), typecheck and production build pass. New tests: `tests/rooms.test.ts` (11) and one rendering test in `tests/helpButton.test.tsx`; three level-count assertions and the snapshot helper were updated for level 7.
- Claude, Playwright Chromium against the production build:
  - **820×1180 (iPad), mouse drags, full win.**
    - The first gate stayed shut with only the grove plate filled and opened on the plain move that filled the song plate; Undo was then disabled.
    - Fixed items didn't drag or select. The elk couldn't be dropped into the Chamber, but moved within the Hall, giving a fresh Undo that left the gate open.
    - Crystal tier 2 of 4 on the stone kept the second gate shut.
    - The backpack stayed hidden until the second gate opened. A tap collected it and won; Undo un-collected it with the gate still open; Enter collected it again.
    - Retry restored the starting pieces, closed gates and hidden backpack.
  - **390×844 (phone), taps.**
    - The map pans: dragging terrain scrolled it, with no horizontal page overflow.
    - Each opening brought the new room fully into view, and a full win worked.
    - Retry returned to the starting view.
  - **Hidden Hollow at 390×844.**
    - A pointer unlock kept the Glade centred, with focus moved but no ring.
    - Enter, and Space under reduced motion, on the Hollow gate left the focused cell (0,0) visible with its ring; before the fix it was off-screen.
    - A focused ready gate kept the 7px dark halo during the pulse and when steady.
    - Retry returned to the starting view.
  - No console errors or warnings.
- **Not verified:** the no-leftovers stone rule and exact plate tiers can't be reached in the shipped arrangement, so only unit tests cover them. Also unverified: physical iPad/Safari (touch, VoiceOver, Home Screen mode), 844×390 and other sizes, iPad landscape, playtesting, and mutation testing of the new tests.

### Known limitations

- On phones the 7×7 map pans, like The Hidden Hollow.
- This build's in-game Release notes page has no entry for The Rune Gates; one was added in `20261019-161758`.
- The gates, plates and backpack are new artwork drawn in code. The owner's feedback on them is recorded above.

## 20261019-055257 — On-board gates for The Hidden Hollow (October 18, 2026)

Published October 18, 2026 with owner authorization in build `20261019-055257`. Owner-approved: opening an area should feel like an action on the board.

Codex release verification: 439 tests, typecheck and production build passed. Independent Chromium checks covered full victory via gates, unavailable/out-of-order activation, keyboard focus transfer, Undo/Retry, reduced-motion steady highlighting, gate dragging versus small-wobble taps, and gate bounds at all seven requested sizes. After deployment, verified live build `20261019-055257` and opened the ready Glade gate by tapping it. Physical Safari and owner playtesting remain pending.

### Changes

- **Wooden gates.** Each locked area's sign is now a gate on the board (`src/ui/Board.tsx`, `src/ui/app.css`): vertical planks, two rails and a rounded top drawn in CSS, carrying the existing parchment sign with the padlock, the area's name and "Needs ⟨item⟩ in ⟨area⟩". No new images.
- **Ready state.** When the area is next and its item is made, the gate shows three cues, not colour alone:
  - a gold ring and glow that gently pulses (1.6s, alternating);
  - an open padlock;
  - a "Tap to open" chip.

  Under reduced motion the glow is steady.
- **Unlocking.**
  - Tapping the gate, or pressing Enter or Space on it, performs the same non-consuming, undoable unlock as the Unlock button, which stays. Nothing unlocks automatically.
  - A gate's unlock names its own area. The session (`unlock(state, region)`) refuses it unless that area is the next to open and its item is made. So a later gate can never open another area, and order and eligibility stay enforced by the session, not the UI.
- **Accessibility.**
  - Each gate is a focusable button, reached with Tab after the board's cells.
  - A gate that isn't ready is `aria-disabled`, labelled for example "Crystal Hollow gate, locked. Needs Song, tier 3 of 4 in Songbird Glade."
  - When ready it reads "Songbird Glade gate. Needs Grove, tier 3 of 4 in Mossy Clearing. Ready: tap to open."
  - The gate disappears when its area opens. After a keyboard unlock, focus moves to the opened area's first cell, so it isn't lost.
- **Pointer behaviour.**
  - Pressing a gate starts the same pending gesture as locked ground. A drag past the 8px threshold pans the board, and its click is suppressed, so it never unlocks; a tap unlocks.
  - Gates never select, drag or receive pieces.
  - Locked ground around them still pans.
- **Placement.** Gates sit inside their own locked area and vanish once it opens, so they never cover playable cells. On phones a gate is no wider than the board view less 48px, but at least 300px, so the Hollow's gate stays readable at 390px wide.
- **Text.** The banner says "Songbird Glade is ready. Tap its gate or press Unlock Songbird Glade.", and Help explains the gate.
- **Unchanged:**
  - board and tile sizes, scrolling and panning;
  - unlock auto-centring, Undo leaving the view in place, and Retry returning to the Clearing;
  - rules, artwork, music, and all other levels and modes.

### Verification

- 439 tests (3 new; four existing assertions updated for the new wording), typecheck, and production build pass.
  - **Session:** gate unlocks are refused for the wrong area (a later area, one already open, out of range, fractional, or not ready) and accepted for the next area.
  - **Reducer:** tapping the Hollow's gate while the Glade is next does nothing. A gate unlock records the action and clears the selection. Gates do nothing once the game is lost.
  - **Rendering:** gates show their labels and stay `aria-disabled` until ready, and only one gate is ever marked ready.
- Claude, Playwright Chromium against the production build (`vite preview`):
  - **820×1180, full win through both gates.**
    - Tapping either gate before it was ready, or the Hollow's gate while the Glade was next, did nothing.
    - The ready gate's glow animation ran.
    - A drag starting on the ready gate did not unlock and left the selected piece selected.
    - A tap with a 3px wobble unlocked, and the cells under the former gate took taps again.
    - Undo brought back the ready gate, and Retry restored both waiting gates.
  - **Keyboard, with reduced motion.**
    - Tab from the board reached the Glade gate, showing the 4px white focus outline and a steady, non-animated glow.
    - Enter on the not-ready Hollow gate did nothing. Enter on the Glade gate unlocked it and moved focus, with a visible ring, to the Glade's first cell.
    - Space on the Hollow gate unlocked it, and the unlock effect was fade-only.
    - After a mouse unlock, focus moved without a ring.
  - **390×844 and 844×390.**
    - Dragging from a waiting gate panned the board without unlocking or moving the page, and locked ground beside the gates still panned.
    - Tap, pan across a gate, tap still merged, with the selection kept.
    - Tapping a ready gate unlocked and centred the opened area.
    - Undo left the view in place, and Retry returned to the starting view.
    - A full win through both gates at 390×844 on the final build.
  - **All seven sizes** (390×844, 844×390, 820×1180, 1180×820, 1024×1366, 1366×1024, 1024×768):
    - gates stayed inside their own areas, waiting and ready, and covered no other area's cells;
    - no horizontal overflow, and no button, input or link under 44px;
    - measured text contrast was 13.4:1 for the sign, 10.1:1 for the area name and 7.3:1 for the "Tap to open" chip.
  - No console errors or warnings.
- **Not verified:** physical iPad/Safari touch on the gates, VoiceOver, and Home Screen mode. Chromium emulation does not establish them. Not yet playtested.

### Known limitations

- At 844×390 the Hollow's gate (300px) is wider than the 228px board view; the player pans to read all of it.
- On phones the Glade's gate covers most of that locked area (196×158px of 210×280px), and so most of its pieces, until it opens.
- Only this level's woodland gate exists; other gate looks (vines, bridges, rune doors) are ideas, not built.
- The in-game Release notes entry for the gates is "Open the woodland gates" in `src/ui/ReleaseNotes.tsx`. (This line previously said the entry was missing; corrected October 19, 2026.)

## 20261019-052826 — The Hidden Hollow (region level) and level picker (October 18, 2026)

Published October 18, 2026 with owner authorization in build `20261019-052826`. A gameplay experiment before any generated multi-room puzzles: one handcrafted map whose areas unlock in order. The owner also asked mid-task for a level picker.

Codex release verification: 436 tests, typecheck and a fresh production build passed. Independently completed the 13-action winning path, checked blocked input and unlock Undo, and confirmed Retry restores the exact Clearing viewport at 390×844 and 844×390 while Undo preserves the view and level 5 retains its pan. After deployment, verified live build `20261019-052826`, six picker entries, level 6 startup, the first unlock and Retry relocking both areas. Added the player-facing Hidden Hollow release entry. Physical iPad/Safari and owner playtesting remain pending.

### Changes

- **Level 6, The Hidden Hollow** (`HOLLOW_LEVEL` in `src/levels.ts`), after the original five. A 7×7 map in three rectangular areas: Mossy Clearing (4×4, open), Songbird Glade (3×4) and Crystal Hollow (7×3, across the top). The Glade opens with Grove tier 3 of 4 made in the Clearing; the Hollow with Song tier 3 of 4 made in the Glade. Goal: Crystal tier 4 of 4 in Crystal Hollow. No supply; every piece starts in its area.
- **Regions** (`src/regions.ts`): a level may list rectangular regions that split its board exactly; region 0 starts open and the rest unlock in list order. The item goal takes an optional `region`. `startSession` rejects anything else with "Unsupported region level: …": a ragged board, a single region, regions out of bounds, overlapping or leaving gaps, a locked first region, a later region without an unlock or unlocking from itself or a later region, supply, or a goal that is not one item in the last region. Levels without regions are unchanged.
- **Rules enforced by the session**, not only the UI (`src/session.ts`): a drop must stay inside one open region (`canDrop`), so locked pieces cannot move, merge, swap or receive drops, and nothing moves or swaps between areas, even once both are open. Merge groups stop at region borders (`previewMerge`/`drop` take an optional `connects` predicate), so a matching piece across a border is never consumed. `unlock()` opens the next region when its item is present in the named region; it consumes and moves nothing, and is an ordinary undoable move. The session snapshot now carries `unlocked`, so single-step Undo restores board, open regions and status together; Retry restores the exact locked start. A key can never disappear afterwards: merges only raise tiers, and the requirement is "that tier or higher".
- **Goals and keys count only in their own area, and only once it is open:** a Crystal tier 4 elsewhere, or inside the still-locked Hollow, does not win.
- **Status for region levels** (`src/status.ts`): won when the goal item is in the open goal region. Lost only when nothing useful can change: no unlock is ready, and no open area holding an unmet target (the next unlock item, or the goal) has three pieces of that family at one tier below the target. Moves, swaps and other families' merges never change those pieces, so such a board can never win. A doomed choice that leaves such merges stays "playing", as in generated puzzles, and an eligible unlock always counts as play. The message is "No useful merges left—Undo or Retry." The rectangular count-based evaluator is not used for region levels.
- **UI:** each area is outlined over the board gaps. Locked areas are shaded and hatched (not colour alone), with a parchment sign showing a padlock, the area's name and "Needs ⟨item⟩ in ⟨area⟩". Cells are labelled with their area and "locked", and locked cells are `aria-disabled`. Signs and outlines never take input. Dragging a locked cell pans the board like empty ground. Taps, Enter and drops on locked or other-area cells do nothing, and a drag over them shows a dashed red "blocked" outline instead of the drop target. Instead of supply, the info panel shows "Locked: ⟨next area⟩ / Needs …" (then "All areas open"), and the controls show "Unlock ⟨area⟩". That button is disabled until the item is made, then reads "All areas open" so Undo and Retry never shift. The banner gives the next step, plus "Drag empty ground to pan." when the board overflows. Help explains areas and unlocking. On phones the board opens on the Clearing; unlocking scrolls the new area into view, and Retry returns to the Clearing exactly as on entry (both instant). Undo leaves the view where it is. A gold glow plays once on the opened area: 0.8s, no pointer events, fade-only under reduced motion, and input is never delayed. Below 600px wide, the region level's two panels stack full width.
- **Level picker** (`src/ui/LevelPicker.tsx`): Home → Levels now lists all six levels, and any can be played (nothing is saved, so none are gated). The level the sequence has reached is marked "Up next". Winning still offers Next level, and the home note still says where Levels continues. Picking a level starts at the top of the page.

### Puzzle design and authored solution

Every piece belongs to its area's target family and has a role. Coordinates are (row, column) from the top-left, 0-based, as in `tests/regions.test.ts`. Tiers below are the code's 0-based tiers (grove-0 is shown as tier 1 of 4).

- **Clearing (Grove; teaches Unlock):** grove-0 ×3 (a pair at (3,0)-(3,1) and a lone one at (5,1)) and a grove-1 pair at (4,3)-(5,3). Drop (5,1) on (3,0), a 3-merge. Drop the new grove-1 (3,0) on the pair at (4,3), a 3-merge giving Grove tier 3 of 4. Unlock Songbird Glade. There are no choices here.
- **Glade (Song; introduces 5 → 2, optional):** song-0 ×6 as a 2×2 block plus a pair, and song-1 ×1. Drop (5,6) on the block, a 5 → 2 merge with outputs at (3,4) and (5,6). Move (6,4) to (5,5). Drop (3,4) on (5,5), a 3-merge giving Song tier 3 of 4. Unlock Crystal Hollow. Two plain 3-merges also work, and every choice reaches the key.
- **Hollow (Crystal; needs one 5 → 2):** crystal-0 ×5 (two pairs and a lone one), crystal-1 ×1 and crystal-2 ×2. Gather four crystal-0 into a block: (2,4) → (1,0), then (2,5) → (1,1). Drop the fifth, (1,6), on the block, a 5 → 2 merge with outputs at (0,0) and (1,6). Move (0,0) to (1,5). Drop (1,3) on (1,5), a 3-merge giving crystal-2 beside the one at (0,5). Drop (2,0) on (1,5), a 3-merge giving Crystal tier 4 of 4. That is the win.
- **Rationale:** a short, readable sequence of three areas, 13 actions in all. The Clearing teaches unlocking with no way to fail. The Glade shows the five-for-two bonus where it is optional, and the Hollow is the only place it is required. The only losing choice in the whole level is a 3-merge of crystal-0 in the Hollow. It leaves two of each crystal tier, which is reported at once, so a single Undo recovers and no Retry is needed. An exhaustive check of every reachable state confirms this.

### Verification

- 436 tests (56 new), typecheck, and production build pass (the sandbox is still excluded from `dist/`). The new tests cover:
  - the level's geometry, inventories and authored solution, replayed step by step through the real session rules;
  - lock, border and merge-group enforcement, including a group that would have been a 5-merge across a border;
  - unlock eligibility, order and non-consumption;
  - Undo and Retry across unlocks, and region-specific goals and keys;
  - failure before and after unlocks;
  - every unsupported configuration;
  - unchanged behaviour of the five original levels and generated puzzles;
  - UI input through the reducer (taps, drags and Unlock on locked or other-area cells; selection, preview and effects after Undo);
  - the Levels page and the region level's render and text.
- **Failure-rule soundness:** an exhaustive search of the level's reachable count states found every unwinnable state reported "lost" and every winnable one "playing" or "won". Each region's state is its piece counts, since any arrangement within a region is reachable, and each state was judged by `evaluateStatus` on a real board. So on this level, failure detection is exact as well as sound. The general argument is in `src/status.ts`.
- Claude, Playwright Chromium against the production build (`vite preview`):
  - **Full win of level 6 at 820×1180:**
    - blocked drags into a locked area and across an open border (blocked outline, no change, Undo untouched);
    - a locked piece that cannot be dragged, and taps and keyboard Enter on locked cells that do nothing;
    - a drag 3-merge, a tap-tap 3-merge and Unlock with its glow;
    - Undo across the unlock, with a Glade item selected beforehand (relocked, nothing selected, no effects), then Unlock again;
    - a keyboard 5 → 2 merge (arrow keys and Enter);
    - the Hollow trap ("No useful merges left—Undo or Retry.", board locked) and Undo;
    - the win ("Play again from level 1", celebration on the goal item), Undo after the win, and Retry to the exact locked start.
  - **390×844:**
    - the board opens with the whole Clearing in view (64px tiles);
    - dragging a locked Hollow piece pans the board without moving it or the page;
    - tap, pan, tap merges across a pan;
    - Unlock scrolls the whole Glade into view.
  - **Retry view, 390×844 and 844×390:**
    - after unlocking the Glade, and again after unlocking both areas, Retry returned the board to exactly its entry scroll (with the whole Clearing in view at 390×844) and to the locked start;
    - Retry after panning away without unlocking did the same;
    - Undo straight after either unlock left the view unchanged;
    - level 5 (no areas) still keeps its pan on Retry.
  - **Reduced motion:** the unlock glow uses the fade-only animation with no pointer events, and a merge tapped straight after Unlock applied.
  - **Picker:** level 1 won through the UI, Next level gave "Level 2 of 6", and the picker then marked level 2 "Up next". Level 4 picked directly. Level 5 still starts centred, and a generated puzzle shows no regions and the same 708px board frame.
  - **At all seven sizes** (390×844, 844×390, 820×1180, 1180×820, 1024×1366, 1366×1024, 1024×768), on the Levels page and on level 6: no horizontal page overflow; no visible button, input or link under 44px; both signs fit inside their areas. The board fits without panning on every iPad size (73–100px tiles); phones pan at 64px.
  - No console errors or warnings. Screenshots were inspected at 820×1180, 390×844, 844×390 and 1024×768.
- **Not verified:** physical iPad/Safari (real touch, VoiceOver reading of signs and cell labels, Home Screen mode). Chromium emulation does not establish them. Not yet playtested by the owner or Alisha.

### Known limitations

- At 844×390 the board viewport (about 234px tall) is shorter than the 4×4 Clearing, so the start shows its middle and the player pans. This is the existing 60vh board size; layout unchanged.
- On phones the signs on locked areas can be out of view; the info panel and Unlock hint always show the next requirement.
- The Glade's sign covers part of its locked pieces until it opens.
- One handcrafted map only; regions must be rectangles, unlock in order, and have no supply. Multi-room generation, supply chests, transferable items, sound effects and campaign work remain deferred.
- The other handcrafted levels still report a loss as soon as counts make the goal unreachable, so the region level and generated puzzles ("no useful merges") behave differently from them.
- The in-game Release notes page has no entry for this yet; add one at deployment.

## 20261019-021029 — Gameplay background (October 18, 2026)

Published as build `20261019-021029`; the live `/version.json` was checked on October 18, 2026. Committed as `204e839` ("Checkpoint gameplay backgrounds pending character placement"). Backgrounds only; merge, goal and victory animations are separate tasks. The text below was written before deployment.

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
