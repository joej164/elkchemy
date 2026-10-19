# Elkchemy — Game Vision and Design Notes

Draft handoff · October 18, 2026

Suggested repository home: `docs/game-vision.md`. Originally read alongside `next-release.md`, which defined the narrower implementation scope; that milestone is complete and the file has been retired (see the status note below). This document preserves the larger discussion; it is not authorization to implement every idea. Inspect existing repository documentation and merge into its conventions rather than creating competing plans.

**Status, October 18, 2026.** Merged into the repository: tasks are tracked only in [TODO.md](../TODO.md). The generated-puzzle milestone that `next-release.md` scoped is complete and published as build `20261018-232855`; its changes, verification, and limitations are in [release-notes.md](release-notes.md), and `next-release.md` was removed. Owner decisions made with that merge:

1. Generated puzzles come before connected-region gameplay, to give Alisha more to play (implemented locally, not yet deployed).
2. Unfinished boards are never saved. Later persistence may cover settings, completed puzzles, and bookmarked seeds.
3. Returning home, followed by finding her friends, is a committed and evolving story direction. Specific plot details remain exploratory; story implementation is outside the current milestone.
4. The gameplay freeze recorded after the proof-of-concept playtest is lifted; this feedback informed these documents.

## Purpose and product principles

Elkchemy is a personal merge-puzzle game originally made for Alisha, whose nickname is Elk. The deployed proof of concept demonstrated that she enjoys the play and especially the clarinet music. Her principal request was more levels and replayability.

- Immediate priority: give her more enjoyable puzzles to play.
- Start with existing rules and code; learn through playtesting before adding mechanics.
- Keep iPad interaction comfortable, including finger-sized pieces and usable panning.
- Offer challenge, meaningful mistakes, undo, and retry. Difficulty need not mean frustration.
- Avoid ads, real-money currencies, purchases, and manipulative free-to-play progression. Earned currency was an idea, not a committed feature.
- Keep larger ambitions optional. Complete released stories should remain satisfying if development stops.
- Do not turn brainstorming into requirements. Implement only the separately scoped release.

## Observed proof-of-concept behavior

Live build tested: `20261018-195510`, at https://elkchemy.web.app/.

The assistant completed all five levels through the deployed browser UI. This verified one winning path per level, not comprehensive testing, iPad touch behavior, audio quality, or internal source implementation.

| Level | Name | Observed objective |
| --- | --- | --- |
| 1 | Sprouting Grove | Make Grove tier 3 |
| 2 | Songbird Chorus | Make Song tier 3 |
| 3 | Lone Elk | Use all supply and leave exactly one item |
| 4 | Crystal Fives | Make Crystal tier 4 |
| 5 | The Faraway Grove | Make tier 4 in all four item families |

Observed rules: tap an item and its destination, or drag; moving onto a different item swaps them. Dropping onto a matching item merges its connected group. Three pieces produce one upgraded piece; five produce two. Items do not merge merely because they become adjacent. Current items stop at tier 4. Preserve the source's actual behavior for other group sizes; investigate rather than inventing rules.

Level 4 was solved with five-piece merges at two successive tiers. Help explains the bonus, but the level does not explicitly teach it. This is a teaching gap, not proof that the rule is undocumented.

Level 5 has a 12-column by 16-row board, four tracked sub-objectives, and four supply pieces. All objectives were completed without drawing any supply. After completion, the UI offers Play again from level 1. Some starting pieces are already grouped, reducing the arranging required. These are observations for future design, not requirements to repair every prototype level.

With unrestricted movement and swaps, scattering pieces and enlarging the board can add searching and interaction time without adding deeper decisions. Genuine planning comes from merge quantities, resource use, and future constraints. A longer relaxed puzzle can still be desirable; do not equate size with difficulty.

## Immediate gameplay direction

Two replayable modes share the existing merge system:

1. **Merge to goals:** create the specified target items, potentially across multiple families. Winning may leave lower-tier pieces on the board.
2. **Merge down to one:** begin with one item family and finish with exactly one item at the intended target tier.

Every generated piece should contribute to the puzzle's objectives. Avoid unrelated decorative item families that have no gameplay role.

Desired configuration ideas include mode, target tier, goal count where relevant, and possibly complexity. Earlier suggestions included one to five goals and three-, four-, or five-star targets; those ranges are exploratory. A five-star tier would extend the current rules and artwork and is not part of the immediate baseline. Complexity must consider the starting mix, not just target tier.

