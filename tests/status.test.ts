import { describe, it, expect } from 'vitest';
import type { Board, Cell, Family, Item, Pos } from '../src/board';
import { LEAVE_ONE_LEVEL } from '../src/levels';
import {
  applyDrop, placeSupply, placeSupplyRandom, startSession, undo, type LevelDefinition, type SessionState,
} from '../src/session';
import { canLeaveOne, evaluateStatus, maxPromotions } from '../src/status';

const F: Record<string, Family> = { g: 'grove', s: 'song', c: 'crystal', e: 'elk' };
function make(rows: string[]): Board {
  return rows.map((r) =>
    r.trim().split(/\s+/).map((c): Cell =>
      c === '.' ? null : { family: F[c[0]], tier: Number(c[1]) as 0 | 1 | 2 | 3 },
    ),
  );
}
const p = (row: number, col: number): Pos => ({ row, col });
const item = (code: string): Item => make([code])[0][0]!;

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

function level(rows: string[], supply: string[], goal: string): LevelDefinition {
  return { seed: 1, board: make(rows), supply: supply.map(item), goal: { kind: 'item', item: item(goal) } };
}
const status = (rows: string[], supply: string[], goal: string) =>
  evaluateStatus(startSession(level(rows, supply, goal)));

describe('maxPromotions', () => {
  const table: [number, number][] = [
    [0, 0], [1, 0], [2, 0], [3, 1], [4, 1], [5, 2], [6, 2], [7, 2], [8, 3], [9, 3], [10, 4], [11, 4], [13, 5],
  ];
  for (const [n, e] of table) it(`${n} -> ${e}`, () => expect(maxPromotions(n)).toBe(e));
});

describe('victory', () => {
  it('goal family at goal tier', () => expect(status(['g1 .'], [], 'g1')).toBe('won'));
  it('goal family above goal tier', () => expect(status(['g2 .'], [], 'g1')).toBe('won'));
  it('different family at goal tier is not a win', () => expect(status(['s1 g0'], [], 'g1')).toBe('lost'));
});

describe('future supply', () => {
  it('unspent supply makes goal reachable', () => expect(status(['g0 g0 .'], ['g0'], 'g1')).toBe('playing'));
  it('same board without that supply is lost', () => expect(status(['g0 g0 .'], [], 'g1')).toBe('lost'));
  it('spent supply no longer counts', () => {
    const s = { ...startSession(level(['g0 g0 .'], ['g0'], 'g1')), supplyIndex: 1 };
    expect(evaluateStatus(s)).toBe('lost');
  });
  it('unspent supply item already at goal tier is reachable', () =>
    expect(status(['s0 .'], ['g1'], 'g1')).toBe('playing'));
});

describe('resource impossibility', () => {
  it('lost while supply and moves remain', () => {
    const s = startSession(level(['g0 g0 g0 g0', '. . . .'], ['c0'], 'g2'));
    expect(s.level.supply.length - s.supplyIndex).toBe(1);
    expect(evaluateStatus(s)).toBe('lost');
  });
});

describe('full board', () => {
  const rows = [
    'g0 s0 g0 c0',
    'e0 g0 s1 g0',
    'g0 c1 g0 e1',
    's2 g0 c2 g0',
  ];
  const steps: [Pos, Pos][] = [
    [p(0, 0), p(0, 1)], [p(2, 0), p(1, 0)], [p(0, 2), p(1, 2)], [p(3, 1), p(2, 1)], // swaps
    [p(3, 3), p(1, 1)], // 5-merge
    [p(1, 3), p(1, 2)], [p(1, 0), p(2, 1)], // moves
    [p(2, 1), p(2, 2)], // 3-merge
    [p(1, 1), p(1, 2)], // move
    [p(3, 3), p(2, 2)], // 3-merge into grove-2
  ];

  it('is playing, not lost or thrown', () => {
    const s = startSession(level(rows, [], 'g2'));
    expect(s.board.every((r) => r.every((c) => c !== null))).toBe(true);
    expect(evaluateStatus(s)).toBe('playing');
  });

  it('a real session sequence reaches won from the full board', () => {
    let s: SessionState = startSession(level(rows, [], 'g2'));
    steps.forEach(([from, to], i) => {
      const next = applyDrop(s, from, to);
      expect(next).not.toBe(s);
      s = next;
      expect(evaluateStatus(s)).toBe(i === steps.length - 1 ? 'won' : 'playing');
    });
  });
});

