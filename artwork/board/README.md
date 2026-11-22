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
