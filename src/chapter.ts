import type { Cell, Item } from './board';
import type { LevelDefinition, Talk } from './session';

// Chapter 1's playable levels (development preview only; see STORY_PREVIEW in src/ui/App.tsx), after the Attic prologue:
// Meet Fiona, Woodland cleanup, the palace entrance (src/entrance.ts), the Crystal Palace rescue and Beyond the gate.
// Story order, scenes and dialogue: docs/story/chapter-one-review.html. Code coordinates are (row, column) from 0;
// tiers are Item.tier (0 is shown as tier 1 of 5).
//
// Every room level here is `strandable`: its rooms hold exact inventories with real choices (a five-merge where three
// would leave too few, or a piece kept back for a second marked tile), so a wrong choice is reported at once ('lost',
// see strandedRoom in status.ts) and Undo takes it back. Rooms are built so that no checkpoint can itself strand a room:
// every merge that can go wrong makes an item no marked tile needs, or completes its room's last task (tests check this).

const g0: Item = { family: 'grove', tier: 0 };
const g1: Item = { family: 'grove', tier: 1 };
const g2: Item = { family: 'grove', tier: 2 };
const s0: Item = { family: 'song', tier: 0 };
const s1: Item = { family: 'song', tier: 1 };
const s2: Item = { family: 'song', tier: 2 };
const s3: Item = { family: 'song', tier: 3 };
const c0: Item = { family: 'crystal', tier: 0 };
const c1: Item = { family: 'crystal', tier: 1 };
const c2: Item = { family: 'crystal', tier: 2 };
const c3: Item = { family: 'crystal', tier: 3 };
const e0: Item = { family: 'elk', tier: 0 };
const e1: Item = { family: 'elk', tier: 1 };
const e2: Item = { family: 'elk', tier: 2 };
const w0: Item = { family: 'wood', tier: 0 };
const w1: Item = { family: 'wood', tier: 1 };
const w2: Item = { family: 'wood', tier: 2 };
const w3: Item = { family: 'wood', tier: 3 };
const t0: Item = { family: 'tool', tier: 0 };
const t1: Item = { family: 'tool', tier: 1 };
const t2: Item = { family: 'tool', tier: 2 };
const t3: Item = { family: 'tool', tier: 3 };

function boardOf(rows: number, cols: number, items: readonly [number, number, Item][]): Cell[][] {
  const board: Cell[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, (): Cell => null));
  for (const [row, col, item] of items) board[row][col] = item;
  return board;
}

// 1 · Meet Fiona: a small clearing, no rooms. A three-merge refresher, then the five-merge lesson: the first merge earns
// the Grove tier 2 the second batch needs. Eight saplings make Grove tier 3 only with one five-merge (5 → 2 plus 3 → 1);
// two three-merges leave two saplings and two Grove tier 2, which is reported at once (the item goal's early loss), so
// Undo takes the second back.
//   g0 g0 .  g0      the pair and a loose one (the refresher)
//   .  .  .  .
//   g0 g0 .  .       a block of four and a loose one (five make two)
//   g0 g0 .  g0
// Winning line: (0,3)→(0,1) 3-merge; (3,3)→(3,1) 5-merge (Grove tier 2 at (3,1) and (3,3)); (0,1)→(2,1); (3,3)→(3,1).
export const MEET_FIONA_LEVEL: LevelDefinition = {
  seed: 101,
  board: boardOf(4, 4, [[0, 0, g0], [0, 1, g0], [0, 3, g0], [2, 0, g0], [2, 1, g0], [3, 0, g0], [3, 1, g0], [3, 3, g0]]),
  supply: [],
  goal: { kind: 'item', item: g2 },
};

/** Woodland cleanup's regions and tasks, by index. */
export const [CLEANUP_SOUTH, CLEANUP_WOOD, CLEANUP_DEPOT, CLEANUP_NORTH] = [0, 1, 2, 3];
export const [CLEAR_PATH_TASK, REVEAL_DEPOT_TASK, LOGS_TASK, TOOLS_TASK] = [0, 1, 2, 3];

