import { describe, expect, it } from 'vitest';
import scoreJson from '../artwork/music/score.json';

// Checks the committed arrangements in docs/music against artwork/music/score.json with a small
// MusicXML reader of its own, independent of the generator (artwork/music/scores.mjs).

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const;
const LETTERS = 'CDEFGAB';
const UKULELE = { 4: 67, 3: 60, 2: 64, 1: 69 } as Record<number, number>; // string number -> open pitch (G C E A)
const DIVISIONS = 4;
const FILES = import.meta.glob<string>('../docs/music/*.{musicxml,svg}', { query: '?raw', import: 'default', eager: true });
const file = (name: string) => FILES[`../docs/music/${name}`] ?? '';

interface Note {
  rest: boolean; chord: boolean; step: string; alter: number; octave: number; midi: number;
  duration: number; tieStart: boolean; tieStop: boolean; staff: number; string?: number; fret?: number;
}

const tag = (xml: string, name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];

function readPart(xml: string, id: string) {
  const part = new RegExp(`<part id="${id}">([\\s\\S]*?)</part>`).exec(xml)![1];
  return [...part.matchAll(/<measure number="(\d+)">([\s\S]*?)<\/measure>/g)].map(([, number, body]) => ({
    number: Number(number), body,
    notes: [...body.matchAll(/<note>([\s\S]*?)<\/note>/g)].map(([, n]): Note => {
      const step = tag(n, 'step') ?? '';
      const alter = Number(tag(n, 'alter') ?? 0);
      const octave = Number(tag(n, 'octave') ?? 0);
      return {
        rest: n.includes('<rest'), chord: n.includes('<chord/>'), step, alter, octave,
        midi: 12 * (octave + 1) + (STEP[step as keyof typeof STEP] ?? 0) + alter,
        duration: Number(tag(n, 'duration')), tieStart: n.includes('<tie type="start"/>'), tieStop: n.includes('<tie type="stop"/>'),
        staff: Number(tag(n, 'staff') ?? 1),
        string: tag(n, 'string') ? Number(tag(n, 'string')) : undefined, fret: tag(n, 'fret') ? Number(tag(n, 'fret')) : undefined,
      };
    }),
  }));
}

/** Simplified chord kind for each original harmony name (extensions and slash basses dropped). */
function expectedSymbol(original: string): string {
  const m = /^([A-G]#?)(maj9|maj7|m9|m7|9|7sus4|7)?(\/.*)?$/.exec(original)!;
  const kind = { maj9: 'maj7', maj7: 'maj7', m9: 'm7', m7: 'm7', 9: '7', '7sus4': '7sus4', 7: '7' }[m[2]]!;
  return `${m[1]}${kind}`;
}
const INTERVALS: Record<string, number[]> = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], '7sus4': [0, 5, 7, 10] };

