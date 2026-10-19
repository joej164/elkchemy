import { describe, expect, it } from 'vitest';
import { MAX_TIER, previewMerge, type Board, type Cell, type Family, type Item, type Pos, type Tier } from '../src/board';
import { generatePuzzle } from '../src/generator';
import { HOLLOW_LEVEL, LEVELS } from '../src/levels';
import { hasItemIn, isOpen, nextLocked, regionAt, unlockReady, validateRegions, type Region } from '../src/regions';
import {
  applyDrop, canDrop, isCellOpen, previewDrop, retry, startSession, undo, unlock, type LevelDefinition, type SessionState,
} from '../src/session';
import { evaluateStatus, isGoalMet, type GameStatus } from '../src/status';

const p = (row: number, col: number): Pos => ({ row, col });
const it_ = (family: Family, tier: Tier): Item => ({ family, tier });
const regions = HOLLOW_LEVEL.regions!;
const [CLEARING, GLADE, HOLLOW] = [0, 1, 2];

/** HOLLOW_LEVEL with some cells replaced. */
function variant(cells: [number, number, Cell][], extra: Partial<LevelDefinition> = {}): LevelDefinition {
  const board = HOLLOW_LEVEL.board.map((r) => [...r]);
  for (const [row, col, c] of cells) board[row][col] = c;
  return { ...HOLLOW_LEVEL, board, ...extra };
}

type Step = { from: Pos; to: Pos; merge?: 3 | 5 } | 'unlock';
const last = <T,>(list: readonly T[]): T => list[list.length - 1];
const step = (s: SessionState, st: Step): SessionState => (st === 'unlock' ? unlock(s) : applyDrop(s, st.from, st.to));

/** Runs steps through the real session rules, checking every step changes the state and its merge size. */
function play(level: LevelDefinition, steps: readonly Step[], statuses?: GameStatus[]): SessionState[] {
  const states = [startSession(level)];
  steps.forEach((st, i) => {
    const s = states[states.length - 1];
    if (st !== 'unlock') expect(previewDrop(s, st.from, st.to)).toHaveLength(st.merge ?? 0);
    const next = step(s, st);
    expect(next).not.toBe(s);
    if (statuses) expect(evaluateStatus(next), `after step ${i + 1}`).toBe(statuses[i]);
    states.push(next);
  });
  return states;
}

// The authored solution (also recorded in docs/release-notes.md).
const CLEARING_STEPS: Step[] = [
  { from: p(5, 1), to: p(3, 0), merge: 3 },   // three grove-0 → grove-1, beside nothing
  { from: p(3, 0), to: p(4, 3), merge: 3 },   // three grove-1 → grove-2, the Glade's key
  'unlock',                                   // Songbird Glade
];
const GLADE_STEPS: Step[] = [
  { from: p(5, 6), to: p(3, 4), merge: 5 },   // five song-0 → two song-1, at (3,4) and (5,6)
  { from: p(6, 4), to: p(5, 5) },             // move a song-1 beside the one at (5,6)
  { from: p(3, 4), to: p(5, 5), merge: 3 },   // three song-1 → song-2, the Hollow's key
  'unlock',                                   // Crystal Hollow
];
const HOLLOW_STEPS: Step[] = [
  { from: p(2, 4), to: p(1, 0) },             // gather four crystal-0 into a 2×2 block
  { from: p(2, 5), to: p(1, 1) },
  { from: p(1, 6), to: p(0, 0), merge: 5 },   // drop the fifth on the block: two crystal-1, at (0,0) and (1,6)
  { from: p(0, 0), to: p(1, 5) },             // move one beside the other
  { from: p(1, 3), to: p(1, 5), merge: 3 },   // three crystal-1 → crystal-2 at (1,5), beside the one at (0,5)
  { from: p(2, 0), to: p(1, 5), merge: 3 },   // three crystal-2 → crystal-3: the goal
];
const WIN: Step[] = [...CLEARING_STEPS, ...GLADE_STEPS, ...HOLLOW_STEPS];
const UNLOCKED_ALL = CLEARING_STEPS.length + GLADE_STEPS.length;

const items = (s: SessionState, r: Region) => {
  const out: Item[] = [];
  for (let row = r.row; row < r.row + r.rows; row++) for (let col = r.col; col < r.col + r.cols; col++) {
    const c = s.board[row][col];
    if (c) out.push(c);
  }
  return out;
};
const count = (list: readonly Item[], family: Family, tier: number) => list.filter((i) => i.family === family && i.tier === tier).length;