describe('assumption enforcement', () => {
  it('throws when board items + unspent supply exceed capacity', () => {
    expect(() => status(['g0 g0'], ['g0'], 'g1')).toThrow(/capacity/);
  });
  it('does not throw when exactly at capacity', () => {
    expect(() => status(['g0 g0 .'], ['g0'], 'g1')).not.toThrow();
  });
  it('throws for non-rectangular boards', () => {
    const lv: LevelDefinition = { ...level(['g0 g0'], [], 'g1'), board: [make(['g0 g0'])[0], make(['g0'])[0]] };
    expect(() => evaluateStatus(startSession(lv))).toThrow(/rectangular/);
  });
  it('a win is reported without the assumption check', () => {
    expect(status(['g1 g0'], ['g0'], 'g1')).toBe('won');
  });
});

describe('items goal', () => {
  const lvl = (rows: string[], supply: string[], targets: string[]): LevelDefinition => ({
    seed: 1, board: make(rows), supply: supply.map(item), goal: { kind: 'items', items: targets.map(item) },
  });
  const status = (l: LevelDefinition) => evaluateStatus(startSession(l));

  it('is won when every target is present (or higher)', () => {
    expect(status(lvl(['g1 s2', '. .'], [], ['g1', 's1']))).toBe('won');
  });
  it('is playing when partially met and the rest is makeable', () => {
    expect(status(lvl(['g1 s0 s0', 's0 . .'], [], ['g1', 's1']))).toBe('playing');
  });
  it('is lost when one target is met but another is unreachable', () => {
    expect(status(lvl(['g1 s0 s0', '. . .'], [], ['g1', 's1']))).toBe('lost');
  });
  it('depends on unspent supply for reachability', () => {
    const l = lvl(['g1 s0 s0', '. . .'], ['s0'], ['g1', 's1']);
    expect(status(l)).toBe('playing');
    expect(evaluateStatus(placeSupply(startSession(l), p(1, 0)))).toBe('playing');
    // Unspent supply of another family does not help the unreachable target.
    expect(status(lvl(['g1 s0 s0', '. . .'], ['g0'], ['g1', 's1']))).toBe('lost');
  });
  it('throws for duplicate target families', () => {
    expect(() => status(lvl(['g0 g0 g0', '. . .'], [], ['g1', 'g2']))).toThrow();
  });
  it('still throws when over capacity', () => {
    expect(() => status(lvl(['g0 s0', 'e0 c0'], ['g0'], ['g1', 's1']))).toThrow();
  });
});

describe('immutability', () => {
  it('does not mutate a deep-frozen state', () => {
    const s = deepFreeze(startSession(level(['g0 g0 .'], ['g0'], 'g1')));
    const before = structuredClone(s);
    expect(() => evaluateStatus(s)).not.toThrow();
    expect(s).toEqual(before);
  });
});

// ---- Leave one ----

function leaveOne(rows: string[], supply: string[]): LevelDefinition {
  return { seed: 1, board: make(rows), supply: supply.map(item), goal: { kind: 'leaveOne' } };
}
/** A single row of `n` items with the given code, padded with empties to fill a 4x4 board. */
const rowsOf = (codes: string[]): string[] => {
  const cells = [...codes, ...Array(16 - codes.length).fill('.')];
  return [0, 1, 2, 3].map((r) => cells.slice(r * 4, r * 4 + 4).join(' '));
};
/** Status of a leave-one level; a one-line board is read as codes and padded to 4x4. */
const l1 = (rows: string[], supply: string[] = []) => {
  const board = rows.length === 1 ? rowsOf(rows[0].trim().split(/\s+/).filter((c) => c !== '.')) : rows;
  return evaluateStatus(startSession(leaveOne(board, supply)));
};

