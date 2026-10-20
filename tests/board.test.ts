import { describe, it, expect } from 'vitest';
import { drop, previewMerge, type Board, type Cell, type Family, type Pos } from '../src/board';

// Codes: '.' empty; letter = family (g grove, s song, c crystal, e elk); digit = tier. e.g. "g0".
const F: Record<string, Family> = { g: 'grove', s: 'song', c: 'crystal', e: 'elk' };
function make(rows: string[]): Board {
  return rows.map((r) =>
    r.trim().split(/\s+/).map((c): Cell =>
      c === '.' ? null : { family: F[c[0]], tier: Number(c[1]) as 0 | 1 | 2 | 3 | 4 },
    ),
  );
}
const p = (row: number, col: number): Pos => ({ row, col });

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

describe('validation', () => {
  const b = make(['g0 .']);
  it('throws on out of bounds or empty source', () => {
    for (const fn of [previewMerge, drop]) {
      expect(() => fn(b, p(0, 2), p(0, 0))).toThrow(Error);
      expect(() => fn(b, p(0, 0), p(1, 0))).toThrow(Error);
      expect(() => fn(b, p(-1, 0), p(0, 0))).toThrow(Error);
      expect(() => fn(b, p(0, 1), p(0, 0))).toThrow(Error);
    }
  });
  it('same cell is none', () => {
    const r = drop(b, p(0, 0), p(0, 0));
    expect(r.kind).toBe('none');
    expect(r.consumed).toEqual([]);
  });
});

describe('move', () => {
  it('moves onto an empty cell', () => {
    const r = drop(make(['g0 .']), p(0, 0), p(0, 1));
    expect(r.kind).toBe('move');
    expect(r.board).toEqual(make(['. g0']));
  });
});

describe('merge', () => {
  it('three-merge', () => {
    // target (0,1), group = (0,1),(0,2); source (1,1)
    const b = make(['. g0 g0', '. g0 .']);
    const r = drop(b, p(1, 1), p(0, 1));
    expect(r.kind).toBe('merge');
    expect(r.consumed).toEqual([p(1, 1), p(0, 1), p(0, 2)]);
    expect(r.board).toEqual(make(['. g1 .', '. . .']));
  });

  it('five-merge upgrades target and source cell', () => {
    // target (1,1); group: N(0,1), E(1,2), S(2,1) ... source at (1,0)
    const b = make(['. g0 .', 'g0 g0 g0', '. g0 .']);
    const r = drop(b, p(1, 0), p(1, 1));
    expect(r.kind).toBe('merge');
    expect(r.consumed).toEqual([p(1, 0), p(1, 1), p(0, 1), p(1, 2), p(2, 1)]);
    expect(r.board).toEqual(make(['. . .', 'g1 g1 .', '. . .']));
  });

  it('group of 4 + dragged consumes 4 group cells in BFS order', () => {
    const b = make(['g0 . .', 'g0 g0 g0', 'g0 . .']);
    const r = drop(b, p(2, 0), p(1, 0));
    expect(r.consumed).toEqual([p(2, 0), p(1, 0), p(0, 0), p(1, 1), p(1, 2)]);
  });

  it('group of 3 + dragged (4 available) consumes 2 group cells, leaves S neighbor', () => {
    const b = make(['. . .', 'g0 g0 g0', '. g0 .']);
    const r = drop(b, p(1, 0), p(1, 1));
    expect(r.consumed).toEqual([p(1, 0), p(1, 1), p(1, 2)]);
    expect(r.board).toEqual(make(['. . .', '. g1 .', '. g0 .']));
  });

  it('large group consumes exactly 5 in N/E/S/W BFS order', () => {
    const b = make([
      'g0 g0 g0 g0',
      'g0 g0 g0 g0',
      '.  .  .  g0',
    ]);
    // target (1,1); source (2,3). group BFS: (1,1); N(0,1), E(1,2), W(1,0); then from (0,1): E(0,2), W(0,0); ...
    const r = drop(b, p(2, 3), p(1, 1));
    expect(r.consumed).toEqual([p(2, 3), p(1, 1), p(0, 1), p(1, 2), p(1, 0)]);
    expect(r.board).toEqual(make([
      'g0 .  g0 g0',
      '.  g1 .  g0',
      '.  .  .  g1',
    ]));
  });

  it('diagonals do not count', () => {
    const b = make(['g0 . g0', '. g0 .', 'g0 . g0']);
    expect(previewMerge(b, p(0, 0), p(1, 1))).toEqual([]);
    expect(drop(b, p(0, 0), p(1, 1)).kind).toBe('swap');
  });

  it('source cell is excluded and cannot act as a bridge', () => {
    // target (0,0), source (0,1), another g0 at (0,2) only reachable via source
    const b = make(['g0 g0 g0']);
    expect(previewMerge(b, p(0, 1), p(0, 0))).toEqual([]);
    expect(drop(b, p(0, 1), p(0, 0)).kind).toBe('swap');
    // with a second real neighbor it merges and source is listed once
    const b2 = make(['g0 g0 g0', 'g0 . .']);
    const c = previewMerge(b2, p(0, 1), p(0, 0));
    expect(c).toEqual([p(0, 1), p(0, 0), p(1, 0)]);
    expect(c.filter((q) => q.row === 0 && q.col === 1)).toHaveLength(1);
  });

  it('previewMerge equals drop consumed and board is consistent', () => {
    const scenarios: [Board, Pos, Pos][] = [
      [make(['. g0 g0', '. g0 .']), p(1, 1), p(0, 1)],
      [make(['. g0 .', 'g0 g0 g0', '. g0 .']), p(1, 0), p(1, 1)],
      [make(['g0 g0 g0 g0', 'g0 g0 g0 g0', '. . . g0']), p(2, 3), p(1, 1)],
      [make(['s2 s2 s2', 'c1 . s2']), p(1, 2), p(0, 1)],
    ];
    for (const [b, from, to] of scenarios) {
      const preview = previewMerge(b, from, to);
      const r = drop(b, from, to);
      expect(r.kind).toBe('merge');
      expect(r.consumed).toEqual(preview);
      const outputs = preview.length === 5 ? [to, from] : [to];
      const isOut = (q: Pos) => outputs.some((o) => o.row === q.row && o.col === q.col);
      const isCons = (q: Pos) => preview.some((o) => o.row === q.row && o.col === q.col);
      b.forEach((row, i) => row.forEach((cell, j) => {
        const q = p(i, j);
        if (isOut(q)) expect(r.board[i][j]).toEqual({ ...cell!, tier: cell!.tier + 1 });
        else if (isCons(q)) expect(r.board[i][j]).toBeNull();
        else expect(r.board[i][j]).toEqual(cell);
      }));
    }
  });
});

