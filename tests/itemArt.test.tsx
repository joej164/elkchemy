import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItemArt, itemLabel, PrizeArt } from '../src/ui/ItemArt';
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
