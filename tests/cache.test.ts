import { describe, expect, it } from 'vitest';
import type { Cell, Family, Item, Pos, Tier } from '../src/board';
import { CACHE_LEVEL, LEVELS, RUNE_LEVEL } from '../src/levels';
import { isFixed, regionAt, roomOf, validateRegions, type Region } from '../src/regions';
import {
  applyDrop, canDrop, collect, isCellOpen, previewDrop, retry, startSession, undo, type LevelDefinition, type SessionState,
} from '../src/session';
import { evaluateStatus } from '../src/status';
import { canPickUp, initUi, reduceUi, treasureShown, type UiAction, type UiState } from '../src/ui/controller';
import { helpObjective, objectiveText, roomsHelp, statusMessage, unlockNeed } from '../src/ui/messages';

// Coordinates are (row, column) from 0; the design's A1 is p(0, 0) and G7 is p(6, 6).
const p = (row: number, col: number): Pos => ({ row, col });
const it_ = (family: Family, tier: Tier): Item => ({ family, tier });
const regions = CACHE_LEVEL.regions!;
const [CLEARING, ALCOVE, NOOK] = [0, 1, 2];
const GROVE_PLATE = p(0, 3);     // D1
const CRYSTAL_PLATE = p(3, 2);   // C4
const CASE = p(6, 1);            // B7

type Move = [Pos, Pos];
// The approved winning sequence: C2 → B1, B1 → D1 (opens the alcove), F1 → A3, A3 → F3, F3 → C4 (opens the nook).
const OPEN_ALCOVE: Move[] = [[p(1, 2), p(0, 1)], [p(0, 1), GROVE_PLATE]];
const OPEN_NOOK: Move[] = [[p(0, 5), p(2, 0)], [p(2, 0), p(2, 5)], [p(2, 5), CRYSTAL_PLATE]];

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
const itemsIn = (s: SessionState, r: Region): Item[] => {
  const out: Item[] = [];
  for (let row = r.row; row < r.row + r.rows; row++) for (let col = r.col; col < r.col + r.cols; col++) {
    if (s.board[row][col]) out.push(s.board[row][col]!);
  }
  return out;
};