describe('HOLLOW_LEVEL design', () => {
  const start = startSession(HOLLOW_LEVEL);

  it('is level 6, after the original five', () => {
    expect(LEVELS).toHaveLength(6);
    expect(LEVELS[5]).toEqual({ name: 'The Hidden Hollow', definition: HOLLOW_LEVEL });
  });

  it('is a 7×7 map split exactly into a 4×4 clearing and two locked regions, with no supply', () => {
    expect(HOLLOW_LEVEL.board).toHaveLength(7);
    HOLLOW_LEVEL.board.forEach((r) => expect(r).toHaveLength(7));
    expect(() => validateRegions(HOLLOW_LEVEL)).not.toThrow();
    expect(regions.map((r) => [r.name, r.rows, r.cols])).toEqual([
      ['Mossy Clearing', 4, 4], ['Songbird Glade', 4, 3], ['Crystal Hollow', 3, 7],
    ]);
    expect(regions[GLADE].unlock).toEqual({ item: it_('grove', 2), in: CLEARING });
    expect(regions[HOLLOW].unlock).toEqual({ item: it_('song', 2), in: GLADE });
    expect(HOLLOW_LEVEL.goal).toEqual({ kind: 'item', item: it_('crystal', 3), region: HOLLOW });
    expect(HOLLOW_LEVEL.supply).toEqual([]);
  });

  it('places each region\'s resources in it, all of its target family, every one used by the solution', () => {
    expect(items(start, regions[CLEARING]).every((i) => i.family === 'grove')).toBe(true);
    expect(items(start, regions[GLADE]).every((i) => i.family === 'song')).toBe(true);
    expect(items(start, regions[HOLLOW]).every((i) => i.family === 'crystal')).toBe(true);
    expect([0, 1, 2].map((t) => count(items(start, regions[CLEARING]), 'grove', t))).toEqual([3, 2, 0]);
    expect([0, 1, 2].map((t) => count(items(start, regions[GLADE]), 'song', t))).toEqual([6, 1, 0]);
    expect([0, 1, 2, 3].map((t) => count(items(start, regions[HOLLOW]), 'crystal', t))).toEqual([5, 1, 2, 0]);
  });

  it('starts in the clearing with both other regions locked and nothing pre-met', () => {
    expect(start.unlocked).toBe(0);
    expect([0, 1, 2].map((i) => isOpen(start, i))).toEqual([true, false, false]);
    expect(nextLocked(start)).toBe(GLADE);
    expect(unlockReady(start)).toBe(false);
    expect(isGoalMet(start)).toBe(false);
    expect(evaluateStatus(start)).toBe('playing');
  });
});

describe('HOLLOW_LEVEL winning path through both unlocks', () => {
  const statuses: GameStatus[] = WIN.map((_, i) => (i === WIN.length - 1 ? 'won' : 'playing'));

  it('wins only at the last step, through the real session rules', () => {
    const states = play(HOLLOW_LEVEL, WIN, statuses);
    const won = states[states.length - 1];
    expect(won.unlocked).toBe(2);
    expect(won.board[1][5]).toEqual(it_('crystal', 3));
    expect(won.moves).toBe(WIN.length);
  });

  it('uses a mix of 3- and 5-merges: one optional 5 in the Glade, one needed 5 in the Hollow', () => {
    const sizes = WIN.flatMap((st) => (st !== 'unlock' && st.merge ? [st.merge] : []));
    expect(sizes).toEqual([3, 3, 5, 3, 5, 3, 3]);
  });

  it('the Glade also reaches its key with plain 3-merges', () => {
    const glade3: Step[] = [
      { from: p(3, 4), to: p(6, 6), merge: 3 },  // song-0 onto the (5,6)-(6,6) pair
      { from: p(3, 5), to: p(4, 4), merge: 3 },  // the rest of the block
      { from: p(6, 6), to: p(6, 5) },            // move a song-1 beside the starting song-1 at (6,4)
      { from: p(4, 4), to: p(6, 5), merge: 3 },  // three song-1 → song-2
    ];
    const states = play(HOLLOW_LEVEL, [...CLEARING_STEPS, ...glade3]);
    const s = states[states.length - 1];
    expect(hasItemIn(s.board, regions[GLADE], it_('song', 2))).toBe(true);
    expect(unlockReady(s)).toBe(true);
  });
});