describe('leave one: victory', () => {
  it('won with one item and no supply', () => expect(l1(['e1 .'])).toBe('won'));
  it('one item on the board with unspent supply is not won', () =>
    expect(l1(['e1 . .'], ['e1', 'e1'])).toBe('playing'));
  it('one item with unspent supply that cannot merge away is lost, not won', () =>
    expect(l1(['e1 . .'], ['e1'])).toBe('lost'));
  it('empty board with no supply is lost', () => expect(l1(['. .'])).toBe('lost'));
  it('several items with no supply are not won', () => expect(l1(['e0 e0 . .'])).toBe('lost'));
});

describe('leave one: real session', () => {
  it('reaches a one-item board with supply left (playing), then wins after placing the rest', () => {
    let s = startSession(leaveOne(rowsOf(['e0', 'e0', 'e0']), ['e1', 'e1']));
    expect(evaluateStatus(s)).toBe('playing');
    s = applyDrop(s, p(0, 0), p(0, 1)); // 3-merge -> single elk-1
    expect(s.board.flat().filter((c) => c !== null)).toHaveLength(1);
    expect(s.supplyIndex).toBeLessThan(s.level.supply.length);
    expect(evaluateStatus(s)).toBe('playing');
    s = placeSupply(s, p(1, 0));
    expect(evaluateStatus(s)).toBe('playing');
    s = placeSupply(s, p(1, 1));
    expect(s.supplyIndex).toBe(2);
    expect(evaluateStatus(s)).toBe('playing');
    s = applyDrop(s, p(1, 0), p(0, 1)); // 3 elk-1 -> elk-2
    expect(s.supplyIndex).toBe(s.level.supply.length);
    expect(s.board.flat().filter((c) => c !== null)).toEqual([{ family: 'elk', tier: 2 }]);
    expect(evaluateStatus(s)).toBe('won');
  });
});

describe('leave one: families', () => {
  it('two families on the board is lost', () => expect(l1(['e0 g0 .'])).toBe('lost'));
  it('one family on the board, another in unspent supply, is lost', () =>
    expect(l1(['e0 e0 .'], ['g0'])).toBe('lost'));
  it('a lone item of another family in supply is lost even if the board is empty of it', () =>
    expect(l1(['e1 .'], ['s0'])).toBe('lost'));
});

/** Independent memoised search over per-tier counts. */
function bruteForce(counts: number[]): boolean {
  const memo = new Map<string, boolean>();
  const go = (c: number[]): boolean => {
    if (c.reduce((a, b) => a + b, 0) === 1) return true;
    const key = c.join(',');
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let ok = false;
    for (let t = 0; t < 3 && !ok; t++) {
      if (c[t] >= 3) { const n = [...c]; n[t] -= 3; n[t + 1] += 1; ok = go(n); }
      if (!ok && c[t] >= 5) { const n = [...c]; n[t] -= 5; n[t + 1] += 2; ok = go(n); }
    }
    memo.set(key, ok);
    return ok;
  };
  return go(counts);
}

describe('leave one: single-family tier-0 counts', () => {
  const expected: Record<number, 'won' | 'playing' | 'lost'> = {
    1: 'won', 2: 'lost', 3: 'playing', 4: 'lost', 5: 'lost', 6: 'lost',
    7: 'lost', 8: 'playing', 9: 'playing', 10: 'lost', 11: 'lost', 12: 'lost',
  };
  for (const [n, e] of Object.entries(expected)) {
    it(`${n} elk-0 on the board, no supply -> ${e}`, () => {
      expect(l1(rowsOf(Array(Number(n)).fill('e0')))).toBe(e);
    });
  }
  it('splitting the same count between board and supply gives the same answer', () => {
    for (const n of [3, 4, 8, 9]) {
      const split = l1(rowsOf(Array(n - 2).fill('e0')), ['e0', 'e0']);
      expect(split).toBe(expected[n]);
    }
  });
  it('table agrees with brute force', () => {
    for (const [n, e] of Object.entries(expected)) {
      expect(e === 'lost' ? false : true).toBe(bruteForce([Number(n), 0, 0, 0]));
    }
  });
});