describe('The Hidden Cache: layout', () => {
  it('is level 8: a clearing, its hidden alcove and a separate final room in terrain', () => {
    expect(LEVELS[7]).toEqual({ name: 'The Hidden Cache', definition: CACHE_LEVEL });
    expect(() => validateRegions(CACHE_LEVEL)).not.toThrow();
    expect(regions.map((r) => [r.name, r.row, r.col, r.rows, r.cols])).toEqual([
      ['Fern Clearing', 0, 0, 4, 4], ['Hidden Alcove', 0, 5, 3, 2], ['Lantern Nook', 5, 1, 2, 2],
    ]);
    // The alcove is part of the clearing's room and hidden; the nook is a room of its own, only darkened.
    expect([regions[ALCOVE].joins, regions[ALCOVE].hidden]).toEqual([CLEARING, true]);
    expect([regions[NOOK].joins, regions[NOOK].hidden]).toEqual([undefined, undefined]);
    expect([0, 1, 2].map((i) => roomOf(regions, i))).toEqual([CLEARING, CLEARING, NOOK]);
    expect(CACHE_LEVEL.goal).toEqual({ kind: 'treasure', at: CASE, prize: 'clarinet' });
    const s = startSession(CACHE_LEVEL);
    let terrain = 0;
    s.board.forEach((row, r) => row.forEach((c, col) => {
      if (regionAt(regions, p(r, col)) !== -1) return;
      terrain++;
      expect(c).toBeNull();
    }));
    expect(terrain).toBe(49 - 16 - 6 - 4);
    expect(regions[ALCOVE].unlock).toEqual({ kind: 'pressure', in: CLEARING, plates: [{ ...GROVE_PLATE, item: it_('grove', 1) }], passage: p(1, 4) });
    expect(regions[NOOK].unlock).toEqual({ kind: 'pressure', in: CLEARING, plates: [{ ...CRYSTAL_PLATE, item: it_('crystal', 2) }], passage: p(4, 2) });
    expect(unlockNeed(regions, ALCOVE)).toBe('Grove, tier 2 of 4 on the pressure plate in Fern Clearing');
    expect(unlockNeed(regions, NOOK)).toBe('Crystal, tier 3 of 4 on the pressure plate in Fern Clearing');
  });

  it('starts the clearing with an unmergeable crystal pair; the alcove holds the rest', () => {
    const s = startSession(CACHE_LEVEL);
    const sort = (list: Item[]) => list.map((i) => `${i.family}${i.tier}`).sort();
    expect(sort(itemsIn(s, regions[CLEARING]))).toEqual(['crystal0', 'crystal0', 'grove0', 'grove0', 'grove0']);
    expect(sort(itemsIn(s, regions[ALCOVE]))).toEqual(['crystal0', 'crystal1', 'crystal1']);
    expect(itemsIn(s, regions[NOOK])).toEqual([]);
    expect(previewDrop(s, p(2, 0), p(2, 1))).toEqual([]);   // two crystal-0 alone never merge
  });

  it('rejects unsupported joined or hidden regions', () => {
    const at = (i: number, change: Partial<Region>): LevelDefinition =>
      ({ ...CACHE_LEVEL, regions: regions.map((r, j) => (j === i ? { ...r, ...change } : r)) });
    expect(() => validateRegions(at(CLEARING, { hidden: true }))).toThrow(/region 0 cannot be joined or hidden/);
    expect(() => validateRegions(at(NOOK, { joins: NOOK }))).toThrow(/must join an earlier region that joins nothing/);
    expect(() => validateRegions(at(NOOK, { joins: ALCOVE }))).toThrow(/must join an earlier region that joins nothing/);
    expect(() => validateRegions(at(NOOK, { joins: 0.5 }))).toThrow(/must join an earlier region/);
    // Item-goal region levels keep one region per room.
    const hollow = LEVELS[5].definition;
    expect(() => validateRegions({ ...hollow, regions: hollow.regions!.map((r, j) => (j === 1 ? { ...r, joins: 0 } : r)) }))
      .toThrow(/region 1 cannot be joined or hidden/);
    // A stone counts only its own region's items, so its room can't have a joined part.
    const rune = RUNE_LEVEL.regions!;
    expect(() => validateRegions({ ...RUNE_LEVEL, regions: [rune[0], rune[1], { ...rune[2], joins: 1 }] }))
      .toThrow(/stone must be in a room without joined regions/);
    expect(() => validateRegions(at(NOOK, { joins: CLEARING }))).not.toThrow();
  });
});

