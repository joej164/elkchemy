import { describe, it, expect } from 'vitest';
import type { Board, Cell, Family, Item, Pos } from '../src/board';
import {
  applyDrop, chooseSupplyCell, placeSupply, placeSupplyRandom, retry, startSession, undo,
  type LevelDefinition, type SessionState,
} from '../src/session';

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

function level(rows: string[], supply: string[] = ['s0', 'c0'], seed = 42): LevelDefinition {
  return { seed, board: make(rows), supply: supply.map(item), goal: { kind: 'item', item: item('e3') } };
}

const fields = (s: SessionState) => ({
  board: s.board, supplyIndex: s.supplyIndex, rngState: s.rngState, moves: s.moves,
});

describe('startSession', () => {
  it('initializes fields', () => {
    const lv = level(['g0 .']);
    const s = startSession(lv);
    expect(s.board).toBe(lv.board);
    expect(s.supplyIndex).toBe(0);
    expect(s.rngState).toBe(42);
    expect(s.moves).toBe(0);
    expect(s.undo).toBeNull();
    expect(s.level).toBe(lv);
  });
});

describe('board-action undo', () => {
  const cases: [string, string[], Pos, Pos, string[]][] = [
    ['move', ['g0 .'], p(0, 0), p(0, 1), ['. g0']],
    ['swap', ['g0 s0'], p(0, 0), p(0, 1), ['s0 g0']],
    ['merge', ['. g0 g0', '. g0 .'], p(1, 1), p(0, 1), ['. g1 .', '. . .']],
  ];
  for (const [name, rows, from, to, expected] of cases) {
    it(name, () => {
      const s0 = startSession(level(rows));
      const s1 = applyDrop(s0, from, to);
      expect(s1.board).toEqual(make(expected));
      expect(s1.moves).toBe(1);
      expect(s1.undo).toEqual(fields(s0));
      const s2 = undo(s1);
      expect(fields(s2)).toEqual(fields(s0));
      expect(s2.undo).toBeNull();
      expect(s2.level).toBe(s0.level);
    });
  }
});

describe('supply undo', () => {
  it('restores board, supplyIndex, moves; same item placed next', () => {
    const s0 = startSession(level(['g0 .']));
    const s1 = placeSupply(s0, p(0, 1));
    expect(s1.board).toEqual(make(['g0 s0']));
    expect(s1.supplyIndex).toBe(1);
    expect(s1.moves).toBe(1);
    const s2 = undo(s1);
    expect(fields(s2)).toEqual(fields(s0));
    expect(s2.board).toEqual(make(['g0 .']));
    const s3 = placeSupply(s2, p(0, 1));
    expect(s3.board).toEqual(make(['g0 s0']));
    expect(s3.supplyIndex).toBe(1);
  });
});

describe('complete state restoration', () => {
  it('undo restores state before last action; second undo is a no-op', () => {
    let s = startSession(level(['g0 . .', '. . .']));
    s = applyDrop(s, p(0, 0), p(1, 1));
    s = placeSupply(s, p(0, 2));
    const before = s;
    s = applyDrop(s, p(1, 1), p(0, 0));
    const u = undo(s);
    expect(fields(u)).toEqual(fields(before));
    expect(u.level).toBe(before.level);
    expect(u.undo).toBeNull();
    expect(undo(u)).toBe(u);
  });
});

describe('retry', () => {
  it('equals a fresh session and leaves level intact', () => {
    const lv = level(['g0 . .', '. . .']);
    const original = structuredClone(lv);
    let s = startSession(lv);
    s = applyDrop(s, p(0, 0), p(1, 1));
    s = placeSupply(s, p(0, 2));
    s = undo(s);
    s = applyDrop(s, p(1, 1), p(1, 2));
    const r = retry(s);
    expect(r).toEqual(startSession(lv));
    expect(r.level).toBe(lv);
    expect(lv).toEqual(original);
    expect(lv.board).toEqual(make(['g0 . .', '. . .']));
  });
});

describe('invalid actions', () => {
  const lv = level(['g0 . s0']);
  const prepared = applyDrop(startSession(lv), p(0, 0), p(0, 1)); // '. g0 s0', has undo
  const fresh = startSession(lv);
  for (const [label, s] of [['fresh', fresh], ['with undo snapshot', prepared]] as const) {
    describe(label, () => {
      const checks: [string, () => SessionState][] = [
        ['same-cell drop', () => applyDrop(s, p(0, 2), p(0, 2))],
        ['out-of-bounds drop (to)', () => applyDrop(s, p(0, 2), p(0, 3))],
        ['out-of-bounds drop (from, negative)', () => applyDrop(s, p(-1, 0), p(0, 1))],
        ['non-integer drop', () => applyDrop(s, p(0, 0.5), p(0, 1))],
        ['drop from empty cell', () => applyDrop(s, p(0, s === fresh ? 1 : 0), p(0, 2))],
        ['supply onto occupied cell', () => placeSupply(s, p(0, 2))],
        ['supply out of bounds', () => placeSupply(s, p(1, 0))],
      ];
      for (const [name, run] of checks) {
        it(name, () => {
          const r = run();
          expect(r).toBe(s);
          expect(r.supplyIndex).toBe(s.supplyIndex);
          expect(r.moves).toBe(s.moves);
          expect(r.undo).toBe(s.undo);
        });
      }
    });
  }
  it('prior undo snapshot is preserved', () => {
    expect(prepared.undo).toEqual(fields(fresh));
    expect(applyDrop(prepared, p(0, 2), p(0, 2)).undo).toBe(prepared.undo);
  });
});

