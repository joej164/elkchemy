import { describe, it, expect } from 'vitest';
import { previewMerge, type Item, type Pos } from '../src/board';
import { HOLLOW_LEVEL, INTRO_LEVEL, LEAVE_ONE_LEVEL, LEVELS } from '../src/levels';
import { EIGHT_GROVE_LEVEL } from './fixtures';
import { chooseSupplyCell, startSession } from '../src/session';
import {
  canDropAt, canPickUp, canPlaceSupply, canUndo, canUnlock, goalCells, initUi, nextSupplyItem, previewCells, reduceUi, supplyRemaining,
  type UiAction, type UiState,
} from '../src/ui/controller';

const p = (row: number, col: number): Pos => ({ row, col });
const tap = (pos: Pos): UiAction => ({ type: 'tap', pos });
const drop = (from: Pos, to: Pos): UiAction => ({ type: 'drop', from, to });
const place: UiAction = { type: 'placeSupply' };
const run = (s: UiState, ...actions: UiAction[]) => actions.reduce(reduceUi, s);
const g0: Item = { family: 'grove', tier: 0 };

// INTRO_LEVEL (seed 7): 3-merges only. Random placements land at (1,2), (1,1), then (2,2)
// (the third depends on the merges made before it).
const INTRO_WIN: UiAction[] = [
  place,                       // (1,2)
  place,                       // (1,1)
  drop(p(0, 0), p(2, 3)),
  drop(p(1, 1), p(2, 1)),
  place,                       // (2,2)
  drop(p(0, 1), p(2, 2)),
  drop(p(2, 1), p(2, 2)),
];
const INTRO_LANDINGS = [p(1, 2), p(1, 1), p(2, 2)];
// EIGHT_GROVE_LEVEL (seed 1): placements land at (1,3), (2,2), (3,2); then a 3-merge,
// a 5-merge and a final 3-merge of grove-1s.
const WIN: UiAction[] = [
  place, place, place,
  drop(p(0, 0), p(0, 1)),
  drop(p(1, 3), p(2, 3)),
  drop(p(0, 1), p(1, 3)),
];
// Two wasteful 3-merges; lost while one supply item remains.
const LOSE: UiAction[] = [place, place, drop(p(0, 0), p(0, 1)), drop(p(1, 3), p(2, 2))];

const init = () => initUi(EIGHT_GROVE_LEVEL);
const introInit = () => initUi(INTRO_LEVEL);
// EIGHT_GROVE_LEVEL plus two extra grove-0s so (0,0),(0,1),(0,2),(1,0),(1,1) form a 5-cluster.
const fiveInit = () => {
  const board = EIGHT_GROVE_LEVEL.board.map((r) => [...r]);
  board[0][2] = g0;
  board[1][0] = g0;
  return initUi({ ...EIGHT_GROVE_LEVEL, board });
};

describe('init', () => {
  it('sets fields', () => {
    const s = init();
    expect(s.session).toEqual(startSession(EIGHT_GROVE_LEVEL));
    expect(s.status).toBe('playing');
    expect(s.selected).toBeNull();
    expect(s.lastAction).toBeNull();
    expect(s.actionSeq).toBe(0);
  });
});