for (const loop of scoreJson.loops) {
  describe(`${loop.name} arrangement`, () => {
    const xml = file(`${loop.name}.musicxml`);
    const parts = { clarinet: file(`${loop.name}-clarinet.svg`), ukulele: file(`${loop.name}-ukulele.svg`) };
    const clarinet = readPart(xml, 'P1');
    const ukulele = readPart(xml, 'P2');
    const concertFifths = { 'woodland-stroll': 2, 'curious-clearing': 1 }[loop.name]!;

    it('is an eight-bar 4/4 loop with tempo, repeats and full bars in every staff', () => {
      for (const part of [clarinet, ukulele]) {
        expect(part.map((m) => m.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(part[0].body).toContain('<repeat direction="forward"/>');
        expect(part[7].body).toContain('<repeat direction="backward"/>');
        for (const m of part) {
          for (const staff of new Set(m.notes.map((n) => n.staff))) {
            const total = m.notes.filter((n) => n.staff === staff && !n.chord).reduce((sum, n) => sum + n.duration, 0);
            expect(total, `bar ${m.number} staff ${staff}`).toBe(4 * DIVISIONS);
          }
        }
      }
      expect(xml).toContain('<beats>4</beats><beat-type>4</beat-type>');
      expect(xml).toContain(`<per-minute>${loop.bpm}</per-minute>`);
      expect(xml).toContain(`<sound tempo="${loop.bpm}"/>`);
    });

    it('clarinet melody matches score.json exactly at concert pitch (ties merged)', () => {
      const events: number[][] = [];
      let open: number[] | null = null;
      clarinet.forEach((m, b) => {
        let at = b * 4;
        for (const n of m.notes) {
          if (!n.rest) {
            const concert = n.midi - 2;
            if (n.tieStop) {
              expect(open, `tie into bar ${m.number}`).not.toBeNull();
              expect(open![2]).toBe(concert);
              open![1] += n.duration / DIVISIONS;
            } else {
              open = [at, n.duration / DIVISIONS, concert];
              events.push(open);
            }
            if (!n.tieStart) open = null;
          }
          at += n.duration / DIVISIONS;
        }
      });
      expect(events).toEqual(loop.lead.map(([beat, duration, midi]) => [beat, duration, midi]));
    });

    it('clarinet is written a major second up, in its own key signature', () => {
      expect(clarinet[0].body).toContain(`<key><fifths>${concertFifths + 2}</fifths></key>`);
      expect(clarinet[0].body).toContain('<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>');
      expect(xml).toContain('<part-name>Clarinet in B♭</part-name>');
      // Each written note is spelled one letter above its concert pitch's diatonic spelling in the key.
      for (const m of clarinet) for (const n of m.notes.filter((x) => !x.rest)) {
        const concertPc = (n.midi - 2 + 120) % 12;
        const letterBelow = LETTERS[(LETTERS.indexOf(n.step) + 6) % 7];
        expect(Math.abs(((concertPc - STEP[letterBelow as keyof typeof STEP] + 18) % 12) - 6), `${n.step}${n.octave}`).toBeLessThanOrEqual(1);
      }
    });

    it('ukulele is at concert pitch, with simplified concert chord symbols matching the recording harmony', () => {
      expect(ukulele[0].body).toContain(`<key><fifths>${concertFifths}</fifths></key>`);
      expect(ukulele[0].body).not.toContain('<transpose>');
      ukulele.forEach((m, b) => {
        const root = tag(m.body, 'root-step')! + (tag(m.body, 'root-alter') === '1' ? '#' : '');
        const kind = /<kind text="([^"]+)">/.exec(m.body)![1];
        expect(`${root}${kind}`, `bar ${m.number}`).toBe(expectedSymbol(loop.harmonyNames[b]));
        // Every strummed chord holds exactly the symbol's four chord tones.
        const rootPc = (STEP[tag(m.body, 'root-step') as keyof typeof STEP] + Number(tag(m.body, 'root-alter') ?? 0)) % 12;
        const tones = new Set(INTERVALS[kind].map((i) => (rootPc + i) % 12));
        const staff1 = m.notes.filter((n) => n.staff === 1 && !n.rest);
        for (let i = 0; i < staff1.length; i += 4) {
          const chord = staff1.slice(i, i + 4);
          expect(chord.slice(1).every((n) => n.chord)).toBe(true);
          expect(new Set(chord.map((n) => n.midi % 12))).toEqual(tones);
        }
      });
    });

    it('ukulele TAB is playable in G-C-E-A tuning and matches the notation staff', () => {
      for (const m of ukulele) {
        const notation = m.notes.filter((n) => n.staff === 1 && !n.rest);
        const tab = m.notes.filter((n) => n.staff === 2 && !n.rest);
        expect(tab.map((n) => n.midi)).toEqual(notation.map((n) => n.midi));
        for (let i = 0; i < tab.length; i += 4) {
          const chord = tab.slice(i, i + 4);
          expect(new Set(chord.map((n) => n.string))).toEqual(new Set([1, 2, 3, 4])); // one note per string
          for (const n of chord) {
            expect(n.midi, `bar ${m.number}`).toBe(UKULELE[n.string!] + n.fret!);
            expect(n.fret).toBeGreaterThanOrEqual(0);
            expect(n.fret).toBeLessThanOrEqual(5); // first-position shapes
          }
        }
      }
      expect(xml).toContain('<staff-lines>4</staff-lines>');
    });

    it('is labelled as an arrangement, with each instrument part engraved to its own page-shaped SVG', () => {
      expect(xml).toContain('Arrangement for B♭ clarinet and ukulele');
      expect(xml).toMatch(/synthesized clarinet-like lead, plucked accompaniment, and bass/);
      for (const [part, svg] of Object.entries(parts)) {
        expect(svg, part).toContain('Engraved by Verovio');
        expect(svg.match(/class="measure"/g), part).toHaveLength(8);
        expect(svg.match(/class="system"/g), part).toHaveLength(2); // four bars per line
        expect(svg).toContain('synthesized clarinet-like lead');
        // Wider than tall enough to fit an A4 or Letter page (printable area about 1.3 times taller than wide).
        const [, , w, h] = /viewBox="([^"]+)"/.exec(svg)![1].split(' ').map(Number);
        expect(h / w, part).toBeLessThan(1.2);
      }
      expect(parts.clarinet).toContain('Clarinet in B♭');
      expect(parts.clarinet).not.toContain('Ukulele');
      expect(parts.ukulele).toContain('Ukulele part');
      expect(parts.ukulele).not.toContain('Clarinet in B♭');
      expect(parts.ukulele.match(/class="harm"/g)).toHaveLength(8); // a chord symbol in every bar
      expect(parts.ukulele).toContain('class="tabGrp"');
    });
  });
}
