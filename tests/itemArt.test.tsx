import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItemArt, itemLabel } from '../src/ui/ItemArt';
import type { Family, Item, Tier } from '../src/board';

const families: Family[] = ['grove', 'song', 'crystal', 'elk'];
const tiers: Tier[] = [0, 1, 2, 3];
const all: Item[] = families.flatMap((family) => tiers.map((tier) => ({ family, tier })));
const html = (item: Item, className?: string) => renderToStaticMarkup(<ItemArt item={item} className={className} />);

describe('itemLabel', () => {
  it('uses 1-based tiers and display names', () => {
    expect(itemLabel({ family: 'grove', tier: 0 })).toBe('Grove, tier 1 of 4');
    expect(itemLabel({ family: 'song', tier: 1 })).toBe('Song, tier 2 of 4');
    expect(itemLabel({ family: 'crystal', tier: 2 })).toBe('Crystal, tier 3 of 4');
    expect(itemLabel({ family: 'elk', tier: 3 })).toBe('Elk, tier 4 of 4');
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

  it('gives all 16 items distinct markup', () => {
    expect(new Set(all.map((i) => html(i))).size).toBe(16);
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
