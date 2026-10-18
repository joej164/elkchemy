import { describe, expect, it } from 'vitest';
import { previewMerge, type Pos } from '../src/board';
import { SANDBOX_LEVEL } from '../src/sandbox/level';
import { applyDrop, placeSupplyRandom, retry, startSession, undo } from '../src/session';
import { evaluateStatus } from '../src/status';

const p = (row: number, col: number): Pos => ({ row, col });
const def = SANDBOX_LEVEL.definition;

describe('navigation sandbox', () => {
  it('is 12 columns by 16 rows and starts playing', () => {
    expect(def.board).toHaveLength(16);
    def.board.forEach((r) => expect(r).toHaveLength(12));
    expect(evaluateStatus(startSession(def))).toBe('playing');
    expect(SANDBOX_LEVEL.name).toMatch(/sandbox/i);
  });

  it('has items in all four quadrants', () => {
    const quadrants = new Set<string>();
    def.board.forEach((r, row) => r.forEach((c, col) => {
      if (c) quadrants.add(`${row < 8 ? 'top' : 'bottom'}-${col < 6 ? 'left' : 'right'}`);
    }));
    expect(quadrants.size).toBe(4);
  });

  it('supports long-distance merges, moves, swaps, supply, undo and retry', () => {
    let s = startSession(def);
    expect(previewMerge(s.board, p(15, 11), p(0, 0))).toHaveLength(3); // corner to corner
    s = applyDrop(s, p(15, 11), p(0, 0));
    expect(s.board[0][0]).toEqual({ family: 'grove', tier: 1 });
    expect(previewMerge(s.board, p(14, 2), p(1, 9))).toHaveLength(5); // bottom-left to top-right
    s = applyDrop(s, p(14, 2), p(1, 9));
    expect(s.board[1][9]).toEqual({ family: 'crystal', tier: 1 });
    s = applyDrop(s, p(4, 2), p(15, 5)); // move
    expect(s.board[15][5]).toEqual({ family: 'song', tier: 1 });
    s = applyDrop(s, p(5, 10), p(12, 3)); // swap
    expect(s.board[12][3]).toEqual({ family: 'elk', tier: 1 });
    expect(s.board[5][10]).toEqual({ family: 'song', tier: 0 });
    expect(evaluateStatus(s)).toBe('playing');

    const before = s;
    s = placeSupplyRandom(s);
    expect(s.supplyIndex).toBe(1);
    expect(undo(s).board).toEqual(before.board);
    expect(retry(s)).toEqual(startSession(def));
  });
});
