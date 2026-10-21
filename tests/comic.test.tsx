import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { beatAnnouncement, Comic, comicBeats, comicView, stepBeat } from '../src/ui/Comic';
import { CLOSING_PANELS, MEMORY_PANEL, memoryMusicOn, OPENING_PANELS } from '../src/ui/atticStory';

const noop = () => {};
const START = { prompt: 'Tap to start tidying.', name: 'Start tidying' };
const LEVELS = { prompt: 'Tap to return to Levels.', name: 'Back to Levels' };
const render = (panels = OPENING_PANELS, finish = START) => renderToStaticMarkup(
  <Comic title="The Attic" label="Opening" panels={panels} finish={finish} onFinish={noop} onHome={noop} musicControl={null} />,
);
const markup = (panels: typeof OPENING_PANELS) => renderToStaticMarkup(<>{panels.map((p) => <div key={p.id}>{p.art}</div>)}</>);

/** Plays taps on the scene (`n`) and Back (`b`) from the first beat: the beats shown, then 'finish' if it finished. */
function walk(panels: typeof OPENING_PANELS, moves: string): (number | 'finish')[] {
  const total = comicBeats(panels).length;
  let beat = 0;
  const shown: (number | 'finish')[] = [0];
  for (const m of moves) {
    const next = stepBeat(beat, total, m === 'n' ? 'next' : 'back');
    shown.push(next);
    if (next === 'finish') break;
    beat = next;
  }
  return shown;
}

describe('comic beats: one line at a time', () => {
  it('lists every line of every picture in order', () => {
    expect(comicBeats(OPENING_PANELS).map((b) => `${OPENING_PANELS[b.panel].id}:${b.line}`)).toEqual([
      'opening-1:0', 'opening-2:0', 'opening-2:1', 'opening-3:0', 'opening-3:1', 'opening-4:0',
    ]);
    expect(comicBeats(CLOSING_PANELS)).toHaveLength(8);
  });

  it('advances a line per tap, onto the next picture after its last line, and Back retraces across pictures', () => {
    const beats = comicBeats(OPENING_PANELS);
    // Forward through opening-2's two lines into opening-3, then back across the boundary to opening-2's last line.
    expect(walk(OPENING_PANELS, 'nnnbbb')).toEqual([0, 1, 2, 3, 2, 1, 0]);
    expect(beats[2]).toEqual({ panel: 1, line: 1 });
    expect(beats[3]).toEqual({ panel: 2, line: 0 });
    // Back stays on the first line; it never finishes or leaves.
    expect(walk(OPENING_PANELS, 'bb')).toEqual([0, 0, 0]);
  });

  it('starts tidying from the last line of the final opening picture, with its prompt, and only then', () => {
    const beats = comicBeats(OPENING_PANELS);
    const last = beats.length - 1;
    expect(walk(OPENING_PANELS, 'nnnnnn')).toEqual([0, 1, 2, 3, 4, 5, 'finish']);
    expect(comicView(beats, last, START)).toEqual({ panel: 3, line: 0, last: true, prompt: 'Tap to start tidying.', name: 'Start tidying' });
    expect(OPENING_PANELS[3].id).toBe('opening-4');
    for (let b = 0; b < last; b++) expect(comicView(beats, b, START)).toMatchObject({ last: false, name: 'Next' });
    // Before that, only the first line says how to move on.
    expect(beats.map((_, b) => comicView(beats, b, START).prompt)).toEqual(['Tap to continue', '', '', '', '', 'Tap to start tidying.']);
  });

  it('ends on the woodland memory with a prompt back to Levels', () => {
    const beats = comicBeats(CLOSING_PANELS);
    expect(comicView(beats, beats.length - 1, LEVELS)).toMatchObject({ panel: MEMORY_PANEL, last: true, prompt: 'Tap to return to Levels.' });
    expect(stepBeat(beats.length - 1, beats.length, 'next')).toBe('finish');
    expect(stepBeat(beats.length - 1, beats.length, 'back')).toBe(beats.length - 2);
  });

  it('brings in Woodland Journey when the woodland memory is first revealed, not before, and keeps it on going back', () => {
    const beats = comicBeats(CLOSING_PANELS);
    let on = false;
    const states: boolean[] = [];
    for (const beat of walk(CLOSING_PANELS, 'nnnnnnnbbbbn')) {
      if (beat === 'finish') break;
      on = memoryMusicOn(on, beats[beat].panel);
      states.push(on);
    }
    // Beats 0–4 are closing-1 to closing-3; beat 5 is the memory's first line.
    expect(beats[5]).toEqual({ panel: MEMORY_PANEL, line: 0 });
    expect(states).toEqual([false, false, false, false, false, true, true, true, true, true, true, true, true]);
    expect(CLOSING_PANELS[MEMORY_PANEL].id).toBe('closing-4');
  });

  it('announces a new picture with its number and description, then the line, and the finish prompt last', () => {
    const beats = comicBeats(OPENING_PANELS);
    expect(beatAnnouncement(OPENING_PANELS, beats[1], true, '')).toBe(
      `Picture 2 of 4. ${OPENING_PANELS[1].description} Granddaughter: Grandma, where did all these photos come from?`);
    expect(beatAnnouncement(OPENING_PANELS, beats[2], false, '')).toBe('Alisha: A lifetime of adventures! Let’s sort them as we go.');
    expect(beatAnnouncement(OPENING_PANELS, beats[5], true, 'Tap to start tidying.')).toBe(
      `Picture 4 of 4. ${OPENING_PANELS[3].description} Alisha: Loose photos first. Three make a tidy bundle. Tap to start tidying.`);
  });
});