describe('unlocking', () => {
  const states = play(HOLLOW_LEVEL, WIN);
  const beforeGlade = states[2];  // key made, Glade still locked
  const afterGlade = states[3];
  const beforeHollow = states[6];
  const afterHollow = states[7];

  it('is refused (same state) until the key is in its region', () => {
    const start = states[0];
    expect(unlock(start)).toBe(start);
    expect(unlock(states[1])).toBe(states[1]);  // grove-1 only
  });

  it('opens the next region without consuming or moving the key', () => {
    expect(unlockReady(beforeGlade)).toBe(true);
    expect(afterGlade.unlocked).toBe(1);
    expect(afterGlade.board).toBe(beforeGlade.board);
    expect(afterGlade.board[4][3]).toEqual(it_('grove', 2));
    expect(afterGlade.moves).toBe(beforeGlade.moves + 1);
    expect(afterHollow.board).toBe(beforeHollow.board);
    expect(afterHollow.board[5][5]).toEqual(it_('song', 2));
  });

  it('goes in order: the Hollow cannot open before the Glade, even with its key already made', () => {
    const level = variant([[6, 5, it_('song', 2)]]);
    let s = startSession(level);
    expect(hasItemIn(s.board, regions[GLADE], it_('song', 2))).toBe(true);
    expect(nextLocked(s)).toBe(GLADE);
    expect(unlock(s)).toBe(s);
    for (const st of CLEARING_STEPS) s = step(s, st);
    expect(nextLocked(s)).toBe(HOLLOW);
    expect(unlockReady(s)).toBe(true);
    s = unlock(s);
    expect(s.unlocked).toBe(2);
    expect(unlock(s)).toBe(s);  // nothing left to unlock
  });

  it('undo restores the board, the lock and the status together; retry restores the exact start', () => {
    const back = undo(afterGlade);
    expect(back.unlocked).toBe(0);
    expect(back.board).toBe(beforeGlade.board);
    expect(back.moves).toBe(beforeGlade.moves);
    expect(isCellOpen(back, p(3, 4))).toBe(false);
    expect(canDrop(back, p(3, 4), p(3, 6))).toBe(false);
    expect(evaluateStatus(back)).toBe('playing');
    expect(unlock(back)).toEqual(afterGlade);

    const backHollow = undo(afterHollow);
    expect(backHollow.unlocked).toBe(1);
    expect(isCellOpen(backHollow, p(0, 0))).toBe(false);

    const won = states[states.length - 1];
    for (const s of [afterGlade, afterHollow, won]) expect(retry(s)).toEqual(startSession(HOLLOW_LEVEL));
    expect(undo(won).unlocked).toBe(2);
    expect(evaluateStatus(undo(won))).toBe('playing');
  });
});