// 2 · Woodland cleanup: four clearings, worked from the bottom up. Tiers as the player sees them (w2: Wood, tier 2 of 5);
// [x] a marked tile (with the item it needs, or holding one), | a rune gate, $ the goal, a f Alisha and Fiona.
//        0  1  2  3  4  5  6  7  8
//    0   ~  ~  ~  ~  ~  .  $  .  ~      North trail exit (rows 0-1, cols 5-7): $ the signpost to the trail north
//    1   ~  ~  ~  ~  ~  .  .  .  ~
//    2   ~  ~  ~  ~  ~  ~  |  ~  ~      its sealed gate: a log and a hammer symbol, one for each cleanup
//    3  [t4 t3 .  t1 ~  . [w4 w2 w2     Hidden depot (rows 3-6, cols 0-3), revealed by [w2] at (4,5): Tool chest [t4] and
//    4   t3 t1 .  t1 | [w2 .  w2 .        Bundled tools [t2] on its tiles light the hammer
//    5   .  t2 t1 .  ~  w1 .  .  w2     Fallen wood (rows 3-6, cols 5-8): [w2] at (4,5) reveals the depot; Stacked logs
//    6   t2 .  t1[t2 ~  w1 w1 w3 w2       [w4] at (3,6) light the log
//    7   ~  ~  ~  ~  ~  ~  |  ~  ~
//    8   ~  ~  ~  ~  ~ [w2 .  w1[w2     Southern clearing (rows 8-10, cols 5-8): two Gathered bundles [w2] open the fallen wood
//    9   ~  ~  ~  ~  ~  w1 w1 .  .
//   10   ~  ~  ~  ~  ~  .  .  w1 w1
//   11   ~  ~  ~  ~  ~  ~  f  a  ~
// Decisions: the clearing's five branches make its two bundles only as one five-merge; the fallen wood must keep one
// bundle for the depot's tile and five-merge the other five into two Trimmed logs (three-merges leave too few); the
// depot's five Loose tools must five-merge, and one Bundled tools stays back for its second tile.
// Winning lines: South (8,7)→(9,7), (9,5)→(9,6) 5-merge, (9,5)→(8,5), (9,6)→(8,8).
//   Fallen wood (6,6)→(6,5), (6,5)→(4,5) reveals the depot; (6,8)→(4,8), (5,8)→(4,8) 5-merge, (4,8)→(3,6), (5,8)→(4,6),
//   (6,7)→(3,6). Depot (6,2)→(4,2), (4,1)→(4,2) 5-merge, (4,2)→(4,1), (4,0)→(3,0), (4,1)→(3,0), (6,0)→(6,3). Then tap $.
const CLEANUP_AREAS: [number, number, Item][] = [
  [8, 7, w0], [9, 5, w0], [9, 6, w0], [10, 7, w0], [10, 8, w0],                          // Southern clearing
  [5, 5, w0], [6, 5, w0], [6, 6, w0], [3, 7, w1], [3, 8, w1], [4, 7, w1], [5, 8, w1], [6, 8, w1], [6, 7, w2], // Fallen wood
  [3, 3, t0], [4, 3, t0], [5, 2, t0], [6, 2, t0], [4, 1, t0], [5, 1, t1], [6, 0, t1], [3, 1, t2], [4, 0, t2], // Hidden depot
];

