import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookPageArt, ItemArt, itemLabel, PictureBookCoverArt, PrizeArt, ShoeboxArt, KeepsakeBoxArt, DustSheetArt } from '../src/ui/ItemArt';
import { AtticWindowArt, AtticLampArt, StackedBoxesArt, ShelfArt } from '../src/ui/AtticArt';
import { AlishaArt, DogArt, FionaArt } from '../src/ui/StoryArt';
import type { Family, Item, Tier } from '../src/board';

const families: Family[] = ['grove', 'song', 'crystal', 'elk'];
const tiers: Tier[] = [0, 1, 2, 3, 4];
const all: Item[] = families.flatMap((family) => tiers.map((tier) => ({ family, tier })));
const html = (item: Item, className?: string) => renderToStaticMarkup(<ItemArt item={item} className={className} />);
/** The board picture an item (or sprite) draws: its one <image>, from the app's own bundled board art, and its name. */
const picture = (m: string) => {
  expect(m.match(/<image /g), m).toHaveLength(1);
  expect(m).not.toMatch(/https?:|url\(|<text|<img/);
  const href = m.match(/<image href="([^"]+)"/)![1];
  const name = m.match(/data-art="([^"]+)"/)![1];
  expect(href).toMatch(new RegExp(`/assets/board/${name}\\.webp$`));
  return name;
};
// The tier mapping of artwork/board/README.md: tiers 0–2 the first three pictures, tiers 3 and 4 the fourth (photos: the third).
const numbered = (family: Family, ns: readonly number[]) => ns.map((n) => `${family}-tier-${n}-v1`);
const PICTURES: Record<Family, readonly string[]> = {
  grove: ['grove-sprout-v1', 'grove-tree-v1', 'grove-full-tree-v1', 'grove-flowering-tree-v1', 'grove-flowering-tree-v1'],
  song: numbered('song', [1, 2, 3, 4, 4]), crystal: numbered('crystal', [1, 2, 3, 4, 4]), elk: ['elk-calf-v1', 'elk-young-v1', ...numbered('elk', [3, 4, 4])],
  wood: numbered('wood', [1, 2, 3, 4, 4]), book: numbered('book', [1, 2, 3, 4, 4]), tool: numbered('tool', [1, 2, 3, 4, 4]),
  photo: numbered('photo', [1, 2, 3, 3, 3]),
  planks: Array(5).fill('chest-planks-v1'), hardware: Array(5).fill('chest-hardware-v1'),
};

describe('itemLabel', () => {
  it('uses 1-based tiers and display names', () => {
    expect(itemLabel({ family: 'grove', tier: 0 })).toBe('Grove, tier 1 of 5');
    expect(itemLabel({ family: 'song', tier: 1 })).toBe('Song, tier 2 of 5');
    expect(itemLabel({ family: 'crystal', tier: 2 })).toBe('Crystal, tier 3 of 5');
    expect(itemLabel({ family: 'elk', tier: 3 })).toBe('Elk, tier 4 of 5');
    expect(itemLabel({ family: 'grove', tier: 4 })).toBe('Grove, tier 5 of 5');
  });
});

