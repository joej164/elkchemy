# The Attic comic artwork — revised review

Current review: October 20, 2026. The owner named the elk **Fiona**, addressed by Alisha’s granddaughter as **Aunt Fiona**, and specified that Fiona is **not in the attic**. This supersedes the earlier cast direction below. Her absence has no established explanation.

Six revised illustrations replace the animal elk with a proposed granddaughter (brown braid, sage sweater). Background helpers remain unnamed. Alisha retains her own elk ears/antlers, glasses and cardigan. The granddaughter’s design is provisional; no real-relative likeness was supplied. Fiona remains in the existing photo and woodland memory. The slipping photo now shows its plain back for continuity.

Review `storyboard.html` for all eight panels with revised dialogue and the app-flow preview; `review.html` for full-resolution art links. New captures: `contact-sheet-v2.png`, `storyboard-overview-v2.png`, `app-preview-opening-v2.png`. Exact prompts and generated source locations are in `revision-prompts-v2.json`; checksums are in `manifest-v2.json`. Earlier art and captures are preserved.

The revised dialogue gives the questions to the granddaughter, introduces Aunt Fiona in the photo, and has Alisha invite her granddaughter beside her before beginning the story. These are review artifacts only: no app source, integration, commit or deployment. Once approved, Claude can integrate optimized images and the agreed captions.

Visual review: Fiona is absent from all six new attic images, the granddaughter’s braid/sweater are consistent, and the loose photo is face down. Alisha’s apparent age and small ornament details still vary slightly between illustrations and remain review considerations.

Browser verification for this revision: all eight images loaded; opening → puzzle summary → closing → restart worked in Chromium. No page errors or horizontal overflow at 820×1180, 1180×820, 390×844 and 844×390. This checks the local review page, not gameplay or physical iPad/Safari. Canonical Alisha reference checksum remains unchanged; `git diff --check` passes.

**Integrated, October 20, 2026 (owner-approved; not committed or deployed).** The six approved illustrations (`manifest-v2.json`) and the storyboard captions, verbatim, now drive the game's Attic comics (`src/ui/atticStory.tsx`); closing-3 and closing-4 reuse `public/icons/icon-512.png` and the woodland home art. Delivery copies are `src/assets/art/attic-*.webp`, 960 × 720 (method and sizes in `src/assets/art/README.md`). The review pages, contact sheets and every source and earlier draft here are unchanged and not shipped. Integration checks: `docs/release-notes.md`, Unreleased.

**Revised, October 20, 2026 (unreleased, not committed).** `storyboard.html` follows the game's revision: the closing-1 narration now reads "Two more books were tucked inside the old box. Together with the book they’d found, they became the Big Memory Book." (one old book on the floor, two in the box), descriptions name the Big Memory Book, and Try app flow shows one picture and one line at a time. No illustration was regenerated or changed; none shows the box's contents. Details: `docs/release-notes.md`, Unreleased.

**Revised again, October 21, 2026 (unreleased, not committed).** The puzzle now ends with the Picture Book: a photo collection and a blank book, assembled from two chains, combined, then tapped open. `storyboard.html`'s closing-1 narration reads "The photos they’d collected and the book they’d put together became the Picture Book.", descriptions name the Picture Book, and the puzzle summary describes both chains. No illustration was regenerated or changed: closing-1 and closing-2 show a single book, which fits. The opening animation's page photographs are code-native SVG in the game (`src/ui/ItemArt.tsx`), not new art files.

**Correction, October 21, 2026 (unreleased).** The tier-3 photo item is now Scrapbook pages (was Photo collection), drawn as loose sheets so it no longer looks like a book; `storyboard.html`'s puzzle summary uses the new name. Comic text and art are unchanged.

## Earlier review history
# The Attic comic artwork

Stage 2 review drafts, October 20, 2026. Generated with the built-in imagegen tool; no CLI fallback or external credentials. The owner approved `opening-2-draft-v2.png` as the visual direction (older Alisha and older elk, helpers facing away without fixed identities). The five additional illustrations below await owner review. Nothing is integrated, committed or deployed.

- `opening-2-draft-v1.png`: one 4:3 illustration for panel `opening-2`, older Alisha holding loose photos while family/friends carry boxes in the attic. Actual age impression and character likeness require owner review.
- Reference 1 (identity): `../../characters/alisha-elk-approved-reference-v1.png`.
- Reference 2 (painting style/palette): `../../gameplay/woodland-cheering-landscape-v1.png`.
- Canonical reference remains unchanged: SHA-256 `365002398195fb49b6ad2080cd995b3784f56b002c6a16a73bc0759436d84404`.
- No application assets or source code changed. Dialogue stays in HTML. This image contains no requested text.