describe('leave one: max tier', () => {
  it('two elk-3 is lost', () => expect(l1(['e3 e3 .'])).toBe('lost'));
  it('elk-3 plus elk-0 is lost', () => expect(l1(['e3 e0 .'])).toBe('lost'));
  it('elk-3 plus elk-0 supply is lost', () => expect(l1(['e3 .'], ['e0'])).toBe('lost'));
  it('three elk-2 is playing', () => expect(l1(['e2 e2 e2 .'])).toBe('playing'));
});

describe('leave one: capacity', () => {
  const full = (n: number) => rowsOf(Array(n).fill('e1'));
  it('throws when board items + supply exceed cells - 2', () => {
    expect(() => l1(full(14), ['e1'])).toThrow(/capacity/);
    expect(() => l1(full(15))).toThrow(/capacity/);
  });
  it('does not throw at exactly cells - 2', () => {
    expect(() => l1(full(14))).not.toThrow();
    expect(() => l1(full(13), ['e1'])).not.toThrow();
  });
  it('a won single-item state is reported without the check', () => {
    expect(l1(['e3'])).toBe('won');
  });
  it('throws for non-rectangular boards', () => {
    const lv: LevelDefinition = { ...leaveOne(['e0 e0'], []), board: [make(['e0 e0'])[0], make(['e0'])[0]] };
    expect(() => evaluateStatus(startSession(lv))).toThrow(/rectangular/);
  });
});

describe('canLeaveOne', () => {
  it('matches an independent brute force over a range of counts', () => {
    let checked = 0;
    for (let c0 = 0; c0 <= 12; c0++) {
      for (let c1 = 0; c1 <= 7; c1++) {
        for (let c2 = 0; c2 <= 5; c2++) {
          for (let c3 = 0; c3 <= 2; c3++) {
            const counts = [c0, c1, c2, c3];
            expect(canLeaveOne(counts), counts.join(',')).toBe(bruteForce(counts));
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(13 * 8 * 6 * 3);
  });
});

describe('leave one: undo restores the preceding status', () => {
  const fieldsOf = (st: SessionState) => ({
    board: st.board, supplyIndex: st.supplyIndex, rngState: st.rngState, moves: st.moves,
  });
  const walk = (steps: string[]): SessionState => {
    let st = startSession(LEAVE_ONE_LEVEL);
    for (const x of steps) {
      st = x === 'P'
        ? placeSupplyRandom(st)
        : applyDrop(st, p(+x[0], +x[1]), p(+x[3], +x[4]));
    }
    return st;
  };
  // Seed 5: random placements land at (2,1), (0,3), (1,2) in this order.
  const WIN = ['P', '33>21', '22>31', 'P', 'P', '03>12', '00>12', '31>12'];

  it('a losing elk-1 5-merge, then undo, is playing again with equal fields', () => {
    const before = walk(WIN.slice(0, 2));
    expect(evaluateStatus(before)).toBe('playing');
    const lost = applyDrop(before, p(0, 0), p(1, 1)); // five connected elk-1 -> 5-merge strands one
    expect(lost.board.flat().filter((c) => c !== null)).toHaveLength(before.board.flat().filter((c) => c !== null).length - 3);
    expect(evaluateStatus(lost)).toBe('lost');
    const back = undo(lost);
    expect(evaluateStatus(back)).toBe('playing');
    expect(fieldsOf(back)).toEqual(fieldsOf(before));
  });
  it('the final winning merge, then undo, is playing again with equal fields', () => {
    const before = walk(WIN.slice(0, -1));
    expect(evaluateStatus(before)).toBe('playing');
    const won = applyDrop(before, p(3, 1), p(1, 2));
    expect(evaluateStatus(won)).toBe('won');
    const back = undo(won);
    expect(evaluateStatus(back)).toBe('playing');
    expect(fieldsOf(back)).toEqual(fieldsOf(before));
  });
});