describe('ItemArt', () => {
  it.each(all)('draws $family tier $tier as its board picture in a decorative 100 × 100 svg', (item) => {
    const m = html(item);
    expect(m).toMatch(/^<svg viewBox="0 0 100 100"[^>]*aria-hidden="true"/);
    expect(picture(m)).toBe(PICTURES[item.family][item.tier]);
  });

  it('maps every family\'s tiers to its board pictures, as artwork/board/README.md lists them', () => {
    const families_: Family[] = ['grove', 'song', 'crystal', 'elk', 'wood', 'tool', 'book', 'photo', 'planks', 'hardware'];
    for (const family of families_) {
      expect(tiers.map((tier) => picture(html({ family, tier }))), family).toEqual(PICTURES[family]);
    }
  });

  it.each(all)('shows tier+1 pips for $family tier $tier', (item) => {
    expect(html(item).match(/data-pip/g)).toHaveLength(item.tier + 1);
  });

  it('draws the chest materials, one picture each, smaller at lower tiers so a merge visibly grows them', () => {
    for (const family of ['planks', 'hardware'] as const) {
      const width = (tier: Tier) => Number(html({ family, tier }).match(/<svg x="[^"]*" y="[^"]*" width="([^"]+)"/)![1]);
      expect(width(0)).toBeLessThan(width(1));
      expect(width(1)).toBeLessThan(width(2));
      expect(width(2)).toBe(width(3));
    }
    expect(itemLabel({ family: 'planks', tier: 2 })).toBe('Planks, tier 3 of 5');
    expect(itemLabel({ family: 'hardware', tier: 2 })).toBe('Chest hardware, tier 3 of 5');
  });

  it('gives all 20 items distinct markup', () => {
    expect(new Set(all.map((i) => html(i))).size).toBe(20);
  });

  it('draws tier 5 as its family\'s tier-4 drawing on a gold radiance, which no lower tier has', () => {
    for (const family of families) {
      const top = html({ family, tier: 4 });
      expect(top).toContain('data-radiance');
      expect(top).toContain(html({ family, tier: 3 }).replace(/^<svg[^>]*>/, '').split('<circle data-pip')[0]);
      for (const tier of [0, 1, 2, 3] as Tier[]) expect(html({ family, tier })).not.toContain('data-radiance');
    }
  });

  it('differs between families at the same tier', () => {
    for (const tier of tiers) {
      expect(new Set(families.map((family) => html({ family, tier }))).size).toBe(4);
    }
  });

  it('passes className through', () => {
    expect(html({ family: 'elk', tier: 0 }, 'my-art')).toContain('class="my-art"');
  });
});

describe('PrizeArt', () => {
  it('draws each treasure closed and open as one safe svg, the backpack by default', () => {
    const art = (prize: 'backpack' | 'clarinet' | 'ukulele' | undefined, open: boolean) => renderToStaticMarkup(<PrizeArt prize={prize} open={open} />);
    expect(art(undefined, false)).toContain('data-backpack="closed"');
    expect(art('backpack', true)).toContain('data-backpack="open"');
    expect(art('clarinet', false)).toContain('data-clarinet="closed"');
    expect(art('clarinet', true)).toContain('data-clarinet="open"');
    expect(art('ukulele', false)).toContain('data-ukulele="closed"');
    expect(art('ukulele', true)).toContain('data-ukulele="open"');
    expect(art('ukulele', false)).not.toMatch(/<circle cx="45"/);           // closed: no sound hole showing
    for (const m of [art('clarinet', false), art('clarinet', true), art('ukulele', false), art('ukulele', true)]) {
      expect(m.match(/<svg/g)).toHaveLength(1);
      expect(m).toContain('aria-hidden="true"');
      for (const bad of ['<image', '<text', 'http', 'href=', 'url(']) expect(m).not.toContain(bad);
    }
  });
});

describe('attic items', () => {
  const atticFamilies: Family[] = ['photo', 'book'];
  const atticAll: Item[] = atticFamilies.flatMap((family) => tiers.map((tier) => ({ family, tier })));

  it('names every photo and book tier, with the last name as fallback', () => {
    const names = (family: Family) => tiers.map((tier) => itemLabel({ family, tier }));
    expect(names('photo')).toEqual([
      'Loose photos, tier 1 of 5', 'Photo bundle, tier 2 of 5', 'Scrapbook pages, tier 3 of 5', 'Scrapbook pages, tier 4 of 5',
      'Scrapbook pages, tier 5 of 5',
    ]);
    // The attic's books: old book → book stack → blank book; the Picture Book (tier 4) is crafted with the scrapbook pages.
    expect(names('book')).toEqual([
      'Old book, tier 1 of 5', 'Book stack, tier 2 of 5', 'Blank book, tier 3 of 5', 'Picture Book, tier 4 of 5', 'Picture Book, tier 5 of 5',
    ]);
  });

  it.each(atticAll)('draws $family tier $tier as its board picture with tier+1 pips', (item) => {
    const m = html(item);
    expect(m).toMatch(/^<svg viewBox="0 0 100 100"[^>]*aria-hidden="true"/);
    expect(picture(m)).toBe(PICTURES[item.family][item.tier]);
    expect(m.match(/data-pip/g)).toHaveLength(item.tier + 1);
  });

  it('draws the named tiers distinctly', () => {
    expect(new Set([0, 1, 2].map((tier) => html({ family: 'photo', tier: tier as Tier }))).size).toBe(3);
    expect(new Set([0, 1, 2, 3].map((tier) => html({ family: 'book', tier: tier as Tier }))).size).toBe(4);
  });

  it('draws the scrapbook pages as photos, unlike any book, and the Picture Book as its opening shows it', () => {
    expect(picture(html({ family: 'photo', tier: 2 }))).toBe('photo-tier-3-v1');
    expect(picture(html({ family: 'book', tier: 2 }))).toBe('book-tier-3-v1');
    // The book opening's cover is the same picture as the Picture Book the player taps (book tier 3, the fourth picture).
    const cover = renderToStaticMarkup(<PictureBookCoverArt />);
    expect(cover).toMatch(/^<svg viewBox="0 0 100 100"[^>]*aria-hidden="true"/);
    expect(picture(cover)).toBe(picture(html({ family: 'book', tier: 3 })));
  });
});

