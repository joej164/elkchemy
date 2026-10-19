import { describe, expect, it } from 'vitest';
import type { Cell, Family, Item, Pos, Tier } from '../src/board';
import { LEVELS, PALACE_LEVEL } from '../src/levels';
import { isFixed, isOpen, regionAt, roomOf, sealedRegion, validateRegions, type Region } from '../src/regions';
import {
  applyDrop, canDrop, collect, isCellOpen, previewDrop, retry, startSession, treasureRevealed, undo, type SessionState,
} from '../src/session';
import { evaluateStatus } from '../src/status';
import { renderToStaticMarkup } from 'react-dom/server';
import { describeAction, Game, TaskPanel } from '../src/ui/App';
import { Board } from '../src/ui/Board';
import { canPickUp, initUi, previewCells, reduceUi, treasureShown, type UiAction, type UiState } from '../src/ui/controller';
import { helpObjective, objectiveText, roomsHelp, statusMessage } from '../src/ui/messages';

// Coordinates are (row, column) from 0 on the 16 × 16 board; the design's A1 is p(0, 0) and P16 is p(15, 15).
const p = (row: number, col: number): Pos => ({ row, col });
const it_ = (family: Family, tier: Tier): Item => ({ family, tier });
const regions = PALACE_LEVEL.regions!;
const tasks = PALACE_LEVEL.tasks!;
const [START, HUB, FERN, CRYSTAL, LODGE, HIDDEN, PALACE] = [0, 1, 2, 3, 4, 5, 6];
const [OPEN_HUB_TASK, BRANCH_TASK, REVEAL_TASK, FERN_TASK, CRYSTAL_TASK, LODGE_TASK, CASE_TASK] = [0, 1, 2, 3, 4, 5, 6];
const BRANCH_TASKS = [FERN_TASK, CRYSTAL_TASK, LODGE_TASK];
const LINK = p(3, 10);   // K4
const CASE = p(4, 2);    // C5

type Move = [Pos, Pos];
// Each area's moves in the design's local (row, column) coordinates from its top-left corner.
const local = (top: number, left: number, moves: [number, number, number, number][]): Move[] =>
  moves.map(([a, b, c, d]) => [p(top + a, left + b), p(top + c, left + d)]);
const OPEN_HUB = local(7, 1, [[1, 2, 0, 1], [0, 1, 0, 3]]);
const OPEN_BRANCHES = local(7, 6, [[1, 2, 0, 1], [0, 1, 2, 0], [2, 0, 0, 3]]);
const REVEAL = local(2, 6, [[1, 2, 0, 1], [0, 1, 0, 3]]);
const FINISH_FERN = local(2, 6, [[0, 5, 2, 0], [2, 0, 2, 5], [2, 5, 3, 2], [0, 7, 1, 0], [1, 0, 3, 3]]);
const FINISH_CRYSTAL = local(7, 11, [[1, 2, 0, 1], [0, 1, 2, 0], [2, 0, 3, 0], [3, 0, 3, 3]]);
const FINISH_LODGE = local(12, 6, [[1, 2, 0, 1], [0, 1, 2, 0], [2, 0, 3, 3]]);
const FINISH_PALACE = local(0, 0, [[1, 2, 0, 1], [0, 1, 2, 0], [2, 0, 3, 0], [3, 0, 0, 3], [4, 3, 4, 1], [4, 1, 3, 3], [3, 3, 1, 3]]);
const BRANCH_MOVES: Record<number, Move[]> = {
  [FERN_TASK]: [...REVEAL, ...FINISH_FERN], [CRYSTAL_TASK]: FINISH_CRYSTAL, [LODGE_TASK]: FINISH_LODGE,
};

function play(s: SessionState, moves: readonly Move[]): SessionState {
  for (const [from, to] of moves) {
    const next = applyDrop(s, from, to);
    expect(next, `${JSON.stringify(from)} → ${JSON.stringify(to)}`).not.toBe(s);
    expect(evaluateStatus(next)).toBe('playing');
    s = next;
  }
  return s;
}
const withBoard = (s: SessionState, cells: [number, number, Cell][]): SessionState => {
  const board: Cell[][] = s.board.map((r) => [...r]);
  for (const [row, col, c] of cells) board[row][col] = c;
  return { ...s, board };
};
const itemsIn = (s: SessionState, r: Region): string[] => {
  const out: string[] = [];
  for (let row = r.row; row < r.row + r.rows; row++) for (let col = r.col; col < r.col + r.cols; col++) {
    const c = s.board[row][col];
    if (c) out.push(`${c.family}${c.tier + 1}`);   // player-facing tiers
  }
  return out.sort();
};
const openRegions = (s: SessionState) => regions.map((_, i) => i).filter((i) => isOpen(s, i));
const branchesOpen = () => play(play(startSession(PALACE_LEVEL), OPEN_HUB), OPEN_BRANCHES);