export const CLEANUP_LEVEL: LevelDefinition = {
  seed: 102,
  board: boardOf(12, 9, CLEANUP_AREAS),
  supply: [],
  strandable: true,
  regions: [
    { name: 'Southern clearing', row: 8, col: 5, rows: 3, cols: 4 },
    { name: 'Fallen wood', row: 3, col: 5, rows: 4, cols: 4, unlock: { tasks: [CLEAR_PATH_TASK], from: CLEANUP_SOUTH, passage: { row: 7, col: 6 } } },
    {
      name: 'Hidden depot', row: 3, col: 0, rows: 4, cols: 4, hidden: true,
      unlock: { tasks: [REVEAL_DEPOT_TASK], from: CLEANUP_WOOD, passage: { row: 4, col: 4 } },
    },
    {
      name: 'North trail exit', row: 0, col: 5, rows: 2, cols: 3,
      unlock: { tasks: [LOGS_TASK, TOOLS_TASK], from: CLEANUP_WOOD, passage: { row: 2, col: 6 } },
    },
  ],
  tasks: [
    { in: CLEANUP_SOUTH, plates: [{ row: 8, col: 5, item: w1 }, { row: 8, col: 8, item: w1 }] },              // 0: opens the fallen wood
    { in: CLEANUP_WOOD, plates: [{ row: 4, col: 5, item: w1 }] },                                            // 1: reveals the depot
    { in: CLEANUP_WOOD, plates: [{ row: 3, col: 6, item: w3 }], symbol: 'wood' },                            // 2: the log symbol
    { in: CLEANUP_DEPOT, plates: [{ row: 3, col: 0, item: t3 }, { row: 6, col: 3, item: t1 }], symbol: 'tool' }, // 3: the hammer
  ],
  goal: { kind: 'treasure', at: { row: 0, col: 6 }, prize: 'trail' },
  party: {
    start: { alisha: { row: 11, col: 7 }, fiona: { row: 11, col: 6 } },
    // The depot revealed (C1-06B), on the move that does it.
    story: [{ id: 'C1-06B', task: REVEAL_DEPOT_TASK }],
  },
};

/** The Crystal Palace rescue's regions and tasks, by index. */
export const [RESCUE_ENTRY, RESCUE_GALLERY, RESCUE_PLATE_ROOM, RESCUE_WORKSHOP, RESCUE_ARCHIVE, RESCUE_POCKET, RESCUE_CHAMBER, RESCUE_ANTE] =
  [0, 1, 2, 3, 4, 5, 6, 7];
export const [
  OPEN_GALLERY_TASK, REVEAL_PLATE_ROOM_TASK, TRAP_TASK, WORKSHOP_TASK, REVEAL_ARCHIVE_TASK, ARCHIVE_TASK, RELEASE_TASK, ANTE_TASK,
] = [0, 1, 2, 3, 4, 5, 6, 7];

// The storyboard's on-board dialogue (docs/story/chapter-one-review.html): the visitor route at the start, C1-10A's lines
// when the plate room is revealed (Alisha's says what to do), and C1-10B's once the partition has closed behind her.
export const RESCUE_TALK: readonly Talk[] = [
  {
    id: 'visitor-route',
    lines: [
      { who: 'alisha', text: 'Which way?' },
      { who: 'fiona', text: 'Through the gallery. The room we want is beyond it.' },
      { who: 'fiona', text: 'This door was open last time.' },
      { who: 'alisha', text: 'Is there another way around?' },
      { who: 'fiona', text: 'Not one I know.' },
      { who: 'alisha', text: 'Let’s have a look.' },
    ],
  },
  {
    id: 'C1-10A', after: REVEAL_PLATE_ROOM_TASK,
    lines: [
      { who: 'fiona', text: 'I haven’t seen this room before.' },
      { who: 'alisha', text: 'Oh, that looks like a pressure plate in that room. I should go stand on it.' },
      { who: 'fiona', text: 'Does it open that door across the gallery?' },
      { who: 'alisha', text: 'Let’s find out.' },
    ],
  },
  {
    id: 'C1-10B', after: TRAP_TASK,
    lines: [
      { who: 'alisha', text: 'That part’s new.' },
      { who: 'fiona', text: 'Can you step off?' },
      { who: 'alisha', text: 'Apparently it stays shut, too.' },
      { who: 'fiona', text: 'There must be a release out here.' },
      { who: 'alisha', text: 'I’ll see what I can find on this side.' },
    ],
  },
];

