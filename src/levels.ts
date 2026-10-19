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

// 7 × 7 exploration map in three regions; items never leave their region, and unlocking consumes nothing.
//   rows 0-2:            Crystal Hollow (7 × 3), unlocked by Song tier 2 (shown as 3 of 4) in Songbird Glade
//   rows 3-6, cols 0-3:  Mossy Clearing (4 × 4), open from the start
//   rows 3-6, cols 4-6:  Songbird Glade (3 × 4), unlocked by Grove tier 2 (shown as 3 of 4) in Mossy Clearing
// Goal: Crystal tier 3 (shown as 4 of 4) in Crystal Hollow. Every piece belongs to its region's target family.
// - Clearing: three grove-0 (a pair and a lone one) make a grove-1; dropped on the grove-1 pair it makes the
//   key. Plain 3-merges, no choices: it teaches Unlock.
// - Glade: six song-0 (a 2×2 block, plus a pair) and one song-1. Dropping a pair piece onto the block is a
//   5 → 2 merge, introducing the bonus; two plain 3-merges work as well. Every choice reaches the key.
// - Hollow: five crystal-0 (two pairs and a lone one), one crystal-1 and two crystal-2. The goal needs one
//   5 → 2 merge of crystal-0 (gather four, then drop the fifth on them); any 3-merge of crystal-0 leaves two of
//   each tier, which is reported straight away (no useful merges left), so a single Undo recovers.
//   c0 c0 .  .  .  c2 .
//   .  .  .  c1 .  .  c0
//   c2 .  .  .  c0 c0 .
//   g0 g0 .  .  s0 s0 .
//   .  .  .  g1 s0 s0 .
//   .  g0 .  g1 .  .  s0
//   .  .  .  .  s1 .  s0
const HOLLOW_ITEMS: [number, number, Item][] = [
  [0, 0, c0], [0, 1, c0], [0, 5, c2], [1, 3, c1], [1, 6, c0], [2, 0, c2], [2, 4, c0], [2, 5, c0],
  [3, 0, g0], [3, 1, g0], [4, 3, g1], [5, 1, g0], [5, 3, g1],
  [3, 4, s0], [3, 5, s0], [4, 4, s0], [4, 5, s0], [5, 6, s0], [6, 4, s1], [6, 6, s0],
];
const hollowBoard: Cell[][] = Array.from({ length: 7 }, () => Array.from({ length: 7 }, (): Cell => null));
for (const [row, col, item] of HOLLOW_ITEMS) hollowBoard[row][col] = item;

export const HOLLOW_LEVEL: LevelDefinition = {
  seed: 6,
  board: hollowBoard,
  supply: [],
  regions: [
    { name: 'Mossy Clearing', row: 3, col: 0, rows: 4, cols: 4 },
    { name: 'Songbird Glade', row: 3, col: 4, rows: 4, cols: 3, unlock: { item: g2, in: 0 } },
    { name: 'Crystal Hollow', row: 0, col: 0, rows: 3, cols: 7, unlock: { item: s2, in: 1 } },
  ],
  goal: { kind: 'item', item: { family: 'crystal', tier: 3 }, region: 2 },
};

// Level 7 (experimental): three small rooms in terrain (~), joined by passages (=, ‖) closed by rune gates. Each gate
// opens by itself on the move that meets its room's tiles, consuming nothing; the items on those tiles then stay fixed
// and Undo history is cleared (a checkpoint).
//   g0 g0 [G] ~  ~  ~  ~      [G] pressure plate: exactly Grove tier 1 (shown as 2 of 4)
//   s0 e0 g0  =  c0 .  c1     [S] pressure plate: exactly Song tier 1; the elk may stay
//   s0 s0 [S] ~  .  (C) .     (C) stone: exactly Crystal tier 2 (shown as 3 of 4), alone in the Stone Chamber
//   ~  ~  ~   ~  c0 c1 c0
//   ~  ~  ~   ~  ~  ‖  ~
//   ~  ~  ~   ~  .  .  ~
//   ~  ~  ~   ~  $  .  ~      $ the disc-golf backpack, hidden until the Treasure Nook opens
// It cannot be stranded, so it never reports a loss: each family in the Pressure Hall has exactly three tier-0 pieces
// (one merge, no overshoot), and the Stone Chamber's three crystal-0 and two crystal-1 can only merge to one crystal-2.
// Winning line: (1,2)→(0,1) merge, (0,1)→(0,2), (2,1)→(2,0) merge, (2,0)→(2,2) opens the first gate; (1,4)→(2,4),
// (3,6)→(3,4) merge, (1,6)→(3,5) merge, (3,5)→(2,5) opens the second; tap (6,4).
const RUNE_ITEMS: [number, number, Item][] = [
  [0, 0, g0], [0, 1, g0], [1, 0, s0], [1, 1, e0], [1, 2, g0], [2, 0, s0], [2, 1, s0],
  [1, 4, c0], [1, 6, c1], [3, 4, c0], [3, 5, c1], [3, 6, c0],
];
const runeBoard: Cell[][] = Array.from({ length: 7 }, () => Array.from({ length: 7 }, (): Cell => null));
for (const [row, col, item] of RUNE_ITEMS) runeBoard[row][col] = item;

