# Background delivery copies

Created from the original PNGs with Chromium 155.0.8059.12 canvas WebP encoding, quality 0.80. Drawing used an sRGB 2D canvas at the source's natural dimensions: no crop, resize, or upscale. The generated ICC profile and extended container were removed with Python's standard-library RIFF handling, preserving the encoded VP8 bitstream without recompression. Final files contain only a VP8 image chunk, with no EXIF, XMP, or ICC metadata. Pixels are sRGB.

| File | Dimensions | Bytes |
| --- | --- | ---: |
| woodland-home-landscape-v1.webp | 1672 × 941 | 304960 |
| woodland-home-portrait-v1.webp | 941 × 1672 | 299552 |
| alisha-elk-play-landscape-v4.webp | 1672 × 941 | 257036 |
| alisha-elk-play-portrait-v1.webp | 941 × 1672 | 280188 |

All four outputs decoded in Chromium and were visually inspected, including dark right/lower areas; no obvious banding or compression artefacts were observed. No project dependencies were added. Layout integration and actual-device review are separate work.

## Source integrity

SHA-256 values matched before and after conversion:

```text
70188610dfa11d3ddb3f1026481e97d6bd0af10771b126bf6cc29c59d5e0b264  artwork/home/woodland-home-landscape-v1.png
8197696045c996be781a99d4398c0d4c7974636ec3beab97acb172d81b40f420  artwork/home/woodland-home-portrait-v1.png
8a80d675ea92073eb71317d36f41a61bb01189b657f6e378f707516444803003  artwork/play/alisha-elk-play-landscape-v4.png
ebfef1e8c59078c6fa971e19dd420121880fa77484b4dcb8ad253c81b9783038  artwork/play/alisha-elk-play-portrait-v1.png
365002398195fb49b6ad2080cd995b3784f56b002c6a16a73bc0759436d84404  artwork/characters/alisha-elk-approved-reference-v1.png
```

Original artwork, approved character reference, and archive files were not modified. Import the WebP files with Vite URL imports for hashed delivery URLs.

## The Attic comic panels