describe('tap', () => {
  it('selects and deselects', () => {
    const s = reduceUi(init(), tap(p(0, 0)));
    expect(s.selected).toEqual(p(0, 0));
    expect(s.lastAction).toBeNull();
    expect(reduceUi(s, tap(p(0, 0))).selected).toBeNull();
  });
  it('item then empty moves', () => {
    const s = run(init(), tap(p(0, 0)), tap(p(1, 0)));
    expect(s.selected).toBeNull();
    expect(s.lastAction).toEqual({ kind: 'move' });
    expect(s.session.board[1][0]).toEqual(g0);
    expect(s.session.board[0][0]).toBeNull();
  });
  it('item then different item swaps', () => {
    const s = run(init(), tap(p(2, 0)), tap(p(3, 0)));
    expect(s.lastAction).toEqual({ kind: 'swap' });
    expect(s.session.board[2][0]).toEqual({ family: 'crystal', tier: 0 });
    expect(s.session.board[3][0]).toEqual({ family: 'elk', tier: 0 });
  });
  it('item then matching item merges 3', () => {
    const s = run(init(), tap(p(0, 0)), tap(p(1, 1)));
    expect(s.selected).toBeNull();
    expect(s.lastAction).toMatchObject({ kind: 'merge', consumed: 3, result: { family: 'grove', tier: 1 } });
    expect(s.session.board[1][1]).toEqual({ family: 'grove', tier: 1 });
  });
  it('merges 5', () => {
    const s = run(fiveInit(), tap(p(2, 3)), tap(p(0, 0)));
    expect(s.lastAction).toMatchObject({ kind: 'merge', consumed: 5, result: { family: 'grove', tier: 1 } });
  });
  it('tapping an empty cell with nothing selected is a no-op', () => {
    const s = init();
    expect(reduceUi(s, tap(p(1, 0)))).toBe(s);
  });
  it('ignores out-of-bounds', () => {
    const s = init();
    expect(reduceUi(s, tap(p(9, 9)))).toBe(s);
    expect(reduceUi(s, tap(p(-1, 0)))).toBe(s);
  });
});

describe('no-ops return same reference', () => {
  const s = init();
  it.each<[string, UiAction]>([
    ['same-cell drop', drop(p(0, 0), p(0, 0))],
    ['out-of-bounds drop', drop(p(0, 0), p(4, 0))],
    ['out-of-bounds source', drop(p(-1, 0), p(0, 0))],
    ['empty source', drop(p(1, 0), p(0, 0))],
    ['clearSelection with nothing selected', { type: 'clearSelection' }],
    ['undo with nothing to undo', { type: 'undo' }],
  ])('%s', (_n, a) => expect(reduceUi(s, a)).toBe(s));

  it('placeSupply when exhausted leaves everything unchanged', () => {
    const t = run(s, place, place, place);
    expect(supplyRemaining(t)).toBe(0);
    expect(nextSupplyItem(t)).toBeNull();
    expect(canPlaceSupply(t)).toBe(false);
    expect(reduceUi(t, place)).toBe(t);
    expect(t.session.undo).not.toBeNull();
  });
  it('invalid drop does not bump actionSeq', () => {
    expect(reduceUi(s, drop(p(1, 0), p(0, 0))).actionSeq).toBe(0);
  });
  it('clearSelection clears', () => {
    const t = reduceUi(s, tap(p(0, 0)));
    expect(reduceUi(t, { type: 'clearSelection' }).selected).toBeNull();
  });
});

