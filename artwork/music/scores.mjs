// Generates the B♭ clarinet and ukulele arrangements of the Elkchemy loops.
//
//   npm run music:scores
//
// Reads the melodies from artwork/music/score.json and the arrangement choices below, writes editable
// MusicXML to docs/music/<id>.musicxml, then engraves docs/music/<id>.svg from that MusicXML with
// Verovio. Both outputs are generated: change score.json or ARRANGEMENTS and rerun rather than editing
// them by hand. The game's audio files are not touched.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'docs', 'music');

// Ukulele frets are listed in string order G C E A (standard re-entrant tuning G4 C4 E4 A4).
// The recordings' extended chords are simplified to four-note shapes in the first position;
// the original harmony names stay in score.json and are listed in docs/music/README.md.
export const UKULELE_TUNING = [67, 60, 64, 69];
export const ARRANGEMENTS = {
  'woodland-stroll': {
    title: 'Woodland Stroll',
    key: 'D major',
    concertFifths: 2,
    strumText: 'Strum gently: down on each beat',
    strum: [[0, 1], [1, 1], [2, 1], [3, 1]],
    chords: [
      ['D', 0, 'maj7', [2, 2, 2, 4]], // Dmaj9
      ['B', 0, 'm7', [2, 2, 2, 2]], // Bm9
      ['G', 0, 'maj7', [0, 2, 2, 2]], // Gmaj9
      ['A', 0, '7sus4', [0, 2, 0, 0]], // A7sus4
      ['D', 0, 'maj7', [2, 2, 2, 4]], // Dmaj9/F#
      ['B', 0, 'm7', [2, 2, 2, 2]], // Bm7
      ['E', 0, 'm7', [0, 2, 0, 2]], // Em9
      ['A', 0, '7', [0, 1, 0, 0]], // A7
    ],
  },
  'curious-clearing': {
    title: 'Curious Clearing',
    key: 'G major',
    concertFifths: 1,
    strumText: 'Strum lightly: down, down-up, down, down-up',
    strum: [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 0.5], [3.5, 0.5]],
    chords: [
      ['G', 0, 'maj7', [0, 2, 2, 2]], // Gmaj9
      ['E', 0, 'm7', [0, 2, 0, 2]], // Em9
      ['C', 0, 'maj7', [0, 0, 0, 2]], // Cmaj9
      ['D', 0, '7', [2, 2, 2, 3]], // D9
      ['G', 0, 'maj7', [0, 2, 2, 2]], // Gmaj7/B
      ['E', 0, 'm7', [0, 2, 0, 2]], // Em7
      ['A', 0, 'm7', [0, 0, 0, 0]], // Am9
      ['D', 0, '7', [2, 2, 2, 3]], // D7
    ],
  },
};

const KINDS = { maj7: 'major-seventh', m7: 'minor-seventh', 7: 'dominant', '7sus4': 'suspended-fourth' };
const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
const DIVISIONS = 4; // per quarter note: a sixteenth is 1
const SYSTEM_BARS = 4; // bars per line: each instrument part fits one printed page
const PAGE_WIDTH = 2100; // Verovio page units; the SVG is PAGE_WIDTH * SCALE / 100 pixels wide
const SCALE = 40;
export const PARTS = { clarinet: 'B♭ clarinet part', ukulele: 'Ukulele part (G–C–E–A), chords and TAB' };
export const RECORDING_NOTE = 'The game recording uses a synthesized clarinet-like lead, plucked accompaniment, and bass; this is an arrangement for real instruments.';
const CREDIT_NOTE = 'Arranged from the game recording (synthesized clarinet-like lead, plucked accompaniment, bass).';
// Header text sizes, applied through Verovio's MEI because it ignores MusicXML credit font sizes.
const HEADER_SIZES = ['180%', '100%', '80%'];
const BEATS_PER_BAR = 4;
const TYPES = { 1: ['16th', 0], 2: ['eighth', 0], 3: ['eighth', 1], 4: ['quarter', 0], 6: ['quarter', 1], 8: ['half', 0], 12: ['half', 1], 16: ['whole', 0] };