describe('board sprites', () => {
  it('draws Alisha, Fiona (leaves on her antlers) and the dog as their chibi board art, decorative (callers name them)', () => {
    const alisha = renderToStaticMarkup(<AlishaArt />);
    const fiona = renderToStaticMarkup(<FionaArt />);
    const dog = renderToStaticMarkup(<DogArt />);
    for (const m of [alisha, fiona]) expect(m).toMatch(/^<svg viewBox="0 0 100 100" overflow="visible" aria-hidden="true" focusable="false">/);
    // The dog stays inside its box, as it is also the goal's picture beside the objective.
    expect(dog).toMatch(/^<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">/);
    expect([picture(alisha), picture(fiona), picture(dog)]).toEqual(['alisha-chibi-v1', 'fiona-leafy-chibi-v1', 'dog-chibi-v1']);
    expect(renderToStaticMarkup(<PrizeArt prize="dog" open={false} />)).toBe(dog);
    // Standing on the bottom edge of their box.
    for (const m of [alisha, fiona, dog]) expect(m).toContain('preserveAspectRatio="xMidYMax meet"');
  });
});

describe('the Picture Book pages', () => {
  const page = (n: number) => renderToStaticMarkup(<BookPageArt page={n} />);
  it('draws small framed photographs, code-native and hidden: woodland, Fiona and keepsakes', () => {
    const pages = [0, 1, 2, 3, 4, 5, 6].map(page);
    for (const m of pages) {
      expect(m).toMatch(/^<svg viewBox="0 0 100 100"[^>]*aria-hidden="true"/);
      expect(m.match(/viewBox="0 0 100 80"/g)!.length).toBeGreaterThanOrEqual(1); // each print's picture
      for (const b of ['<image', '<text', 'http', 'href=', 'url(']) expect(m).not.toContain(b);
    }
    const all = pages.join('');
    expect(all).toContain('fill="#bfe0f0"'); // a woodland sky
    expect(all).toContain('fill="#f3d9a4"'); // Fiona's meadow, with the elk as drawn on the board
    expect(all).toContain('fill="#d8ccef"'); // keepsakes: a flying disc and music
    expect(new Set(pages).size).toBe(7);
  });
});

describe('container and attic prop art', () => {
  const cases: [string, ReactElement, string | null][] = [
    ['ShoeboxArt', <ShoeboxArt />, 'data-container="shoebox"'],
    ['KeepsakeBoxArt', <KeepsakeBoxArt />, 'data-container="keepsake-box"'],
    ['DustSheetArt', <DustSheetArt />, 'data-container="dust-sheet"'],
  ];
  it.each(cases)('%s renders one safe decorative svg', (_name, el, attr) => {
    const m = renderToStaticMarkup(el);
    expect(m.match(/<svg/g)).toHaveLength(1);
    expect(m).toContain('aria-hidden="true"');
    expect(m).toContain('focusable="false"');
    if (attr) expect(m).toContain(attr);
    for (const b of ['<image', '<text', 'http', 'href=', 'url(']) expect(m).not.toContain(b);
  });

  it.each([
    [<AtticWindowArt />, 'attic-window-v1'], [<AtticLampArt />, 'attic-lamp-v1'],
    [<StackedBoxesArt />, 'attic-boxes-v1'], [<ShelfArt />, 'attic-shelf-v1'],
  ])('renders the painted attic scenery', (element, name) => {
    const markup = renderToStaticMarkup(element);
    expect(markup).toContain(`/${name}.webp`);
    expect(markup).toContain('aria-hidden="true"');
  });

  it('passes className through on attic props', () => {
    expect(renderToStaticMarkup(<ShelfArt className="x" />)).toContain('class="x"');
  });
});