describe('exhaustion', () => {
  it('further supply returns the same state', () => {
    let s = startSession(level(['. . .'], ['s0', 'c0']));
    s = placeSupply(s, p(0, 0));
    s = placeSupply(s, p(0, 1));
    expect(s.supplyIndex).toBe(2);
    expect(s.moves).toBe(2);
    const r = placeSupply(s, p(0, 2));
    expect(r).toBe(s);
    expect(r.moves).toBe(2);
    expect(r.undo).toBe(s.undo);
    expect(r.board).toEqual(make(['s0 c0 .']));
  });
});

describe('immutability', () => {
  it('does not mutate level or earlier states', () => {
    const lv = deepFreeze(level(['g0 . g0', '. g0 .']));
    const clone = structuredClone(lv);
    const s0 = startSession(lv);
    const s0Copy = structuredClone(s0);
    const s1 = applyDrop(s0, p(0, 0), p(1, 0));
    const s1Copy = structuredClone(s1);
    const s2 = placeSupply(s1, p(0, 1));
    const s2Copy = structuredClone(s2);
    const s3 = undo(s2);
    const s4 = retry(s3);
    expect(s4).toEqual(s0);
    expect(lv).toEqual(clone);
    expect(s0).toEqual(s0Copy);
    expect(s1).toEqual(s1Copy);
    expect(s2).toEqual(s2Copy);
  });
});

describe('random supply placement', () => {
  const rows = ['g0 . s0 .', '. c0 . e0'];
  const supply = ['s0', 'c0', 'e0', 'g0'];
  const at = (s: SessionState) => chooseSupplyCell(s)!.at;
  const key = (q: Pos) => `${q.row},${q.col}`;

  it('is deterministic and does not mutate', () => {
    const s = startSession(deepFreeze(level(rows, supply, 123)));
    const a = chooseSupplyCell(s);
    expect(a).not.toBeNull();
    expect(chooseSupplyCell(s)).toEqual(a);
    const r1 = placeSupplyRandom(s);
    const r2 = placeSupplyRandom(s);
    expect(r1.board).toEqual(r2.board);
    expect(r1.rngState).toBe(r2.rngState);
    expect(r1.rngState).toBe(a!.rngState);
    expect(r1.board[a!.at.row][a!.at.col]).toEqual(item('s0'));
    expect(s.rngState).toBe(123);
    expect(s.supplyIndex).toBe(0);
  });

  it('chooses only empty cells, changes exactly one cell, never overwrites', () => {
    for (let seed = 0; seed < 500; seed++) {
      const s = startSession(level(rows, supply, seed));
      const t = placeSupplyRandom(s);
      const chosen = at(s);
      expect(s.board[chosen.row][chosen.col]).toBeNull();
      const changed: string[] = [];
      s.board.forEach((r, i) => r.forEach((c, j) => {
        if (c !== null) expect(t.board[i][j]).toBe(c);
        else if (t.board[i][j] !== null) changed.push(`${i},${j}`);
      }));
      expect(changed).toEqual([key(chosen)]);
      expect(t.supplyIndex).toBe(1);
      expect(t.moves).toBe(1);
      expect(t.rngState).not.toBe(s.rngState);
    }
  });

  it('is roughly uniform over empty cells', () => {
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 4000; seed++) {
      const k = key(at(startSession(level(rows, supply, seed))));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(['0,1', '0,3', '1,0', '1,2']);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThanOrEqual(850);
      expect(n).toBeLessThanOrEqual(1150);
    }
  });

  it('different seeds give different first cells', () => {
    const cells = new Set<string>();
    for (let seed = 0; seed < 20; seed++) cells.add(key(at(startSession(level(rows, supply, seed)))));
    expect(cells.size).toBeGreaterThan(1);
  });

  it('is a no-op when supply is exhausted or the board is full', () => {
    let s = startSession(level(['. . .'], ['s0', 'c0'], 9));
    s = placeSupplyRandom(placeSupplyRandom(s));
    expect(s.supplyIndex).toBe(2);
    expect(chooseSupplyCell(s)).toBeNull();
    expect(placeSupplyRandom(s)).toBe(s);

    const full = startSession(level(['g0 s0'], ['c0'], 9));
    expect(chooseSupplyCell(full)).toBeNull();
    expect(placeSupplyRandom(full)).toBe(full);
    expect(full.rngState).toBe(9);
  });

  it('undo restores random state; placing again repeats the cell and rng state', () => {
    const s0 = startSession(level(rows, supply, 77));
    const s1 = placeSupplyRandom(s0);
    const back = undo(s1);
    expect(fields(back)).toEqual(fields(s0));
    expect(back.rngState).toBe(77);
    const again = placeSupplyRandom(back);
    expect(again.board).toEqual(s1.board);
    expect(again.rngState).toBe(s1.rngState);
  });

  it('retry reproduces the same sequence of cells', () => {
    const lv = level(['. . . .', '. . . .'], ['s0', 'c0', 'e0', 'g0'], 5);
    const sequence = (start: SessionState) => {
      const cells: string[] = [];
      let s = start;
      while (chooseSupplyCell(s)) {
        cells.push(key(at(s)));
        s = placeSupplyRandom(s);
      }
      return { cells, s };
    };
    const first = sequence(startSession(lv));
    expect(first.cells).toHaveLength(4);
    const second = sequence(retry(first.s));
    expect(second.cells).toEqual(first.cells);
  });

  it('explicit placeSupply and applyDrop leave rngState unchanged', () => {
    const s0 = startSession(level(rows, supply, 31));
    const s1 = placeSupply(s0, p(0, 1));
    expect(s1.rngState).toBe(31);
    expect(applyDrop(s1, p(0, 0), p(1, 0)).rngState).toBe(31);
  });
});
