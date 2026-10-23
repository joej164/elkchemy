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

// The palace entrance (a story prototype, outside the numbered levels): one 20 × 11 map, worked from the bottom up.
// Code coordinates are (row, column) from 0; the player sees no numbers or room labels beyond the rooms' names.
//        0  1  2  3  4  5  6  7  8  9  10
//    0   ~  ~  w  w  w  D  w  w  w  ~  ~     D the palace entrance, w palace wall: forest until the forecourt is revealed
//    1   ~  ~  ~  F  F  @  F  F  ~  ~  ~     F Palace forecourt (hidden, no items); @ Alisha's plate, the goal
//    2   ~  ~  ~  F  F  F  F  F  ~  ~  ~
//    3   ~  ~  ~  f  a  ‖  ~  ~  ~  ~  ~     ‖ its rune gate, forest until it opens; f a Fiona and Alisha once it is revealed
//    4   ~  ~  ~  .  . [G] .  .  ~  ~  ~     Upper approach (rows 4-6): [G] Grove 3 of 5 reveals the forecourt
//    5   ~  ~  ~  g0 g0 .  .  .  ~  s1 s0    East terrace's concealed part (rows 5-6, columns 9-10)
//    6   ~  ~  ~  g1 g1 .  g0 .  ~  s1 .
//    7   ~  ~  ~  ~  ~  ‖  ~  ~  ~  *  ~     ‖ the Upper approach's sealed gate, with a symbol for each terrace; * the link
//    8  [C] g0 g0 [g] ~  =  ~  s0 .  .  [g]  West terrace (rows 8-10, columns 0-3): [C] Crystal 3 and [g] Grove 2 of 5
//    9   c0 c0 .  g0 ~  =  ~  g0 g0 .  .     East terrace (rows 8-10, columns 7-10): [g] Grove 2 reveals its concealed part,
//   10   c1 c1 c0 .  ~  =  ~  s0 .  g0 [S]     then [S] Song 3 of 5 completes it
//   11   ~  ~  ~  |  ~  =  ~  |  ~  ~  ~     | rune gates to the terraces; = the path up to the Upper approach's gate
//   12   ~  ~  ~  .  . [S]  .  .  ~  ~  ~    Forked path (rows 12-14): [S] Song 3 of 5 opens both terraces
//   13   ~  ~  ~  s0 s0 .  .  .  ~  ~  ~
//   14   ~  ~  ~  .  .  s0 s1 s1 ~  ~  ~
//   15   ~  ~  ~  ~  ~  |  ~  ~  ~  ~  ~
//   16   ~  ~  ~  .  .  .  . [g]  ~  ~  ~    Southern clearing (rows 16-18), open: [g] Grove 2 of 5 opens the Forked path
//   17   ~  ~  ~  g0 g0 .  .  .  ~  ~  ~
//   18   ~  ~  ~  .  .  g0 .  .  ~  ~  ~
//   19   ~  ~  ~  ~  f  a  ~  ~  ~  ~  ~     f a Fiona and Alisha at the start
// Every marked tile is a task (Crystal Palace rules): done for good on the move that leaves exactly its items, a
// checkpoint that fixes them and clears Undo. The terraces open together and can be completed in either order; each
// lights its symbol on the Upper approach's gate (crystal west, musical note east), and the second opens it. The East
// terrace's two Song tier 1 can't merge until its concealed part adds the third and two Song tier 2 (as in The Hidden
// Cache). Items never leave their room.
// Exact inventories: in every room each family's pieces make one plain chain (three tier 1 make a tier 2, which with two
// more makes a tier 3), never five alike, so every merge is a 3-merge, every order of merges ends with the plates' items,
// and the level can't be stranded (room levels never report a loss).
// Winning lines: Southern clearing (18,5)→(17,4), (17,4)→(16,7). Forked path (14,5)→(13,4), (13,4)→(14,6), (14,6)→(12,5).
//   West terrace (10,2)→(9,1), (9,1)→(10,1), (10,1)→(8,0), (9,3)→(8,2), (8,2)→(8,3).
//   East terrace (10,9)→(9,8), (9,8)→(8,10) reveals; (10,7)→(9,7), (5,10)→(9,7), (9,7)→(6,9), (6,9)→(10,10).
//   Upper approach (6,6)→(5,4), (5,4)→(6,4), (6,4)→(4,5) reveals the forecourt; then Alisha onto (1,5).
const AREAS: [number, number, Item][] = [
  [17, 3, g0], [17, 4, g0], [18, 5, g0],                                                    // Southern clearing
  [13, 3, s0], [13, 4, s0], [14, 5, s0], [14, 6, s1], [14, 7, s1],                          // Forked path
  [8, 1, g0], [8, 2, g0], [9, 3, g0], [9, 0, c0], [9, 1, c0], [10, 2, c0], [10, 0, c1], [10, 1, c1], // West terrace
  [9, 7, g0], [9, 8, g0], [10, 9, g0], [8, 7, s0], [10, 7, s0],                             // East terrace
  [5, 10, s0], [5, 9, s1], [6, 9, s1],                                                      // its concealed part
  [5, 3, g0], [5, 4, g0], [6, 6, g0], [6, 3, g1], [6, 4, g1],                               // Upper approach
];
const board: Cell[][] = Array.from({ length: 20 }, () => Array.from({ length: 11 }, (): Cell => null));
for (const [row, col, item] of AREAS) board[row][col] = item;

export const ENTRANCE_LEVEL: LevelDefinition = {
  seed: 10,
  board,
  supply: [],
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
  },
};
