import { describe, expect, it } from 'vitest';
import type { Board, Cell, Family, Item, Pos, Tier } from '../src/board';
import { LEVELS, RUNE_LEVEL } from '../src/levels';
import { isFixed, platesMet, regionAt, unlockReady, validateRegions, type Region } from '../src/regions';
import {
  applyDrop, canDrop, collect, isCellOpen, previewDrop, retry, startSession, undo, unlock, type LevelDefinition, type SessionState,
} from '../src/session';
import { evaluateStatus } from '../src/status';
import { canPickUp, initUi, openedRegion, reduceUi, treasureShown, type UiAction, type UiState } from '../src/ui/controller';
import { statusMessage, unlockNeed } from '../src/ui/messages';

const p = (row: number, col: number): Pos => ({ row, col });
const it_ = (family: Family, tier: Tier): Item => ({ family, tier });
const regions = RUNE_LEVEL.regions!;
const [HALL, CHAMBER, NOOK] = [0, 1, 2];
const TREASURE = p(6, 4);
const GROVE_PLATE = p(0, 2);
const SONG_PLATE = p(2, 2);
const STONE = p(2, 5);

type Move = [Pos, Pos];
// The authored winning line (see levels.ts): the last move of each room is a plain move that opens its gate.
const HALL_MOVES: Move[] = [[p(1, 2), p(0, 1)], [p(0, 1), GROVE_PLATE], [p(2, 1), p(2, 0)], [p(2, 0), SONG_PLATE]];
const CHAMBER_MOVES: Move[] = [[p(1, 4), p(2, 4)], [p(3, 6), p(3, 4)], [p(1, 6), p(3, 5)], [p(3, 5), STONE]];

function play(s: SessionState, moves: readonly Move[]): SessionState {
  for (const [from, to] of moves) {
    const next = applyDrop(s, from, to);
    expect(next, `${JSON.stringify(from)} → ${JSON.stringify(to)}`).not.toBe(s);
    expect(evaluateStatus(next)).toBe('playing');
    s = next;
  }
  return s;
}

/** RUNE_LEVEL with some cells replaced. */
function variant(cells: [number, number, Cell][], extra: Partial<LevelDefinition> = {}): LevelDefinition {
  const board = RUNE_LEVEL.board.map((r) => [...r]);
  for (const [row, col, c] of cells) board[row][col] = c;
  return { ...RUNE_LEVEL, board, ...extra };
}
const withBoard = (s: SessionState, cells: [number, number, Cell][]): SessionState => {
  const board: Cell[][] = s.board.map((r) => [...r]);
  for (const [row, col, c] of cells) board[row][col] = c;
  return { ...s, board };
};

describe('The Rune Gates: layout', () => {
  it('is level 7: three rooms in empty terrain, with each gate in a passage between its rooms', () => {
    expect(LEVELS[6]).toEqual({ name: 'The Rune Gates', definition: RUNE_LEVEL });
    expect(() => validateRegions(RUNE_LEVEL)).not.toThrow();
    const s = startSession(RUNE_LEVEL);
    expect(regions.map((r) => r.name)).toEqual(['Pressure Hall', 'Stone Chamber', 'Treasure Nook']);
    let terrain = 0;
    s.board.forEach((row, r) => row.forEach((c, col) => {
      if (regionAt(regions, p(r, col)) !== -1) return;
      terrain++;
      expect(c).toBeNull();
      expect(isCellOpen(s, p(r, col))).toBe(false);
    }));
    expect(terrain).toBe(49 - 9 - 9 - 4);
    for (const i of [CHAMBER, NOOK]) {
      const u = regions[i].unlock!;
      expect('passage' in u && !!u.passage && regionAt(regions, u.passage)).toBe(-1);
    }
    expect(unlockNeed(regions, CHAMBER)).toBe('Grove, tier 2 of 5 and Song, tier 2 of 5 on the pressure plates in Pressure Hall');
    expect(unlockNeed(regions, NOOK)).toBe('Crystal, tier 3 of 5 alone on the stone in Stone Chamber');
  });

  it('rejects unsupported room configurations', () => {
    const chamber = regions[CHAMBER] as Region & { unlock: { kind: 'pressure' } };
    const withChamber = (unlock: object): LevelDefinition =>
      ({ ...RUNE_LEVEL, regions: [regions[HALL], { ...chamber, unlock: { ...chamber.unlock, ...unlock } } as Region, regions[NOOK]] });
    expect(() => validateRegions(withChamber({ plates: [{ row: 1, col: 5, item: it_('grove', 1) }] }))).toThrow(/plates must be in region 0/);
    expect(() => validateRegions(withChamber({ passage: p(3, 3) }))).toThrow(/passage must be terrain beside both rooms/);
    expect(() => validateRegions(withChamber({ kind: 'stone' }))).toThrow(/one stone or some plates/);
    expect(() => validateRegions({ ...RUNE_LEVEL, regions: [regions[HALL], { ...chamber, unlock: { item: it_('grove', 1), in: 0 } }, regions[NOOK]] }))
      .toThrow(/must open by plates/);
    expect(() => validateRegions(variant([[4, 0, it_('elk', 0)]]))).toThrow(/terrain must be empty/);
    expect(() => validateRegions({ ...RUNE_LEVEL, goal: { kind: 'treasure', at: p(2, 4) } })).toThrow(/treasure must be on an empty cell of the last region/);
    expect(() => validateRegions({ ...RUNE_LEVEL, regions: undefined })).toThrow(/treasure needs rooms/);
  });
});

