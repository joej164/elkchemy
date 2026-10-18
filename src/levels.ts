import type { Cell, Item } from './board';
import type { LevelDefinition } from './session';

export interface Level {
  readonly name: string;
  readonly definition: LevelDefinition;
}

const g0: Item = { family: 'grove', tier: 0 };
const g1: Item = { family: 'grove', tier: 1 };
const g2: Item = { family: 'grove', tier: 2 };
const s0: Item = { family: 'song', tier: 0 };
const s1: Item = { family: 'song', tier: 1 };
const s2: Item = { family: 'song', tier: 2 };
const c0: Item = { family: 'crystal', tier: 0 };
const c1: Item = { family: 'crystal', tier: 1 };
const c2: Item = { family: 'crystal', tier: 2 };
const e0: Item = { family: 'elk', tier: 0 };
const e1: Item = { family: 'elk', tier: 1 };
const e2: Item = { family: 'elk', tier: 2 };

// Layout (G = grove-0): three grove pairs, none touching, so a ready 3-merge exists
// (drag any G onto a pair) but the player chooses which. Nine grove-0s in total
// (6 board + 3 supply) make exactly three grove-1s, then one more 3-merge reaches
// the goal (grove tier 2, shown as tier 3). A 5-merge is a bonus, not required.
// Supply lands in a seeded random empty cell.
// Non-grove items are all distinct so they can never merge.
//   G  G  .  song
//   .  .  .  .
//   elk G  .  G
//   cry G  .  G
export const INTRO_LEVEL: LevelDefinition = {
  seed: 7,
  board: [
    [g0, g0, null, s0],
    [null, null, null, null],
    [e0, g0, null, g0],
    [c0, g0, null, g0],
  ],
  supply: [g0, g0, g0],
  goal: { kind: 'item', item: { family: 'grove', tier: 2 } },
};

// Six song-0s (4 board + 2 supply) make two song-1s; with the song-1 already on the
// board that is three, and one more 3-merge makes the goal (song tier 2). Any mix of
// 3- and 5-merges on the song-0s gives two song-1s, so plain 3-merges always suffice.
// The grove-1 and elk-1 are distinct decorations.
//   s0 s0 .  g1
//   .  .  .  .
//   s1 .  s0 .
//   .  e1 .  s0
export const SONG_LEVEL: LevelDefinition = {
  seed: 11,
  board: [
    [s0, s0, null, g1],
    [null, null, null, null],
    [s1, null, s0, null],
    [null, e1, null, s0],
  ],
  supply: [s0, s0],
  goal: { kind: 'item', item: { family: 'song', tier: 2 } },
};

// Elk only: six elk-0 (3 board + 3 supply), four elk-1, one elk-2. Two 3-merges of elk-0
// make six elk-1, two 3-merges of those make three elk-2, and a last 3-merge leaves a
// single elk-3. A 5-merge at tier 0 or 1 strands a leftover, so it loses.
// 8 board + 3 supply = 11 items, within the two-free-cell bound.
//   e1 .  e0 .
//   .  e1 .  e2
//   e0 .  e1 .
//   .  e1 .  e0
export const LEAVE_ONE_LEVEL: LevelDefinition = {
  seed: 5,
  board: [
    [e1, null, e0, null],
    [null, e1, null, e2],
    [e0, null, e1, null],
    [null, e1, null, e0],
  ],
  supply: [e0, e0, e0],
  goal: { kind: 'leaveOne' },
};

// Exactly enough crystal for crystal-3: five crystal-0 (3 board + 2 supply) must 5-merge
// into two crystal-1; with the three on the board that is five, which must 5-merge into
// two crystal-2; with the one on the board, a 3-merge makes crystal-3. The ready
// 3-merges on the board (crystal-0 pair + one, crystal-1 pair + one) are traps: any
// 3-merge of crystal-0 or crystal-1 makes the goal unreachable.
// The grove-1, song-0 and elk-0 are distinct decorations.
//   c0 c0 .  g1
//   .  c1 c1 .
//   .  c0 .  s0
//   c1 .  c2 e0
export const CRYSTAL_LEVEL: LevelDefinition = {
  seed: 3,
  board: [
    [c0, c0, null, g1],
    [null, c1, c1, null],
    [null, c0, null, s0],
    [c1, null, c2, e0],
  ],
  supply: [c0, c0],
  goal: { kind: 'item', item: { family: 'crystal', tier: 3 } },
};

// 12 columns × 16 rows; the goal is all four families at tier 3 (shown as tier 4 of 4) at once.
// Each family has the same, forgiving layout in different regions: a ready tier-0 pair, a lone
// tier-0 far away, a tier-1 pair and a tier-2 pair. Three long-distance 3-merges per family
// (lone tier-0 onto the pair, the new tier-1 onto the tier-1 pair, the new tier-2 onto the tier-2
// pair) finish it. Supply adds one spare tier-0 per family, so 3-merges have slack and no choice
// can strand a family. 28 board items + 4 supply in 192 cells, within the capacity assumption.
const FARAWAY_ITEMS: [number, number, Item][] = [
  // Grove: pair top-left, lone bottom-right, tier-1 pair bottom-left, tier-2 pair right-middle.
  [1, 1, g0], [1, 2, g0], [13, 9, g0], [14, 2, g1], [15, 2, g1], [7, 10, g2], [8, 10, g2],
  // Song: pair top-right, lone lower-left, tier-1 pair centre, tier-2 pair top-middle.
  [2, 9, s0], [2, 10, s0], [12, 1, s0], [9, 6, s1], [9, 7, s1], [0, 5, s2], [0, 6, s2],
  // Elk: pair bottom-middle, lone upper-left, tier-1 pair right edge, tier-2 pair lower-middle.
  [14, 5, e0], [14, 6, e0], [4, 3, e0], [3, 11, e1], [4, 11, e1], [11, 4, e2], [12, 4, e2],
  // Crystal: pair lower-right, lone left edge, tier-1 pair left-middle, tier-2 pair bottom-right.
  [10, 10, c0], [10, 11, c0], [5, 0, c0], [6, 2, c1], [7, 2, c1], [15, 9, c2], [15, 10, c2],
];
const farawayBoard: Cell[][] = Array.from({ length: 16 }, () => Array.from({ length: 12 }, (): Cell => null));
for (const [row, col, item] of FARAWAY_ITEMS) farawayBoard[row][col] = item;

export const FARAWAY_LEVEL: LevelDefinition = {
  seed: 21,
  board: farawayBoard,
  supply: [g0, s0, e0, c0],
  goal: {
    kind: 'items',
    items: [
      { family: 'grove', tier: 3 }, { family: 'song', tier: 3 }, { family: 'elk', tier: 3 }, { family: 'crystal', tier: 3 },
    ],
  },
};

export const LEVELS: readonly Level[] = [
  { name: 'Sprouting Grove', definition: INTRO_LEVEL },
  { name: 'Songbird Chorus', definition: SONG_LEVEL },
  { name: 'Lone Elk', definition: LEAVE_ONE_LEVEL },
  { name: 'Crystal Fives', definition: CRYSTAL_LEVEL },
  { name: 'The Faraway Grove', definition: FARAWAY_LEVEL },
];

/** The level index to play after `index` in a list of `count` levels: the next one, or 0 to replay after the last. */
export function nextLevelIndex(index: number, count = LEVELS.length): number {
  return index + 1 < count ? index + 1 : 0;
}
