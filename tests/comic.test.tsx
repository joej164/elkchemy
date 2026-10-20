import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Comic, comicButtonLabels, nextShown } from '../src/ui/Comic';
import { CLOSING_PANELS, OPENING_PANELS } from '../src/ui/atticStory';

const noop = () => {};
const render = (panels = OPENING_PANELS, secondary?: { label: string; onClick: () => void }) => renderToStaticMarkup(
  <Comic title="The Attic" label="Opening" panels={panels} finishLabel="Start tidying" onFinish={noop}
    secondary={secondary} onHome={noop} musicControl={null} />,
);
const markup = (panels: typeof OPENING_PANELS) => renderToStaticMarkup(<>{panels.map((p) => <div key={p.id}>{p.art}</div>)}</>);

describe('nextShown', () => {
  it('advances by one and clamps at the total', () => {
    expect(nextShown(1, 4)).toBe(2);
    expect(nextShown(3, 4)).toBe(4);
    expect(nextShown(4, 4)).toBe(4);
  });
});

describe('comicButtonLabels', () => {
  it('counts the next panel, then switches to the finish label', () => {
    expect(comicButtonLabels(1, 4, 'Go')).toEqual({ text: 'Next', name: 'Next panel, 2 of 4' });
    expect(comicButtonLabels(4, 4, 'Go')).toEqual({ text: 'Go', name: 'Go' });
  });
});

describe('Comic', () => {
  it('starts with one panel, empty frames, a Next button and Home', () => {
    const html = render();
    expect(html.match(/data-panel="/g)).toHaveLength(1);
    expect(html).toContain('data-panel="opening-1"');
    expect(html.match(/comic-empty/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Next panel, 2 of 4"');
    expect(html).toContain('aria-label="The Attic: Opening"');
    expect(html).toContain('data-action="home"');
    expect(html).not.toContain('data-action="comic-secondary"');
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
  it('uses the approved dialogue (artwork/story/attic/storyboard.html), panel by panel', () => {
    const lines = (p: (typeof all)[number]) => p.lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text));
    expect(Object.fromEntries(all.map((p) => [p.id, lines(p)]))).toEqual({
      'opening-1': ['On a rainy afternoon, Alisha’s granddaughter helps her tidy the attic.'],
      'opening-2': ['Granddaughter: Grandma, where did all these photos come from?',
        'Alisha: A lifetime of adventures! Let’s sort them as we go.'],
      'opening-3': ['Granddaughter: What’s under that old sheet?',
        'Alisha: I’d almost forgotten that box. Let’s clear a little space.'],
      'opening-4': ['Alisha: Loose photos first. Three make a tidy bundle.'],
      'closing-1': ['Inside the old box were three books. Together, they became the memory book.',
        'Her granddaughter settles beside her.'],
      'closing-2': ['Granddaughter: Look—a photo slipped out!'],
      'closing-3': ['Granddaughter: Grandma, is that Aunt Fiona?', 'Alisha: Yes. That photograph was taken a long time ago.'],
      'closing-4': ['Granddaughter: Will you tell me about it?', 'Alisha: Come sit beside me. I’ll start at the beginning.',
        'Alisha’s story begins.'],
    });
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
