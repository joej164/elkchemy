import type { Cell, Item } from './board';
import type { LevelDefinition } from './session';

const g0: Item = { family: 'grove', tier: 0 };
const g1: Item = { family: 'grove', tier: 1 };
const g2: Item = { family: 'grove', tier: 2 };
const s0: Item = { family: 'song', tier: 0 };
const s1: Item = { family: 'song', tier: 1 };
const s2: Item = { family: 'song', tier: 2 };
const c0: Item = { family: 'crystal', tier: 0 };
const c1: Item = { family: 'crystal', tier: 1 };
const c2: Item = { family: 'crystal', tier: 2 };

/** The palace entrance prototype's regions and tasks, by index (see ENTRANCE_LEVEL). */
export const [SOUTH, FORK, WEST, EAST, EAST_POCKET, UPPER, FORECOURT] = [0, 1, 2, 3, 4, 5, 6];
export const [OPEN_FORK_TASK, OPEN_TERRACES_TASK, REVEAL_POCKET_TASK, WEST_TASK, EAST_TASK, REVEAL_FORECOURT_TASK] = [0, 1, 2, 3, 4, 5];

// The palace entrance (Chapter 1, level 3; development preview only): one 20 × 11 map, worked from the bottom up. Code
// coordinates are (row, column) from 0; the player sees no numbers or room labels beyond the rooms' names. Tiers as the
// player sees them (g2: Grove, tier 2 of 5); [x] a marked tile (with the item it needs, or holding one).
//        0  1  2  3  4  5  6  7  8  9  10
//    0   ~  ~  ~  ~  ~  D  ~  ~  ~  ~  ~     D the palace entrance in the palace wall: forest until the forecourt is revealed
//    1   ~  ~  ~  .  .  @  .  .  ~  ~  ~     Palace forecourt (rows 1-2, hidden, no items); @ Alisha's plate, the goal
//    2   ~  ~  ~  .  .  .  .  .  ~  ~  ~
//    3   ~  ~  ~  f  a  |  ~  ~  ~  ~  ~     | its rune gate, forest until it opens; f a Fiona and Alisha once it is revealed
//    4   ~  ~  ~  .  g1[g3 .  g1 ~  ~  ~     Upper approach (rows 4-6): [g3] Grove 3 of 5 reveals the forecourt
//    5   ~  ~  ~  g1 .  g1 .  g1 ~  s1 s1    East terrace's concealed part (rows 5-6, columns 9-10)
//    6   ~  ~  ~  g1 g1 .  .  g1 ~  s2 s1
//    7   ~  ~  ~  ~  ~  |  ~  ~  ~  *  ~     | the Upper approach's sealed gate, with a symbol for each terrace; * the link
//    8  [c3 g1 g1[g2 ~  =  ~  s1 .  . [g2    West terrace (rows 8-10, columns 0-3): [c3] Crystal 3 and [g2] Grove 2 of 5
//    9   c1 c1 .  g1 ~  =  ~  g1 g1 .  .     East terrace (rows 8-10, columns 7-10): [g2] Grove 2 reveals its concealed part,
//   10   c1 c2 c1 c1 ~  =  ~  s1 .  g1[s3       then [s3] Song 3 of 5 completes it
//   11   ~  ~  ~  |  ~  =  ~  |  ~  ~  ~     | rune gates to the terraces; = the path up to the Upper approach's gate
//   12   ~  ~  ~  .  . [s3 .  .  ~  ~  ~     Forked path (rows 12-14): [s3] Song 3 of 5 opens both terraces
//   13   ~  ~  ~  s1 s1 .  .  s1 ~  ~  ~
//   14   ~  ~  ~  .  s1 .  s2 s1 ~  ~  ~
//   15   ~  ~  ~  ~  ~  |  ~  ~  ~  ~  ~
//   16   ~  ~  ~  .  .  .  . [g2 ~  ~  ~     Southern clearing (rows 16-18), open: [g2] Grove 2 of 5 opens the Forked path
//   17   ~  ~  ~  g1 g1 .  .  .  ~  ~  ~
//   18   ~  ~  ~  .  .  g1 .  .  ~  ~  ~
//   19   ~  ~  ~  ~  f  a  ~  ~  ~  ~  ~     f a Fiona and Alisha at the start
// Every marked tile is a task (Crystal Palace rules): done for good on the move that leaves exactly its items, a
// checkpoint that fixes them and clears Undo. The terraces open together and can be completed in either order; each
// lights its symbol on the Upper approach's gate (crystal west, musical note east), and the second opens it. The East
// terrace's two Song tier 1 can't merge until its concealed part adds three more and a Song tier 2 (as in The Hidden
// Cache). Items never leave their room.
// Chapter 1 inventories (strandable, see src/chapter.ts): the Southern clearing is a plain warm-up; elsewhere a five-merge
// is needed: the Forked path's five Song 1, the West terrace's five Crystal 1, the East terrace's five Song 1 once its
// concealed part is found, and the Upper approach's eight Grove 1 (one five-merge and one three-merge, in either order).
// A wrong choice leaves too few pieces, is reported at once and Undo takes it back; no checkpoint can strand a room.
// Winning lines: Southern clearing (18,5)→(17,4), (17,4)→(16,7).
//   Forked path (13,7)→(14,5), (14,7)→(14,5) 5-merge, (14,5)→(12,5), (14,6)→(13,5), (14,7)→(12,5).
//   West terrace (10,2)→(9,2), (10,3)→(9,2) 5-merge, (9,2)→(8,0), (10,1)→(9,0), (10,3)→(8,0), (9,3)→(8,2), (8,2)→(8,3).
//   East terrace (10,9)→(9,8), (9,8)→(8,10) reveals; (6,9)→(9,9), (8,7)→(6,9), (10,7)→(6,9) 5-merge, (9,9)→(10,10),
//   (6,9)→(10,9), (10,7)→(10,10).
//   Upper approach (5,5)→(5,4), (4,4)→(5,4) 5-merge, (4,7)→(5,7), (5,4)→(4,5), (5,7)→(4,5) reveals the forecourt; then
//   Alisha onto (1,5).
const AREAS: [number, number, Item][] = [
  [17, 3, g0], [17, 4, g0], [18, 5, g0],                                                    // Southern clearing
  [13, 3, s0], [13, 4, s0], [14, 4, s0], [13, 7, s0], [14, 7, s0], [14, 6, s1],             // Forked path
  [8, 1, g0], [8, 2, g0], [9, 3, g0], [9, 0, c0], [9, 1, c0], [10, 0, c0], [10, 2, c0], [10, 3, c0], [10, 1, c1], // West terrace
  [9, 7, g0], [9, 8, g0], [10, 9, g0], [8, 7, s0], [10, 7, s0],                             // East terrace
  [5, 9, s0], [5, 10, s0], [6, 10, s0], [6, 9, s1],                                         // its concealed part
  [5, 3, g0], [6, 3, g0], [6, 4, g0], [4, 7, g0], [5, 7, g0], [6, 7, g0], [4, 4, g0], [5, 5, g0], // Upper approach
];
const board: Cell[][] = Array.from({ length: 20 }, () => Array.from({ length: 11 }, (): Cell => null));
for (const [row, col, item] of AREAS) board[row][col] = item;

