# Elkchemy music: clarinet and ukulele arrangements

Playable arrangements of the two game loops for **B♭ clarinet** and **ukulele**. They are arrangements, not transcriptions of the recordings: the game audio (`public/audio/*.wav`) uses a synthesized clarinet-like lead, plucked accompaniment, and bass, rendered by `artwork/music/render.py`. The audio is unchanged.

| Song | Concert key | Tempo | Clarinet (written) | Files |
| --- | --- | --- | --- | --- |
| Woodland Stroll | D major | ♩ = 76 | E major | `woodland-stroll-clarinet.svg`, `woodland-stroll-ukulele.svg`, `woodland-stroll.musicxml` |
| Curious Clearing | G major | ♩ = 92 | A major | `curious-clearing-clarinet.svg`, `curious-clearing-ukulele.svg`, `curious-clearing.musicxml` |

Each song has two one-page parts, B♭ clarinet and ukulele (chord symbols, notation, and TAB), four bars per line. Both are eight-bar loops in 4/4 with repeat signs at bars 1 and 8, a metronome mark, and every bar numbered. The MusicXML holds both parts together (the optional combined score, for notation apps). The game's Music / Scores page (home screen) shows each part with "Open … part to print" and "Download … part (SVG)" links, plus the MusicXML.

## Generated files

The MusicXML (editable in notation software) and SVG (engraved for the browser and printing) are **generated**. Do not edit them by hand; change the source and regenerate from the repository root:

```bash
npm run music:scores
```

- Melody, tempo, and loop length come from `artwork/music/score.json`, the exact score of the recordings.
- Arrangement choices (ukulele chord symbols, fret shapes, strum pattern) are in `ARRANGEMENTS` in `artwork/music/scores.mjs`.
- `scores.mjs` writes `<id>.musicxml` (both parts), then engraves `<id>-clarinet.svg` and `<id>-ukulele.svg` from single-part MusicXML built the same way, with [Verovio](https://www.verovio.org/) 6.3.0 (a dev dependency, LGPL-3.0; not shipped in the app). Output is deterministic: rerunning produces identical files.
- Verovio ignores MusicXML credit font sizes, so the script sizes the title lines in Verovio's MEI before engraving. Nothing else is post-processed.

To add a song: add its loop to `score.json` (and audio, if wanted), add an entry to `ARRANGEMENTS`, run `npm run music:scores`, and add the song to `SONGS` in `src/ui/Scores.tsx`.

## Clarinet part

The melody is exactly the recording's lead line (every pitch, start, and length), written for B♭ clarinet a major second above concert pitch, with the key signature transposed too (D → E major, G → A major). The MusicXML records the transposition, so notation software can show it at concert pitch. Syncopated notes that cross a beat are written as tied notes (for example an eighth tied to a sixteenth) so each beat stays visible; rests fill the gaps. Written ranges: D♯4–D♯5 (Woodland Stroll) and E4–E5 (Curious Clearing), crossing the break.

## Ukulele part

Standard G–C–E–A (re-entrant) tuning, at concert pitch: chord symbols above a notation staff, with a TAB staff below showing the string and fret of every note (top line = A string). It is not transposed with the clarinet. All shapes are first-position and one note per string.

The recordings' extended chords are simplified to four-note seventh chords (ninths dropped; slash basses dropped, since the ukulele has no low bass string; the recording's separate bass line is not included):

| Bar | Woodland Stroll (recording → ukulele) | Frets G C E A | Curious Clearing (recording → ukulele) | Frets G C E A |
| --- | --- | --- | --- | --- |
| 1 | Dmaj9 → Dmaj7 | 2 2 2 4 | Gmaj9 → Gmaj7 | 0 2 2 2 |
| 2 | Bm9 → Bm7 | 2 2 2 2 | Em9 → Em7 | 0 2 0 2 |
| 3 | Gmaj9 → Gmaj7 | 0 2 2 2 | Cmaj9 → Cmaj7 | 0 0 0 2 |
| 4 | A7sus4 → A7sus4 | 0 2 0 0 | D9 → D7 | 2 2 2 3 |
| 5 | Dmaj9/F♯ → Dmaj7 | 2 2 2 4 | Gmaj7/B → Gmaj7 | 0 2 2 2 |
| 6 | Bm7 → Bm7 | 2 2 2 2 | Em7 → Em7 | 0 2 0 2 |
| 7 | Em9 → Em7 | 0 2 0 2 | Am9 → Am7 | 0 0 0 0 |
| 8 | A7 → A7 | 0 1 0 0 | D7 → D7 | 2 2 2 3 |

Rhythm: the recordings pluck a quiet arpeggio; the ukulele strums instead. Woodland Stroll: a gentle down-strum on each beat. Curious Clearing: down, down-up, down, down-up (quarter, two eighths, quarter, two eighths).

## Verification

`tests/musicScores.test.ts` reads the committed MusicXML with its own parser and checks, for both songs: the clarinet melody against every `score.json` lead event at concert pitch (ties merged); the written key signature and transposition; every bar filling 4/4 on every staff; tempo and repeat marks; each ukulele chord symbol against the simplified recording harmony and each strum's notes against that chord's four tones; TAB strings and frets against G–C–E–A tuning and the notation staff; the arrangement labels; and that each SVG is one Verovio page with eight bars. Deliberately corrupting a melody pitch or a chord root makes the tests fail.

Printing was checked in Chromium by generating real print PDFs at A4 and Letter with 0.4-inch margins: each part opened on its own prints as exactly one page, scaled to the page width (staff about 6.5 mm) and centred vertically; printing the Music / Scores page gives exactly four pages, one complete part per page, with no clipping and no blank pages. Those PDFs were rendered and inspected. Safari and physical iPad printing are unverified, and the arrangements have not yet been played on real instruments.