Board dimensions should follow the pieces needed, with usable empty space and comfortable touch sizing. Avoid making maps scrollable solely to look large. Starting pieces can mix tiers below the requested target. No resupply is needed for the first generated modes: all required resources start on the board.

Generation must produce a legal, solvable starting state and be reproducible. Choose a valid combination and randomize arrangement; independently randomizing item counts and tiers is insufficient. Validation must use actual merge semantics, especially the five-for-two bonus and the exact-one-item condition. A three-for-one-only chain from tier 1 to tier 5 takes 81 starting pieces; starting with higher tiers can dramatically reduce board size.

Difficulty controls, density, board sizes, and target ranges should be tuned through playtesting. Solvable is necessary but does not guarantee fun.

## Failure, undo, and help

Design preference: do not immediately announce that a move has made the puzzle unwinnable while meaningful play remains. Let the player explore and work out where a mistake occurred. End failure when useful actions are exhausted, rather than exposing the exact fatal choice.

Because arbitrary moving and swapping remain possible, “out of moves” cannot simply mean no movable pieces. Its exact implementation requires investigation. Startup solvability validation must not become an unsolicited live hint or immediate failure detector.

Preserve undo and retry. Full hints are undecided and deferred. Explain the three-for-one/five-for-two rule more clearly when teaching is addressed.

## Persistence and player identity

Longer-term direction: local player profiles without cloud sign-in. Cloud accounts, Google authentication, automatic remote backup, and cross-device sync are not needed now.

Important correction to earlier assistant advice: **do not assume active-puzzle saving.** The user chose a simpler approach: eventually preserve settings, completed puzzle identifiers, and bookmarked seeds, rather than unfinished board state. Leaving a puzzle can warn that the current attempt will be discarded. Replaying starts from its initial state. Campaign persistence can track completed levels and story milestones without saving the active board.

Completed history and bookmarks serve different purposes; an unfinished puzzle may be worth bookmarking. Puzzle identity needs the seed and relevant mode/settings/generator version. Keep identifiers compact. A seed is not a serialized multi-megabyte board.

Optional save export/import is a later feature for progress and settings. Investigate iPad sharing support before promising a share-sheet workflow. Validate imports and version save formats. Statistics by game mode, lifetime completion counts, and a reset-statistics action are explicitly later ideas, not immediate work.

Seed reproduction across future generator changes remains a design issue. Candidate approaches include retaining compatible generator versions or recording the original puzzle definition. Do not require active-game-state persistence to solve this.

## Updates and diagnostics — supporting follow-up work

Updates should be detected automatically and advertised with a badge or similar notification. **Applying an update remains a deliberate button press.** Do not silently replace a game during play. The current prototype requires the player to know to press Check for updates.

Diagnostics should reuse the user's existing music/note-detection app pattern. The user taps Report a problem or Send diagnostics, adds a note, and explicitly sends. Do not introduce automatic report submission or assume continuous data collection. What technical details accompany the report should be confirmed against the reference implementation.

The existing other-app backend is believed to use Firestore; confirm its actual code and configuration. Reports are viewed through Google Cloud Console and can be read by local Codex through an already authenticated gcloud CLI. That access exists on the user's development machine, not necessarily in every assistant environment. Diagnostic file export/import is unnecessary now. Reproduction information such as seed, mode, version, and build can accompany explicitly submitted reports. Avoid building a new diagnostics architecture when the existing pattern is available.

## Later gameplay experiment: connected regions

After the two generated modes, investigate larger maps composed of smaller connected rooms, paths, and clearings. They need not be full rectangles. Merges could create runes or keys to gates, activate tunnels, repair machines, or lower bridges. A bomb opening a barrier was another example, not a committed recipe.

Initial resource boundary: **items may only be consumed or used toward puzzle objectives within their room of origin.** Allowing pieces to move between rooms was considered, but is not mandatory. Any movement must preserve that boundary; merging must not provide a loophole for transferring resources between rooms. Cross-room resource puzzles are a possible later mechanic. Whether keys are consumed when activating gates remains a separate per-mechanic detail; the settled rule is where consumption is allowed.

Resupply can become an object in the world: unlock a cave, tap its chest, and receive more pieces. This is more purposeful than an always-available supply button. The entire puzzle must have at least one winning sequence. Supplies behind gates are allowed when reachable through a valid order; shared resources and wrong choices may still lead to failure. Do not impose the stronger rule that every gate must be independently solvable in every state.