## Generation prompt

Use case: illustration-story. Generate ONE new 4:3 landscape storybook comic illustration for Elkchemy, panel opening-2, NOT a character sheet. Reference image 1 is the canonical Alisha character identity; reference image 2 supplies accepted painterly storybook rendering and palette only. Preserve Alisha's recognizable HUMAN face, blue eyes, black rectangular glasses, curly brown updo, elk ears and small leafy antlers, but portray her as a warm older woman in her sixties: visible gentle smile lines and silver streaks in her curls, still lively and recognizable. Cozy brown-and-cream cardigan echoing her antler-motif outfit. She is centre-left, mid-shot, smiling fondly while holding a handful of loose photographic prints. Two or three family/friend adults of varied ages carry plain cardboard storage boxes at the sides and behind her; nonspecific faces, no intentional likenesses of real relatives. Cozy attic storage room with sloped wooden roof beams, a small round window with rain on glass, stored furniture, stacked plain cardboard boxes and photo albums, hanging warm bulb. Soft rainy afternoon window light mixed with warm golden lamplight. Gentle affection, curiosity and a sense of family history, not sorrow. Warm richly painted storybook illustration consistent with reference 2, readable clean silhouettes; face and photos must remain clear when panel displays at only 170 to 380 pixels wide. Uncluttered central subjects, safe margins around faces and antlers. Only ordinary cardboard boxes: special carved box appears in a later panel, do not show it here. No text, captions, speech bubbles, lettering, logos, watermark, UI, borders, panels within the image. Output exactly one single scene in landscape 4:3. This is the first style/older-character approval draft, not final approved art.

## Review set and panel mapping

| Panel ID | Source | Status |
| --- | --- | --- |
| opening-1 | `opening-1-draft-v1.png` | New establishing-shot draft |
| opening-2 | `opening-2-draft-v2.png` | Owner-approved visual direction |
| opening-3 | `opening-3-draft-v1.png` | New covered-box draft |
| opening-4 | `opening-4-draft-v1.png` | New sorting-photos draft |
| closing-1 | `closing-1-draft-v1.png` | New memory-book draft |
| closing-2 | `closing-2-draft-v1.png` | New open-book/photo draft |
| closing-3 | Existing `public/icons/icon-512.png` | Reuse; no new generation |
| closing-4 | Existing `artwork/home/woodland-home-landscape-v1.png` | Reuse; game supplies memory tint |

- `contact-sheet-v1.png`: labelled full-sequence review sheet, assembled from the separate illustrations with HTML/browser rendering, not a generated montage.
- `review.html`: responsive review page with full-resolution links; it is artwork documentation, not a shipped app page.
- `remaining-panels-prompts.json`: exact five built-in prompts and common approved reference.
- `manifest.json`: image dimensions and SHA-256 checksums.

Inspected all generated outputs and the contact sheet. The five drafts maintain the main cardigan/glasses/elk/attic motifs. They are not exact scene replicas: framing, furniture positions, leaf/antler details and book ornament vary. Opening-4 clips some upper antler tips. Generated book spines contain small decorative marks despite the no-lettering prompt. The slipping photograph in closing-2 shows woodland scenery, while closing-3 is the established elk photo; owner should review whether to make the slipping photo face-down or match it before integration. These are draft review items, not approved continuity decisions.

Supporting helpers remain background back views; they do not establish named cast members or real relatives' likenesses. New book art follows the burgundy/gold direction, but requires comparison to the SVG game item during owner review.

## Next stage

### Caption/storyboard review

`storyboard.html` is a self-contained local review page: all eight images with proposed captions, plus a tap-through app-style comic preview and an explicitly non-playable puzzle interlude. It uses only relative local asset paths and can be opened directly from disk. `storyboard-overview-v1.png` captures the full story; `app-preview-opening-v1.png` captures the opening at iPad portrait size. Captions in this page are proposals, not approved changes to `src/ui/atticStory.tsx`. They keep helper voices as “Someone” and refer to the elk photograph as an old photograph while the older elk is present.

Browser checked the opening, puzzle interlude, closing, restart and image loads. No console errors or horizontal overflow at 820×1180, 1180×820, 390×844 and 844×390. This review rendering approximates the app's panel flow; it does not implement or exercise gameplay. The existing slipping-photo continuity issue remains explicitly noted.

Get owner approval or requested corrections on the contact sheet. Then prepare a bounded Claude handoff to create optimized delivery copies and replace the approved panel placeholders, preserving all dialogue and comic behavior. Do not integrate unapproved illustrations. Existing canonical reference and title-screen art remain unchanged.