describe('swap', () => {
  it('different family swaps', () => {
    const r = drop(make(['g0 s0']), p(0, 0), p(0, 1));
    expect(r.kind).toBe('swap');
    expect(r.board).toEqual(make(['s0 g0']));
  });
  it('different tier swaps', () => {
    const r = drop(make(['g0 g1']), p(0, 0), p(0, 1));
    expect(r.kind).toBe('swap');
    expect(r.board).toEqual(make(['g1 g0']));
  });
  it('matching drop with fewer than 3 available swaps', () => {
    const r = drop(make(['g0 g0 .']), p(0, 0), p(0, 1));
    expect(r.kind).toBe('swap');
    expect(r.consumed).toEqual([]);
  });
  it('tier 4 matches merge into tier 5, the top tier, whose matches do not merge', () => {
    const four = drop(make(['c3 c3 .', 'c3 . .']), p(1, 0), p(0, 1));
    expect([four.kind, four.board[0][1]]).toEqual(['merge', { family: 'crystal', tier: 4 }]);
    const b = make(['c4 c4 c4', 'c4 c4 c4']);
    expect(previewMerge(b, p(0, 0), p(1, 1))).toEqual([]);
    expect(drop(b, p(0, 0), p(1, 1)).kind).toBe('swap');
  });
});

describe('no automatic merges', () => {
  it('move leaving 3+ adjacent matches does not merge', () => {
    const r = drop(make(['g0 g0 . g0']), p(0, 3), p(0, 2));
    expect(r.kind).toBe('move');
    expect(r.board).toEqual(make(['g0 g0 g0 .']));
  });
  it('swap leaving 3+ adjacent matches does not merge', () => {
    const r = drop(make(['g0 g0 s0 g0']), p(0, 3), p(0, 2));
    expect(r.kind).toBe('swap');
    expect(r.board).toEqual(make(['g0 g0 g0 s0']));
  });
});

describe('immutability', () => {
  const cases: [string, string[], Pos, Pos][] = [
    ['move', ['g0 .'], p(0, 0), p(0, 1)],
    ['swap', ['g0 s0'], p(0, 0), p(0, 1)],
    ['3-merge', ['. g0 g0', '. g0 .'], p(1, 1), p(0, 1)],
    ['5-merge', ['. g0 .', 'g0 g0 g0', '. g0 .'], p(1, 0), p(1, 1)],
  ];
  for (const [name, rows, from, to] of cases) {
    it(`does not mutate input on ${name}`, () => {
      const b = deepFreeze(make(rows));
      const snap = structuredClone(b);
      expect(() => drop(b, from, to)).not.toThrow();
      expect(() => previewMerge(b, from, to)).not.toThrow();
      expect(b).toEqual(snap);
    });
  }
});