describe('The Hidden Cache: rules', () => {
  it('wins along the approved sequence with the stated items, each gate opening on a plain move', () => {
    let s = startSession(CACHE_LEVEL);
    s = play(s, OPEN_ALCOVE.slice(0, 1));
    expect(s.board[0][1]).toEqual(it_('grove', 1));                   // three Grove tier 1 → Grove tier 2 on B1
    expect(s.unlocked).toBe(CLEARING);
    s = play(s, OPEN_ALCOVE.slice(1));                                // a plain move onto D1
    expect(s.unlocked).toBe(ALCOVE);
    s = play(s, OPEN_NOOK.slice(0, 1));
    expect(s.board[2][0]).toEqual(it_('crystal', 1));                 // F1 joins the clearing's pair: Crystal tier 2 on A3
    expect([s.board[0][5], s.board[2][1]]).toEqual([null, null]);
    s = play(s, OPEN_NOOK.slice(1, 2));
    expect(s.board[2][5]).toEqual(it_('crystal', 2));                 // with the alcove's two: Crystal tier 3 on F3
    expect([s.board[2][0], s.board[2][6]]).toEqual([null, null]);
    expect(s.unlocked).toBe(ALCOVE);
    s = play(s, OPEN_NOOK.slice(2));                                  // a plain move from the alcove onto C4
    expect(s.unlocked).toBe(NOOK);
    expect(evaluateStatus(s)).toBe('playing');
    const won = collect(s);
    expect(won.collected).toBe(true);
    expect(evaluateStatus(won)).toBe('won');
    expect(won.moves).toBe(6);
  });

  it('hides nothing usable: the alcove takes no drops, gives none and joins no merge group until it opens', () => {
    const s = startSession(CACHE_LEVEL);
    for (const [row, col] of [[0, 5], [0, 6], [1, 5], [2, 5], [2, 6]]) expect(isCellOpen(s, p(row, col))).toBe(false);
    expect(canDrop(s, p(0, 5), p(0, 6))).toBe(false);                 // within the alcove
    expect(canDrop(s, p(0, 5), p(2, 0))).toBe(false);                 // out of it
    expect(canDrop(s, p(2, 0), p(1, 5))).toBe(false);                 // into it
    expect(canDrop(s, p(2, 0), p(2, 5))).toBe(false);                 // swap with a hidden item
    expect(applyDrop(s, p(0, 5), p(2, 0))).toBe(s);
    expect(collect(s)).toBe(s);
  });

  it('opens each gate only for its exact item on its own plate', () => {
    const open = startSession(CACHE_LEVEL);
    for (const wrong of [it_('grove', 0), it_('grove', 2), it_('crystal', 1)]) {
      const s = withBoard(open, [[3, 0, wrong]]);
      expect(applyDrop(s, p(3, 0), GROVE_PLATE).unlocked).toBe(CLEARING);
    }
    // Grove tier 2 on the crystal plate opens nothing; the nook stays shut until after the alcove.
    expect(applyDrop(withBoard(open, [[3, 0, it_('grove', 1)]]), p(3, 0), CRYSTAL_PLATE).unlocked).toBe(CLEARING);
    expect(applyDrop(withBoard(open, [[3, 0, it_('crystal', 2)]]), p(3, 0), CRYSTAL_PLATE).unlocked).toBe(CLEARING);
    // A swap onto the plate counts like a move.
    const blocked = withBoard(open, [[0, 3, it_('crystal', 0)], [3, 0, it_('grove', 1)]]);
    expect(applyDrop(blocked, p(3, 0), GROVE_PLATE).unlocked).toBe(ALCOVE);
    const alcove = play(open, OPEN_ALCOVE);
    for (const wrong of [it_('crystal', 1), it_('crystal', 3)]) {
      expect(applyDrop(withBoard(alcove, [[3, 0, wrong]]), p(3, 0), CRYSTAL_PLATE).unlocked).toBe(ALCOVE);
    }
  });

  it('each opening is a checkpoint: its item is fixed, Undo is cleared, and later moves get a fresh Undo', () => {
    const before = play(startSession(CACHE_LEVEL), OPEN_ALCOVE.slice(0, 1));
    expect(before.undo).not.toBeNull();
    const alcove = play(before, OPEN_ALCOVE.slice(1));
    expect(alcove.undo).toBeNull();
    expect(undo(alcove)).toBe(alcove);
    expect(isFixed(alcove, GROVE_PLATE)).toBe(true);
    expect(canDrop(alcove, GROVE_PLATE, p(0, 2))).toBe(false);
    expect(canDrop(alcove, p(2, 0), GROVE_PLATE)).toBe(false);
    const moved = applyDrop(alcove, p(2, 0), p(3, 0));
    expect(moved.undo).not.toBeNull();
    expect(undo(moved)).toEqual({ ...alcove, undo: null });            // back to the checkpoint, alcove still open

    const nook = play(alcove, OPEN_NOOK);
    expect(nook.undo).toBeNull();
    expect(isFixed(nook, CRYSTAL_PLATE) && isFixed(nook, GROVE_PLATE)).toBe(true);
    expect(canDrop(nook, CRYSTAL_PLATE, p(3, 3))).toBe(false);
    const later = applyDrop(withBoard(nook, [[3, 3, it_('elk', 0)]]), p(3, 3), p(1, 6));
    expect(later.undo).not.toBeNull();
    expect(undo(later).unlocked).toBe(NOOK);
  });

  it('once open, the alcove and clearing are one room: moves and swaps go both ways', () => {
    const s = play(startSession(CACHE_LEVEL), OPEN_ALCOVE);
    const out = applyDrop(s, p(0, 5), p(3, 3));                       // alcove → clearing
    expect([out.board[3][3], out.board[0][5]]).toEqual([it_('crystal', 0), null]);
    const back = applyDrop(out, p(3, 3), p(1, 6));                    // clearing → alcove
    expect([back.board[1][6], back.board[3][3]]).toEqual([it_('crystal', 0), null]);
    const swapIn = applyDrop(s, p(2, 0), p(2, 6));                    // clearing crystal-0 ⇄ alcove crystal-1
    expect([swapIn.board[2][6], swapIn.board[2][0]]).toEqual([it_('crystal', 0), it_('crystal', 1)]);
    const swapOut = applyDrop(s, p(2, 5), p(2, 1));                   // alcove crystal-1 ⇄ clearing crystal-0
    expect([swapOut.board[2][1], swapOut.board[2][5]]).toEqual([it_('crystal', 1), it_('crystal', 0)]);
    // Merges in both directions are steps 3 (alcove → clearing) and 4 (clearing → alcove) of the winning sequence.
  });

  it('keeps the nook a separate room: nothing moves, swaps or merges across, even with every gate open', () => {
    const s = play(play(startSession(CACHE_LEVEL), OPEN_ALCOVE), OPEN_NOOK);
    const t = withBoard(s, [[5, 2, it_('crystal', 0)], [3, 3, it_('crystal', 0)], [1, 6, it_('crystal', 0)], [5, 1, it_('crystal', 0)]]);
    expect(canDrop(t, p(3, 3), p(6, 2))).toBe(false);                 // clearing → nook (empty cell)
    expect(canDrop(t, p(1, 6), p(6, 2))).toBe(false);                 // alcove → nook
    expect(canDrop(t, p(5, 2), p(3, 0))).toBe(false);                 // nook → clearing
    expect(canDrop(t, p(5, 2), p(0, 6))).toBe(false);                 // nook → alcove
    expect(canDrop(t, p(3, 3), p(5, 2))).toBe(false);                 // a merge or swap across
    expect(canDrop(t, p(3, 3), p(4, 2))).toBe(false);                 // onto the passage
    expect(canDrop(t, p(3, 3), p(1, 4))).toBe(false);                 // onto the alcove's passage
    expect(canDrop(t, p(5, 1), p(5, 2))).toBe(true);                  // inside the nook is fine
    expect(previewDrop(t, p(3, 3), p(5, 2))).toEqual([]);
  });

  it('the case is hidden until the nook opens; opening it is one undoable move; Retry restores the start', () => {
    const start = startSession(CACHE_LEVEL);
    expect(collect(start)).toBe(start);
    const alcove = play(start, OPEN_ALCOVE);
    expect(collect(alcove)).toBe(alcove);
    const nook = play(alcove, OPEN_NOOK);
    const won = collect(nook);
    expect(collect(won)).toBe(won);
    const undone = undo(won);
    expect([undone.collected, undone.unlocked, evaluateStatus(undone)]).toEqual([false, NOOK, 'playing']);
    expect(retry(won)).toEqual(start);
    expect(retry(alcove)).toEqual(start);
  });
});

