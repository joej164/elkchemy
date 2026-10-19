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
const c3: Item = { family: 'crystal', tier: 3 };
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

// Level 8: one irregular clearing, part of it concealed, and a separate final room. Both are opened by pressure plates
// in the clearing (exact items; others may stay), each a checkpoint as in level 7. Until the first plate holds its
// item, the clearing's pocket (columns 5-6, rows 0-2) and the floor tile linking it (1,4) are drawn as plain forest,
// with a faint clue in the link's foliage. They belong to the pocket region, which joins the clearing's room: once
// revealed, items move, swap and merge anywhere in the clearing, including through the link. The final room keeps
// its own rune gate.
//   g0 g0 .  [P] ~  c0 .      [P] pressure plate: exactly Grove tier 1 (shown as 2 of 4); reveals the pocket and link
//   .  .  g0 .   *  .  .      *   the link: forest with a faint clue, then floor
//   c0 c0 .  .   ~  c1 c1
//   .  .  [S] .  ~  ~  ~      [S] pressure plate: exactly Crystal tier 2 (shown as 3 of 4); opens the Lantern Nook
//   ~  ~  ‖  ~   ~  ~  ~      ‖   rune gate to the Lantern Nook
//   ~  .  .  ~   ~  ~  ~
//   ~  $  .  ~   ~  ~  ~      $   the clarinet case, hidden until the Lantern Nook opens
// The clearing's two crystal-0 can't merge on their own: the pocket's crystal-0 and two crystal-1 are needed. Exact
// inventories, so it cannot be stranded and never reports a loss: three grove-0 make the one grove-1; three crystal-0
// make a crystal-1, and with the pocket's two, the one crystal-2.
// Winning line: (1,2)→(0,1) merge, (0,1)→(0,3) reveals the pocket; (0,5)→(2,0) merge, (2,0)→(2,5) merge,
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
      name: 'Fern Clearing pocket', row: 0, col: 5, rows: 3, cols: 2, joins: 0, hidden: true, link: { row: 1, col: 4 },
      unlock: { kind: 'pressure', in: 0, plates: [{ row: 0, col: 3, item: g1 }] },
    },
    {
      name: 'Lantern Nook', row: 5, col: 1, rows: 2, cols: 2,
      unlock: { kind: 'pressure', in: 0, plates: [{ row: 3, col: 2, item: c2 }], passage: { row: 4, col: 2 } },
    },
  ],
  goal: { kind: 'treasure', at: { row: 6, col: 1 }, prize: 'clarinet' },
};

// Level 9: a 16 × 16 woodland map (columns A-P, rows 1-16; code coordinates are (row, column) from 0). Starting Glade's
// marked tile opens Songbird Glade, the hub; the hub's opens Fern Glade, Crystal Glade and Woodland Lodge together. Each
// branch is completed by its own marked tiles, in any order, and lights its symbol on the Crystal Palace's gate; the
// third opens the palace, whose interior stays sealed (blank, unlabelled) until then. Its two marked tiles reveal a closed
// ukulele case. Fern Glade has a concealed part (L3-N5),
// joined by the link K4, revealed by its Grove tile. Every marked tile is a task: a checkpoint, done for good.
//   A  B  C  D  E  F  G  H  I  J  K  L  M  N  O  P
//   P  P  P  #  w                                        1    P Crystal Palace, w its crystal walls; $ the ukulele case
//   P  P  P  #  w                                        2    S Starting Glade, H Songbird Glade (the hub)
//   P  P  P  P  w     F  F  F  #     x  x  x             3    F Fern Glade, x its concealed part, * the link K4
//   P  P  P  P  w     F  F  F  F  *  x  x  x             4    C Crystal Glade
//   P  P  $  P  w     F  F  F  F     x  x  x             5    L Woodland Lodge, w its log walls
//   w  =  w  w  w     F  F  #  #                         6    | rune gates: F10, I7, K9, I12, and the palace's at F7,
//      =  =  =  =  |  =     |                            7      on its path (=) G7, F7-B7, B6
//      S  S  S  #     H  H  H  #     C  C  C  C          8    # marked tiles (player-facing tiers):
//      S  S  S  S     H  H  H  H  |  C  C  C  C          9      E8 Grove 2 opens the hub; J8 Song 3 opens F, C and L;
//      S  S  S  S  |  H  H  H  H     C  C  C  C          10     J3 Grove 2 reveals x and *; I6 Crystal 3 with J6 Song 2
//      S  S  S  S     H  H  H  H     C  C  C  #          11     complete F; O11 Crystal 4 completes C; J16 Song 3
//                  w  w  w  |  w  w                      12     completes L; D1 Crystal 4 with D2 Song 3 reveal $
//                  w  L  L  L  L  w                      13
//                  w  L  L  L  L  w                      14
//                  w  L  L  L  L  w                      15
//                  w  L  L  L  #  w                      16
// Every room's inventory is a plain chain of its families: three tier-1 make a tier 2, which with two more makes a tier 3,
// and so on; never five alike, so no five-merge and no wrong choice. Fern Glade's two Crystal and two Song tier 1 can't
// merge until the concealed part adds one of each (and two Crystal tier 2). Room levels never report a loss; exact
// inventories keep this one from being stranded. The case's cell takes no item, so the case always has room.
// Winning lines, area by area (local (row, column) from each area's top-left):
//   Starting Glade (1,2)→(0,1), (0,1)→(0,3).  Songbird Glade (1,2)→(0,1), (0,1)→(2,0), (2,0)→(0,3).
//   Crystal Glade (1,2)→(0,1), (0,1)→(2,0), (2,0)→(3,0), (3,0)→(3,3).  Woodland Lodge (1,2)→(0,1), (0,1)→(2,0), (2,0)→(3,3).
//   Fern Glade (1,2)→(0,1), (0,1)→(0,3) reveals, (0,5)→(2,0), (2,0)→(2,5), (2,5)→(3,2), (0,7)→(1,0), (1,0)→(3,3).
//   Crystal Palace (1,2)→(0,1), (0,1)→(2,0), (2,0)→(3,0), (3,0)→(0,3), (4,3)→(4,1), (4,1)→(3,3), (3,3)→(1,3); tap (4,2).
const PALACE_AREAS: [number, number, [number, number, Item][]][] = [
  [7, 1, [[0, 0, g0], [0, 1, g0], [1, 2, g0]]],                                                  // Starting Glade
  [7, 6, [[0, 0, s0], [0, 1, s0], [1, 2, s0], [2, 0, s1], [2, 1, s1]]],                          // Songbird Glade
  [2, 6, [[0, 0, g0], [0, 1, g0], [1, 2, g0], [2, 0, c0], [2, 1, c0], [1, 0, s0], [1, 1, s0]]],  // Fern Glade
  [7, 11, [[0, 0, c0], [0, 1, c0], [1, 2, c0], [2, 0, c1], [2, 1, c1], [3, 0, c2], [3, 1, c2]]], // Crystal Glade
  [12, 6, [[0, 0, s0], [0, 1, s0], [1, 2, s0], [2, 0, s1], [2, 1, s1]]],                         // Woodland Lodge
  [2, 11, [[0, 0, c0], [2, 0, c1], [2, 1, c1], [0, 2, s0]]],                                     // Fern Glade's concealed part
  [0, 0, [[0, 0, c0], [0, 1, c0], [1, 2, c0], [2, 0, c1], [2, 1, c1], [3, 0, c2], [3, 1, c2],    // Crystal Palace
    [4, 0, s0], [4, 1, s0], [4, 3, s0], [2, 3, s1], [3, 3, s1]]],
];
const palaceBoard: Cell[][] = Array.from({ length: 16 }, () => Array.from({ length: 16 }, (): Cell => null));
for (const [top, left, items] of PALACE_AREAS) for (const [row, col, item] of items) palaceBoard[top + row][left + col] = item;