describe('locked regions and region borders', () => {
  const start = startSession(HOLLOW_LEVEL);
  const afterGlade = last(play(HOLLOW_LEVEL, CLEARING_STEPS));
  const afterHollow = last(play(HOLLOW_LEVEL, [...CLEARING_STEPS, ...GLADE_STEPS]));

  it('locked pieces cannot move, merge, swap or receive drops', () => {
    expect(applyDrop(start, p(3, 4), p(3, 6))).toBe(start);  // locked move inside the Glade
    expect(applyDrop(start, p(5, 6), p(3, 4))).toBe(start);  // locked 5-merge
    expect(applyDrop(start, p(6, 4), p(3, 4))).toBe(start);  // locked swap
    expect(applyDrop(start, p(3, 1), p(3, 6))).toBe(start);  // clearing item onto an empty locked cell
    expect(applyDrop(start, p(4, 3), p(4, 4))).toBe(start);  // clearing item onto a locked item
    expect(applyDrop(start, p(2, 0), p(3, 2))).toBe(start);  // locked Hollow item into the clearing
    expect(previewDrop(start, p(5, 6), p(3, 4))).toEqual([]);
    expect(isCellOpen(start, p(3, 3))).toBe(true);
    expect(isCellOpen(start, p(3, 4))).toBe(false);
    expect(isCellOpen(start, p(0, 0))).toBe(false);
  });

  it('open regions refuse cross-border moves, swaps and merges', () => {
    // Clearing ↔ Glade, both open.
    expect(applyDrop(afterGlade, p(3, 1), p(3, 6))).toBe(afterGlade);   // move
    expect(applyDrop(afterGlade, p(4, 3), p(4, 4))).toBe(afterGlade);   // swap
    expect(canDrop(afterGlade, p(3, 1), p(3, 6))).toBe(false);
    // Glade ↔ Hollow, and Hollow ↔ clearing, all open.
    expect(applyDrop(afterHollow, p(5, 5), p(2, 6))).toBe(afterHollow); // the key into the Hollow
    expect(applyDrop(afterHollow, p(2, 0), p(3, 0))).toBe(afterHollow); // swap across the clearing's top edge
    expect(applyDrop(afterHollow, p(2, 4), p(3, 4))).toBe(afterHollow); // swap with the Glade
    // Within a region everything still works.
    expect(applyDrop(afterHollow, p(2, 4), p(1, 0))).not.toBe(afterHollow);
  });

  it('a merge group never reaches across a border, even into a locked region', () => {
    // Clearing grove-0 pair (3,0),(3,1) touches two grove-0 placed in the locked Hollow at (2,0),(2,1).
    const s = startSession(variant([[2, 0, it_('grove', 0)], [2, 1, it_('grove', 0)]]));
    // Unbounded, dropping the clearing's third grove-0 would be a 5-merge; bounded it is a 3-merge.
    expect(previewMerge(s.board, p(5, 1), p(3, 0))).toHaveLength(5);
    expect(previewDrop(s, p(5, 1), p(3, 0))).toHaveLength(3);
    const after = applyDrop(s, p(5, 1), p(3, 0));
    expect(after.board[2][0]).toEqual(it_('grove', 0));
    expect(after.board[2][1]).toEqual(it_('grove', 0));
    expect(after.board[3][0]).toEqual(it_('grove', 1));
  });

  it('a matching pair split by a border is a no-op drop that keeps the Undo step', () => {
    const level = variant([[2, 0, it_('grove', 0)], [3, 1, null]]);
    let s = startSession(level);
    s = applyDrop(s, p(5, 1), p(5, 2));                 // an ordinary move, to fill the Undo step
    const before = s;
    expect(previewMerge(s.board, p(5, 2), p(3, 0))).toHaveLength(3); // only via the Hollow's piece
    expect(applyDrop(s, p(5, 2), p(3, 0))).toBe(before);
  });
});

describe('region-specific objectives and resources', () => {
  it('a goal item outside the goal region does not count', () => {
    const level = variant([[6, 0, it_('crystal', 3)]]);
    const s = last(play(level, [...CLEARING_STEPS, ...GLADE_STEPS]));
    expect(s.unlocked).toBe(2);
    expect(isGoalMet(s)).toBe(false);
    expect(evaluateStatus(s)).toBe('playing');
  });

  it('a goal item in the locked goal region does not count until it opens', () => {
    const level = variant([[0, 3, it_('crystal', 3)]]);
    const states = play(level, [...CLEARING_STEPS, ...GLADE_STEPS]);
    expect(states.slice(0, -1).map(evaluateStatus)).not.toContain('won');
    expect(evaluateStatus(last(states))).toBe('won');
  });

  it('an unlock key counts only in the region it names', () => {
    // A grove-2 in the Glade is not the Glade's key, which must be made in the clearing.
    const level = variant([[6, 5, it_('grove', 2)]]);
    expect(unlockReady(startSession(level))).toBe(false);
  });
});

