import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookPageArt, ItemArt, itemLabel, PictureBookCoverArt, PrizeArt, ShoeboxArt, KeepsakeBoxArt, DustSheetArt } from '../src/ui/ItemArt';
import { AtticWindowArt, AtticLampArt, StackedBoxesArt, ShelfArt } from '../src/ui/AtticArt';
import type { Family, Item, Tier } from '../src/board';

const families: Family[] = ['grove', 'song', 'crystal', 'elk'];
const tiers: Tier[] = [0, 1, 2, 3, 4];
const all: Item[] = families.flatMap((family) => tiers.map((tier) => ({ family, tier })));
const html = (item: Item, className?: string) => renderToStaticMarkup(<ItemArt item={item} className={className} />);

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
  it.each(all)('renders a safe single svg for $family tier $tier', (item) => {
    const m = html(item);
    expect(m.startsWith('<svg')).toBe(true);
    expect(m.match(/<svg/g)).toHaveLength(1);
    expect(m).toContain('viewBox="0 0 100 100"');
    expect(m).toContain('aria-hidden="true"');
    for (const bad of ['<image', '<text', 'http', 'href=', 'url(']) expect(m).not.toContain(bad);
  });

  it.each(all)('shows tier+1 pips for $family tier $tier', (item) => {
    expect(html(item).match(/data-pip/g)).toHaveLength(item.tier + 1);
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
  const bad = ['<image', '<text', 'http', 'href=', 'url('];

  it('names every photo and book tier, with the last name as fallback', () => {
    const names = (family: Family) => tiers.map((tier) => itemLabel({ family, tier }));
    expect(names('photo')).toEqual([
      'Loose photos, tier 1 of 5', 'Photo bundle, tier 2 of 5', 'Photo collection, tier 3 of 5', 'Photo collection, tier 4 of 5',
      'Photo collection, tier 5 of 5',
    ]);
    // The attic's books: old book → book stack → blank book; the Picture Book (tier 4) is crafted with the photo collection.
    expect(names('book')).toEqual([
      'Old book, tier 1 of 5', 'Book stack, tier 2 of 5', 'Blank book, tier 3 of 5', 'Picture Book, tier 4 of 5', 'Picture Book, tier 5 of 5',
    ]);
  });

  it.each(atticAll)('renders a safe svg with tier+1 pips for $family tier $tier', (item) => {
    const m = html(item);
    expect(m.match(/<svg/g)).toHaveLength(1);
    expect(m).toContain('viewBox="0 0 100 100"');
    expect(m).toContain('aria-hidden="true"');
    for (const b of bad) expect(m).not.toContain(b);
    expect(m.match(/data-pip/g)).toHaveLength(item.tier + 1);
  });

  it('draws the named tiers distinctly', () => {
    expect(new Set([0, 1, 2].map((tier) => html({ family: 'photo', tier: tier as Tier }))).size).toBe(3);
    expect(new Set([0, 1, 2, 3].map((tier) => html({ family: 'book', tier: tier as Tier }))).size).toBe(4);
  });

  it('draws each book tier distinctly, the Picture Book with the cover its opening shows on its own', () => {
    const art = (tier: Tier) => html({ family: 'book', tier }).replace(/<circle[^>]*data-pip[^>]*><\/circle>/g, '');
    expect(art(0)).toContain('#4a7a8a'); // the old book's blue-grey cover
    expect(art(1).match(/<rect[^>]*height="15"/g)).toHaveLength(6); // three spines, each with its page edge
    expect(art(2)).toContain('#3d6b4f'); // the blank book's green cover, an empty photo window on it
    expect(art(3)).toContain('#7a2338');
    const cover = renderToStaticMarkup(<PictureBookCoverArt />);
    expect(cover).toContain('viewBox="16 14 62 62"');
    expect(html({ family: 'book', tier: 3 })).toContain(cover.slice(cover.indexOf('>') + 1, cover.lastIndexOf('</svg>')));
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
    ['AtticWindowArt', <AtticWindowArt />, null],
    ['AtticLampArt', <AtticLampArt />, null],
    ['StackedBoxesArt', <StackedBoxesArt />, null],
    ['ShelfArt', <ShelfArt />, null],
  ];
  it.each(cases)('%s renders one safe decorative svg', (_name, el, attr) => {
    const m = renderToStaticMarkup(el);
    expect(m.match(/<svg/g)).toHaveLength(1);
    expect(m).toContain('aria-hidden="true"');
    expect(m).toContain('focusable="false"');
    if (attr) expect(m).toContain(attr);
    for (const b of ['<image', '<text', 'http', 'href=', 'url(']) expect(m).not.toContain(b);
  });

  it('passes className through on attic props', () => {
    expect(renderToStaticMarkup(<ShelfArt className="x" />)).toContain('class="x"');
  });
});