describe('The Rune Gates: rules', () => {
  it('wins along the authored line; each gate opens on the move that completes its tiles, never by Unlock', () => {
    let s = startSession(RUNE_LEVEL);
    s = play(s, HALL_MOVES.slice(0, 3));
    expect(s.unlocked).toBe(0);                             // the grove plate alone is not enough
    expect(unlockReady(s)).toBe(false);
    expect(unlock(s)).toBe(s);
    s = play(s, HALL_MOVES.slice(3));                       // a plain move completes both plates
    expect(s.unlocked).toBe(CHAMBER);
    expect(s.board[1][1]).toEqual(it_('elk', 0));           // other items may remain
    s = play(s, CHAMBER_MOVES.slice(0, 3));
    expect(s.unlocked).toBe(CHAMBER);
    s = play(s, CHAMBER_MOVES.slice(3));
    expect(s.unlocked).toBe(NOOK);
    expect(evaluateStatus(s)).toBe('playing');              // no merges left, but the treasure can still be taken
    const won = collect(s);
    expect(won.collected).toBe(true);
    expect(evaluateStatus(won)).toBe('won');
    expect(won.moves).toBe(9);
  });

  it('pressure plates need their exact items at the same time, in either order', () => {
    let s = startSession(RUNE_LEVEL);
    s = play(s, [HALL_MOVES[2], HALL_MOVES[3], HALL_MOVES[0]]);   // song plate first
    expect(s.unlocked).toBe(0);
    s = play(s, [HALL_MOVES[1]]);
    expect(s.unlocked).toBe(CHAMBER);
    // Exact family and tier: a higher tier or another family on a plate does not count.
    const board = (grove: Item, song: Item): Board => withBoard(startSession(RUNE_LEVEL), [[0, 2, grove], [2, 2, song]]).board;
    expect(platesMet(board(it_('grove', 1), it_('song', 1)), regions, CHAMBER)).toBe(true);
    expect(platesMet(board(it_('grove', 2), it_('song', 1)), regions, CHAMBER)).toBe(false);
    expect(platesMet(board(it_('grove', 1), it_('song', 0)), regions, CHAMBER)).toBe(false);
    expect(platesMet(board(it_('song', 1), it_('grove', 1)), regions, CHAMBER)).toBe(false);
  });

  it('the stone needs its exact item with nothing else left in the Stone Chamber', () => {
    // The Chamber already open, with a crystal-2 ready to move onto the stone.
    const open = (cells: [number, number, Cell][]) => ({ ...startSession(variant(cells)), unlocked: CHAMBER });
    const crystal2 = it_('crystal', 2);
    const alone = open([[1, 4, null], [1, 6, null], [3, 4, null], [3, 6, null], [3, 5, crystal2]]);
    expect(applyDrop(alone, p(3, 5), STONE).unlocked).toBe(NOOK);
    const leftover = open([[1, 6, null], [3, 4, null], [3, 6, null], [3, 5, crystal2]]);   // a crystal-0 remains
    const moved = applyDrop(leftover, p(3, 5), STONE);
    expect(moved.board[2][5]).toEqual(crystal2);
    expect(moved.unlocked).toBe(CHAMBER);
    expect(platesMet(moved.board, regions, NOOK)).toBe(false);
    const wrongTier = open([[1, 4, null], [3, 4, null], [3, 5, null], [3, 6, null]]);       // only a crystal-1 left
    expect(applyDrop(wrongTier, p(1, 6), STONE).unlocked).toBe(CHAMBER);
  });

  it('an opened gate is a checkpoint: its items stay fixed, Undo history is cleared and starts afresh', () => {
    const before = play(startSession(RUNE_LEVEL), HALL_MOVES.slice(0, 3));
    expect(before.undo).not.toBeNull();
    const opened = play(before, HALL_MOVES.slice(3));
    expect(opened.undo).toBeNull();
    expect(undo(opened)).toBe(opened);
    expect(isFixed(opened, GROVE_PLATE) && isFixed(opened, SONG_PLATE)).toBe(true);
    expect(isFixed(before, GROVE_PLATE)).toBe(false);
    // Fixed items cannot move, swap or receive a drop; the elk still moves within the Hall.
    expect(canDrop(opened, GROVE_PLATE, p(0, 0))).toBe(false);
    expect(canDrop(opened, p(1, 1), SONG_PLATE)).toBe(false);
    expect(canDrop(opened, p(1, 1), p(0, 0))).toBe(true);
    // Merge groups never take a fixed item: two loose grove-1s beside the fixed one do not merge.
    const groves = withBoard(opened, [[0, 1, it_('grove', 1)], [1, 1, it_('grove', 1)]]);
    expect(previewDrop(groves, p(1, 1), p(0, 1))).toEqual([]);
    // The next move builds a fresh Undo step, which keeps the gate open.
    const next = applyDrop(opened, p(1, 1), p(0, 0));
    expect(next.undo).not.toBeNull();
    const undone = undo(next);
    expect(undone.unlocked).toBe(CHAMBER);
    expect(undone.board).toEqual(opened.board);
    expect(undo(undone)).toBe(undone);
  });

  it('items never leave their room, even with every gate open', () => {
    const s = play(play(startSession(RUNE_LEVEL), HALL_MOVES), CHAMBER_MOVES);
    expect(canDrop(s, p(1, 1), p(1, 5))).toBe(false);       // the elk into the Chamber
    expect(canDrop(s, p(1, 1), p(1, 3))).toBe(false);       // into the passage
    expect(canDrop(s, p(1, 1), p(5, 5))).toBe(false);       // into the Nook
    expect(canDrop(s, p(1, 1), p(4, 0))).toBe(false);       // onto terrain
    const locked = startSession(RUNE_LEVEL);
    expect(canDrop(locked, p(1, 4), p(2, 4))).toBe(false);  // the Chamber is locked at first
  });

  it('the treasure is hidden until its room opens; collecting it is one undoable move; Retry restores everything', () => {
    const start = startSession(RUNE_LEVEL);
    expect(collect(start)).toBe(start);
    const chamberOpen = play(start, HALL_MOVES);
    expect(collect(chamberOpen)).toBe(chamberOpen);
    const nookOpen = play(chamberOpen, CHAMBER_MOVES);
    const won = collect(nookOpen);
    expect(collect(won)).toBe(won);
    const undone = undo(won);
    expect(undone.collected).toBe(false);
    expect(undone.unlocked).toBe(NOOK);
    expect(evaluateStatus(undone)).toBe('playing');
    expect(retry(won)).toEqual(start);
    expect(retry(won).collected).toBe(false);
  });
});