describe('random supply placement', () => {
  it('places the next item at the cell chosen by chooseSupplyCell', () => {
    const s = init();
    const pick = chooseSupplyCell(s.session)!;
    expect(pick.at).toEqual(p(1, 3));
    expect(canPlaceSupply(s)).toBe(true);
    expect(supplyRemaining(s)).toBe(3);
    const item = nextSupplyItem(s);
    const t = reduceUi(s, place);
    expect(s.session.board[pick.at.row][pick.at.col]).toBeNull();
    expect(t.session.board[pick.at.row][pick.at.col]).toEqual(item);
    expect(t.session.rngState).toBe(pick.rngState);
    expect(supplyRemaining(t)).toBe(2);
    expect(t.lastAction).toEqual({ kind: 'place', at: pick.at, item });
    expect(t.actionSeq).toBe(1);
  });
  it('never overwrites an occupied cell', () => {
    let s = init();
    for (let i = 0; i < 3; i++) {
      const before = s.session.board;
      s = reduceUi(s, place);
      before.forEach((r, i2) => r.forEach((c, j) => {
        if (c !== null) expect(s.session.board[i2][j]).toBe(c);
      }));
    }
    expect(s.session.board.flat().filter((c) => c !== null)).toHaveLength(11);
  });
  it('also works with an item selected, and clears selection', () => {
    const s = reduceUi(init(), tap(p(2, 0)));
    const at = chooseSupplyCell(s.session)!.at;
    const t = reduceUi(s, place);
    expect(t.session.board[at.row][at.col]).toEqual(g0);
    expect(t.selected).toBeNull();
    expect(t.lastAction).toMatchObject({ kind: 'place', at });
  });
  it('full board with supply remaining cannot place', () => {
    // evaluateStatus rejects such levels, so build the state directly.
    const full = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => ({
      family: (['song', 'crystal', 'elk', 'grove'] as const)[r], tier: c as 0 | 1 | 2 | 3,
    })));
    const base = init();
    const s: UiState = { ...base, session: { ...base.session, board: full, moves: 5 } };
    expect(s.status).toBe('playing');
    expect(supplyRemaining(s)).toBe(3);
    expect(canPlaceSupply(s)).toBe(false);
    const t = reduceUi(s, place);
    expect(t).toBe(s);
    expect(t.session.moves).toBe(5);
    expect(t.session.supplyIndex).toBe(0);
    expect(t.session.undo).toBeNull();
  });
  it('canPlaceSupply is false when the game is over', () => {
    expect(canPlaceSupply(run(init(), ...LOSE))).toBe(false);
    expect(canPlaceSupply(run(init(), ...WIN))).toBe(false);
  });
  it('rngState changes only on placeSupply', () => {
    const s0 = init();
    const seed = s0.session.rngState;
    let s = s0;
    const check = () => expect(s.session.rngState).toBe(seed);
    s = reduceUi(s, tap(p(0, 0))); check();
    s = reduceUi(s, tap(p(0, 0))); check();
    s = reduceUi(s, tap(p(0, 0))); check();
    s = reduceUi(s, { type: 'clearSelection' }); check();
    previewCells(s, p(0, 0), p(1, 1));
    canPlaceSupply(s);
    check();
    s = run(s, drop(p(1, 0), p(0, 0)), drop(p(9, 9), p(0, 0)), tap(p(9, 9)), tap(p(1, 0))); check();
    expect(s.actionSeq).toBe(0);
    const over = run(init(), ...LOSE);
    const overRng = over.session.rngState;
    expect(reduceUi(over, place).session.rngState).toBe(overRng);
    expect(reduceUi(s, place).session.rngState).not.toBe(seed);
  });
});

describe('undo and retry', () => {
  it('undo after placement restores session including rngState; placing again lands in the same cell', () => {
    const s0 = init();
    const s1 = reduceUi(s0, place);
    const s2 = reduceUi(s1, { type: 'undo' });
    expect(s2.session.board).toEqual(s0.session.board);
    expect(s2.session.supplyIndex).toBe(0);
    expect(s2.session.moves).toBe(0);
    expect(s2.session.rngState).toBe(s0.session.rngState);
    expect(s2.lastAction).toEqual({ kind: 'undo' });
    expect(s2.actionSeq).toBe(2);
    expect(canUndo(s2)).toBe(false);
    const s3 = reduceUi(s2, place);
    expect(s3.lastAction).toEqual(s1.lastAction);
    expect(s3.session.board).toEqual(s1.session.board);
    expect(s3.session.rngState).toBe(s1.session.rngState);
  });
  it('undo restores session and clears selection', () => {
    const s0 = init();
    const s1 = run(s0, tap(p(0, 0)), tap(p(1, 0)), tap(p(2, 3)));
    expect(s1.selected).toEqual(p(2, 3));
    expect(canUndo(s1)).toBe(true);
    const s2 = reduceUi(s1, { type: 'undo' });
    expect(s2.session.board).toEqual(s0.session.board);
    expect(s2.session.moves).toBe(0);
    expect(s2.selected).toBeNull();
    expect(s2.lastAction).toEqual({ kind: 'undo' });
    expect(canUndo(s2)).toBe(false);
  });
  it('retry resets, and the first placement lands where it did originally', () => {
    const first = reduceUi(init(), place);
    const s = run(first, place, drop(p(0, 0), p(1, 1)), tap(p(1, 1)));
    const r = reduceUi(s, { type: 'retry' });
    expect(r.session).toEqual(init().session);
    expect(r.status).toBe('playing');
    expect(r.selected).toBeNull();
    expect(r.lastAction).toEqual({ kind: 'retry' });
    expect(r.actionSeq).toBe(s.actionSeq + 1);
    expect(reduceUi(r, place).lastAction).toEqual(first.lastAction);
  });
});