describe('failure handling', () => {
  it('locked resources are not usable: a clearing that cannot make its key is lost at once', () => {
    // Two grove-0 and two grove-1: no merge and no unlock, though the locked Glade could merge.
    const level = variant([[5, 1, null]]);
    expect(evaluateStatus(startSession(level))).toBe('lost');
  });

  it('a doomed clearing stays playing while a merge toward its key remains', () => {
    // Four grove-0 and one grove-1: the key is out of reach, but a merge is still possible.
    const level = variant([[5, 3, it_('grove', 0)], [6, 3, null]]);
    let s = startSession(level);
    expect(evaluateStatus(s)).toBe('playing');
    s = applyDrop(s, p(5, 1), p(3, 0));
    expect(evaluateStatus(s)).toBe('lost');  // one grove-0, two grove-1
  });

  it('is never lost while an unlock is ready, even with no merges left', () => {
    const s = last(play(HOLLOW_LEVEL, CLEARING_STEPS.slice(0, 2)));
    expect(items(s, regions[CLEARING])).toEqual([it_('grove', 2)]);
    expect(unlockReady(s)).toBe(true);
    expect(evaluateStatus(s)).toBe('playing');
  });

  it('a newly opened region\'s merges keep the game going', () => {
    const level = variant([[3, 4, null], [3, 5, null], [4, 4, null], [4, 5, null]]); // Glade: two song-0, one song-1
    let s = startSession(level);
    for (const st of CLEARING_STEPS.slice(0, 2)) s = step(s, st);
    expect(evaluateStatus(s)).toBe('playing');  // unlock ready
    s = unlock(s);
    expect(evaluateStatus(s)).toBe('lost');     // the Glade cannot make its key
    expect(evaluateStatus(undo(s))).toBe('playing');
  });

  it('the Hollow trap: any 3-merge of crystal-0 is reported at once, and one Undo recovers', () => {
    const open = last(play(HOLLOW_LEVEL, WIN.slice(0, UNLOCKED_ALL)));
    expect(evaluateStatus(open)).toBe('playing');
    for (const [from, to] of [[p(1, 6), p(0, 0)], [p(1, 6), p(2, 5)], [p(0, 0), p(2, 4)]] as const) {
      expect(previewDrop(open, from, to)).toHaveLength(3);
      const lost = applyDrop(open, from, to);
      expect(evaluateStatus(lost)).toBe('lost');
      const back = undo(lost);
      expect(back.board).toBe(open.board);
      expect(back.unlocked).toBe(2);
      let s = back;
      for (const st of HOLLOW_STEPS) s = step(s, st);
      expect(evaluateStatus(s)).toBe('won');
    }
  });
});

// Exhaustive check of the status rule on every reachable count state of the authored level. Within a region any
// arrangement is reachable (drops go anywhere in it, swaps exchange differing items), so a region's state is its
// item counts; a 3-merge needs three of a kind and a 5-merge five. Each state is laid out on a real board and judged
// by evaluateStatus, and compared with whether a win is still reachable.
describe('HOLLOW_LEVEL status over every reachable state', () => {
  type State = { counts: Map<string, number>[]; unlocked: number };
  const key = (s: State) => `${s.unlocked}|${s.counts.map((m) => [...m].filter(([, n]) => n).sort().join(',')).join('|')}`;
  const realize = (s: State): SessionState => {
    const board: Cell[][] = HOLLOW_LEVEL.board.map((r) => r.map((): Cell => null));
    regions.forEach((r, i) => {
      const list = [...s.counts[i]].flatMap(([k, n]) => Array.from({ length: n }, () => it_(k.slice(0, -1) as Family, Number(k.slice(-1)) as Tier)));
      list.forEach((item, j) => { board[r.row + Math.floor(j / r.cols)][r.col + (j % r.cols)] = item; });
    });
    return { ...startSession(HOLLOW_LEVEL), board: board as Board, unlocked: s.unlocked };
  };
  const successors = (s: State): State[] => {
    const out: State[] = [];
    s.counts.forEach((m, r) => {
      if (r > s.unlocked) return;
      for (const [k, n] of m) {
        const tier = Number(k.slice(-1));
        if (tier >= MAX_TIER) continue;
        const up = `${k.slice(0, -1)}${tier + 1}`;
        for (const [use, make] of [[3, 1], [5, 2]] as const) {
          if (n < use) continue;
          const next = s.counts.map((c) => new Map(c));
          next[r].set(k, n - use);
          next[r].set(up, (next[r].get(up) ?? 0) + make);
          out.push({ counts: next, unlocked: s.unlocked });
        }
      }
    });
    if (unlockReady(realize(s))) out.push({ counts: s.counts, unlocked: s.unlocked + 1 });
    return out;
  };
  const start = startSession(HOLLOW_LEVEL);
  const initial: State = {
    unlocked: 0,
    counts: regions.map((r) => {
      const m = new Map<string, number>();
      for (const i of items(start, r)) m.set(`${i.family}${i.tier}`, (m.get(`${i.family}${i.tier}`) ?? 0) + 1);
      return m;
    }),
  };
  const all = new Map<string, State>();
  const queue = [initial];
  while (queue.length) {
    const s = queue.pop()!;
    if (all.has(key(s))) continue;
    all.set(key(s), s);
    if (!isGoalMet(realize(s))) queue.push(...successors(s));
  }
  const memo = new Map<string, boolean>();
  const winnable = (s: State): boolean => {
    const k = key(s);
    if (!memo.has(k)) memo.set(k, isGoalMet(realize(s)) || successors(s).some(winnable));
    return memo.get(k)!;
  };

  it('is bounded and starts winnable', () => {
    expect(all.size).toBeGreaterThan(10);
    expect(all.size).toBeLessThan(200);
    expect(winnable(initial)).toBe(true);
  });

  it('reports lost exactly when no win is reachable, and won exactly when the goal is met', () => {
    for (const s of all.values()) {
      const status = evaluateStatus(realize(s));
      expect(status === 'won', key(s)).toBe(isGoalMet(realize(s)));
      if (status !== 'won') expect(status === 'lost', key(s)).toBe(!winnable(s));
    }
  });

  it('its only losing choice is a 3-merge of crystal-0 in the Hollow', () => {
    const dead = [...all.values()].filter((s) => !winnable(s));
    expect(dead.length).toBeGreaterThan(0);
    for (const s of dead) {
      expect(s.unlocked).toBe(2);
      expect(Object.fromEntries([...s.counts[HOLLOW]].filter(([, n]) => n))).toEqual({ crystal0: 2, crystal1: 2, crystal2: 2 });
    }
  });
});

