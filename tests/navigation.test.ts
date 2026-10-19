import { describe, it, expect } from 'vitest';
import { centerScroll, centreSpan, exceedsThreshold, moveFocus, panScroll, revealSpan } from '../src/ui/navigation';

describe('navigation helpers', () => {
  it('moves focus and clamps at the edges', () => {
    expect(moveFocus({ row: 1, col: 1 }, 'ArrowRight', 16, 12)).toEqual({ row: 1, col: 2 });
    expect(moveFocus({ row: 0, col: 0 }, 'ArrowUp', 16, 12)).toEqual({ row: 0, col: 0 });
    expect(moveFocus({ row: 15, col: 11 }, 'ArrowDown', 16, 12)).toEqual({ row: 15, col: 11 });
    expect(moveFocus({ row: 15, col: 11 }, 'ArrowRight', 16, 12)).toEqual({ row: 15, col: 11 });
    expect(moveFocus({ row: 2, col: 2 }, 'a', 4, 4)).toBeNull();
  });

  it('treats movement up to 8px as a tap', () => {
    expect(exceedsThreshold(8, 0)).toBe(false);
    expect(exceedsThreshold(0, -8)).toBe(false);
    expect(exceedsThreshold(6, 6)).toBe(true);
    expect(exceedsThreshold(8.1, 0)).toBe(true);
  });

  it('pans opposite to pointer movement', () => {
    expect(panScroll({ x: 100, y: 50 }, { x: 200, y: 200 }, { x: 170, y: 230 })).toEqual({ x: 130, y: 20 });
  });

  it('centers content, never negative', () => {
    expect(centerScroll(1000, 400)).toBe(300);
    expect(centerScroll(300, 400)).toBe(0);
  });

  it('centres a span within the scroll range', () => {
    expect(centreSpan(500, 600, 400, 1000)).toBe(350);
    expect(centreSpan(0, 100, 400, 1000)).toBe(0);
    expect(centreSpan(1300, 1400, 400, 1000)).toBe(1000);
  });

  it('reveals a span by moving least, keeping a margin, and not at all when it is already in view', () => {
    expect(revealSpan(300, 400, 500, 400, 1000, 8)).toBe(300);       // already in view
    expect(revealSpan(300, 100, 200, 400, 1000, 8)).toBe(92);        // above: its start, 8px clear
    expect(revealSpan(300, 650, 750, 400, 1000, 8)).toBe(358);       // below: its end, 8px clear
    expect(revealSpan(300, 0, 100, 400, 1000, 8)).toBe(0);           // clamped to the range
    expect(revealSpan(300, 100, 600, 400, 1000, 8)).toBe(92);        // too long: its start
  });
});