describe('previewCells', () => {
  const s = init();
  it('matches previewMerge for a valid merge', () => {
    const cells = previewCells(s, p(0, 0), p(1, 1));
    expect(cells).toEqual(previewMerge(s.session.board, p(0, 0), p(1, 1)));
    expect(cells).toHaveLength(3);
  });
  it('is empty for invalid input', () => {
    expect(previewCells(s, p(0, 0), p(0, 0))).toEqual([]);
    expect(previewCells(s, p(0, 0), p(9, 9))).toEqual([]);
    expect(previewCells(s, p(-1, 0), p(0, 0))).toEqual([]);
    expect(previewCells(s, p(1, 0), p(0, 0))).toEqual([]);
    expect(previewCells(s, p(2, 0), p(3, 0))).toEqual([]);
  });
  it('is empty after game over', () => {
    const won = run(s, ...WIN);
    expect(previewCells(won, p(0, 0), p(1, 1))).toEqual([]);
  });
});

describe('merge lastAction', () => {
  it('3-merge carries cells, outputs, input, result', () => {
    const s = init();
    const t = reduceUi(s, drop(p(0, 0), p(1, 1)));
    expect(t.lastAction).toEqual({
      kind: 'merge', consumed: 3, input: g0, result: { family: 'grove', tier: 1 },
      cells: previewMerge(s.session.board, p(0, 0), p(1, 1)), outputs: [p(1, 1)],
    });
    expect(t.actionSeq).toBe(1);
  });
  it('5-merge outputs are [to, from]', () => {
    const s = fiveInit();
    const t = reduceUi(s, drop(p(2, 3), p(0, 0)));
    expect(t.lastAction).toEqual({
      kind: 'merge', consumed: 5, input: g0, result: { family: 'grove', tier: 1 },
      cells: previewMerge(s.session.board, p(2, 3), p(0, 0)), outputs: [p(0, 0), p(2, 3)],
    });
    expect(t.session.board[2][3]).toEqual({ family: 'grove', tier: 1 });
  });
  it('actionSeq only increments on state changes', () => {
    let s = init();
    s = reduceUi(s, tap(p(0, 0)));
    expect(s.actionSeq).toBe(0);
    s = reduceUi(s, { type: 'clearSelection' });
    expect(s.actionSeq).toBe(0);
    s = reduceUi(s, drop(p(0, 0), p(1, 0)));
    expect(s.actionSeq).toBe(1);
    s = reduceUi(s, drop(p(0, 0), p(0, 0)));
    expect(s.actionSeq).toBe(1);
  });
});

describe('goalCells', () => {
  it('is empty before the win and the goal cell after', () => {
    expect(goalCells(introInit())).toEqual([]);
    const won = run(introInit(), ...INTRO_WIN);
    expect(goalCells(won)).toEqual([p(2, 2)]);
  });
  it('for Leave one is empty until won, then exactly the last item', () => {
    const LEAVE_WIN: UiAction[] = [
      place, drop(p(3, 3), p(2, 1)), drop(p(2, 2), p(3, 1)), place, place,
      drop(p(0, 3), p(1, 2)), drop(p(0, 0), p(1, 2)), drop(p(3, 1), p(1, 2)),
    ];
    let s = initUi(LEAVE_ONE_LEVEL);
    expect(goalCells(s)).toEqual([]);
    for (const a of LEAVE_WIN.slice(0, -1)) {
      s = reduceUi(s, a);
      expect(goalCells(s)).toEqual([]);
    }
    s = reduceUi(s, LEAVE_WIN[LEAVE_WIN.length - 1]);
    expect(s.status).toBe('won');
    expect(goalCells(s)).toEqual([p(1, 2)]);
  });
});