// 4 · The Crystal Palace: seven rooms inside the palace, worked from the bottom up (key as for Woodland cleanup; = a
// path, @ Alisha's plate).
//        0  1  2  3  4  5  6  7  8  9  10 11 12 13
//    0   ~  ~  ~  ~  ~  s1 $  .  c1 ~  ~  ~  ~  ~     Message antechamber (rows 0-2, cols 5-8): Song 2 and Crystal 2 on
//    1   ~  ~  ~  ~  ~  s1 .  c1 c1 ~  ~  ~  ~  ~       its tiles reveal $, the message room door
//    2   ~  ~  ~  ~  ~ [s2 s1 . [c2 ~  ~  c1 c1 c3     East archive's concealed part (rows 2-3, cols 11-13), linked at (4,11)
//    3   ~  ~  ~  ~  ~  ~  |  a  f  ~  ~  .  c1 c2     a f: Alisha and Fiona once she is free
//    4  [s4 .  e2 .  ~ [c3 . [s3[c2 ~  ~  .  ~  ~     West workshop (rows 4-7, cols 0-3): Crystal 3 + Elk 3 craft the Crystal
//    5   c1 c1 .  e1 ~  c1 c1 .  s2 ~  e1 .  . [e2      chest (3 Song 3); Song 4 [s4] lights its note
//    6   c2 .  e2 e1 ~  c2 .  s2 s2 ~  e1 c1 .  .     Crystal chamber (rows 4-7, cols 5-8, sealed by both symbols): [c3]
//    7   c1 c1 c1 e1 ~  c1 c1 c1 c2 ~  e1 c1 c3[c4      [s3] and [c2] release Alisha; East archive (rows 5-7, cols 10-13):
//    8   ~  ~  |  ~  ~  ~  |  ~  ~  ~  ~  |  ~  ~       [e2] reveals its concealed part, Crystal 4 [c4] lights its crystal
//    9   ~  ~  =  s1 s1 .  .  s2 .  s1 =  =  ~  ~
//   10   ~  ~  ~  .  s1 . [s4 .  s2 s1 ~  ~  ~  ~     Gallery (rows 9-11, cols 3-9): Song 4 [s4] reveals the plate room
//   11   ~  ~  ~  s3 .  .  .  s2 .  .  ~  ~  ~  ~
//   12   ~  ~  ~  ~  ~  |  ~  ~  |  a  f  ~  ~  ~     (12,8): the plate room's passage, a crystal partition while she is trapped
//   13   ~  ~  ~ [c2 .  . [s2 ~  .  .  ~  ~  ~  ~     Plate room (rows 13-14, cols 8-9, hidden): @ Alisha's plate
//   14   ~  ~  ~  c1 .  s1 s1 ~  .  @  ~  ~  ~  ~     Entry hall (rows 13-15, cols 3-6): Crystal 2 and Song 2 open the gallery
//   15   ~  ~  ~  c1 c1 s1 .  ~  ~  ~  ~  ~  ~  ~
//   16   ~  ~  ~  ~  a  f  ~  ~  ~  ~  ~  ~  ~  ~     Alisha and Fiona at the start
// Standing Alisha on @ opens the West workshop and East archive together and closes the partition behind her (a
// checkpoint); she stays there, talking, until the Crystal chamber's marked tiles release her and open the antechamber.
// Decisions: the gallery's Song 1 and Song 2 each need a five-merge; the workshop's crystals a five-merge (and its two
// ingredients exactly tier 3); the archive's crystals a five-merge once its concealed part is found; the chamber's
// crystals a five-merge, keeping one Crystal 2 back. Winning lines: tests/chapter.test.tsx (LINES.rescue).
const RESCUE_AREAS: [number, number, Item][] = [
  [14, 3, c0], [15, 3, c0], [15, 4, c0], [14, 5, s0], [14, 6, s0], [15, 5, s0],                              // Entry hall
  [9, 3, s0], [9, 4, s0], [10, 4, s0], [9, 9, s0], [10, 9, s0], [9, 7, s1], [10, 8, s1], [11, 7, s1], [11, 3, s2], // Gallery
  [5, 0, c0], [5, 1, c0], [7, 0, c0], [7, 1, c0], [7, 2, c0], [6, 0, c1], [5, 3, e0], [6, 3, e0], [7, 3, e0], [4, 2, e1], [6, 2, e1], // West workshop
  [5, 10, e0], [6, 10, e0], [7, 10, e0], [6, 11, c0], [7, 11, c0], [7, 12, c2],                              // East archive
  [2, 11, c0], [2, 12, c0], [3, 12, c0], [3, 13, c1], [2, 13, c2],                                           // its concealed part
  [5, 5, c0], [5, 6, c0], [7, 5, c0], [7, 6, c0], [7, 7, c0], [6, 5, c1], [7, 8, c1], [5, 8, s1], [6, 7, s1], [6, 8, s1], // Crystal chamber
  [0, 5, s0], [1, 5, s0], [2, 6, s0], [0, 8, c0], [1, 7, c0], [1, 8, c0],                                    // Message antechamber
];