**Prototypes so far.** The Hidden Hollow (published `20261019-052826`, gates `20261019-055257`) opens rectangular areas with a made item and an explicit Unlock. The Rune Gates (level 7, experimental, published October 19, 2026 in `20261019-132651`) tries smaller rooms in terrain: rune gates across passages open by themselves when marked tiles hold exact items (pressure plates, then a stone that must hold its room's only item), and a disc-golf backpack hidden in the last room appears closed and opens to show its discs when tapped, which wins. Decisions made for it: opening consumes nothing but is a checkpoint, so the tile items stay fixed and Undo history is cleared, and Retry resets everything; items still never leave their room; room levels never report a loss, so this level is built so it can't be stranded. Chests, beam routing, recipes, walking characters and procedural rooms remain ideas. The owner playtested it (October 19, 2026) and said the gate and path design looks nice and works; longer paths between rooms are an option for future levels, not a current request.

The elk may automatically walk through a cleared route, then wait safely at the next obstacle. The player solves rather than steers. Cutscenes can carry story beats between sections. Prototype these ideas before using them as campaign foundations.

## Campaign and narrative vision

Working identity: **Elkchemy** during the opening; **Elkchemy: Echoes of Home** is the selected subtitle for a later reveal. Exact reveal timing follows the final story and release boundaries.

Initial campaign direction is linear: introduce the elk and possibly her friends, an incident separates or displaces her, and she works her way home through a magical forest. A kidnapping, time warp, or space warp were possible explanations, not decisions. Optional side quests may fit but are not required.

Returning home is the first satisfying stopping point, and finding her friends afterwards is the committed next arc (owner decision 3); how that unfolds is still exploratory. The woodland can become a base and hub. The friends' rescues might take place in themed regions; later still, travel to entirely different hub worlds or through space and time is an idea. None of this commits the project to a large universe.

The latest preference is to let the opening end properly and sustain play with generated puzzles. A later update can introduce a new event and surprise the player. A cliffhanger was considered but is not required. If friend rescues or future areas are teased, balance those promises against the goal that a released arc feels complete. Coming-soon areas were discussed, then qualified by this completion principle.

The desired effect is a game that gradually reveals more depth. Subtle changes to title art, the home scene, characters present, or music can reflect progress and new releases. Avoid spoiling the larger reveal on the opening menu.

Writing should have emotional depth: attachment, friendship, loss, hope, and meaningful consequences, without becoming excessively dark. Branching choices, two difficult alternatives, and a character changing allegiance were exploratory examples. Full branching is not a current requirement. Develop character personalities, appearances, relationships, and arcs before relying on emotional consequences.

Campaign levels should reuse proven puzzle types. The exact narrative explanation for merging remains to be written; runes, keys, and world repair are candidate connections.

## Art, music, sound, and animation

Keep the elk from the existing icon prominent in the eventual title screen. Begin with magical woodland imagery, then support other settings in a consistent art style. Do not constrain the whole game to woodland themes.

Clarinet is the primary musical identity. Ukulele and guitar can support it; occasional harmonica could add a family connection. Preserve what is appealing in the existing tune while improving arrangement, sound quality, and variety. Music must suit each area's setting and emotional tone. The user suspects a simple MIDI-like sound; its production method has not been verified. Inspect the source before choosing a replacement approach.

Sound effects for buttons, merges, unlocks, and wins are future polish. Preserve music controls; fuller saved audio settings can follow the minimal release.

Story scenes can use illustrated backgrounds and portraits, timed text, layered motion, SVG/CSS/TypeScript animation, camera pans, particles, and music. In-board animation can show gates opening and the elk advancing. A short victory celebration is a possible capability demo after gameplay, not part of the current milestone. Scenes should eventually support advance, skip, replay, and appropriate progress tracking. No particular rendering library or cutscene engine is selected. Full video is optional and not necessary for the initial approach.

## Deferred idea pool

- Cross-family recipes, such as combining different classes into new themed items.
- Earned currency and unlock economies, only if they improve play; no real-money tie-in.
- More puzzle types and special mechanics introduced over time.
- Fully developed campaign, side quests, branching outcomes, and additional hub worlds.
- Cutscenes, victory animations, richer music, and UI/gameplay sound effects.
- Local profile management, history/bookmark screens, backups, statistics, and possibly cloud recovery much later.

## Guidance for the implementing agent

Read repository instructions, actual source, tests, and existing plans first. Update the project's canonical to-do list and documentation without discarding earlier valid work. Preserve the separation between settled direction, optional ideas, and open implementation choices. Take the implementation boundary from the current task in TODO.md (the generated-puzzle milestone defined by the former `next-release.md` is complete). Make routine decisions independently, but raise material scope changes or blockers rather than silently building deferred systems. Do not promise dates or effort estimates before inspecting the code.
