import { describe, expect, it } from 'vitest';
import { previewMerge, type Board, type Item, type Tier } from '../src/board';
import {
  findWinningMoves, generatePuzzle, GENERATOR_VERSION, GOAL_COUNTS, isSupportedConfig, MAX_BOARD_SIDE, parsePuzzleId,
  puzzleId, TARGET_TIERS, type GeneratedPuzzle, type Move, type PuzzleConfig,
} from '../src/generator';
import { applyDrop, startSession } from '../src/session';
import { canArrangeMerge, canLeaveOne, evaluateStatus } from '../src/status';
import { initUi, reduceUi } from '../src/ui/controller';

const CONFIGS: PuzzleConfig[] = [
  ...TARGET_TIERS.flatMap((tier) => GOAL_COUNTS.map((goals): PuzzleConfig => ({ mode: 'goals', tier, goals }))),
  ...TARGET_TIERS.map((tier): PuzzleConfig => ({ mode: 'one', tier, goals: 1 })),
];
// Spread-out 32-bit seeds, including both ends of the range.
const SEEDS = [0, 1, 0xffffffff, ...Array.from({ length: 57 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0)];

// Merge to goals and Merge down to one: their winning lines are drops only.
const movesOf = (p: GeneratedPuzzle) => p.witness as readonly Move[];
const code = (c: Item | null) => (c ? `${c.family[0]}${c.tier}` : '.');
const fingerprint = (board: Board) => board.map((r) => r.map(code).join(' ')).join(' / ');
const itemsOf = (board: Board) => board.flat().filter((c): c is Item => c !== null);
const targetsOf = (p: GeneratedPuzzle): Item[] => {
  const { goal } = p.definition;
  return goal.kind === 'items' ? [...goal.items] : goal.kind !== 'treasure' && goal.item ? [goal.item] : [];
};

/** Replays the witness through the session, returning the merge sizes; asserts status after every move. */
function replay(p: GeneratedPuzzle): number[] {
  let s = startSession(p.definition);
  expect(evaluateStatus(s)).toBe('playing');
  const sizes: number[] = [];
  movesOf(p).forEach((m, i) => {
    const merged = previewMerge(s.board, m.from, m.to).length;
    if (merged) sizes.push(merged);
    const next = applyDrop(s, m.from, m.to);
    expect(next).not.toBe(s);
    s = next;
    expect(evaluateStatus(s)).toBe(i === p.witness.length - 1 ? 'won' : 'playing');
  });
  if (p.config.mode === 'one') expect(itemsOf(s.board)).toEqual(targetsOf(p));
  return sizes;
}

describe('configuration support', () => {
  it('accepts the menu choices', () => {
    CONFIGS.forEach((c) => expect(isSupportedConfig(c)).toBe(true));
  });
  it.each<[string, PuzzleConfig]>([
    ['tier 2 of 5', { mode: 'goals', tier: 1, goals: 1 }],
    ['zero goals', { mode: 'goals', tier: 3, goals: 0 }],
    ['four goals', { mode: 'goals', tier: 3, goals: 4 }],
    ['merge down to one with two goals', { mode: 'one', tier: 3, goals: 2 }],
    ['unknown mode', { mode: 'other' as never, tier: 3, goals: 1 }],
  ])('rejects %s without generating', (_name, config) => {
    expect(isSupportedConfig(config)).toBe(false);
    expect(() => generatePuzzle(config, 1)).toThrow(/Unsupported/);
  });
  it('rejects seeds outside 32 bits', () => {
    for (const seed of [-1, 1.5, 2 ** 32]) expect(() => generatePuzzle(CONFIGS[0], seed)).toThrow(/seed/);
  });
});

describe('reproduction IDs', () => {
  it('encode version, mode, shown tier, goal count and base-36 seed', () => {
    expect(puzzleId({ mode: 'goals', tier: 3, goals: 2 }, 35)).toBe(`v${GENERATOR_VERSION}-goals-t4-g2-z`);
    expect(puzzleId({ mode: 'one', tier: 2, goals: 1 }, 0xffffffff)).toBe(`v${GENERATOR_VERSION}-one-t3-1z141z3`);
  });
  it('round-trip through parsePuzzleId for every config', () => {
    for (const config of CONFIGS) {
      for (const seed of [0, 12345, 0xffffffff]) {
        expect(parsePuzzleId(puzzleId(config, seed))).toEqual({ config, seed, version: GENERATOR_VERSION });
      }
    }
    expect(parsePuzzleId(` V${GENERATOR_VERSION}-ONE-T4-ABC `)).toEqual({ config: { mode: 'one', tier: 3, goals: 1 }, seed: parseInt('abc', 36), version: 2 });
    // Version 1 IDs still parse, for their own settings (tiers 3 and 4 of 5).
    expect(parsePuzzleId('v1-goals-t3-g1-z7hukc')).toEqual({ config: { mode: 'goals', tier: 2, goals: 1 }, seed: parseInt('z7hukc', 36), version: 1 });
  });
  it('reject other versions, unsupported settings and malformed text', () => {
    for (const id of [
      `v${GENERATOR_VERSION + 1}-one-t4-abc`, `v${GENERATOR_VERSION}-one-t2-abc`, `v${GENERATOR_VERSION}-goals-t4-g4-abc`,
      `v${GENERATOR_VERSION}-goals-t4-abc`, `v${GENERATOR_VERSION}-one-t4-g1-abc`, `v${GENERATOR_VERSION}-one-t4-zzzzzzz`, 'nonsense', '',
      'v0-one-t4-abc', 'v1-one-t5-abc', 'v1-goals-t5-g1-abc', `v${GENERATOR_VERSION}-one-t6-abc`,
    ]) expect(parsePuzzleId(id), id).toBeNull();
  });
});

describe('determinism', () => {
  it('the same config and seed always give the same puzzle', () => {
    for (const config of CONFIGS) {
      const a = generatePuzzle(config, 424242);
      expect(generatePuzzle(config, 424242)).toEqual(a);
      expect(generatePuzzle(parsePuzzleId(a.id)!.config, parsePuzzleId(a.id)!.seed)).toEqual(a);
    }
  });
  it('different seeds give different IDs and varied boards', () => {
    const config = CONFIGS[1];
    const puzzles = SEEDS.map((seed) => generatePuzzle(config, seed));
    expect(new Set(puzzles.map((p) => p.id)).size).toBe(SEEDS.length);
    expect(new Set(puzzles.map((p) => fingerprint(p.definition.board))).size).toBeGreaterThan(SEEDS.length * 0.9);
  });
  // Pinned boards: if one of these changes, bump GENERATOR_VERSION so older IDs are not silently reused.
  it.each([
    ['v1-goals-t4-g2-2n9c', 's0 e0 s1 e0 . e1 / s0 e0 e0 e1 e1 . / e1 . s1 . s0 . / s0 s1 . . . . / . e0 s2 s1 s0 . / e1 e0 . . . e1'],
    ['v1-one-t4-kf12', '. s0 . s0 . / . . . s0 s0 / s1 . s1 s0 . / s0 . s0 s0 s1 / s1 s1 . . .'],
    ['v2-goals-t5-g2-2n9c', 'e2 . . . e1 s2 . / . . . . e1 e1 s1 / . . . s1 e2 . . / s2 e1 . e1 s1 e2 s2 / . s2 . s1 s1 e1 . / . s1 e1 e1 e2 e1 e1 / . . s1 . e1 s2 s1'],
    ['v2-one-t5-kf12', 's2 . s1 . s0 s1 / . . s2 s0 . . / s1 s1 . s1 . s1 / . s1 . . . s2 / s0 s1 . . s1 . / . . s1 s1 . s1'],
  ])('%s keeps its board', (id, expected) => {
    const parsed = parsePuzzleId(id)!;
    const puzzle = generatePuzzle(parsed.config, parsed.seed, parsed.version);
    expect([puzzle.id, fingerprint(puzzle.definition.board)]).toEqual([id, expected]);
  });
});

describe('generated puzzles across supported configs', () => {
  for (const config of CONFIGS) {
    describe(puzzleId(config, 0).replace(/-0$/, ''), () => {
      const puzzles = SEEDS.map((seed) => generatePuzzle(config, seed));

      it('have no supply, no early loss, and finger-sized square boards with working space', () => {
        for (const p of puzzles) {
          const { board, supply, earlyLoss } = p.definition;
          expect(supply).toEqual([]);
          expect(earlyLoss).toBe(false);
          const side = board.length;
          board.forEach((r) => expect(r).toHaveLength(side));
          expect(side).toBeGreaterThanOrEqual(4);
          expect(side).toBeLessThanOrEqual(MAX_BOARD_SIDE);
          expect(side * side).toBeGreaterThanOrEqual(itemsOf(board).length * 1.5);
        }
      });

      it('use only the target families, below the target tier', () => {
        for (const p of puzzles) {
          const targets = targetsOf(p);
          expect(targets).toHaveLength(config.goals);
          expect(new Set(targets.map((t) => t.family)).size).toBe(config.goals);
          targets.forEach((t) => expect(t.tier).toBe(config.tier));
          const families = new Set(itemsOf(p.definition.board).map((i) => i.family));
          expect([...families].sort()).toEqual(targets.map((t) => t.family).sort());
          itemsOf(p.definition.board).forEach((i) => expect(i.tier).toBeLessThan(config.tier));
        }
      });

      it('are won by their witness through the session rules, and only at the last move', () => {
        for (const p of puzzles) expect(replay(p).length).toBeGreaterThanOrEqual(2);
      });

      it('agree with the count-based feasibility checks', () => {
        for (const p of puzzles) {
          // The handcrafted-level evaluator, which does report losses, sees a reachable goal.
          expect(evaluateStatus(startSession({ ...p.definition, earlyLoss: true }))).toBe('playing');
          if (config.mode !== 'one') continue;
          const counts = [0, 0, 0, 0, 0];
          itemsOf(p.definition.board).forEach((i) => counts[i.tier]++);
          // Exactly one item is reachable at the target tier and at no other tier.
          [0, 1, 2, 3, 4].forEach((t) => expect(canLeaveOne(counts, t)).toBe(t === config.tier));
        }
      });

      it('mix 3-merges and 5-merges across seeds', () => {
        const sizes = puzzles.flatMap(replay);
        expect(sizes).toContain(3);
        expect(sizes).toContain(5);
        expect(sizes.every((n) => n === 3 || n === 5)).toBe(true);
      });
    });
  }

  it('Merge to goals has spare pieces in some boards (a choice of what to merge, left over by the witness); version 1 and Merge down to one never do', () => {
    const leftovers = (p: GeneratedPuzzle) => {
      let s = startSession(p.definition);
      for (const m of movesOf(p)) s = applyDrop(s, m.from, m.to);
      return itemsOf(s.board).length - targetsOf(p).length;
    };
    for (const config of CONFIGS) {
      const spare = SEEDS.map((seed) => leftovers(generatePuzzle(config, seed)));
      if (config.mode === 'one') expect(spare.every((n) => n === 0)).toBe(true);
      else {
        expect(spare.some((n) => n > 0), puzzleId(config, 0)).toBe(true);
        expect(Math.max(...spare)).toBeLessThanOrEqual(2 * config.goals);
      }
      if (config.tier < 4) expect(SEEDS.map((seed) => leftovers(generatePuzzle(config, seed, 1))).every((n) => n === 0)).toBe(true);
    }
  });

  it('tier 5 boards are bigger and their winning lines longer than tier 4\'s, within 10 × 10', () => {
    for (const mode of ['goals', 'one'] as const) {
      const goals = mode === 'goals' ? 3 : 1;
      const at = (tier: Tier) => SEEDS.map((seed) => generatePuzzle({ mode, tier, goals }, seed));
      const mean = (ps: GeneratedPuzzle[], f: (p: GeneratedPuzzle) => number) => ps.reduce((a, p) => a + f(p), 0) / ps.length;
      const [four, five] = [at(3), at(4)];
      expect(mean(five, (p) => p.definition.board.length)).toBeGreaterThan(mean(four, (p) => p.definition.board.length));
      expect(mean(five, (p) => p.witness.length)).toBeGreaterThan(mean(four, (p) => p.witness.length));
      expect(Math.max(...five.map((p) => p.definition.board.length))).toBeLessThanOrEqual(10);
    }
  });

  it('include starting boards that mix tiers', () => {
    const mixed = SEEDS.map((seed) => generatePuzzle({ mode: 'one', tier: 3, goals: 1 }, seed))
      .filter((p) => new Set(itemsOf(p.definition.board).map((i) => i.tier)).size > 1);
    expect(mixed.length).toBeGreaterThan(0);
  });
});

describe('witness search', () => {
  const e0: Item = { family: 'elk', tier: 0 };
  it('reports failure instead of a sequence when no exact merge can be arranged', () => {
    // A full 3x3 of identical items: every drop sees all nine, so a 3-merge can never be isolated.
    const full: Board = Array.from({ length: 3 }, () => [e0, e0, e0]);
    expect(findWinningMoves(full, [{ family: 'elk', tier: 0, size: 3 }])).toBeNull();
    expect(findWinningMoves(full, [{ family: 'elk', tier: 0, size: 5 }])).not.toBeNull();
  });
  it('gathers scattered items into an isolated group before merging', () => {
    const board: Board = [
      [e0, null, null, e0],
      [null, null, null, null],
      [null, null, null, null],
      [e0, null, null, e0],
    ];
    const moves = findWinningMoves(board, [{ family: 'elk', tier: 0, size: 3 }])!;
    let s = startSession({ seed: 1, board, supply: [], goal: { kind: 'item', item: { family: 'elk', tier: 1 as Tier } } });
    moves.forEach((m) => { s = applyDrop(s, m.from, m.to); });
    expect(itemsOf(s.board).map(code).sort()).toEqual(['e0', 'e1']);
  });
});

describe('play loop on a generated puzzle', () => {
  const puzzle = generatePuzzle({ mode: 'one', tier: 3, goals: 1 }, 2024);
  const drops = movesOf(puzzle).map((m) => ({ type: 'drop' as const, from: m.from, to: m.to }));

  it('the UI reducer wins with the witness; undo and retry restore earlier states', () => {
    const start = initUi(puzzle.definition);
    const states = drops.reduce((acc, a) => [...acc, reduceUi(acc[acc.length - 1], a)], [start]);
    const won = states[states.length - 1];
    expect(won.status).toBe('won');
    const undone = reduceUi(won, { type: 'undo' });
    expect(undone.status).toBe('playing');
    expect(undone.session.board).toEqual(states[states.length - 2].session.board);
    const retried = reduceUi(won, { type: 'retry' });
    expect(retried.session).toEqual(start.session);
    expect(retried.session).toEqual(initUi(generatePuzzle(puzzle.config, puzzle.seed).definition).session);
  });

  it('reports no early loss after a fatal merge, and lost only once no merge can be arranged', () => {
    // Always take a 5-merge when one is available: for some puzzles that strands a leftover, which
    // the count-based checker used by handcrafted levels reports as lost straight away.
    let scattered = false;
    const greedy = (p: GeneratedPuzzle) => {
      let s = initUi(p.definition);
      let earlyCountLoss = false;
      for (let guard = 0; guard < 50 && s.status === 'playing'; guard++) {
        const cells = s.session.board.flatMap((r, row) => r.map((c, col) => (c ? [{ row, col }] : []))).flat();
        const pairs = cells.flatMap((from) => cells.map((to) => ({ from, to })));
        const size = (x: { from: typeof cells[0]; to: typeof cells[0] }) => previewMerge(s.session.board, x.from, x.to).length;
        const pick = pairs.find((x) => size(x) === 5) ?? pairs.find((x) => size(x) === 3);
        if (!pick) {
          // Still playing with no adjacent group: the matching items are scattered and must be gathered first.
          expect(canArrangeMerge(s.session)).toBe(true);
          const items = cells.map((c) => s.session.board[c.row][c.col]!);
          const mergeable = items.find((i) => i.tier < 3 && items.filter((j) => j.family === i.family && j.tier === i.tier).length >= 3)!;
          const moves = findWinningMoves(s.session.board, [{ family: mergeable.family, tier: mergeable.tier, size: 3 }])!;
          moves.slice(0, -1).forEach((m) => { s = reduceUi(s, { type: 'drop', ...m }); });
          expect(s.status).toBe('playing');
          scattered = true;
          continue;
        }
        const before = s;
        s = reduceUi(s, { type: 'drop', ...pick });
        const countLost = evaluateStatus({ ...s.session, level: { ...s.session.level, earlyLoss: true } }) === 'lost';
        if (countLost && s.status === 'playing') earlyCountLoss = true;
        if (s.status === 'lost') {
          expect(canArrangeMerge(s.session)).toBe(false);
          // Undo leaves the "no merges left" state.
          expect(reduceUi(s, { type: 'undo' }).session.board).toEqual(before.session.board);
          expect(reduceUi(s, { type: 'undo' }).status).toBe('playing');
        }
      }
      return { status: s.status, earlyCountLoss };
    };
    const results = SEEDS.map((seed) => greedy(generatePuzzle({ mode: 'one', tier: 3, goals: 1 }, seed)));
    expect(results.some((r) => r.earlyCountLoss)).toBe(true);
    expect(results.some((r) => r.status === 'lost')).toBe(true);
    results.forEach((r) => expect(['won', 'lost']).toContain(r.status));
    expect(scattered).toBe(true); // some boards were playing with only scattered matches
  });
});

describe('reported puzzle v1-goals-t3-g1-z7hukc', () => {
  // Five Elk tier 1 and one Elk tier 2; the goal is Elk tier 3, which needs the 5-merge.
  const { config, seed, version } = parsePuzzleId('v1-goals-t3-g1-z7hukc')!;
  const puzzle = generatePuzzle(config, seed, version);
  const p = (row: number, col: number) => ({ row, col });
  const stuck = (s = initUi(puzzle.definition)) => reduceUi(s, { type: 'drop', from: p(3, 1), to: p(1, 3) }); // a 3-merge

  it('has the reported board', () => {
    expect(fingerprint(puzzle.definition.board)).toBe('. . . e0 / e0 e1 . e0 / e0 . . . / . e0 . .');
  });

  it('a 3-merge leaves no merges; Undo restores the previous board and play continues to a win', () => {
    const start = initUi(puzzle.definition);
    const dead = stuck(start);
    expect(dead.lastAction).toMatchObject({ kind: 'merge', consumed: 3 });
    expect(dead.status).toBe('lost');
    const back = reduceUi(dead, { type: 'undo' });
    expect(back.status).toBe('playing');
    expect(back.session.board).toEqual(start.session.board);
    const won = movesOf(puzzle).reduce((s, m) => reduceUi(s, { type: 'drop', ...m }), back);
    expect(won.status).toBe('won');
    expect(reduceUi(won, { type: 'undo' }).status).toBe('playing');
  });

  it('the stuck board is locked; Undo, Retry and New Puzzle stay available', () => {
    const dead = stuck();
    expect(reduceUi(dead, { type: 'drop', from: p(1, 1), to: p(1, 3) })).toBe(dead);
    expect(reduceUi(dead, { type: 'tap', pos: p(1, 1) })).toBe(dead);
    expect(reduceUi(dead, { type: 'retry' }).session.board).toEqual(puzzle.definition.board);
    expect(reduceUi(dead, { type: 'undo' }).session.board).toEqual(puzzle.definition.board);
  });

  it('a drop onto an identical item that cannot merge changes nothing and keeps the Undo step', () => {
    // An ordinary move first, so there is an Undo step to protect. (1,0) and (2,0) are a tier-1 pair.
    const start = initUi(puzzle.definition);
    const moved = reduceUi(start, { type: 'drop', from: p(3, 1), to: p(3, 3) });
    expect(moved.status).toBe('playing');
    expect(reduceUi(moved, { type: 'drop', from: p(1, 0), to: p(2, 0) })).toBe(moved);
    const tapped = reduceUi(reduceUi(moved, { type: 'tap', pos: p(1, 0) }), { type: 'tap', pos: p(2, 0) });
    expect(tapped.selected).toBeNull();
    expect(tapped.session).toBe(moved.session);
    expect(reduceUi(tapped, { type: 'undo' }).session.board).toEqual(start.session.board);
  });

  it('Undo after an ordinary move restores it; Undo is single-step, so a second press does nothing', () => {
    const start = initUi(puzzle.definition);
    const moved = reduceUi(start, { type: 'drop', from: p(3, 1), to: p(3, 3) });
    expect(moved.lastAction).toEqual({ kind: 'move' });
    const back = reduceUi(moved, { type: 'undo' });
    expect(back.session.board).toEqual(start.session.board);
    expect(reduceUi(back, { type: 'undo' })).toBe(back);
  });
});
