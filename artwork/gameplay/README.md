# Gameplay backdrop — draft v1

## Checkpoint for the next session

Owner requested committing and pushing the current work as an unfinished checkpoint. Both orientation-specific WebPs are integrated locally in Game via SceneArt; no deployment is authorized by this checkpoint. Most of the cheering characters are hidden behind the unchanged board/control layout, as recorded in TODO.md and the Unreleased release notes. Do not treat integration as visually finished. Next session should resolve character placement with the owner; separate character layers are a proposed approach, not an approved layout change. Animation work remains unimplemented. Production stays at build `20261019-011024`.

The preparation notes below describe earlier stages; this checkpoint records the current integration state.

`woodland-cheering-landscape-v1.png` is the gameplay direction accepted by the owner on October 18, 2026 ("what you have above seems ok"). Built-in imagegen used the Home landscape and canonical approved Alisha reference. Those references remain unchanged. Not integrated, committed or deployed.

Owner requested detailed but readable woodland behind active puzzle play, with the elk and Alisha cheering at the edge, plus more gameplay animation. Work is split into small chunks to conserve session usage. Portrait layout, integration and animation are pending; do not claim them complete. Characters are baked into this draft, so independently animated character reactions would need separate assets or another deliberate approach.

## Delivery copy

`src/assets/art/woodland-cheering-landscape-v1.webp`: 1672×941, 314212 bytes. Chromium canvas encoder, quality 0.80, sRGB; no crop or resize. Generated ICC/extended container stripped with standard-library RIFF handling while preserving the VP8 bitstream, as for the existing menu delivery copies. Only a VP8 image chunk remains. Original and canonical-reference SHA-256 matched before and after:

```text
cdca7cb1e6f19b109552272242697a8fcfb353e3ece2d464cde6dc181f5a11fc  artwork/gameplay/woodland-cheering-landscape-v1.png
365002398195fb49b6ad2080cd995b3784f56b002c6a16a73bc0759436d84404  artwork/characters/alisha-elk-approved-reference-v1.png
```

## Implementation research and next chunks

Portrait counterpart is now available for review: `woodland-cheering-portrait-v1.png`, with web copy `src/assets/art/woodland-cheering-portrait-v1.webp` (941×1672, quality 0.80, sRGB, metadata stripped using the same conversion method). Both characters are at the lower-right; center remains quiet. It is not integrated or deployed. Use orientation-specific images rather than simply cropping the landscape; actual board/control overlap still needs layout verification.

Repository inspection, not implemented behavior:

1. **Background first.** Use the WebP via Vite import, only during active game screens. Preserve board dimensions, tile contrast, panning, controls and Home/Play art. Both modes and authored levels share `Game` in `src/ui/App.tsx`. Inspect all seven existing phone/iPad viewports. A naive `cover` crop of this landscape can cut off the right-side characters in portrait; do not claim portrait is solved. Prefer a contained decorative scene/edge-colour fill if it works with the existing layout; surface a need for separate portrait art rather than hiding characters or covering controls. No automatic deployment.
2. **Merge travel and five-piece flourish.** `LastAction` in `src/ui/controller.ts` already records `input`, `cells`, `outputs`, `consumed` and `actionSeq`. Board currently shrinks consumed artwork for 350ms, pulses outputs for 600ms and shows a 3/5 badge; extend these rather than duplicate them. Render pointer-inert temporary artwork that travels from consumed cells toward the merge destination. Preserve two visible upgraded outputs in a five-merge (destination AND source). Work in board-local coordinates so panning stays aligned. Never delay applying a move, block input, or retain a queue of stale effects. Replace/cancel effects on the next action, Undo, Retry, new session and unmount; define behavior on resize. If transform motion would affect item hit testing, animate a decorative child/overlay, not the cell button. Use a distinct bounded golden flourish for five-merges.
3. **Goal and victory feedback.** Compare goal completion before/after a successful merge. Trigger a brief goal-panel sparkle only on a new completion, not on selection, initial render, Undo, Retry or navigation. Victory uses one short celebration. Keep effects separate from reducer rules. Independent character nod/wave animation cannot be obtained from this flattened image; separate transparent character artwork is a later asset task. Do not animate the whole background to imitate a character reaction.

All motion should respect `prefers-reduced-motion`: preserve immediate static status/goal feedback without travel, bounce or flashing. Tests should cover event transitions/cancellation, 3/5 output semantics and immediate subsequent input. Playwright should check real taps/drags, panning during effects, Undo/Retry interruption, reduced-motion, and the existing phone/iPad sizes. Chromium checks do not verify physical Safari performance.

Existing effects inspected: consumed-piece shrink, upgraded-cell pulse, 3/5 merge badge, sparks and win banner/goal celebration already exist. Later animation work should reuse these and add merge travel, a clearer five-piece flourish and brief goal/win reactions without blocking input; respect reduced-motion and Undo/Retry/session changes.

## Prompt

Use case: illustration-story. ONE draft background for active gameplay in Elkchemy, wide landscape 16:9. Reference 1 establishes the golden elk's appearance and woodland painting style; reference 2 is the canonical approved Alisha character, preserve her illustrated HUMAN face, blue eyes, dark glasses, brown updo, elk ears and leafy antlers, brown/cream longer skort outfit, hiking gear and disc bag. Scene: a calm magical woodland clearing with layered emerald trees, distant stream, softly glowing cyan rune stones, a few tiny musical golden fireflies. Rich detailed scenery around the far edges, but CENTRAL 75% is quiet soft dark moss/forest haze, low contrast and uncluttered, to sit BEHIND an opaque puzzle board and real UI. No board or UI drawn. Put both characters together SMALL at the far lower-right edge, within rightmost 18% of image width, a warm encouraging cameo rather than main subjects: full four-legged golden elk smiling with ears perked; adult Alisha smiling and lifting one hand in a friendly encouraging wave, natural anatomy, canonical petite proportions and human face. Both complete with antlers visible, not cropped, comfortably inside margin; roughly 25% image height. They should look toward the quiet center as if encouraging the player. Keep characters and bright accents out of the central board area. Soft woodland dusk lit with warm gold edges, painterly storybook fantasy matching prior scenes, tasteful subtle sci-fi celestial/rune details, not spooky. No text, labels, title, buttons, panels, grid, symbols resembling UI, border, or watermark. This is one draft for review, not a mockup.