Owner-approved panel art (October 20, 2026), from `artwork/story/attic/` (provenance and prompts: that folder's README). Same method as above, with one difference: each source (1448 × 1086, 4:3) was downscaled to 960 × 720 with Chromium 155 `createImageBitmap` (`resizeQuality: 'high'`) before drawing to the sRGB canvas, since a panel shows at most 457 CSS px wide (12.9-inch iPad portrait), about 914 device pixels at 2×. Aspect ratio kept; no crop. The sources are untagged 8-bit RGB (no ICC), treated as sRGB. Quality 0.80; ICC and extended container stripped to a single VP8 chunk.

| File | Source | Bytes |
| --- | --- | ---: |
| attic-opening-1-v2.webp | opening-1-draft-v2.png | 120068 |
| attic-opening-2-v3.webp | opening-2-draft-v3.png | 102482 |
| attic-opening-3-v2.webp | opening-3-draft-v2.png | 102354 |
| attic-opening-4-v2.webp | opening-4-draft-v2.png | 117890 |
| attic-closing-1-v2.webp | closing-1-draft-v2.png | 126518 |
| attic-closing-2-v2.webp | closing-2-draft-v2.png | 115678 |

All six decoded at 960 × 720 in Chromium and were inspected in the game's comic layout. Closing panels 3 and 4 reuse `public/icons/icon-512.png` and `woodland-home-landscape-v1.webp` unchanged. Source SHA-256 values still match `artwork/story/attic/manifest-v2.json` after conversion; the approved Alisha reference is unchanged (`365002398195fb49b6ad2080cd995b3784f56b002c6a16a73bc0759436d84404`).

## Chapter 1 palace entry panels (drafts)

The palace entrance prototype's entry scene (October 23, 2026), from `artwork/story/chapter-one/` (prompts, status and checksums: `render-manifest.json`; review: `review.html`). Both are drafts awaiting owner review, not approved art. Same method as the Attic panels: each source (1448 × 1086, 4:3, untagged 8-bit RGB, treated as sRGB) was downscaled to 960 × 720 with Chromium 155.0.8059.12 `createImageBitmap` (`resizeQuality: 'high'`), drawn to an sRGB 2D canvas and encoded as WebP at quality 0.80; the VP8X container and ICC chunk were then removed with Python's standard library, leaving a single VP8 chunk (not recompressed). No crop.

| File | Source | Feedback code | Bytes |
| --- | --- | --- | ---: |
| chapter-one-09-palace-entry-v1.webp | 09-palace-entry-draft-v1.png | C1-09 | 164094 |
| chapter-one-10-palace-interior-v1.webp | 10-palace-interior-draft-v1.png | C1-10 | 151968 |
| chapter-one-08-palace-approach-v2.webp | 08-palace-approach-draft-v2.png | C1-08 | 238808 |
| chapter-one-08a-terrace-junction-v2.webp | 08a-terrace-junction-draft-v2.png | C1-08A | 243418 |
| chapter-one-08b-forecourt-revealed-v1.webp | 08b-forecourt-revealed-draft-v1.png | C1-08B | 187260 |

The C1-09 and C1-10 copies decoded at 960 × 720 in Chromium and were inspected in the game's comic layout at four phone and iPad sizes. Source SHA-256 values match `render-manifest.json` before and after conversion (`8c52618a12ccced6584e9a3dc164009925401a9d2b52167b5124e5fe8491e3cb`, `c3eb7993772185d34d8907811d99dffd231c2bc3aa31e2abeacd7601580cc79d`); the sources were not modified.

Level 3 approach panels (October 25, 2026): the C1-08, C1-08A and C1-08B rows above were added from the files the storyboard (`docs/story/chapter-one-review.html`) currently references. Same method (1448 × 1086 sources downscaled to 960 × 720, quality 0.80, single VP8 chunk), encoded with Chromium 155.0.8059.12; all three outputs are 960 × 720. These are drafts awaiting owner review. The C1-09 and C1-10 WebP files are unchanged: the storyboard still references `09-palace-entry-draft-v1.png` and `10-palace-interior-draft-v1.png`, and their SHA-256 values still match the checksums above.

Source SHA-256 values match `render-manifest.json` before and after conversion; the sources were not modified:

```text
7643ecb950f2951f39a9484bd1c569048b4eab7943c45a1f0ef75066a962356b  08-palace-approach-draft-v2.png
1d47aa336cb5ebddca1bf306c8d53e9b3e8fe53443f577d3594d94b3dc4bc07c  08a-terrace-junction-draft-v2.png
449c605b5190ccca4a69bb654c8ecf38b3db8678024d40c104b687503f46281f  08b-forecourt-revealed-draft-v1.png
```

Chapter 1 story scenes (October 28, 2026), for the development preview's Chapter 1 levels (`src/ui/chapterStory.tsx`): one copy of each image the storyboard (`docs/story/chapter-one-review.html`) currently references for C1-01 to C1-07 and C1-11 to C1-22. C1-10A and C1-10B have no copies: their dialogue plays as on-board speech bubbles instead (owner decision, October 28, 2026). Same method as the approach panels: 1448 × 1086 sources downscaled to 960 × 720 with Chromium 155.0.8059.12 `createImageBitmap` (`resizeQuality: 'high'`), drawn to an sRGB 2D canvas, WebP quality 0.80, then reduced to a single VP8 chunk (not recompressed). No crop. All 24 outputs decoded at 960 × 720 in Chromium. These are drafts awaiting owner review, and the ending (C1-12 onward) is itself a storyboard draft.

| File | Source | Feedback code | Bytes |
| --- | --- | --- | ---: |
| chapter-one-01-forest-throw-v2.webp | 01-forest-throw-draft-v2.png | C1-01 | 211110 |
| chapter-one-02-tree-ricochet-v2.webp | 02-tree-ricochet-draft-v2.png | C1-02 | 172586 |
| chapter-one-meeting-disc-antlers-v2.webp | meeting-disc-antlers-draft-v2.png | C1-03 | 200964 |
| chapter-one-04-disc-returned-v1.webp | 04-disc-returned-draft-v1.png | C1-04 | 195234 |
| chapter-one-05-walking-together-v1.webp | 05-walking-together-draft-v1.png | C1-05 | 203856 |
| chapter-one-06a-trail-entry-v1.webp | 06a-trail-entry-draft-v1.png | C1-06A | 234402 |
| chapter-one-06c-second-throw-v2.webp | 06c-second-throw-draft-v2.png | C1-06C | 234230 |
| chapter-one-06-tool-shed-collapse-v3.webp | 06-tool-shed-collapse-draft-v3.png | C1-06 | 258348 |
| chapter-one-06d-tree-shattered-v1.webp | 06d-tree-shattered-draft-v1.png | C1-06D | 280460 |
| chapter-one-06b-hidden-depot-v4.webp | 06b-hidden-depot-draft-v4.png | C1-06B | 269204 |
| chapter-one-07-clearing-tidied-v4.webp | 07-clearing-tidied-draft-v4.png | C1-07 | 255292 |
| chapter-one-11-palace-reunion-v1.webp | 11-palace-reunion-draft-v1.png | C1-11 | 132786 |
| chapter-one-12-message-door-v1.webp | 12-message-door-draft-v1.png | C1-12 | 106994 |
| chapter-one-13-dog-sighting-v2.webp | 13-dog-sighting-draft-v2.png | C1-13 | 119740 |
| chapter-one-14-fiona-follows-v2.webp | 14-fiona-follows-draft-v2.png | C1-14 | 139500 |
| chapter-one-15-grove-arrival-v1.webp | 15-grove-arrival-draft-v1.png | C1-15 | 172762 |
| chapter-one-16-discs-spill-v2.webp | 16-discs-spill-draft-v2.png | C1-16 | 195482 |
| chapter-one-17-gate-awakens-v4.webp | 17-gate-awakens-draft-v4.png | C1-17 | 189648 |
| chapter-one-18-course-reveal-v3.webp | 18-course-reveal-draft-v3.png | C1-18 | 210768 |
| chapter-one-19a-mechanism-trip-v6.webp | 19a-mechanism-trip-draft-v6.png | C1-19A | 204000 |
| chapter-one-19-crossing-v4.webp | 19-crossing-draft-v4.png | C1-19 | 211420 |
| chapter-one-20-gate-closing-v4.webp | 20-gate-closing-draft-v4.png | C1-20 | 215644 |
| chapter-one-21-course-reveal-v3.webp | 21-course-reveal-draft-v3.png | C1-21 | 205442 |
| chapter-one-21-linked-gates-v1.webp | 21-linked-gates-draft-v1.png | C1-22 | 219004 |

Source SHA-256 values match `render-manifest.json` before and after conversion; the sources were not modified:

```text
cc9a75cf1eb4566a45e012f1d32357a733458b61c1ff52a1d7c02f6374d5b9d1  01-forest-throw-draft-v2.png
a9cbd74ab9ffcf5768a3fc9924c140ca68ef1245251901004eecf011fe5d72cb  02-tree-ricochet-draft-v2.png
36aa6e3572e8091469729176efc36c29e9015596b717aa145df98c085e5f09d4  meeting-disc-antlers-draft-v2.png
3793821908a43429df9444982c1dca1ea12d86c6d18915dcd0ca88f4f192be83  04-disc-returned-draft-v1.png
577530bf9337aeff433079d50bc4656872e4d2180115a92b53f176e894bc6e83  05-walking-together-draft-v1.png
3adea50da38657354b4599cea6f887e135954a93aca8b2121cecf08ee9443d3b  06a-trail-entry-draft-v1.png
a4a21a659a2db0646c8bd73c2e5de01e8caef5878440ec8961d1ab72df5e8725  06c-second-throw-draft-v2.png
18a2a045e42fed82ff3d397693c0ec734adc3ab234d633a48e2de5bae0672671  06-tool-shed-collapse-draft-v3.png
0da64b4be3704b7cbbfeb11e43a8a1c54f55228dd14bd06b9c5cedf09425b606  06d-tree-shattered-draft-v1.png
7a8f254454ec0cd997668f3debfbafa2617ddfd79e794a4750bf33637ce3b663  06b-hidden-depot-draft-v4.png
6c85be7099eb54838942af95bbc7880923718f528e1f810f5b19ba3d840d4c8f  07-clearing-tidied-draft-v4.png
3497651d77365eb16f1e205498d4c5819b771e3cb4a34b114d9ebee4c5fb5de4  11-palace-reunion-draft-v1.png
9061747612a2d706e8349b9c5436ae67385555172c4ad529a43f7923c969bb9e  12-message-door-draft-v1.png
600cfb93171c75104db80064c27e815842d604905c5dff4e262701e60987e1a2  13-dog-sighting-draft-v2.png
77201c10274b2760e8a36f3869484250410f03df4eb919d6015600c0e5be44e6  14-fiona-follows-draft-v2.png
b4fda519b49b390024b7bbf92b70a0430e4c94c50086d44fe67ae05debe460c5  15-grove-arrival-draft-v1.png
f35f54ebb2ee90de21df203c134f0278f5e95764e6fdd4794bfd8401979308f7  16-discs-spill-draft-v2.png
eb832a03f3a09624b6eecfa6dffae8e8466eae2bde97ced78d0c709d01b67c6e  17-gate-awakens-draft-v4.png
09c1e2fe5e02d7d7b716f3c1dadf53168dacb90ca5a943ebe08397d81eeaec3a  18-course-reveal-draft-v3.png
9bd9a7f13c6a3b87acbc99dc1b3e306c1e59fad105a2bb7a536ae3c078744fab  19a-mechanism-trip-draft-v6.png
c5303ea2f4ca49ceaedfb44a9225c7eca68655149e37183779117722d56f189c  19-crossing-draft-v4.png
95a4fe2302e4bac5adfe18cf78b6567b2053b0b999f5893751eff2bfa2655f89  20-gate-closing-draft-v4.png
603bd87234f5138350703525dfd531cd8630f7e83eac09a265eb413bb07fb4a7  21-course-reveal-draft-v3.png
ed5627eaacd33b10b44e73b7b2fb01865d7e90a26fb7d2c88a31fbde48dc6601  21-linked-gates-draft-v1.png
```

Added November 22, 2026: the two owner-approved beats' pictures, copied byte for byte from `artwork/story/chapter-one/delivery-drafts/` (made there from the matching PNG drafts in Chromium canvas at WebP quality 0.80, 960 × 720; see `artwork/board/README.md`). C1-12A holds three moments in one picture, revealed one per tap (`moments` in `src/ui/chapterStory.tsx`, cut at its panel gutters, 229 and 467 of 720 px).

| File | Source | Feedback code | Bytes |
| --- | --- | --- | ---: |
| chapter-one-12a-growing-restless-v1.webp | 12a-growing-restless-draft-v1.png | C1-12A | 145040 |
| chapter-one-15a-cookie-call-v1.webp | 15a-cookie-call-draft-v1.png | C1-15A | 185804 |

```text
1c5585e0298805947b4bc81d3b75da7ffcc825784a2eec348cee8eef58d9f765  12a-growing-restless-draft-v1.png
2860121bd9206ca9090a694ff6da5f54bfa04707a1f99269d958f03102b3a3ef  15a-cookie-call-draft-v1.png
```

## Board art (`src/assets/board/`)

The 33 board pictures (merge items by family and tier, Alisha, and Fiona without leaves), copied byte for byte from `artwork/board/webp/` (method, tier mapping and checks: `artwork/board/README.md`; masters in `artwork/board/drafts/`). The leafy Fiona draft is not used. `src/ui/BoardArt.tsx` maps them to items and sprites and crops each family to the union of its pictures' opaque pixels, so tiers keep their relative sizes.