export const RESCUE_LEVEL: LevelDefinition = {
  seed: 104,
  board: boardOf(17, 14, RESCUE_AREAS),
  supply: [],
  strandable: true,
  regions: [
    { name: 'Entry hall', row: 13, col: 3, rows: 3, cols: 4 },
    { name: 'Gallery', row: 9, col: 3, rows: 3, cols: 7, unlock: { tasks: [OPEN_GALLERY_TASK], from: RESCUE_ENTRY, passage: { row: 12, col: 5 } } },
    {
      name: 'Plate room', row: 13, col: 8, rows: 2, cols: 2, hidden: true,
      unlock: { tasks: [REVEAL_PLATE_ROOM_TASK], from: RESCUE_GALLERY, passage: { row: 12, col: 8 } },
    },
    {
      name: 'West workshop', row: 4, col: 0, rows: 4, cols: 4,
      unlock: { tasks: [TRAP_TASK], from: RESCUE_GALLERY, passage: { row: 8, col: 2 }, path: [{ row: 9, col: 2 }] },
    },
    {
      name: 'East archive', row: 5, col: 10, rows: 3, cols: 4,
      unlock: { tasks: [TRAP_TASK], from: RESCUE_GALLERY, passage: { row: 8, col: 11 }, path: [{ row: 9, col: 11 }, { row: 9, col: 10 }] },
    },
    {
      name: 'East archive concealed part', row: 2, col: 11, rows: 2, cols: 3, joins: RESCUE_ARCHIVE, hidden: true, link: { row: 4, col: 11 },
      unlock: { tasks: [REVEAL_ARCHIVE_TASK] },
    },
    {
      name: 'Crystal chamber', row: 4, col: 5, rows: 4, cols: 4,
      unlock: { tasks: [WORKSHOP_TASK, ARCHIVE_TASK], from: RESCUE_GALLERY, passage: { row: 8, col: 6 } },
    },
    {
      name: 'Message antechamber', row: 0, col: 5, rows: 3, cols: 4,
      unlock: { tasks: [RELEASE_TASK], from: RESCUE_CHAMBER, passage: { row: 3, col: 6 } },
    },
  ],
  tasks: [
    { in: RESCUE_ENTRY, plates: [{ row: 13, col: 3, item: c1 }, { row: 13, col: 6, item: s1 }] },                    // 0: opens the gallery
    { in: RESCUE_GALLERY, plates: [{ row: 10, col: 6, item: s3 }] },                                               // 1: reveals the plate room
    { in: RESCUE_PLATE_ROOM, plates: [], alisha: { row: 14, col: 9 } },                                            // 2: the trap
    { in: RESCUE_WORKSHOP, plates: [{ row: 4, col: 0, item: s3 }], symbol: 'note' },                               // 3: the note
    { in: RESCUE_ARCHIVE, plates: [{ row: 5, col: 13, item: e1 }] },                                               // 4: reveals more archive
    { in: RESCUE_ARCHIVE, plates: [{ row: 7, col: 13, item: c3 }], symbol: 'crystal' },                            // 5: the crystal
    { in: RESCUE_CHAMBER, plates: [{ row: 4, col: 5, item: c2 }, { row: 4, col: 7, item: s2 }, { row: 4, col: 8, item: c1 }] }, // 6: the release
    { in: RESCUE_ANTE, plates: [{ row: 2, col: 5, item: s1 }, { row: 2, col: 8, item: c1 }] },                      // 7: reveals the door
  ],
  recipe: {
    id: 'crystal', name: 'Crystal chest', container: 'chest',
    ingredients: [{ item: c2, count: 1 }, { item: e2, count: 1 }], contents: { item: s2, count: 3 },
  },
  workshop: RESCUE_WORKSHOP,
  goal: { kind: 'treasure', at: { row: 0, col: 6 }, prize: 'door', task: ANTE_TASK },
  party: {
    start: { alisha: { row: 16, col: 4 }, fiona: { row: 16, col: 5 } },
    waiting: { alisha: { row: 12, col: 9 }, fiona: { row: 12, col: 10 } },
    trap: { task: TRAP_TASK, release: RELEASE_TASK, fiona: { row: 12, col: 10 }, free: { alisha: { row: 3, col: 7 }, fiona: { row: 3, col: 8 } } },
    talk: RESCUE_TALK,
    // The reunion (C1-11), on the move that releases her. C1-10 comes before play, as the level's opening.
    story: [{ id: 'C1-11', task: RELEASE_TASK }],
  },
};