describe('The Rune Gates: input', () => {
  const run = (s: UiState, ...actions: UiAction[]) => actions.reduce(reduceUi, s);
  const drop = ([from, to]: Move): UiAction => ({ type: 'drop', from, to });
  const tap = (pos: Pos): UiAction => ({ type: 'tap', pos });

  it('records the gate a drop opens, fixes its items, and collects the revealed treasure on a tap', () => {
    let s = run(initUi(RUNE_LEVEL), ...HALL_MOVES.slice(0, 3).map(drop));
    expect(openedRegion(s.lastAction)).toBeNull();
    s = run(s, drop(HALL_MOVES[3]));
    expect(s.lastAction).toEqual({ kind: 'move', opened: CHAMBER });
    expect(openedRegion(s.lastAction)).toBe(CHAMBER);
    expect(canPickUp(s, SONG_PLATE)).toBe(false);
    expect(run(s, tap(SONG_PLATE)).selected).toBeNull();
    expect(canPickUp(s, p(1, 1))).toBe(true);
    // A tap on the hidden treasure does nothing but end a selection.
    expect(treasureShown(s)).toBe(false);
    expect(run(s, tap(TREASURE))).toBe(s);
    expect(run(s, tap(p(1, 1)), tap(TREASURE)).selected).toBeNull();
    s = run(s, ...CHAMBER_MOVES.map(drop));
    expect(s.lastAction).toEqual({ kind: 'move', opened: NOOK });
    expect(treasureShown(s)).toBe(true);
    expect(statusMessage(s, false)).toBe('Treasure Nook is open. Tap the disc-golf backpack to collect it.');
    const won = run(s, tap(p(1, 1)), tap(TREASURE));       // collects even with something selected
    expect(won.status).toBe('won');
    expect(won.lastAction).toEqual({ kind: 'collect' });
    expect(run(won, { type: 'undo' }).status).toBe('playing');
    expect(statusMessage(won, false)).toBe('Goal complete! You found the disc-golf backpack.');
  });

  it('wins by taps alone', () => {
    const taps = [...HALL_MOVES, ...CHAMBER_MOVES].flatMap(([from, to]) => [tap(from), tap(to)]);
    const s = run(initUi(RUNE_LEVEL), ...taps, tap(TREASURE));
    expect(s.status).toBe('won');
    expect(s.session.unlocked).toBe(NOOK);
  });

  it('tells the player what each room needs', () => {
    let s = initUi(RUNE_LEVEL);
    expect(statusMessage(s, false))
      .toBe('Put Grove, tier 2 of 5 and Song, tier 2 of 5 on the pressure plates in Pressure Hall to open the rune gate to Stone Chamber.');
    s = run(s, ...HALL_MOVES.map(drop));
    expect(statusMessage(s, true))
      .toBe('Merge down to Crystal, tier 3 of 5 alone on the stone in Stone Chamber to open the rune gate to Treasure Nook. Drag empty ground to pan.');
  });
});