describe('Comic', () => {
  it('shows one picture and its first line only, with the whole scene as the button, Back and Home outside it', () => {
    const html = render();
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).toContain('data-panel="opening-1"');
    expect(html).toContain(OPENING_PANELS[0].lines[0].text);
    for (const p of OPENING_PANELS.slice(1)) for (const l of p.lines) expect(html).not.toContain(l.text);
    expect(html).toContain('Tap to continue');
    expect(html).toContain('aria-label="The Attic: Opening"');
    // The scene: one transparent button named Next, described by the picture and its caption; no visible Next button.
    expect(html).toMatch(/<button type="button" class="comic-advance" data-action="comic-next" aria-label="Next" aria-describedby="[^"]+-art [^"]+-caption"><\/button>/);
    expect(html).not.toMatch(/>Next</);
    expect(html).not.toMatch(/data-action="comic-(finish|secondary)"/);
    // Back and Home are separate buttons outside the scene; Back has nowhere to go yet.
    const stage = html.slice(html.indexOf('<section'), html.indexOf('</section>'));
    expect(stage).not.toMatch(/data-action="(home|comic-back)"/);
    expect(html).toContain('data-action="home"');
    expect(html).toMatch(/data-action="comic-back" aria-disabled="true">‹ Back</);
    // No announcement on entry: the focused scene button says it.
    expect(html).toContain('<div role="status" aria-live="polite" class="sr-only"></div>');
  });

  it('keeps every caption as HTML text, the picture as a described image', () => {
    const html = render(CLOSING_PANELS, LEVELS);
    expect(html).toContain(`role="img" aria-label="${CLOSING_PANELS[0].description}"`);
    expect(html).toMatch(/<figcaption[^>]*><p class="comic-narration">Two more books were tucked inside the old box\./);
  });
});

describe('story content', () => {
  const all = [...OPENING_PANELS, ...CLOSING_PANELS];
  it('has four described panels with lines in each comic', () => {
    expect(OPENING_PANELS).toHaveLength(4);
    expect(CLOSING_PANELS).toHaveLength(4);
    for (const p of all) {
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.lines.length).toBeGreaterThan(0);
    }
  });
  it('uses the approved dialogue (artwork/story/attic/storyboard.html), with the closing narration fitting the books', () => {
    const lines = (p: (typeof all)[number]) => p.lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text));
    expect(Object.fromEntries(all.map((p) => [p.id, lines(p)]))).toEqual({
      'opening-1': ['On a rainy afternoon, Alisha’s granddaughter helps her tidy the attic.'],
      'opening-2': ['Granddaughter: Grandma, where did all these photos come from?',
        'Alisha: A lifetime of adventures! Let’s sort them as we go.'],
      'opening-3': ['Granddaughter: What’s under that old sheet?',
        'Alisha: I’d almost forgotten that box. Let’s clear a little space.'],
      'opening-4': ['Alisha: Loose photos first. Three make a tidy bundle.'],
      'closing-1': ['Two more books were tucked inside the old box. Together with the book they’d found, they became the Big Memory Book.',
        'Her granddaughter settles beside her.'],
      'closing-2': ['Granddaughter: Look—a photo slipped out!'],
      'closing-3': ['Granddaughter: Grandma, is that Aunt Fiona?', 'Alisha: Yes. That photograph was taken a long time ago.'],
      'closing-4': ['Granddaughter: Will you tell me about it?', 'Alisha: Come sit beside me. I’ll start at the beginning.',
        'Alisha’s story begins.'],
    });
    // Nothing left of the old inventory (three books in the box) or the old name.
    expect(all.flatMap((p) => [p.description, ...p.lines.map((l) => l.text)]).join(' ')).not.toMatch(/three books|memory book/);
  });
  it('keeps Fiona out of the attic and the helpers unnamed', () => {
    const attic = all.filter((p) => !['closing-3', 'closing-4'].includes(p.id));
    for (const p of attic) {
      expect(p.description).not.toMatch(/Fiona|elk/i);
      expect(p.lines.map((l) => l.text).join(' ')).not.toMatch(/Fiona/);
      expect(p.lines.every((l) => !l.speaker || ['Alisha', 'Granddaughter'].includes(l.speaker))).toBe(true);
    }
    expect(CLOSING_PANELS[2].lines[0].text).toBe('Grandma, is that Aunt Fiona?');
  });
  it('shows the approved artwork, with no placeholders or words in the art', () => {
    const art: Record<string, RegExp> = {
      'opening-1': /attic-opening-1-v2[^"]*\.webp/, 'opening-2': /attic-opening-2-v3[^"]*\.webp/,
      'opening-3': /attic-opening-3-v2[^"]*\.webp/, 'opening-4': /attic-opening-4-v2[^"]*\.webp/,
      'closing-1': /attic-closing-1-v2[^"]*\.webp/, 'closing-2': /attic-closing-2-v2[^"]*\.webp/,
      'closing-3': /\/icons\/icon-512\.png/, 'closing-4': /woodland-home-landscape-v1[^"]*\.webp/,
    };
    for (const p of all) {
      const html = markup([p]);
      expect(html).toMatch(art[p.id]!);
      expect(html.match(/<img /g)).toHaveLength(1);
      expect(html).toContain('alt=""');
    }
    expect(markup(all)).not.toMatch(/data-placeholder|<svg|<text/);
  });
});
