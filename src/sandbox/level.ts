import type { Cell, Item } from '../board';
import type { Level } from '../levels';

// Navigation test board, not a finished level. Served only by the dev server at /sandbox.html;
// production builds use index.html alone, so none of this ships.
//
// 12 columns × 16 rows with items in distant areas, for testing panning, long-distance
// moves, merges (3 and 5), swaps, random supply across a large board, undo and retry.
// Goal grove-3 stays reachable (3 grove-0 → 1 grove-1; 3 grove-1 → 1 grove-2; 3 grove-2 →
// grove-3), so the existing evaluator reports 'playing'; 23 items in 192 cells is far
// within its capacity assumption.
const ROWS = 16;
const COLS = 12;

const g0: Item = { family: 'grove', tier: 0 };
const g1: Item = { family: 'grove', tier: 1 };
const g2: Item = { family: 'grove', tier: 2 };
const s0: Item = { family: 'song', tier: 0 };
const s1: Item = { family: 'song', tier: 1 };
const c0: Item = { family: 'crystal', tier: 0 };
const e0: Item = { family: 'elk', tier: 0 };
const e1: Item = { family: 'elk', tier: 1 };

const PLACED: [number, number, Item][] = [
  // Top-left grove pair; its third grove-0 is in the far bottom-right corner.
  [0, 0, g0], [0, 1, g0], [15, 11, g0],
  // Grove-1s in the other two corners, grove-2s near the middle (not touching).
  [0, 11, g1], [15, 0, g1], [7, 5, g2], [8, 7, g2],
  // Crystal-0 square top-right; its fifth crystal is bottom-left (a long-distance 5-merge).
  [1, 9, c0], [1, 10, c0], [2, 9, c0], [2, 10, c0], [14, 2, c0],
  // Song pair lower right with a third song-0 lower left; a lone song-1 upper left.
  [10, 8, s0], [10, 9, s0], [12, 3, s0], [4, 2, s1],
  // Elk pair bottom-left, an elk-1 upper right for swaps.
  [13, 4, e0], [14, 4, e0], [5, 10, e1],
];

const board: Cell[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, (): Cell => null));
for (const [row, col, item] of PLACED) board[row][col] = item;

export const SANDBOX_LEVEL: Level = {
  name: 'Navigation sandbox (test board, not a level)',
  definition: {
    seed: 12,
    board,
    supply: [c0, s0, e0, c0],
    goal: { kind: 'item', item: { family: 'grove', tier: 3 } },
  },
};