describe('goalCells for items goals', () => {
  it('lists only cells holding a qualifying item', () => {
    const level = {
      seed: 1,
      board: [
        [{ family: 'grove', tier: 1 }, { family: 'grove', tier: 0 }],
        [{ family: 'song', tier: 1 }, null],
      ],
      supply: [],
      goal: { kind: 'items', items: [{ family: 'grove', tier: 1 }, { family: 'song', tier: 1 }] },
    } as const;
    expect(goalCells(initUi(level as never))).toEqual([p(0, 0), p(1, 0)]);
    expect(goalCells(initUi(LEVELS[4].definition))).toEqual([]);
  });
});

describe('full games', () => {
  it('wins INTRO_LEVEL with seeded random placement and only 3-merges', () => {
    let s = introInit();
    const landings: Pos[] = [];
    for (const a of INTRO_WIN) {
      s = reduceUi(s, a);
      if (s.lastAction?.kind === 'merge') expect(s.lastAction.consumed).toBe(3);
      if (s.lastAction?.kind === 'place') landings.push(s.lastAction.at);
    }
    expect(landings).toEqual(INTRO_LANDINGS);
    expect(s.status).toBe('won');
    expect(supplyRemaining(s)).toBe(0);
  });
  it('wins EIGHT_GROVE_LEVEL with a 5-merge', () => {
    let s = init();
    const consumed: number[] = [];
    for (const a of WIN) {
      s = reduceUi(s, a);
      if (s.lastAction?.kind === 'merge') consumed.push(s.lastAction.consumed);
    }
    expect(s.status).toBe('won');
    expect(consumed).toEqual([3, 5, 3]);
  });
  it('loses EIGHT_GROVE_LEVEL while supply remains; no-ops, then undo and retry work', () => {
    const lost = run(init(), ...LOSE);
    expect(lost.status).toBe('lost');
    expect(supplyRemaining(lost)).toBe(1);
    expect(canPlaceSupply(lost)).toBe(false);
    expect(reduceUi(lost, tap(p(0, 0)))).toBe(lost);
    expect(reduceUi(lost, drop(p(2, 2), p(2, 3)))).toBe(lost);
    expect(reduceUi(lost, place)).toBe(lost);
    expect(reduceUi(lost, { type: 'undo' }).status).toBe('playing');
    expect(reduceUi(lost, { type: 'retry' }).session).toEqual(init().session);
  });
  it('game over blocks tap/drop/placeSupply but allows undo/retry', () => {
    for (const [seq, status] of [[WIN, 'won'], [LOSE, 'lost']] as const) {
      const over = run(init(), ...seq);
      expect(over.status).toBe(status);
      expect(reduceUi(over, tap(p(0, 0)))).toBe(over);
      expect(reduceUi(over, drop(p(0, 0), p(1, 1)))).toBe(over);
      expect(reduceUi(over, place)).toBe(over);
      const back = reduceUi(over, { type: 'undo' });
      expect(back.status).toBe('playing');
      expect(reduceUi(over, { type: 'retry' }).session).toEqual(init().session);
    }
  });
});

describe('immutability', () => {
  it('does not mutate frozen inputs', () => {
    const deepFreeze = <T,>(o: T): T => {
      if (o && typeof o === 'object') {
        Object.values(o).forEach(deepFreeze);
        Object.freeze(o);
      }
      return o;
    };
    const level = structuredClone(EIGHT_GROVE_LEVEL);
    const s = initUi(level);
    deepFreeze(s);
    const before = structuredClone(s);
    let cur = s;
    for (const a of [...WIN, { type: 'undo' } as UiAction, { type: 'retry' } as UiAction]) {
      cur = reduceUi(cur, a);
      previewCells(cur, p(0, 0), p(1, 1));
    }
    expect(s).toEqual(before);
    expect(level).toEqual(EIGHT_GROVE_LEVEL);
  });
});