/** Alisha's line, in her speech bubble, once the forecourt is revealed. */
export const ALISHA_LINE = 'I can stand on that plate.';

export const ENTRANCE_LEVEL: LevelDefinition = {
  seed: 10,
  board,
  supply: [],
  strandable: true,
  regions: [
    { name: 'Southern clearing', row: 16, col: 3, rows: 3, cols: 5 },
    { name: 'Forked path', row: 12, col: 3, rows: 3, cols: 5, unlock: { tasks: [OPEN_FORK_TASK], from: SOUTH, passage: { row: 15, col: 5 } } },
    { name: 'West terrace', row: 8, col: 0, rows: 3, cols: 4, unlock: { tasks: [OPEN_TERRACES_TASK], from: FORK, passage: { row: 11, col: 3 } } },
    { name: 'East terrace', row: 8, col: 7, rows: 3, cols: 4, unlock: { tasks: [OPEN_TERRACES_TASK], from: FORK, passage: { row: 11, col: 7 } } },
    {
      name: 'East terrace concealed part', row: 5, col: 9, rows: 2, cols: 2, joins: EAST, hidden: true, link: { row: 7, col: 9 },
      unlock: { tasks: [REVEAL_POCKET_TASK] },
    },
    {
      name: 'Upper approach', row: 4, col: 3, rows: 3, cols: 5,
      unlock: {
        tasks: [WEST_TASK, EAST_TASK], from: FORK, passage: { row: 7, col: 5 },
        path: [{ row: 8, col: 5 }, { row: 9, col: 5 }, { row: 10, col: 5 }, { row: 11, col: 5 }],
      },
    },
    {
      name: 'Palace forecourt', row: 1, col: 3, rows: 2, cols: 5, hidden: true,
      unlock: { tasks: [REVEAL_FORECOURT_TASK], from: UPPER, passage: { row: 3, col: 5 } },
    },
  ],
  tasks: [
    { in: SOUTH, plates: [{ row: 16, col: 7, item: g1 }] },                                          // 0: opens the Forked path
    { in: FORK, plates: [{ row: 12, col: 5, item: s2 }] },                                           // 1: opens both terraces
    { in: EAST, plates: [{ row: 8, col: 10, item: g1 }] },                                           // 2: reveals the concealed part
    { in: WEST, plates: [{ row: 8, col: 0, item: c2 }, { row: 8, col: 3, item: g1 }], symbol: 'crystal' }, // 3: the west symbol
    { in: EAST, plates: [{ row: 10, col: 10, item: s2 }], symbol: 'note' },                          // 4: the east symbol
    { in: UPPER, plates: [{ row: 4, col: 5, item: g2 }] },                                           // 5: reveals the forecourt
  ],
  goal: { kind: 'treasure', at: { row: 1, col: 5 }, prize: 'entrance' },
  party: {
    start: { alisha: { row: 19, col: 5 }, fiona: { row: 19, col: 4 } },
    waiting: { alisha: { row: 3, col: 4 }, fiona: { row: 3, col: 3 } },
    door: { row: 0, col: 5 },
    // The terrace junction (C1-08A) once both terraces open; the forecourt (C1-08B) once it is revealed, before Alisha's
    // bubble. The approach (C1-08) is shown before play, and the entry (C1-09, C1-10) after the win.
    story: [{ id: 'C1-08A', task: OPEN_TERRACES_TASK }, { id: 'C1-08B', task: REVEAL_FORECOURT_TASK }],
    talk: [{ id: 'plate', after: REVEAL_FORECOURT_TASK, lines: [{ who: 'alisha', text: ALISHA_LINE }] }],
  },
};