// A small room level whose alcove (column 2, rows 0-1) touches its clearing (columns 0-1, rows 0-2), so a merge group
// could span both. The alcove opens with grove-0 on (2,0); the nook (row 4) with crystal-1 on (2,1).
//   c0 c0 | c0
//   g0 .  | .
//   [g][c] =
//   ~  ‖  ~
//   $  .  ~
const ADJACENT: LevelDefinition = {
  seed: 1,
  board: [
    [it_('crystal', 0), it_('crystal', 0), it_('crystal', 0)],
    [it_('grove', 0), null, null],
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ],
  supply: [],
  regions: [
    { name: 'Clearing', row: 0, col: 0, rows: 3, cols: 2 },
    {
      name: 'Alcove', row: 0, col: 2, rows: 2, cols: 1, joins: 0, hidden: true,
      unlock: { kind: 'pressure', in: 0, plates: [{ row: 2, col: 0, item: it_('grove', 0) }], passage: p(2, 2) },
    },
    {
      name: 'Nook', row: 4, col: 0, rows: 1, cols: 2,
      unlock: { kind: 'pressure', in: 0, plates: [{ row: 2, col: 1, item: it_('crystal', 1) }], passage: p(3, 1) },
    },
  ],
  goal: { kind: 'treasure', at: p(4, 0) },
};

describe('A joined alcove beside its clearing', () => {
  it('merge groups take its items only once it is open', () => {
    const shut = startSession(ADJACENT);
    // Shut: the alcove's crystal-0 beside the pair is not part of the group, so (0,0) onto (0,1) is no merge.
    expect(previewDrop(shut, p(0, 0), p(0, 1))).toEqual([]);
    const open = applyDrop(shut, p(1, 0), p(2, 0));
    expect(open.unlocked).toBe(1);
    expect(previewDrop(open, p(0, 0), p(0, 1))).toEqual([p(0, 0), p(0, 1), p(0, 2)]);
    const merged = applyDrop(open, p(0, 0), p(0, 1));
    expect(merged.board[0]).toEqual([null, it_('crystal', 1), null]);
    expect(merged.unlocked).toBe(1);
  });
});