/** Sharp spelling (these keys only use sharps). */
function spell(midi) {
  const [step, alter] = SHARP_NAMES[midi % 12];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

/** Written pitch for B♭ clarinet: a major second (one letter, two semitones) above sounding pitch. */
export function clarinetWritten(midi) {
  const s = spell(midi);
  const index = STEPS.indexOf(s.step) + 1;
  const step = STEPS[index % 7];
  const octave = s.octave + (index === 7 ? 1 : 0);
  return { step, alter: midi + 2 - (12 * (octave + 1) + NATURAL[step]), octave };
}

function keyAlters(fifths) {
  const order = fifths >= 0 ? ['F', 'C', 'G', 'D', 'A', 'E', 'B'] : ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  return Object.fromEntries(order.slice(0, Math.abs(fifths)).map((step) => [step, Math.sign(fifths)]));
}

/**
 * Splits a bar's timeline (in sixteenths) into notated pieces: notes and rests are split at every beat,
 * pieces crossing a beat are tied, and whole-beat rests merge into half or whole rests where aligned.
 */
function notate(events, barStart) {
  const bar = BEATS_PER_BAR * DIVISIONS;
  const spans = [];
  let at = 0;
  for (const e of events) {
    const start = Math.round((e.beat - barStart) * DIVISIONS);
    if (start > at) spans.push({ start: at, len: start - at, pitch: null });
    spans.push({ start, len: Math.round(e.duration * DIVISIONS), pitch: e.pitch });
    at = start + Math.round(e.duration * DIVISIONS);
  }
  if (at < bar) spans.push({ start: at, len: bar - at, pitch: null });
  if (at > bar) throw new Error('Event crosses a barline');

  const pieces = [];
  for (const span of spans) {
    let start = span.start;
    const end = span.start + span.len;
    // Notes that start on a beat and fill whole beats stay whole; everything else splits at beats.
    if (span.pitch !== null && start % DIVISIONS === 0 && span.len % DIVISIONS === 0 && TYPES[span.len]) {
      pieces.push({ ...span, tieStart: false, tieStop: false });
      continue;
    }
    while (start < end) {
      const next = Math.min(end, (Math.floor(start / DIVISIONS) + 1) * DIVISIONS);
      pieces.push({ start, len: next - start, pitch: span.pitch, tieStop: start > span.start, tieStart: next < end });
      start = next;
    }
  }
  // Merge whole-beat rests: two aligned quarters make a half; a silent bar is one whole rest.
  const merged = [];
  for (const p of pieces) {
    const last = merged[merged.length - 1];
    if (p.pitch === null && last && last.pitch === null && last.len % DIVISIONS === 0 && p.len === DIVISIONS &&
      p.start % DIVISIONS === 0 && last.start % (2 * DIVISIONS) === 0 && last.len + p.len <= 2 * DIVISIONS) {
      last.len += p.len;
    } else merged.push({ ...p });
  }
  if (merged.length === 2 && merged.every((p) => p.pitch === null && p.len === 2 * DIVISIONS)) {
    return [{ start: 0, len: bar, pitch: null, whole: true }];
  }
  return merged;
}

/** Beam groups: runs of flagged notes within one beat (rests break a run). */
function beams(pieces) {
  const result = pieces.map(() => []);
  let i = 0;
  while (i < pieces.length) {
    const beat = Math.floor(pieces[i].start / DIVISIONS);
    const run = [];
    while (i < pieces.length && Math.floor(pieces[i].start / DIVISIONS) === beat) {
      const p = pieces[i];
      if (p.pitch !== null && p.len < DIVISIONS) run.push(i);
      else if (run.length) { mark(run); run.length = 0; }
      i++;
    }
    if (run.length) mark(run);
  }
  function mark(run) {
    if (run.length < 2) return;
    run.forEach((idx, k) => {
      result[idx].push([1, k === 0 ? 'begin' : k === run.length - 1 ? 'end' : 'continue']);
    });
    // Second beam level for sixteenths.
    run.forEach((idx, k) => {
      if (pieces[idx].len !== 1) return;
      const prev = k > 0 && pieces[run[k - 1]].len === 1;
      const next = k < run.length - 1 && pieces[run[k + 1]].len === 1;
      const kind = prev && next ? 'continue' : prev ? 'end' : next ? 'begin' : k === 0 ? 'forward hook' : 'backward hook';
      result[idx].push([2, kind]);
    });
  }
  return result;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function pitchXml(p) {
  return `<pitch><step>${p.step}</step>${p.alter ? `<alter>${p.alter}</alter>` : ''}<octave>${p.octave}</octave></pitch>`;
}

function accidentalName(alter) {
  return { '-1': 'flat', 0: 'natural', 1: 'sharp' }[alter];
}

/**
 * One part's measures. Each layer is one staff: `pitches(piece, bar)` gives its written pitches (one, or
 * several for a chord), and `technical(index, bar)` optional per-note string/fret markup for tablature.
 */
function partXml(id, bars, firstAttributes, fifths, extraFirst, harmonies, layers) {
  const out = [`<part id="${id}">`];
  const barLength = BEATS_PER_BAR * DIVISIONS;
  bars.forEach((pieces, b) => {
    out.push(`<measure number="${b + 1}">`);
    if (b > 0 && b % SYSTEM_BARS === 0) out.push('<print new-system="yes"/>');
    if (b === 0) out.push('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>', firstAttributes, extraFirst);
    if (harmonies) out.push(harmonies[b]);
    const beamed = beams(pieces);
    layers.forEach((layer, l) => {
      if (l > 0) out.push(`<backup><duration>${barLength}</duration></backup>`);
      const state = { ...keyAlters(fifths) };
      const staff = layers.length > 1 ? `<staff>${layer.staff}</staff>` : '';
      pieces.forEach((p, k) => {
        const [type, dots] = p.whole ? ['whole', 0] : TYPES[p.len];
        if (p.pitch === null) {
          out.push(`<note>${p.whole ? '<rest measure="yes"/>' : '<rest/>'}<duration>${p.len}</duration><voice>${layer.voice}</voice>` +
            `${p.whole ? '' : `<type>${type}</type>${'<dot/>'.repeat(dots)}`}${staff}</note>`);
          return;
        }
        layer.pitches(p, b).forEach((pitch, n) => {
          const key = `${pitch.step}${pitch.octave}`;
          const current = state[key] ?? state[pitch.step] ?? 0;
          const accidental = !layer.tab && !p.tieStop && current !== pitch.alter ? `<accidental>${accidentalName(pitch.alter)}</accidental>` : '';
          state[key] = pitch.alter;
          const ties = `${p.tieStop ? '<tie type="stop"/>' : ''}${p.tieStart ? '<tie type="start"/>' : ''}`;
          const tied = `${p.tieStop ? '<tied type="stop"/>' : ''}${p.tieStart ? '<tied type="start"/>' : ''}`;
          const technical = layer.technical ? `<technical>${layer.technical(n, b)}</technical>` : '';
          const beam = n === 0 ? beamed[k].map(([level, kind]) => `<beam number="${level}">${kind}</beam>`).join('') : '';
          const notations = tied || technical ? `<notations>${tied}${technical}</notations>` : '';
          out.push(`<note>${n > 0 ? '<chord/>' : ''}${pitchXml(pitch)}<duration>${p.len}</duration>${ties}<voice>${layer.voice}</voice>` +
            `<type>${type}</type>${'<dot/>'.repeat(dots)}${accidental}${staff}${beam}${notations}</note>`);
        });
      });
    });
    if (b === bars.length - 1) out.push('<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>');
    out.push('</measure>');
  });
  out.push('</part>');
  return out.join('\n');
}

/** Ukulele chord for bar `b`: notes sorted by pitch, with string (1 = A ... 4 = G) and fret. */
export function ukuleleVoicing(arrangement, b) {
  return arrangement.chords[b][3]
    .map((fret, s) => ({ midi: UKULELE_TUNING[s] + fret, string: 4 - s, fret }))
    .sort((x, y) => x.midi - y.midi);
}

/** MusicXML for the arrangement: both parts (the optional combined score), or one part (`clarinet` or `ukulele`). */
export function buildMusicXml(loop, arrangement, only) {
  const bars = loop.beats / BEATS_PER_BAR;
  if (bars !== 8 || arrangement.chords.length !== bars) throw new Error(`${loop.name}: expected an eight-bar loop`);
  const lead = loop.lead.map(([beat, duration, midi]) => ({ beat, duration, pitch: midi }));
  const melodyBars = Array.from({ length: bars }, (_, b) =>
    notate(lead.filter((e) => e.beat >= b * BEATS_PER_BAR && e.beat < (b + 1) * BEATS_PER_BAR), b * BEATS_PER_BAR));
  const strum = arrangement.strum.map(([beat, duration]) => ({ beat, duration, pitch: 0 }));
  const ukuleleBars = Array.from({ length: bars }, (_, b) => notate(strum.map((e) => ({ ...e, beat: e.beat + b * BEATS_PER_BAR })), b * BEATS_PER_BAR));

  const writtenFifths = arrangement.concertFifths + 2; // up a major second adds two sharps
  const time = `<time><beats>${BEATS_PER_BAR}</beats><beat-type>4</beat-type></time>`;
  const clarinetAttrs = `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${writtenFifths}</fifths></key>${time}` +
    '<clef><sign>G</sign><line>2</line></clef><transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose></attributes>';
  const tuning = UKULELE_TUNING.map((midi, line) => {
    const s = spell(midi);
    return `<staff-tuning line="${line + 1}"><tuning-step>${s.step}</tuning-step><tuning-octave>${s.octave}</tuning-octave></staff-tuning>`;
  }).join('');
  const ukuleleAttrs = `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${arrangement.concertFifths}</fifths></key>${time}<staves>2</staves>` +
    '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>TAB</sign><line>5</line></clef>' +
    `<staff-details number="2"><staff-lines>4</staff-lines>${tuning}</staff-details></attributes>`;
  const tempo = `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${loop.bpm}</per-minute></metronome></direction-type><sound tempo="${loop.bpm}"/></direction>`;
  const strumText = `<direction placement="above"><direction-type><words>${esc(arrangement.strumText)}</words></direction-type><staff>1</staff></direction>`;
  const harmonies = arrangement.chords.map(([step, alter, kind]) =>
    `<harmony><root><root-step>${step}</root-step>${alter ? `<root-alter>${alter}</root-alter>` : ''}</root><kind text="${kind}">${KINDS[kind]}</kind><staff>1</staff></harmony>`);

  const clarinet = partXml('P1', melodyBars, clarinetAttrs, writtenFifths, tempo, null,
    [{ staff: 1, voice: 1, pitches: (p) => [clarinetWritten(p.pitch)] }]);
  const chordPitches = (p, b) => ukuleleVoicing(arrangement, b).map((n) => spell(n.midi));
  const ukulele = partXml('P2', ukuleleBars, ukuleleAttrs, arrangement.concertFifths, tempo + strumText, harmonies, [
    { staff: 1, voice: 1, pitches: chordPitches },
    { staff: 2, voice: 5, tab: true, pitches: chordPitches,
      technical: (n, b) => { const v = ukuleleVoicing(arrangement, b)[n]; return `<string>${v.string}</string><fret>${v.fret}</fret>`; } },
  ]);

  const center = PAGE_WIDTH / 2;
  const credit = (type, y, size, text, justify = 'center', x = center) =>
    `<credit page="1"><credit-type>${type}</credit-type><credit-words default-x="${x}" default-y="${y}" justify="${justify}" valign="top" font-size="${size}">${esc(text)}</credit-words></credit>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
<work><work-title>${esc(arrangement.title)}</work-title></work>
<identification>
<creator type="composer">Elkchemy game music</creator>
<creator type="arranger">Arrangement for B♭ clarinet and ukulele</creator>
<encoding><software>Generated by artwork/music/scores.mjs from artwork/music/score.json</software></encoding>
<miscellaneous><miscellaneous-field name="note">${esc(RECORDING_NOTE)} Concert key ${arrangement.key}; ${loop.bpm} BPM; eight-bar loop.</miscellaneous-field></miscellaneous>
</identification>
${credit('title', 1900, 22, arrangement.title)}
${credit('subtitle', 1850, 12, `${only ? PARTS[only] : 'Arrangement for B♭ clarinet and ukulele'} · concert key ${arrangement.key}`)}
${credit('rights', 1810, 9, CREDIT_NOTE)}
<part-list>
${only === 'ukulele' ? '' : `<score-part id="P1"><part-name>Clarinet in B♭</part-name><part-abbreviation>Cl.</part-abbreviation><score-instrument id="P1-I1"><instrument-name>Clarinet in B♭</instrument-name></score-instrument><midi-instrument id="P1-I1"><midi-program>72</midi-program></midi-instrument></score-part>`}
${only === 'clarinet' ? '' : `<score-part id="P2"><part-name>Ukulele</part-name><part-abbreviation>Uke</part-abbreviation><score-instrument id="P2-I1"><instrument-name>Ukulele</instrument-name></score-instrument><midi-instrument id="P2-I1"><midi-program>25</midi-program></midi-instrument></score-part>`}
</part-list>
${only === 'ukulele' ? '' : clarinet}
${only === 'clarinet' ? '' : ukulele}
</score-partwise>
`;
}

export async function renderSvg(musicXml) {
  const toolkit = new VerovioToolkit(await createVerovioModule());
  toolkit.setOptions({
    pageWidth: PAGE_WIDTH, pageHeight: 6000, adjustPageHeight: true, scale: SCALE, breaks: 'encoded',
    footer: 'none', header: 'auto', mnumInterval: 1, minLastJustification: 0, spacingStaff: 16, xmlIdSeed: 1, svgViewBox: true, svgHtml5: false,
  });
  if (!toolkit.loadData(musicXml)) throw new Error('Verovio could not load the MusicXML');
  // Verovio ignores MusicXML credit font sizes, so size the header lines in its MEI and engrave that.
  let header = 0;
  const mei = toolkit.getMEI().replace(/<pgHead[\s\S]*?<\/pgHead>/, (head) =>
    head.replace(/<rend /g, (tag) => (header < HEADER_SIZES.length ? `<rend fontsize="${HEADER_SIZES[header++]}" ` : tag)));
  if (header !== HEADER_SIZES.length) throw new Error('Unexpected score header');
  if (!toolkit.loadData(mei)) throw new Error('Verovio could not reload its MEI');
  if (toolkit.getPageCount() !== 1) throw new Error(`Expected one page, got ${toolkit.getPageCount()}`);
  return toolkit.renderToSVG(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { loops } = JSON.parse(readFileSync(join(HERE, 'score.json'), 'utf8'));
  mkdirSync(OUT, { recursive: true });
  for (const loop of loops) {
    const arrangement = ARRANGEMENTS[loop.name];
    if (!arrangement) throw new Error(`No arrangement for ${loop.name}`);
    // The combined score is the editable MusicXML; each instrument part is engraved to its own page.
    writeFileSync(join(OUT, `${loop.name}.musicxml`), buildMusicXml(loop, arrangement));
    for (const part of Object.keys(PARTS)) {
      const svg = await renderSvg(buildMusicXml(loop, arrangement, part));
      writeFileSync(join(OUT, `${loop.name}-${part}.svg`), svg);
      console.log(`${loop.name}-${part}.svg: ${svg.length} bytes, ${/viewBox="([^"]+)"/.exec(svg)[1]}`);
    }
  }
}