describe('The Crystal Palace: layout', () => {
  it('is level 9: seven areas on a 16 × 16 map, with the approved rectangles, routes and buildings', () => {
    expect(LEVELS[8]).toEqual({ name: 'The Crystal Palace', definition: PALACE_LEVEL });
    expect(() => validateRegions(PALACE_LEVEL)).not.toThrow();
    expect(PALACE_LEVEL.board).toHaveLength(16);
    PALACE_LEVEL.board.forEach((r) => expect(r).toHaveLength(16));
    expect(regions.map((r) => [r.name, r.row, r.col, r.rows, r.cols])).toEqual([
      ['Starting Glade', 7, 1, 4, 4],            // B8-E11
      ['Songbird Glade', 7, 6, 4, 4],            // G8-J11
      ['Fern Glade', 2, 6, 4, 4],                // G3-J6
      ['Crystal Glade', 7, 11, 4, 4],            // L8-O11
      ['Woodland Lodge', 12, 6, 4, 4],           // G13-J16
      ['Fern Glade concealed part', 2, 11, 3, 3], // L3-N5
      ['Crystal Palace', 0, 0, 5, 4],            // A1-D5
    ]);
    expect([regions[HIDDEN].joins, regions[HIDDEN].hidden, regions[HIDDEN].link]).toEqual([FERN, true, LINK]);
    expect(regions.map((_, i) => roomOf(regions, i))).toEqual([START, HUB, FERN, CRYSTAL, LODGE, FERN, PALACE]);
    expect(regions.map((r) => r.building)).toEqual([undefined, undefined, undefined, undefined, 'lodge', undefined, 'palace']);
    // Gates: F10 to the hub, I7, K9 and I12 to the branches; the palace's at F7 on the path G7, F7-B7, B6.
    const route = (i: number) => (regions[i].unlock as { from?: number; passage?: Pos; path?: Pos[] });
    expect([1, 2, 3, 4].map((i) => [route(i).from, route(i).passage])).toEqual([[START, p(9, 5)], [HUB, p(6, 8)], [HUB, p(8, 10)], [HUB, p(11, 8)]]);
    expect([route(PALACE).from, route(PALACE).passage, route(PALACE).path]).toEqual([
      HUB, p(6, 5), [p(6, 6), p(6, 4), p(6, 3), p(6, 2), p(6, 1), p(5, 1)],
    ]);
    expect(sealedRegion(regions)).toBe(PALACE);
    expect(regions.map((r) => (r.unlock && 'tasks' in r.unlock ? r.unlock.tasks : null))).toEqual([
      null, [OPEN_HUB_TASK], [BRANCH_TASK], [BRANCH_TASK], [BRANCH_TASK], [REVEAL_TASK], BRANCH_TASKS,
    ]);
    expect(BRANCH_TASKS.map((t) => [tasks[t].in, tasks[t].symbol])).toEqual([[FERN, 'fern'], [CRYSTAL, 'crystal'], [LODGE, 'note']]);
    expect(PALACE_LEVEL.goal).toEqual({ kind: 'treasure', at: CASE, prize: 'ukulele', task: CASE_TASK });
    // Every item is inside an area; terrain and routes are empty scenery.
    PALACE_LEVEL.board.forEach((row, r) => row.forEach((c, col) => { if (c) expect(regionAt(regions, p(r, col))).not.toBe(-1); }));
  });

  it('places exactly the approved inventories, with the marked tiles needing exact player-facing tiers', () => {
    const s = startSession(PALACE_LEVEL);
    expect(itemsIn(s, regions[START])).toEqual(['grove1', 'grove1', 'grove1']);
    expect(itemsIn(s, regions[HUB])).toEqual(['song1', 'song1', 'song1', 'song2', 'song2']);
    expect(itemsIn(s, regions[FERN])).toEqual(['crystal1', 'crystal1', 'grove1', 'grove1', 'grove1', 'song1', 'song1']);
    expect(itemsIn(s, regions[HIDDEN])).toEqual(['crystal1', 'crystal2', 'crystal2', 'song1']);
    expect(itemsIn(s, regions[CRYSTAL])).toEqual(['crystal1', 'crystal1', 'crystal1', 'crystal2', 'crystal2', 'crystal3', 'crystal3']);
    expect(itemsIn(s, regions[LODGE])).toEqual(['song1', 'song1', 'song1', 'song2', 'song2']);
    expect(itemsIn(s, regions[PALACE])).toEqual([
      'crystal1', 'crystal1', 'crystal1', 'crystal2', 'crystal2', 'crystal3', 'crystal3', 'song1', 'song1', 'song1', 'song2', 'song2',
    ]);
    const plates = tasks.map((t) => t.plates.map((pl) => [pl.row, pl.col, `${pl.item.family}${pl.item.tier + 1}`]));
    expect(plates).toEqual([
      [[7, 4, 'grove2']],                        // E8
      [[7, 9, 'song3']],                         // J8
      [[2, 9, 'grove2']],                        // J3
      [[5, 8, 'crystal3'], [5, 9, 'song2']],     // I6, J6
      [[10, 14, 'crystal4']],                    // O11
      [[15, 9, 'song3']],                        // J16
      [[0, 3, 'crystal4'], [1, 3, 'song3']],     // D1, D2
    ]);
    // Fern Glade's two Crystal and two Song tier 1 cannot merge on their own.
    expect(previewDrop(s, p(4, 6), p(4, 7))).toEqual([]);
  });
});

describe('The Crystal Palace: winning line', () => {
  it('wins through every area with the stated items, through the actual session rules', () => {
    let s = startSession(PALACE_LEVEL);
    expect(openRegions(s)).toEqual([START]);
    s = play(s, OPEN_HUB.slice(0, 1));
    expect(s.board[7][2]).toEqual(it_('grove', 1));
    s = play(s, OPEN_HUB.slice(1));
    expect([openRegions(s), s.done]).toEqual([[START, HUB], [OPEN_HUB_TASK]]);
    s = play(s, OPEN_BRANCHES.slice(0, 2));
    expect(s.board[9][6]).toEqual(it_('song', 2));
    s = play(s, OPEN_BRANCHES.slice(2));
    expect([openRegions(s), s.done]).toEqual([[START, HUB, FERN, CRYSTAL, LODGE], [OPEN_HUB_TASK, BRANCH_TASK]]);
    s = play(s, FINISH_CRYSTAL.slice(0, 3));
    expect(s.board[10][11]).toEqual(it_('crystal', 3));
    s = play(s, FINISH_CRYSTAL.slice(3));
    expect(s.done).toContain(CRYSTAL_TASK);
    s = play(s, FINISH_LODGE.slice(0, 2));
    expect(s.board[14][6]).toEqual(it_('song', 2));
    s = play(s, FINISH_LODGE.slice(2));
    expect(s.done).toContain(LODGE_TASK);
    s = play(s, REVEAL);
    expect(openRegions(s)).toEqual([START, HUB, FERN, CRYSTAL, LODGE, HIDDEN]);
    s = play(s, FINISH_FERN.slice(0, 2));
    expect(s.board[4][11]).toEqual(it_('crystal', 2));
    s = play(s, FINISH_FERN.slice(2, 4));
    expect(s.board[3][6]).toEqual(it_('song', 1));
    expect(isOpen(s, PALACE)).toBe(false);
    s = play(s, FINISH_FERN.slice(4));
    expect(openRegions(s)).toEqual([START, HUB, FERN, CRYSTAL, LODGE, HIDDEN, PALACE]);
    expect(treasureRevealed(s)).toBe(false);
    s = play(s, FINISH_PALACE.slice(0, 3));
    expect(s.board[3][0]).toEqual(it_('crystal', 3));
    s = play(s, FINISH_PALACE.slice(3, 6));
    expect(s.board[3][3]).toEqual(it_('song', 2));
    expect(treasureRevealed(s)).toBe(false);
    s = play(s, FINISH_PALACE.slice(6));
    expect(treasureRevealed(s)).toBe(true);
    expect(s.done).toHaveLength(tasks.length);
    const won = collect(s);
    expect([won.collected, evaluateStatus(won)]).toEqual([true, 'won']);
    expect(won.moves).toBe(2 + 3 + 4 + 3 + 7 + 7 + 1);
  });
});