describe('The Hidden Cache: input and text', () => {
  const run = (s: UiState, ...actions: UiAction[]) => actions.reduce(reduceUi, s);
  const drop = ([from, to]: Move): UiAction => ({ type: 'drop', from, to });
  const tap = (pos: Pos): UiAction => ({ type: 'tap', pos });

  it('ignores taps and drags on the hidden alcove, then plays it after the gate opens', () => {
    const start = initUi(CACHE_LEVEL);
    expect(canPickUp(start, p(0, 5))).toBe(false);
    expect(run(start, tap(p(0, 5)))).toBe(start);
    expect(run(start, drop([p(0, 5), p(2, 0)]))).toBe(start);
    expect(run(start, tap(p(2, 0)), tap(p(1, 5))).session).toBe(start.session);
    let s = run(start, ...OPEN_ALCOVE.map(drop));
    expect(s.lastAction).toEqual({ kind: 'move', opened: ALCOVE });
    expect(canPickUp(s, p(0, 5))).toBe(true);
    expect(canPickUp(s, GROVE_PLATE)).toBe(false);
    s = run(s, tap(p(0, 5)), tap(p(2, 0)));                           // tap-tap across the two areas merges
    expect(s.lastAction?.kind).toBe('merge');
  });

  it('wins by taps alone, with the case closed until tapped', () => {
    const taps = [...OPEN_ALCOVE, ...OPEN_NOOK].flatMap(([from, to]) => [tap(from), tap(to)]);
    const s = run(initUi(CACHE_LEVEL), ...taps);
    expect(s.session.unlocked).toBe(NOOK);
    expect([treasureShown(s), s.status]).toEqual([true, 'playing']);
    const won = run(s, tap(CASE));
    expect([won.status, won.lastAction]).toEqual(['won', { kind: 'collect' }]);
    expect(run(won, { type: 'undo' }).status).toBe('playing');
  });

  it('names the clarinet case and explains the shared alcove', () => {
    let s = initUi(CACHE_LEVEL);
    expect(objectiveText(CACHE_LEVEL.goal, regions)).toBe('Goal: find the clarinet case in Lantern Nook');
    expect(helpObjective(CACHE_LEVEL.goal, regions)).toBe('Goal: open the rune gates and open the clarinet case in Lantern Nook.');
    expect(roomsHelp(regions)).toBe('Each rune gate opens by itself on the move that puts exactly the items shown on its room\'s ' +
      'marked tiles. Hidden Alcove is part of Fern Clearing\'s room: once its gate opens, items move, swap and merge between ' +
      'the two. Items never leave their own room.');
    expect(statusMessage(s, false))
      .toBe('Put Grove, tier 2 of 4 on the pressure plate in Fern Clearing to open the rune gate to Hidden Alcove.');
    s = run(s, ...OPEN_ALCOVE.map(drop));
    expect(statusMessage(s, true)).toBe('Put Crystal, tier 3 of 4 on the pressure plate in Fern Clearing to open the rune gate to ' +
      'Lantern Nook. Items move and merge between Fern Clearing and Hidden Alcove. Drag empty ground to pan.');
    s = run(s, ...OPEN_NOOK.map(drop));
    expect(statusMessage(s, false)).toBe('Lantern Nook is open. Tap the clarinet case to open it.');
    expect(statusMessage(run(s, tap(CASE)), false)).toBe('Goal complete! You opened the clarinet case and found an assembled clarinet.');
  });

  it('leaves the Rune Gates text unchanged', () => {
    const rune = RUNE_LEVEL.regions!;
    expect(helpObjective(RUNE_LEVEL.goal, rune)).toBe('Goal: open the rune gates and collect the disc-golf backpack in Treasure Nook.');
    expect(roomsHelp(rune)).toBe('Each rune gate opens by itself on the move that puts exactly the items shown on its room\'s ' +
      'marked tiles; a stone must hold the only item left in its room. Items never leave their own room.');
  });
});