describe('unsupported region configurations are rejected', () => {
  const base = HOLLOW_LEVEL;
  const withRegions = (rs: Region[], extra: Partial<LevelDefinition> = {}): LevelDefinition => ({ ...base, regions: rs, ...extra });
  const [r0, r1, r2] = regions;
  const cases: [string, LevelDefinition][] = [
    ['ragged board', { ...base, board: base.board.map((r, i) => (i === 6 ? r.slice(1) : r)) }],
    ['one region', withRegions([{ ...r0, row: 0, rows: 7, cols: 7 }], { goal: { ...base.goal, region: 0 } as LevelDefinition['goal'] })],
    ['region outside the board', withRegions([r0, { ...r1, cols: 4 }, r2])],
    ['fractional bounds', withRegions([r0, { ...r1, rows: 3.5 }, r2])],
    ['overlap', withRegions([r0, { ...r1, col: 3, cols: 4 }, r2])],
    ['gap', withRegions([r0, { ...r1, rows: 3 }, r2])],
    ['first region locked', withRegions([{ ...r0, unlock: { item: it_('grove', 1), in: 0 } }, r1, r2])],
    ['later region without unlock', withRegions([r0, { ...r1, unlock: undefined }, r2])],
    ['unlock from itself', withRegions([r0, r1, { ...r2, unlock: { item: it_('song', 2), in: 2 } }])],
    ['unlock from a later region', withRegions([r0, { ...r1, unlock: { item: it_('grove', 2), in: 2 } }, r2])],
    ['supply', { ...base, supply: [it_('grove', 0)] }],
    ['goal outside the last region', { ...base, goal: { kind: 'item', item: it_('crystal', 3), region: 1 } }],
    ['goal without a region', { ...base, goal: { kind: 'item', item: it_('crystal', 3) } }],
    ['items goal', { ...base, goal: { kind: 'items', items: [it_('crystal', 3)] } }],
    ['leave-one goal', { ...base, goal: { kind: 'leaveOne' } }],
    ['goal region without regions', { ...base, regions: undefined }],
  ];
  for (const [name, level] of cases) {
    it(name, () => {
      expect(() => validateRegions(level)).toThrow(/Unsupported/);
      expect(() => startSession(level)).toThrow(/Unsupported/);
    });
  }
});

describe('levels without regions are unchanged', () => {
  const definitions = [
    ...LEVELS.slice(0, 5).map((l) => l.definition),
    generatePuzzle({ mode: 'goals', tier: 3, goals: 2 }, 7).definition,
    generatePuzzle({ mode: 'one', tier: 2, goals: 1 }, 7).definition,
  ];
  it('start with nothing to unlock, every cell open, and drops allowed anywhere', () => {
    for (const level of definitions) {
      const s = startSession(level);
      expect(level.regions).toBeUndefined();
      expect(s.unlocked).toBe(0);
      expect(nextLocked(s)).toBeNull();
      expect(unlock(s)).toBe(s);
      const at = s.board.flatMap((r, row) => r.map((c, col) => (c ? p(row, col) : null))).find(Boolean)!;
      s.board.forEach((r, row) => r.forEach((_, col) => {
        expect(isCellOpen(s, p(row, col))).toBe(true);
        expect(regionAt([], p(row, col))).toBe(-1);
        if (row !== at.row || col !== at.col) {
          expect(canDrop(s, at, p(row, col))).toBe(true);
          expect(previewDrop(s, at, p(row, col))).toEqual(previewMerge(s.board, at, p(row, col)));
        }
      }));
    }
  });
});