describe('The Crystal Palace: branches in any order', () => {
  const orders = [
    [FERN_TASK, CRYSTAL_TASK, LODGE_TASK], [FERN_TASK, LODGE_TASK, CRYSTAL_TASK], [CRYSTAL_TASK, FERN_TASK, LODGE_TASK],
    [CRYSTAL_TASK, LODGE_TASK, FERN_TASK], [LODGE_TASK, FERN_TASK, CRYSTAL_TASK], [LODGE_TASK, CRYSTAL_TASK, FERN_TASK],
  ];
  it.each(orders)('completes %i, %i, %i: the palace stays sealed until the third, then opens on that move and wins', (...order) => {
    let s = branchesOpen();
    const done: number[] = [];
    for (const t of order) {
      expect(isOpen(s, PALACE)).toBe(false);
      s = play(s, BRANCH_MOVES[t]);
      done.push(t);
      // Exactly the completed branches are done (their symbols lit), each completion a checkpoint.
      expect(BRANCH_TASKS.filter((b) => s.done.includes(b)).sort()).toEqual([...done].sort());
      expect(s.undo).toBeNull();
      expect(isOpen(s, PALACE)).toBe(done.length === 3);
    }
    expect(treasureRevealed(s)).toBe(false);
    s = play(s, FINISH_PALACE);
    expect(evaluateStatus(collect(s))).toBe('won');
  });

  it('opens all three branches on one move, as one checkpoint, without opening the concealed part or the palace', () => {
    const before = play(play(startSession(PALACE_LEVEL), OPEN_HUB), OPEN_BRANCHES.slice(0, 2));
    expect([FERN, CRYSTAL, LODGE].map((i) => isOpen(before, i))).toEqual([false, false, false]);
    expect(before.undo).not.toBeNull();
    const s = applyDrop(before, ...OPEN_BRANCHES[2]);
    expect(s.done).toEqual([OPEN_HUB_TASK, BRANCH_TASK]);
    expect(openRegions(s)).toEqual([START, HUB, FERN, CRYSTAL, LODGE]);
    expect([isOpen(s, HIDDEN), isOpen(s, PALACE), isCellOpen(s, LINK)]).toEqual([false, false, false]);
    expect(s.undo).toBeNull();
    expect(isFixed(s, p(7, 9))).toBe(true);
  });

  it('keeps partial work in one branch while another is completed, then finishes it', () => {
    let s = play(branchesOpen(), FINISH_CRYSTAL.slice(0, 2));          // Crystal Glade half done
    const crystalItems = itemsIn(s, regions[CRYSTAL]);
    s = play(s, REVEAL);                                               // switch to Fern Glade: reveal its concealed part
    s = play(s, FINISH_FERN.slice(0, 3));                              // and fill its Crystal plate only
    expect(s.done).not.toContain(FERN_TASK);
    expect(isFixed(s, p(5, 8))).toBe(false);                           // a partly filled task fixes nothing
    s = play(s, FINISH_LODGE);                                         // finish the lodge
    expect(itemsIn(s, regions[CRYSTAL])).toEqual(crystalItems);       // Crystal Glade untouched meanwhile
    s = play(s, FINISH_CRYSTAL.slice(2));                              // back to Crystal Glade
    s = play(s, FINISH_FERN.slice(3));                                 // and Fern Glade, which opens the palace
    expect(BRANCH_TASKS.every((t) => s.done.includes(t))).toBe(true);
    expect(isOpen(s, PALACE)).toBe(true);
  });

  it('keeps completed branches and opened areas through later Undo', () => {
    let s = play(branchesOpen(), FINISH_CRYSTAL);
    s = applyDrop(s, ...FINISH_LODGE[0]);
    const back = undo(s);
    expect(back.done).toContain(CRYSTAL_TASK);
    expect(openRegions(back)).toEqual(openRegions(s));
    expect(undo(back)).toBe(back);                                     // single-step Undo, never past a checkpoint
  });
});

describe('The Crystal Palace: the concealed part of Fern Glade', () => {
  const ext = [p(2, 11), p(2, 12), p(2, 13), p(3, 11), p(3, 12), p(3, 13), p(4, 11), p(4, 12), p(4, 13), LINK];

  it('is unusable before discovery: no drops onto it or out of it, and no merge group through it', () => {
    const s = branchesOpen();
    for (const q of ext) expect(isCellOpen(s, q)).toBe(false);
    expect(canDrop(s, p(2, 11), p(2, 12))).toBe(false);                // within it
    expect(canDrop(s, p(2, 11), p(4, 6))).toBe(false);                 // out of it
    expect(canDrop(s, p(4, 6), p(3, 11))).toBe(false);                 // into it
    expect(canDrop(s, p(4, 6), LINK)).toBe(false);                     // onto the link
    expect(applyDrop(s, p(2, 11), p(4, 6))).toBe(s);
    // Matching items on the hidden link and beyond would not join a Fern Glade merge group.
    const lined = withBoard(s, [[3, 9, it_('crystal', 0)], [3, 10, it_('crystal', 0)], [3, 11, it_('crystal', 0)]]);
    expect(previewDrop(lined, p(4, 6), p(3, 9))).toEqual([]);
  });

  it('reveals the concealed part and K4 together, as Fern Glade floor: moves, swaps and merges pass through K4', () => {
    const s = play(branchesOpen(), REVEAL);
    expect(s.done).toEqual([OPEN_HUB_TASK, BRANCH_TASK, REVEAL_TASK]);
    expect(s.undo).toBeNull();
    for (const q of ext) expect(isCellOpen(s, q)).toBe(true);
    expect(roomOf(regions, regionAt(regions, LINK))).toBe(FERN);
    const onto = applyDrop(s, p(2, 11), LINK);                         // concealed part → link
    expect([onto.board[3][10], onto.board[2][11]]).toEqual([it_('crystal', 0), null]);
    const off = applyDrop(onto, LINK, p(5, 6));                        // link → Fern Glade
    expect([off.board[5][6], off.board[3][10]]).toEqual([it_('crystal', 0), null]);
    const swap = applyDrop(onto, p(4, 11), LINK);                      // Crystal tier 2 ⇄ the link's Crystal tier 1
    expect([swap.board[3][10], swap.board[4][11]]).toEqual([it_('crystal', 1), it_('crystal', 0)]);
    // A merge group running from Fern Glade through K4 into the concealed part.
    const lined = withBoard(s, [[2, 11, null], [3, 9, it_('crystal', 0)], [3, 10, it_('crystal', 0)], [3, 11, it_('crystal', 0)]]);
    expect(previewDrop(lined, p(4, 6), p(3, 9))).toEqual([p(4, 6), p(3, 9), p(3, 10)]);
    const five = withBoard(lined, [[3, 12, it_('crystal', 0)]]);
    expect(previewDrop(five, p(4, 6), p(3, 9))).toEqual([p(4, 6), p(3, 9), p(3, 10), p(3, 11), p(3, 12)]);
    const merged = applyDrop(five, p(4, 6), p(3, 9));
    expect([merged.board[3][9], merged.board[4][6], merged.board[3][10], merged.board[3][12]]).toEqual([it_('crystal', 1), it_('crystal', 1), null, null]);
  });
});