/** Beyond the gate's regions and tasks, by index. */
export const [BEYOND_GALLERY, BEYOND_COURTYARD, BEYOND_GARDEN, BEYOND_GARDEN_POCKET, BEYOND_GROVE] = [0, 1, 2, 3, 4];
export const [OUTER_DOOR_TASK, COURTYARD_TASK, REVEAL_GREENERY_TASK, GARDEN_TASK] = [0, 1, 2, 3];

// 5 · Beyond the gate: from the message room's landing, out through the palace grounds to its walled grove (key as for
// Woodland cleanup; * a link, d the dog).
//        0  1  2  3  4  5  6  7  8
//    0   ~  ~  ~  .  .  $  d  ~  ~      Walled grove (rows 0-1, cols 3-5, hidden): $ Alisha's spot beside the dog
//    1   ~  ~  ~  .  .  .  ~  ~  ~
//    2   ~  ~  ~  a  |  f  ~  ~  ~      a f: Alisha and Fiona, once the grove is revealed
//    3   ~  ~  e1 . [e3 .  *  e1 e1     Garden passage (rows 3-5, cols 2-5) and its greenery (rows 3-4, cols 7-8, linked at
//    4   ~  ~  .  e2 g1 g1 ~  e1 .        (3,6)): Grove 2 [g2] reveals the greenery; Elk 3 [e3] reveals the grove
//    5   ~  ~  e1 .  g1[g2 ~  d  ~      d: the dog glimpsed ahead, once the garden is open
//    6   ~  ~  ~  |  ~  ~  ~  ~  ~
//    7   ~  . [g3 . [g2 ~  ~  ~  ~      Open courtyard (rows 7-9, cols 1-4): Grove 3 and Grove 2 open the garden
//    8   ~  g2 g2 .  g1 ~  ~  ~  ~
//    9   ~  g2 .  g1 g1 ~  d  ~  ~      d: the dog, a little ahead, at the start
//   10   ~  ~  ~  ~  |  ~  ~  ~  ~
//   11   ~  ~  ~  s1 . [s3 s2 ~  ~      Gallery (rows 11-13, cols 3-6): Song 3 opens the outer door
//   12   ~  ~  ~  s1 .  s1 .  ~  ~
//   13   ~  ~  ~  .  s1 s1 .  ~  ~
//   14   ~  ~  ~  ~  f  a  ~  ~  ~      the message room's landing: Fiona and Alisha
// Decisions: the gallery's five Song 1 make the Song 2 it needs only as one five-merge; the garden's Elk likewise, once
// its greenery is found. The courtyard is short: four Grove 2 make Grove 3, one left for the second tile.
// Winning lines: Gallery (11,3)→(12,4), (12,3)→(12,4) 5-merge, (12,4)→(11,5), (12,3)→(11,5).
//   Courtyard (9,3)→(9,4), (8,1)→(7,2), (9,1)→(7,2), (9,4)→(7,4).
//   Garden (4,5)→(5,5), (4,4)→(5,5) reveals; (3,2)→(3,6), (5,2)→(3,6) 5-merge, (4,3)→(3,4), (3,6)→(3,5), (5,2)→(3,4)
//   reveals the grove; then Alisha onto $.
const BEYOND_AREAS: [number, number, Item][] = [
  [11, 3, s0], [12, 3, s0], [12, 5, s0], [13, 4, s0], [13, 5, s0], [11, 6, s1],     // Gallery
  [8, 1, g1], [8, 2, g1], [9, 1, g1], [8, 4, g0], [9, 3, g0], [9, 4, g0],           // Open courtyard
  [3, 2, e0], [5, 2, e0], [4, 3, e1], [4, 4, g0], [4, 5, g0], [5, 4, g0],           // Garden passage
  [3, 7, e0], [3, 8, e0], [4, 7, e0],                                               // its greenery
];