describe('region level input (The Hidden Hollow)', () => {
  const unlockAction: UiAction = { type: 'unlock' };
  const start = () => initUi(HOLLOW_LEVEL);
  // Clearing: two 3-merges make the Glade's key. Glade: a 5-merge, a move, a 3-merge. Hollow: two gathering
  // moves, a 5-merge, a move and two 3-merges.
  const CLEARING: UiAction[] = [drop(p(5, 1), p(3, 0)), drop(p(3, 0), p(4, 3))];
  const GLADE: UiAction[] = [drop(p(5, 6), p(3, 4)), drop(p(6, 4), p(5, 5)), drop(p(3, 4), p(5, 5))];
  const HOLLOW: UiAction[] = [
    drop(p(2, 4), p(1, 0)), drop(p(2, 5), p(1, 1)), drop(p(1, 6), p(0, 0)),
    drop(p(0, 0), p(1, 5)), drop(p(1, 3), p(1, 5)), drop(p(2, 0), p(1, 5)),
  ];
  const tapTo = (from: Pos, to: Pos): UiAction[] => [tap(from), tap(to)];

  it('locked items cannot be selected, dragged or previewed; taps on them do nothing', () => {
    const s = start();
    expect(canPickUp(s, p(3, 4))).toBe(false);   // Glade
    expect(canPickUp(s, p(0, 0))).toBe(false);   // Hollow
    expect(canPickUp(s, p(3, 0))).toBe(true);
    expect(reduceUi(s, tap(p(3, 4)))).toBe(s);
    expect(reduceUi(s, drop(p(5, 6), p(3, 4)))).toBe(s);
    expect(previewCells(s, p(5, 6), p(3, 4))).toEqual([]);
    expect(canDropAt(s, p(5, 6), p(3, 4))).toBe(false);
  });

  it('a selected item tapped onto a locked or other-region cell stays put and the selection ends', () => {
    let s = run(start(), tap(p(3, 0)));
    expect(s.selected).toEqual(p(3, 0));
    const session = s.session;
    s = reduceUi(s, tap(p(3, 6)));                // empty, locked Glade cell
    expect(s.selected).toBeNull();
    expect(s.session).toBe(session);
    s = run(s, ...CLEARING, unlockAction, tap(p(4, 3)), tap(p(3, 6))); // Glade open: still a different region
    expect(s.selected).toBeNull();
    expect(s.session.board[4][3]).toEqual({ family: 'grove', tier: 2 });
    expect(s.session.board[3][6]).toBeNull();
    expect(canDropAt(s, p(4, 3), p(3, 6))).toBe(false);
    expect(canDropAt(s, p(3, 4), p(3, 6))).toBe(true);
  });

  it('Unlock is a real action: refused until ready, then recorded, clearing the selection', () => {
    let s = start();
    expect(canUnlock(s)).toBe(false);
    expect(reduceUi(s, unlockAction)).toBe(s);
    s = run(s, ...CLEARING, tap(p(4, 3)));
    expect(canUnlock(s)).toBe(true);
    expect(s.selected).toEqual(p(4, 3));
    const before = s;
    s = reduceUi(s, unlockAction);
    expect(s.session.unlocked).toBe(1);
    expect(s.selected).toBeNull();
    expect(s.lastAction).toEqual({ kind: 'unlock', region: 1 });
    expect(s.actionSeq).toBe(before.actionSeq + 1);
    expect(s.session.board).toBe(before.session.board);
    expect(canUndo(s)).toBe(true);
    expect(canPickUp(s, p(3, 4))).toBe(true);
  });

  it('a gate tap unlocks only its own region: a later gate never opens the next one', () => {
    let s = start();
    const gate = (region: number): UiAction => ({ type: 'unlock', region });
    expect(canUnlock(s, 1)).toBe(false);
    expect(reduceUi(s, gate(1))).toBe(s);       // not ready yet
    s = run(s, ...CLEARING, tap(p(4, 3)));
    expect(canUnlock(s, 1)).toBe(true);
    expect(canUnlock(s, 2)).toBe(false);
    expect(reduceUi(s, gate(2))).toBe(s);       // the Hollow's gate while the Glade is next: nothing
    s = reduceUi(s, gate(1));
    expect(s.session.unlocked).toBe(1);
    expect(s.lastAction).toEqual({ kind: 'unlock', region: 1 });
    expect(s.selected).toBeNull();
    expect(reduceUi(s, gate(1))).toBe(s);       // already open
    s = run(s, ...GLADE, gate(2));
    expect(s.session.unlocked).toBe(2);
    s = run(s, { type: 'undo' });
    expect(s.session.unlocked).toBe(1);
    expect(canUnlock(s, 2)).toBe(true);
    // Once over, gates do nothing.
    const lost = run(s, gate(2), drop(p(1, 6), p(0, 0)));
    expect(lost.status).toBe('lost');
    expect(canUnlock(lost, 2)).toBe(false);
  });

  it('Undo across an unlock relocks it and leaves nothing selected, previewed or celebrating', () => {
    let s = run(start(), ...CLEARING, unlockAction, tap(p(3, 4)));
    expect(s.selected).toEqual(p(3, 4));
    s = reduceUi(s, { type: 'undo' });
    expect(s.session.unlocked).toBe(0);
    expect(s.selected).toBeNull();
    expect(s.lastAction).toEqual({ kind: 'undo' });
    expect(canPickUp(s, p(3, 4))).toBe(false);
    expect(previewCells(s, p(5, 6), p(3, 4))).toEqual([]);
    expect(goalCells(s)).toEqual([]);
    expect(canUnlock(s)).toBe(true);
  });

  it('Retry from any point restores the exact locked start', () => {
    const s = run(start(), ...CLEARING, unlockAction, ...GLADE, unlockAction, tap(p(0, 0)), { type: 'retry' });
    expect(s.session).toEqual(startSession(HOLLOW_LEVEL));
    expect(s.selected).toBeNull();
    expect(s.status).toBe('playing');
  });

  it('wins through taps and drags with both unlocks, celebrating only the Hollow\'s goal item', () => {
    const tapped = [...CLEARING, ...GLADE, ...HOLLOW].map((a) => (a.type === 'drop' ? tapTo(a.from, a.to) : [a]));
    const steps = [...tapped.slice(0, 2), [unlockAction], ...tapped.slice(2, 5), [unlockAction], ...tapped.slice(5)];
    let s = start();
    steps.forEach((group, i) => {
      s = run(s, ...group);
      expect(s.status).toBe(i === steps.length - 1 ? 'won' : 'playing');
    });
    expect(goalCells(s)).toEqual([p(1, 5)]);
    // Drags reach the same win.
    const dragged = run(start(), ...CLEARING, unlockAction, ...GLADE, unlockAction, ...HOLLOW);
    expect(dragged.session.board).toEqual(s.session.board);
    expect(dragged.status).toBe('won');
    // Once won, the board takes no input.
    expect(canPickUp(s, p(4, 3))).toBe(false);
    expect(reduceUi(s, unlockAction)).toBe(s);
  });

  it('the Hollow trap locks the board until Undo', () => {
    let s = run(start(), ...CLEARING, unlockAction, ...GLADE, unlockAction, drop(p(1, 6), p(0, 0)));
    expect(s.status).toBe('lost');
    expect(canPickUp(s, p(2, 4))).toBe(false);
    expect(reduceUi(s, tap(p(2, 4)))).toBe(s);
    s = reduceUi(s, { type: 'undo' });
    expect(s.status).toBe('playing');
    expect(s.session.unlocked).toBe(2);
  });
});