describe('The Crystal Palace: rooms stay separate', () => {
  it('refuses every move, swap and merge between separate rooms, and onto routes or terrain, even with everything open', () => {
    let s = branchesOpen();
    for (const t of BRANCH_TASKS) s = play(s, BRANCH_MOVES[t]);
    expect(openRegions(s)).toHaveLength(regions.length);
    // One item of each area, all Song tier 1 so any allowed drop between them could merge or swap.
    const t = withBoard(s, [[8, 1, it_('song', 0)], [8, 6, it_('song', 0)], [3, 7, it_('song', 0)], [2, 12, it_('song', 0)],
      [8, 12, it_('song', 0)], [13, 7, it_('song', 0)], [1, 1, it_('song', 0)]]);
    const spots = [p(8, 1), p(8, 6), p(3, 7), p(2, 12), p(8, 12), p(13, 7), p(1, 1)];
    const rooms = spots.map((q) => roomOf(regions, regionAt(regions, q)));
    spots.forEach((a, i) => spots.forEach((b, j) => {
      if (i !== j) expect(canDrop(t, a, b), `${JSON.stringify(a)} → ${JSON.stringify(b)}`).toBe(rooms[i] === rooms[j]);
    }));
    expect(rooms[2]).toBe(rooms[3]);                                    // Fern Glade and its concealed part are one room
    for (const scenery of [p(9, 5), p(6, 8), p(8, 10), p(11, 8), p(6, 5), p(6, 6), p(5, 1), p(0, 4), p(12, 5)]) {
      expect(canDrop(t, p(8, 6), scenery)).toBe(false);
    }
  });

  it('keeps every room\'s resources until it opens: the palace takes no drops before its gate opens', () => {
    const s = play(branchesOpen(), [...FINISH_CRYSTAL, ...FINISH_LODGE]);
    expect(isOpen(s, PALACE)).toBe(false);
    expect(canDrop(s, p(1, 2), p(0, 1))).toBe(false);
    expect(applyDrop(s, p(1, 2), p(0, 1))).toBe(s);
    expect(previewDrop(s, p(1, 2), p(0, 1))).toEqual([]);
  });
});