export const RUNE_LEVEL: LevelDefinition = {
  seed: 7,
  board: runeBoard,
  supply: [],
  regions: [
    { name: 'Pressure Hall', row: 0, col: 0, rows: 3, cols: 3 },
    {
      name: 'Stone Chamber', row: 1, col: 4, rows: 3, cols: 3,
      unlock: { kind: 'pressure', in: 0, plates: [{ row: 0, col: 2, item: g1 }, { row: 2, col: 2, item: s1 }], passage: { row: 1, col: 3 } },
    },
    {
      name: 'Treasure Nook', row: 5, col: 4, rows: 2, cols: 2,
      unlock: { kind: 'stone', in: 1, plates: [{ row: 2, col: 5, item: c2 }], passage: { row: 4, col: 5 } },
    },
  ],
  goal: { kind: 'treasure', at: { row: 6, col: 4 } },
};

// Level 8: a clearing whose hidden alcove holds the crystals it lacks, and a separate final room. Both gates are pressure
// plates in the clearing (exact items; others may stay), each opening a checkpoint as in level 7. The alcove is part of
// the clearing's room (`joins`): once open, items move, swap and merge between them. Until then its tiles and items
// are hidden. The final room is a room of its own.
//   g0 g0 .  [P] ~  c0 .      [P] pressure plate: exactly Grove tier 1 (shown as 2 of 4); opens the Hidden Alcove
//   .  .  g0 .   =  .  .      =   rune gate to the Hidden Alcove (columns 5-6, rows 0-2)
//   c0 c0 .  .   ~  c1 c1
//   .  .  [S] .  ~  ~  ~      [S] pressure plate: exactly Crystal tier 2 (shown as 3 of 4); opens the Lantern Nook
//   ~  ~  ‖  ~   ~  ~  ~      ‖   rune gate to the Lantern Nook
//   ~  .  .  ~   ~  ~  ~
//   ~  $  .  ~   ~  ~  ~      $   the clarinet case, hidden until the Lantern Nook opens
// The clearing's two crystal-0 can't merge on their own: the alcove's crystal-0 and two crystal-1 are needed. Exact
// inventories, so it cannot be stranded and never reports a loss: three grove-0 make the one grove-1; three crystal-0
// make a crystal-1, and with the alcove's two, the one crystal-2.
// Winning line: (1,2)→(0,1) merge, (0,1)→(0,3) opens the alcove; (0,5)→(2,0) merge, (2,0)→(2,5) merge,
// (2,5)→(3,2) opens the Lantern Nook; tap (6,1).
const CACHE_ITEMS: [number, number, Item][] = [
  [0, 0, g0], [0, 1, g0], [1, 2, g0], [2, 0, c0], [2, 1, c0],
  [0, 5, c0], [2, 5, c1], [2, 6, c1],
];
const cacheBoard: Cell[][] = Array.from({ length: 7 }, () => Array.from({ length: 7 }, (): Cell => null));
for (const [row, col, item] of CACHE_ITEMS) cacheBoard[row][col] = item;

export const CACHE_LEVEL: LevelDefinition = {
  seed: 8,
  board: cacheBoard,
  supply: [],
  regions: [
    { name: 'Fern Clearing', row: 0, col: 0, rows: 4, cols: 4 },
    {
      name: 'Hidden Alcove', row: 0, col: 5, rows: 3, cols: 2, joins: 0, hidden: true,
      unlock: { kind: 'pressure', in: 0, plates: [{ row: 0, col: 3, item: g1 }], passage: { row: 1, col: 4 } },
    },
    {
      name: 'Lantern Nook', row: 5, col: 1, rows: 2, cols: 2,
      unlock: { kind: 'pressure', in: 0, plates: [{ row: 3, col: 2, item: c2 }], passage: { row: 4, col: 2 } },
    },
  ],
  goal: { kind: 'treasure', at: { row: 6, col: 1 }, prize: 'clarinet' },
};

export const LEVELS: readonly Level[] = [
  { name: 'Sprouting Grove', definition: INTRO_LEVEL },
  { name: 'Songbird Chorus', definition: SONG_LEVEL },
  { name: 'Lone Elk', definition: LEAVE_ONE_LEVEL },
  { name: 'Crystal Fives', definition: CRYSTAL_LEVEL },
  { name: 'The Faraway Grove', definition: FARAWAY_LEVEL },
  { name: 'The Hidden Hollow', definition: HOLLOW_LEVEL },
  { name: 'The Rune Gates', definition: RUNE_LEVEL },
  { name: 'The Hidden Cache', definition: CACHE_LEVEL },
];

/** The level index to play after `index` in a list of `count` levels: the next one, or 0 to replay after the last. */
export function nextLevelIndex(index: number, count = LEVELS.length): number {
  return index + 1 < count ? index + 1 : 0;
}
