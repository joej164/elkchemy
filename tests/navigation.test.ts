import { describe, it, expect } from 'vitest';
import { centerScroll, exceedsThreshold, moveFocus, panScroll } from '../src/ui/navigation';

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
});