describe('The Crystal Palace: marked tiles and checkpoints', () => {
  it('needs exact tiers: lower or higher items, or other families, complete nothing', () => {
    const s = branchesOpen();
    for (const wrong of [it_('crystal', 2), it_('song', 3), it_('grove', 3)]) {
      expect(applyDrop(withBoard(s, [[8, 14, wrong]]), p(8, 14), p(10, 14)).done).not.toContain(CRYSTAL_TASK);
    }
    expect(applyDrop(withBoard(s, [[8, 14, it_('crystal', 3)]]), p(8, 14), p(10, 14)).done).toContain(CRYSTAL_TASK);
    for (const wrong of [it_('grove', 0), it_('grove', 2), it_('song', 1)]) {
      expect(applyDrop(withBoard(s, [[3, 9, wrong]]), p(3, 9), p(2, 9)).done).not.toContain(REVEAL_TASK);
    }
  });

  it('a two-plate task completes only with both plates exact, on the move that fills the second', () => {
    const s = play(branchesOpen(), REVEAL);
    const crystalOnly = withBoard(s, [[4, 9, it_('crystal', 2)]]);
    const one = applyDrop(crystalOnly, p(4, 9), p(5, 8));
    expect(one.done).not.toContain(FERN_TASK);
    expect(isFixed(one, p(5, 8))).toBe(false);
    expect(canDrop(one, p(5, 8), p(4, 9))).toBe(true);                  // still free to move away
    const wrongSong = applyDrop(withBoard(one, [[4, 8, it_('song', 2)]]), p(4, 8), p(5, 9));
    expect(wrongSong.done).not.toContain(FERN_TASK);
    const both = applyDrop(withBoard(one, [[4, 8, it_('song', 1)]]), p(4, 8), p(5, 9));
    expect(both.done).toContain(FERN_TASK);
    expect([isFixed(both, p(5, 8)), isFixed(both, p(5, 9)), both.undo]).toEqual([true, true, null]);
    expect(canDrop(both, p(5, 8), p(4, 9))).toBe(false);
    expect(canDrop(both, p(4, 9), p(5, 9))).toBe(false);
  });

  it('every checkpoint fixes its items and clears Undo; the next ordinary move gets a fresh single Undo back to it', () => {
    let s = startSession(PALACE_LEVEL);
    const checkpoints: [Move[], Pos[]][] = [
      [OPEN_HUB, [p(7, 4)]], [OPEN_BRANCHES, [p(7, 9)]], [REVEAL, [p(2, 9)]], [FINISH_FERN, [p(5, 8), p(5, 9)]],
      [FINISH_CRYSTAL, [p(10, 14)]], [FINISH_LODGE, [p(15, 9)]], [FINISH_PALACE, [p(0, 3), p(1, 3)]],
    ];
    let checkpoint: SessionState | null = null;
    for (const [moves, plates] of checkpoints) {
      for (const [k, move] of moves.entries()) {
        s = play(s, [move]);
        if (k === 0 && checkpoint) expect(undo(s)).toEqual(checkpoint);  // fresh Undo, back to the checkpoint and no further
      }
      expect(s.undo).toBeNull();
      expect(undo(s)).toBe(s);
      for (const q of plates) expect(isFixed(s, q)).toBe(true);
      checkpoint = s;
    }
    expect(s.done).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('The Crystal Palace: the ukulele case', () => {
  const palaceOpen = () => {
    let s = branchesOpen();
    for (const t of BRANCH_TASKS) s = play(s, BRANCH_MOVES[t]);
    return s;
  };

  it('is absent until both final plates are met: it cannot be opened, and its cell takes no item', () => {
    let s = startSession(PALACE_LEVEL);
    expect(collect(s)).toBe(s);
    s = palaceOpen();
    expect([treasureRevealed(s), collect(s)]).toEqual([false, s]);
    expect(canDrop(s, p(4, 1), CASE)).toBe(false);                       // even an empty-looking floor tile
    s = play(s, FINISH_PALACE.slice(0, 4));                              // the Crystal plate alone
    expect([treasureRevealed(s), collect(s)]).toEqual([false, s]);
    expect(isFixed(s, p(0, 3))).toBe(false);
    s = play(s, FINISH_PALACE.slice(4));
    expect([treasureRevealed(s), s.done[s.done.length - 1], s.undo]).toEqual([true, CASE_TASK, null]);
    expect(s.board[CASE.row][CASE.col]).toBeNull();
  });

  it('opening it is one undoable move that wins; Undo closes it with the final puzzle still done; Retry resets everything', () => {
    const revealed = play(palaceOpen(), FINISH_PALACE);
    const won = collect(revealed);
    expect([won.collected, evaluateStatus(won), collect(won)]).toEqual([true, 'won', won]);
    const undone = undo(won);
    expect([undone.collected, evaluateStatus(undone), treasureRevealed(undone)]).toEqual([false, 'playing', true]);
    expect(undone.done).toEqual(revealed.done);
    expect(retry(won)).toEqual(startSession(PALACE_LEVEL));
    expect(retry(revealed)).toEqual(startSession(PALACE_LEVEL));
    expect(retry(branchesOpen())).toEqual(startSession(PALACE_LEVEL));
  });
});

describe('The Crystal Palace: validation of levels with tasks', () => {
  const withRegion = (i: number, change: Partial<Region>) =>
    ({ ...PALACE_LEVEL, regions: regions.map((r, j) => (j === i ? { ...r, ...change } : r)) });
  const withTask = (i: number, change: object) =>
    ({ ...PALACE_LEVEL, tasks: tasks.map((t, j) => (j === i ? { ...t, ...change } : t)) });
  const unlock = (i: number) => regions[i].unlock as { tasks: number[]; from?: number; passage?: Pos; path?: Pos[] };

  it('rejects unsupported task configurations', () => {
    expect(() => validateRegions({ ...regionsLevel(), tasks })).toThrow(/only room levels have tasks/);
    expect(() => validateRegions({ ...PALACE_LEVEL, tasks: undefined })).toThrow(/region 1 cannot open by tasks/);
    expect(() => validateRegions(withRegion(1, { unlock: { kind: 'pressure', in: 0, plates: tasks[0].plates, passage: p(9, 5) } })))
      .toThrow(/region 1 must open by tasks/);
    expect(() => validateRegions(withRegion(1, { unlock: { ...unlock(1), tasks: [] } }))).toThrow(/region 1 needs distinct tasks/);
    expect(() => validateRegions(withRegion(1, { unlock: { ...unlock(1), tasks: [9] } }))).toThrow(/region 1 needs distinct tasks/);
    expect(() => validateRegions(withTask(2, { plates: [{ row: 7, col: 9, item: it_('grove', 1) }] }))).toThrow(/task 2's plates must be in region 2/);
    expect(() => validateRegions(withTask(3, { plates: [tasks[2].plates[0]], in: 2 }))).toThrow(/on cells of their own/);
    expect(() => validateRegions(withTask(0, { in: 1, plates: [{ row: 8, col: 9, item: it_('song', 2) }] })))
      .toThrow(/task 0's region must open by earlier tasks/);
    expect(() => validateRegions(withTask(0, { plates: [{ row: 7, col: 1, item: it_('grove', 0) }] }))).toThrow(/task 0 must not be done at the start/);
    expect(() => validateRegions(withTask(4, { symbol: undefined }))).toThrow(/region 6 is the one region needing several tasks/);
    expect(() => validateRegions(withTask(4, { symbol: 'fern' }))).toThrow(/region 6 is the one region needing several tasks/);
    expect(() => validateRegions(withRegion(4, { unlock: { ...unlock(4), tasks: [1, 0] } }))).toThrow(/region 4 is the one region/);
  });

  it('rejects routes that are not free, connected terrain from their room, and treasures waiting on another room\'s task', () => {
    expect(() => validateRegions(withRegion(1, { unlock: { ...unlock(1), passage: undefined } }))).toThrow(/needs a passage or a link/);
    expect(() => validateRegions(withRegion(5, { unlock: { tasks: [2], from: 2, passage: p(3, 10) } }))).toThrow(/needs a passage or a link/);
    expect(() => validateRegions(withRegion(1, { unlock: { ...unlock(1), from: undefined } }))).toThrow(/route needs a room to lead from/);
    expect(() => validateRegions(withRegion(1, { unlock: { ...unlock(1), from: 1 } }))).toThrow(/route needs a room to lead from/);
    expect(() => validateRegions(withRegion(1, { unlock: { ...unlock(1), passage: p(8, 4) } }))).toThrow(/route must be free terrain/);
    expect(() => validateRegions(withRegion(2, { unlock: { ...unlock(2), passage: p(6, 6) } }))).toThrow(/route must be free terrain/);
    expect(() => validateRegions(withRegion(1, { unlock: { ...unlock(1), passage: p(12, 3) } }))).toThrow(/route must join room 0 to it/);
    const gap = unlock(6).path!.filter((q) => !(q.row === 6 && q.col === 3));
    expect(() => validateRegions(withRegion(6, { unlock: { ...unlock(6), path: gap } }))).toThrow(/route must join room 1 to it/);
    expect(() => validateRegions({ ...PALACE_LEVEL, goal: { ...PALACE_LEVEL.goal, task: 5 } as typeof PALACE_LEVEL.goal }))
      .toThrow(/the treasure's task must be in its region/);
    expect(() => validateRegions(withRegion(0, { building: 'lodge' }))).not.toThrow();
    expect(() => validateRegions({ ...regionsLevel(), regions: regionsLevel().regions!.map((r, j) => (j === 1 ? { ...r, building: 'lodge' as const } : r)) }))
      .toThrow(/region 1 cannot be a building/);
  });
});

/** The Hidden Hollow: an item-goal region level, which can't have tasks or buildings. */
function regionsLevel() {
  return LEVELS[5].definition;
}

describe('The Crystal Palace: input, view and announcements', () => {
  const run = (s: UiState, ...actions: UiAction[]) => actions.reduce(reduceUi, s);
  const drops = (moves: readonly Move[]): UiAction[] => moves.map(([from, to]) => ({ type: 'drop', from, to }));
  const taps = (moves: readonly Move[]): UiAction[] => moves.flatMap(([from, to]) => [{ type: 'tap', pos: from }, { type: 'tap', pos: to }]);
  const say = (s: UiState) => describeAction(s.lastAction, 'Level', PALACE_LEVEL.goal, regions, tasks);

  it('brings the hub and the concealed part into view, and keeps the view for the branches, completions and the palace', () => {
    let s = run(initUi(PALACE_LEVEL), ...drops(OPEN_HUB));
    expect(s.lastAction).toEqual({ kind: 'move', opened: HUB, progress: { tasks: [OPEN_HUB_TASK], regions: [HUB] } });
    expect(say(s)).toBe('Moved an item. The rune gate to Songbird Glade opened.');
    s = run(s, ...drops(OPEN_BRANCHES));
    expect(s.lastAction).toEqual({ kind: 'move', progress: { tasks: [BRANCH_TASK], regions: [FERN, CRYSTAL, LODGE] } });
    expect(say(s)).toBe('Moved an item. The rune gates to Fern Glade, Crystal Glade and Woodland Lodge opened.');
    s = run(s, ...drops(FINISH_CRYSTAL));
    expect(s.lastAction).toEqual({ kind: 'move', progress: { tasks: [CRYSTAL_TASK], regions: [] } });
    expect(say(s)).toBe('Moved an item. Crystal Glade is complete: its crystal is lit on the gate to Crystal Palace.');
    s = run(s, ...drops(REVEAL));
    expect(s.lastAction).toEqual({ kind: 'move', opened: HIDDEN, progress: { tasks: [REVEAL_TASK], regions: [HIDDEN] } });
    expect(say(s)).toBe('Moved an item. More of Fern Glade was revealed, with more items to use.');
    s = run(s, ...drops(FINISH_FERN));
    expect(say(s)).toBe('Moved an item. Fern Glade is complete: its fern is lit on the gate to Crystal Palace.');
    s = run(s, ...drops(FINISH_LODGE));
    expect(s.lastAction).toEqual({ kind: 'move', progress: { tasks: [LODGE_TASK], regions: [PALACE] } });
    expect(say(s)).toBe('Moved an item. Woodland Lodge is complete: its musical note is lit on the gate to Crystal Palace. ' +
      'The rune gate to Crystal Palace opened.');
    s = run(s, ...drops(FINISH_PALACE));
    expect([s.lastAction, treasureShown(s)]).toEqual([{ kind: 'move', progress: { tasks: [CASE_TASK], regions: [] } }, true]);
    expect(say(s)).toBe('Moved an item. A closed ukulele case appeared in Crystal Palace.');
    s = run(s, { type: 'tap', pos: CASE });
    expect([s.status, say(s)]).toEqual(['won', 'Opened the ukulele case: a ukulele is inside.']);
  });

  it('wins by taps alone; the case stays closed until tapped, and a tap on its empty cell before then does nothing', () => {
    const start = initUi(PALACE_LEVEL);
    const ready = run(start, ...taps([...OPEN_HUB, ...OPEN_BRANCHES, ...BRANCH_MOVES[LODGE_TASK], ...BRANCH_MOVES[FERN_TASK],
      ...BRANCH_MOVES[CRYSTAL_TASK]]));
    expect(isOpen(ready.session, PALACE)).toBe(true);
    expect(run(ready, { type: 'tap', pos: CASE })).toBe(ready);
    const revealed = run(ready, ...taps(FINISH_PALACE));
    expect([revealed.status, treasureShown(revealed)]).toEqual(['playing', true]);
    const won = run(revealed, { type: 'tap', pos: CASE });
    expect(won.status).toBe('won');
    expect(run(won, { type: 'undo' }).status).toBe('playing');
    expect(run(won, { type: 'retry' }).session).toEqual(start.session);
  });

  it('tells the player the next step without a required order, and names nothing concealed before discovery', () => {
    let s = initUi(PALACE_LEVEL);
    const concealed = /concealed|hidden|secret|pocket|alcove|more of/i;
    expect(statusMessage(s, true)).toBe('Put Grove, tier 2 of 4 on the pressure plate in Starting Glade to open the rune gate to ' +
      'Songbird Glade. Drag empty ground to pan.');
    s = run(s, ...drops(OPEN_HUB));
    // The checklist already names the three branches, so the banner counts them.
    expect(statusMessage(s, false)).toBe('Put Song, tier 3 of 4 on the pressure plate in Songbird Glade to open the rune gates to ' +
      'all three branches.');
    s = run(s, ...drops(OPEN_BRANCHES));
    // The checklist shows each branch's needs; the banner only names what is left, spelling out the last one's need.
    const three = statusMessage(s, false);
    expect(three).toBe('Complete the three branches in any order to open Crystal Palace.');
    const help = [roomsHelp(regions, (i) => isOpen(s.session, i), tasks), helpObjective(PALACE_LEVEL.goal, regions)];
    expect(help).toEqual([
      'Marked tiles work by themselves, on the move that puts exactly the items shown on them: they open rune gates, or ' +
      'complete Fern Glade, Crystal Glade or Woodland Lodge, in any order. Each one completed lights its symbol on the gate to ' +
      'Crystal Palace, and all three open it. Items never leave their own room.',
      'Goal: open the rune gates and open the ukulele case in Crystal Palace.',
    ]);
    for (const text of [three, ...help, objectiveText(PALACE_LEVEL.goal, regions)]) expect(text).not.toMatch(concealed);
    s = run(s, ...drops(FINISH_CRYSTAL));
    expect(statusMessage(s, false)).toBe('Complete Fern Glade and Woodland Lodge in either order to open Crystal Palace.');
    s = run(s, ...drops(FINISH_LODGE));
    // The last branch, Fern Glade, asks only for its Grove item until its concealed part is found.
    const last = statusMessage(s, false);
    expect(last).toBe('Complete Fern Glade to open Crystal Palace: put Grove, tier 2 of 4 on its marked tile.');
    expect(last).not.toMatch(concealed);
    s = run(s, ...drops(REVEAL));
    // The discovery is told on the move that made it (the checklist shows the new needs), then not repeated.
    expect(statusMessage(s, false)).toBe('More of Fern Glade has been revealed. Complete Fern Glade to open Crystal Palace.');
    expect(roomsHelp(regions, (i) => isOpen(s.session, i), tasks)).toContain(' More of Fern Glade has been revealed: items move, swap ' +
      'and merge anywhere in it. Items never leave their own room.');
    s = run(s, ...drops(FINISH_FERN.slice(0, 1)));
    expect(statusMessage(s, false)).toBe('Complete Fern Glade to open Crystal Palace: put Crystal, tier 3 of 4 and Song, tier 2 of 4 on its ' +
      'marked tiles.');
    s = run(s, ...drops(FINISH_FERN.slice(1)));
    expect(statusMessage(s, false)).toBe('Crystal Palace is open: put Crystal, tier 4 of 4 and Song, tier 3 of 4 on its marked tiles.');
    s = run(s, ...drops(FINISH_PALACE.slice(0, 1)));
    expect(statusMessage(s, false)).toBe('Put Crystal, tier 4 of 4 and Song, tier 3 of 4 on the pressure plates in Crystal Palace to ' +
      'find the ukulele case.');
    s = run(s, ...drops(FINISH_PALACE.slice(1)));
    expect(statusMessage(s, false)).toBe('The ukulele case is in Crystal Palace. Tap it to open it.');
    expect(statusMessage(run(s, { type: 'tap', pos: CASE }), false)).toBe('Goal complete! You found a ukulele in the case.');
  });
});

describe('The Crystal Palace: rendering', () => {
  const run = (s: UiState, ...actions: UiAction[]) => actions.reduce(reduceUi, s);
  const drops = (moves: readonly Move[]): UiAction[] => moves.map(([from, to]) => ({ type: 'drop', from, to }));
  const board = (s: UiState) => renderToStaticMarkup(<Board state={s} dispatch={() => {}} />);
  const tiles = (html: string) => [...html.matchAll(/<(?:button|div)[^>]*? class="((?:cell|terrain|passage|path|sealed)[^"]*)"/g)].map((m) => m[1]);
  const PALACE_FLOOR = /data-row="[0-4]" data-col="[0-3]"/;

  it('starts in Starting Glade, with the map, gates, buildings and the sealed palace, and nothing concealed shown', () => {
    const game = renderToStaticMarkup(<Game definition={PALACE_LEVEL} label="Level 9 of 9 · The Crystal Palace" musicControl={null}
      onHome={() => {}} winLabel="Play again from level 1" onWin={() => {}} />);
    expect(game).toContain('Goal: find the ukulele case in Crystal Palace');
    expect(game).toContain('data-ukulele="closed"');                      // the goal panel: closed until opened
    expect(game).not.toMatch(/data-ukulele="open"|data-action="unlock"|class="gate[ "]|class="checklist/);
    expect(game).toContain('<strong>Rune gate: Songbird Glade</strong><br/>Needs Grove, tier 2 of 4 on the pressure plate in Starting Glade');
    expect(game).not.toMatch(/concealed|Hidden|pocket|alcove/);
    const all = tiles(game);
    expect(all).toHaveLength(256);
    const count = (cls: string) => all.filter((t) => t === cls).length;
    // 7 areas less the concealed part and the sealed palace: 16 × 5 = 80 cells; 20 sealed tiles; 9 + 13 building walls;
    // 6 path cells; 5 gates.
    expect(all.filter((t) => t.startsWith('cell'))).toHaveLength(80);
    expect(count('sealed')).toBe(20);
    expect([count('terrain is-palace'), count('terrain is-lodge'), count('terrain is-lodge is-roof'), count('path')]).toEqual([9, 8, 5, 6]);
    expect(all.filter((t) => t.startsWith('passage'))).toHaveLength(5);
    expect(count('terrain is-clue')).toBe(1);
    expect(all.indexOf('terrain is-clue')).toBe(3 * 16 + 10);           // K4
    expect(count('terrain')).toBe(256 - 80 - 20 - 22 - 6 - 5 - 1);
    expect(game).not.toMatch(/data-row="[2-4]" data-col="1[1-3]"/);       // no concealed cells
    expect(game).toContain('<div class="passage is-across is-sealed" data-passage="6" role="img" aria-label="Rune gate to Crystal Palace, closed, 0 of 3 symbols lit">');
    expect((game.match(/data-lit="false"/g) ?? []).length).toBe(3);
    expect(game).toContain('aria-label="Rune gate to Songbird Glade, closed"');
    expect(game).not.toMatch(PALACE_FLOOR);                               // no palace cells: no labels, focus or items
    expect((game.match(/class="region is-locked is-room"/g) ?? []).length).toBe(5);       // all but Starting Glade and the concealed part
    // The first tab stop is in Starting Glade, not the locked palace in the corner.
    expect(game).toMatch(/aria-label="Row 8, column 2, Starting Glade: Grove, tier 1 of 4" aria-pressed="false" tabindex="0"/);
  });

  it('shows the checklist after the hub opens: each branch\'s gate, then its need, then done, and the palace', () => {
    const panel = (s: UiState) => renderToStaticMarkup(<TaskPanel session={s.session} />);
    const rows = (html: string) => [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
    expect(panel(initUi(PALACE_LEVEL))).not.toContain('checklist');
    let s = run(initUi(PALACE_LEVEL), ...drops(OPEN_HUB));
    expect(rows(panel(s))).toEqual(['Fern Glade: gate closed', 'Crystal Glade: gate closed', 'Woodland Lodge: gate closed', 'Crystal Palace0 of 3 symbols lit, sealed']);
    s = run(s, ...drops([...OPEN_BRANCHES, ...FINISH_CRYSTAL]));
    // Each need shows its item and exact tier (decorative), and says it in full to assistive technology.
    expect(rows(panel(s))).toEqual(['Fern Gladetier 2 of 4: needs Grove, tier 2 of 4', 'Crystal Glade✓: complete',
      'Woodland Lodgetier 3 of 4: needs Song, tier 3 of 4', 'Crystal Palace1 of 3 symbols lit, sealed']);
    expect(panel(s)).toContain('<span class="check-need" aria-hidden="true"><span class="check-item"><svg');
    expect(panel(s)).toMatch(/<li class="is-done" data-task="4"><span class="check-symbol" aria-hidden="true"><svg[^>]*><g data-symbol="crystal" data-lit="true">/);
    const html = board(s);
    expect(html).toContain('aria-label="Rune gate to Crystal Palace, closed, 1 of 3 symbols lit"');
    expect(html).toMatch(/data-symbol="crystal" data-lit="true"/);
    expect(html).toMatch(/data-symbol="fern" data-lit="false"/);
    expect((html.match(/class="fixed-lock"/g) ?? []).length).toBe(3);
    s = run(s, ...drops(REVEAL));
    expect(rows(panel(s))[0]).toBe('Fern Gladetier 3 of 4tier 2 of 4: needs Crystal, tier 3 of 4 and Song, tier 2 of 4');
    s = run(s, ...drops([...FINISH_FERN, ...FINISH_LODGE]));
    expect(rows(panel(s))[3]).toBe('Crystal PalaceOpen');
    const open = board(s);
    expect(open).toContain('aria-label="Rune gate to Crystal Palace, open, 3 of 3 symbols lit"');
    expect(open).toContain('aria-label="Row 4, column 11, Fern Glade: empty"');            // K4 is Fern Glade floor
    expect(open).not.toContain('is-clue');
    expect(open).not.toContain('data-ukulele');
    s = run(s, ...drops(FINISH_PALACE));
    expect(board(s)).toContain('aria-label="Row 5, column 3, Crystal Palace: ukulele case, closed, tap to open"');
    const won = run(s, { type: 'tap', pos: CASE });
    expect(board(won)).toContain('data-ukulele="open"');
    expect(board(won)).toContain('ukulele case, open, a ukulele inside');
    expect(board(run(won, { type: 'undo' }))).toContain('data-ukulele="closed"');
    const retried = board(run(won, { type: 'retry' }));
    expect(retried).not.toMatch(/data-ukulele|fixed-lock|notch-|data-lit="true"/);
    expect((retried.match(/class="terrain is-clue"/g) ?? []).length).toBe(1);
  });

  it('keeps the palace interior sealed until the third branch: no items, marked tiles, labels or focus, then all at once', () => {
    // The sealed palace's part of the board: its 20 tiles, blank and hidden from assistive technology.
    const sealedPart = (html: string) => html.match(/<div class="sealed" aria-hidden="true"><\/div>/g) ?? [];
    let s = initUi(PALACE_LEVEL);
    const sealedBoards = [board(s)];
    s = run(s, ...drops([...OPEN_HUB, ...OPEN_BRANCHES]));
    sealedBoards.push(board(s));
    s = run(s, ...drops(FINISH_CRYSTAL));
    sealedBoards.push(board(s));
    s = run(s, ...drops(FINISH_LODGE));
    sealedBoards.push(board(s));
    for (const html of sealedBoards) {
      expect(sealedPart(html)).toHaveLength(20);
      expect(html).not.toMatch(PALACE_FLOOR);
      expect(html).not.toMatch(/column \d+, Crystal Palace/);           // no cell labels; only the gate names it
      expect(html).not.toContain('ukulele');
      expect(html).toContain('class="region is-locked is-room" data-region="6"');   // still a sealed palace, not forest
      expect((html.match(/class="terrain is-palace"/g) ?? []).length).toBe(9);
    }
    // Before it opens, nothing sealed can be picked up, previewed or dropped on.
    expect(canPickUp(s, p(0, 0))).toBe(false);
    expect(previewCells(s, p(1, 2), p(0, 1))).toEqual([]);
    expect(run(s, { type: 'tap', pos: p(1, 2) })).toBe(s);
    // The third branch opens it: floor, items and both marked tiles together, glowing once; the case is still absent.
    s = run(s, ...drops([...REVEAL, ...FINISH_FERN]));
    const open = board(s);
    expect(sealedPart(open)).toHaveLength(0);
    expect(open).toContain('aria-label="Row 1, column 1, Crystal Palace: Crystal, tier 1 of 4"');
    expect(open).toContain('aria-label="Row 1, column 4, Crystal Palace, pressure plate for Crystal, tier 4 of 4: empty"');
    expect(open).toContain('aria-label="Row 2, column 4, Crystal Palace, pressure plate for Song, tier 3 of 4: empty"');
    expect(open).toContain('aria-label="Row 5, column 3, Crystal Palace: empty"');
    expect(open).not.toContain('ukulele');
    expect(open).toMatch(/data-region="6"[^>]*><span data-fx="unlock"/);
    expect(canPickUp(s, p(1, 2))).toBe(true);
    expect(previewCells(s, p(1, 2), p(0, 1))).toEqual([p(1, 2), p(0, 1), p(0, 0)]);
    s = run(s, ...drops(FINISH_PALACE));
    expect(board(s)).toContain('Crystal Palace: ukulele case, closed, tap to open');
    // Retry seals it again.
    const retried = board(run(s, { type: 'retry' }));
    expect(sealedPart(retried)).toHaveLength(20);
    expect(retried).not.toMatch(PALACE_FLOOR);
    expect(retried).not.toMatch(/column \d+, Crystal Palace|ukulele|fixed-lock/);
  });

  it('draws the path out of the sides it connects: from the hub up through G7, west to B7, then north into the palace', () => {
    const html = board(initUi(PALACE_LEVEL));
    const paths = [...html.matchAll(/<div class="path" aria-hidden="true">(.*?)<\/div>/g)].map((m) =>
      [...m[1].matchAll(/path-(\w)/g)].map((x) => x[1]).join(''));
    // In board order: B6, then B7, C7, D7, E7, G7.
    expect(paths).toEqual(['tb', 'tr', 'rl', 'rl', 'rl', 'bl']);
  });
});
