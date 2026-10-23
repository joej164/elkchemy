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

Both decoded at 960 × 720 in Chromium and were inspected in the game's comic layout at four phone and iPad sizes. Source SHA-256 values match `render-manifest.json` before and after conversion (`8c52618a12ccced6584e9a3dc164009925401a9d2b52167b5124e5fe8491e3cb`, `c3eb7993772185d34d8907811d99dffd231c2bc3aa31e2abeacd7601580cc79d`); the sources were not modified.