export const PALACE_LEVEL: LevelDefinition = {
  seed: 9,
  board: palaceBoard,
  supply: [],
  regions: [
    { name: 'Starting Glade', row: 7, col: 1, rows: 4, cols: 4 },
    { name: 'Songbird Glade', row: 7, col: 6, rows: 4, cols: 4, unlock: { tasks: [0], from: 0, passage: { row: 9, col: 5 } } },
    { name: 'Fern Glade', row: 2, col: 6, rows: 4, cols: 4, unlock: { tasks: [1], from: 1, passage: { row: 6, col: 8 } } },
    { name: 'Crystal Glade', row: 7, col: 11, rows: 4, cols: 4, unlock: { tasks: [1], from: 1, passage: { row: 8, col: 10 } } },
    {
      name: 'Woodland Lodge', row: 12, col: 6, rows: 4, cols: 4, building: 'lodge',
      unlock: { tasks: [1], from: 1, passage: { row: 11, col: 8 } },
    },
    {
      name: 'Fern Glade concealed part', row: 2, col: 11, rows: 3, cols: 3, joins: 2, hidden: true, link: { row: 3, col: 10 },
      unlock: { tasks: [2] },
    },
    {
      name: 'Crystal Palace', row: 0, col: 0, rows: 5, cols: 4, building: 'palace', hidden: true,
      unlock: {
        tasks: [3, 4, 5], from: 1, passage: { row: 6, col: 5 },
        path: [{ row: 6, col: 6 }, { row: 6, col: 4 }, { row: 6, col: 3 }, { row: 6, col: 2 }, { row: 6, col: 1 }, { row: 5, col: 1 }],
      },
    },
  ],
  tasks: [
    { in: 0, plates: [{ row: 7, col: 4, item: g1 }] },                                                           // 0: E8 opens the hub
    { in: 1, plates: [{ row: 7, col: 9, item: s2 }] },                                                           // 1: J8 opens the branches
    { in: 2, plates: [{ row: 2, col: 9, item: g1 }] },                                                           // 2: J3 reveals the concealed part
    { in: 2, plates: [{ row: 5, col: 8, item: c2 }, { row: 5, col: 9, item: s1 }], symbol: 'fern' },             // 3: I6 and J6
    { in: 3, plates: [{ row: 10, col: 14, item: c3 }], symbol: 'crystal' },                                      // 4: O11
    { in: 4, plates: [{ row: 15, col: 9, item: s2 }], symbol: 'note' },                                          // 5: J16
    { in: 6, plates: [{ row: 0, col: 3, item: c3 }, { row: 1, col: 3, item: s2 }] },                            // 6: D1 and D2
  ],
  goal: { kind: 'treasure', at: { row: 4, col: 2 }, prize: 'ukulele', task: 6 },
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
  { name: 'The Crystal Palace', definition: PALACE_LEVEL },
];

/** The level index to play after `index` in a list of `count` levels: the next one, or 0 to replay after the last. */
export function nextLevelIndex(index: number, count = LEVELS.length): number {
  return index + 1 < count ? index + 1 : 0;
}