export const BEYOND_LEVEL: LevelDefinition = {
  seed: 105,
  board: boardOf(15, 9, BEYOND_AREAS),
  supply: [],
  strandable: true,
  regions: [
    { name: 'Gallery', row: 11, col: 3, rows: 3, cols: 4 },
    { name: 'Open courtyard', row: 7, col: 1, rows: 3, cols: 4, unlock: { tasks: [OUTER_DOOR_TASK], from: BEYOND_GALLERY, passage: { row: 10, col: 4 } } },
    { name: 'Garden passage', row: 3, col: 2, rows: 3, cols: 4, unlock: { tasks: [COURTYARD_TASK], from: BEYOND_COURTYARD, passage: { row: 6, col: 3 } } },
    {
      name: 'Garden passage greenery', row: 3, col: 7, rows: 2, cols: 2, joins: BEYOND_GARDEN, hidden: true, link: { row: 3, col: 6 },
      unlock: { tasks: [REVEAL_GREENERY_TASK] },
    },
    {
      name: 'Walled grove', row: 0, col: 3, rows: 2, cols: 3, hidden: true,
      unlock: { tasks: [GARDEN_TASK], from: BEYOND_GARDEN, passage: { row: 2, col: 4 } },
    },
  ],
  tasks: [
    { in: BEYOND_GALLERY, plates: [{ row: 11, col: 5, item: s2 }] },                                   // 0: the outer door
    { in: BEYOND_COURTYARD, plates: [{ row: 7, col: 2, item: g2 }, { row: 7, col: 4, item: g1 }] },     // 1: opens the garden
    { in: BEYOND_GARDEN, plates: [{ row: 5, col: 5, item: g1 }] },                                     // 2: reveals the greenery
    { in: BEYOND_GARDEN, plates: [{ row: 3, col: 4, item: e2 }] },                                     // 3: reveals the grove
  ],
  goal: { kind: 'treasure', at: { row: 0, col: 5 }, prize: 'dog' },
  party: {
    start: { alisha: { row: 14, col: 5 }, fiona: { row: 14, col: 4 } },
    waiting: { alisha: { row: 2, col: 3 }, fiona: { row: 2, col: 5 } },
    dog: [{ at: { row: 9, col: 6 } }, { at: { row: 5, col: 7 }, after: COURTYARD_TASK }, { at: { row: 0, col: 6 }, after: GARDEN_TASK }],
  },
};
