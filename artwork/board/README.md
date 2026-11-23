# Board art handoff

The `drafts/` PNGs are the source masters; `webp/` contains 33 delivery candidates for integration. The images are drafts, not yet used by the game. The leafless Fiona is `fiona-chibi-leafless-v1.webp`; the earlier leafy Fiona remains in `drafts/` only.

Each delivery copy was made from its PNG in Chromium canvas, preserving aspect ratio and transparency, with the longest dimension resized to 512 pixels and WebP quality 0.90. No crop was applied. All 33 decoded in Chromium at the expected dimensions and had transparent top-left corners; the subtle glow is intentional. Source PNGs are unchanged.

For each family, the game uses zero-based tiers 0–4. Map the numbered files as follows; the existing tier indicators and maximum-tier effect should remain separate:

| Family | Tier 0 | Tier 1 | Tier 2 | Tiers 3 and 4 |
| --- | --- | --- | --- | --- |
| Grove | `grove-sprout-v1` | `grove-tree-v1` | `grove-full-tree-v1` | `grove-flowering-tree-v1` |
| Song | `song-tier-1-v1` | `song-tier-2-v1` | `song-tier-3-v1` | `song-tier-4-v1` |
| Crystal | `crystal-tier-1-v1` | `crystal-tier-2-v1` | `crystal-tier-3-v1` | `crystal-tier-4-v1` |
| Elk | `elk-tier-1-v1` | `elk-tier-2-v1` | `elk-tier-3-v1` | `elk-tier-4-v1` |
| Wood | `wood-tier-1-v1` | `wood-tier-2-v1` | `wood-tier-3-v1` | `wood-tier-4-v1` |
| Book | `book-tier-1-v1` | `book-tier-2-v1` | `book-tier-3-v1` | `book-tier-4-v1` |
| Tool | `tool-tier-1-v1` | `tool-tier-2-v1` | `tool-tier-3-v1` | `tool-tier-4-v1` |
| Photo | `photo-tier-1-v1` | `photo-tier-2-v1` | `photo-tier-3-v1` | `photo-tier-3-v1` |

Append `.webp` to the names in the table. The photo and maximum-tier reuse matches the current `ItemArt` implementation. Characters use `alisha-chibi-v1.webp` and `fiona-chibi-leafless-v1.webp`.

`size-review.html` and `size-review-enlarged.png` compare source drafts at 64 and 96 CSS pixel tiles with provisional display scaling and tier dots. Bird and elk tiers, particularly the first two elk stages, need checking in the game at actual board size. The fourth elk merge item has leaves on its antlers; the owner requested leaf removal from Fiona's character art, not explicitly from the separate elk item. The existing board backgrounds and the characters' selection, dragging and labels must be checked with the integrated assets. The WebP images have not been visually verified in the game or on a physical iPad.

The two new story images also have 960 × 720 WebP delivery drafts in `artwork/story/chapter-one/delivery-drafts/`, made from the matching PNG drafts with Chromium canvas at quality 0.80. Both decoded at 960 × 720. C1-12A contains three moments in one image; presenting those moments one at a time requires separate presentation work. They remain outside `src/assets/art/` until integration, because the story's asset glob would otherwise load them automatically and the current tests still expect placeholders.

## Forest surroundings — owner liked the direction

`backgrounds/forest-canopy-tile-v1.png` is the source for a candidate woodland terrain texture; `backgrounds/forest-canopy-tile-v1.webp` is its 512 × 512 Chromium-canvas delivery draft (quality 0.90, no crop). Both were generated with the built-in image tool using the existing woodland art as reference. `backgrounds/woodland-border-concept-v1.png` is a fixed composition for visual direction, not a texture for arbitrary map shapes. `forest-review.html` and `forest-review.png` show the canopy around pieces at 64 CSS pixels per cell; this is a mockup, not the game.

The owner liked the forest direction and asked to prepare it for integration. The candidate is visually busy, and seamless repetition is not verified. Check repeats and transitions at actual map sizes before using it. Woodland terrain currently uses `.terrain` and `.path` in `src/ui/app.css`; `.terrain.is-clue` deliberately differs for a hidden link, and palace terrain has its own override. Preserve those gameplay clues, gates, paths, fog and interactions. Check contrast with characters, markers and items in Playwright at iPad portrait and landscape; physical iPad/Safari remains unverified. Do not replace palace walls or change the board's playing cells as an incidental effect.

Review: Chromium decoded the 512 × 512 WebP and loaded every preview item. Opposite texture edges differ (mean RGB difference about 15/255 horizontally and 12/255 vertically), so do not assume seamless tiling. A temporary browser-only overlay on the palace entrance confirmed that restarting the texture in every cell repeats conspicuously; aligning the texture across cells looks better, although the rounded cell gaps remain visible. See `forest-game-aligned-review.png` (portrait) and `forest-game-landscape-review.png` (landscape); the injected overlay is a visual experiment, not integrated code. The old `.is-clue` remains visually mismatched when excluded, so it needs an illustrated treatment that remains discoverable. A browser-driven item move worked under the overlay; gates and characters remained visible. Fog, real touch, physical iPad/Safari and a full playthrough with the eventual integration remain unverified.

Two additional image-generated candidates are `backgrounds/forest-canopy-variation-v1` and `backgrounds/forest-hidden-link-v1` (PNG masters and 512 × 512 WebPs, Chromium quality 0.90). The former has a different tree arrangement; the latter explores a warmer patch for a hidden-link clue. Both decode in Chromium, but neither is proven seamless or interchangeable with its neighbors; their opposite-edge mean RGB differences are approximately 8/255 and 9/255 (variation), and 15/255 and 16/255 (clue). The clue's discoverability at board scale is untested; check it in context rather than relying on color alone. They are candidates for integration, not changes to the game.
