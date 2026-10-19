import { drop, previewMerge, type Board, type Cell, type Family, type Item, type Pos, type Tier } from './board';
import { applyDrop, nextUint32, startSession, type LevelDefinition, type LevelGoal } from './session';
import { evaluateStatus } from './status';

// Seeded puzzle generation. A puzzle is fully determined by (generator version, config, seed);
// the puzzle ID encodes all three. Bump GENERATOR_VERSION whenever a change would make an
// existing ID produce a different board (the fixed-ID test in tests/generator.test.ts catches this).
//
// Construction works backwards from each target item: repeatedly split one item into the three
// items that merge into it (3 -> 1), or two equal items into the five that merge into them
// (5 -> 2), until the family reaches its piece budget. Every piece is therefore part of a known
// merge plan for its target. The pieces are shuffled onto a board sized from their count, and the
// plan is then executed on that actual board with the real drop() rules (moves and swaps to gather
// each group, then the merge). The resulting winning sequence is replayed through the session and
// status rules before the puzzle is returned. Candidates that fail are discarded; after a bounded
// number of attempts generation throws rather than returning an unverified puzzle.

export const GENERATOR_VERSION = 1;

export type PuzzleMode = 'goals' | 'one';

/** `tier` uses Item.tier numbering (2 is shown as tier 3 of 4). `goals` is always 1 for 'one'. */
export interface PuzzleConfig {
  readonly mode: PuzzleMode;
  readonly tier: Tier;
  readonly goals: number;
}

export const TARGET_TIERS: readonly Tier[] = [2, 3];
export const GOAL_COUNTS: readonly number[] = [1, 2, 3];

export interface Move { readonly from: Pos; readonly to: Pos }

export interface GeneratedPuzzle {
  readonly id: string;
  readonly config: PuzzleConfig;
  readonly seed: number;
  readonly definition: LevelDefinition;
  /** A verified winning sequence for `definition`. Used for validation and tests; never shown to the player. */
  readonly witness: readonly Move[];
}

/** A planned merge of `size` items of one family at `tier`. */
export interface PlannedMerge { readonly family: Family; readonly tier: Tier; readonly size: 3 | 5 }

const FAMILIES: readonly Family[] = ['grove', 'song', 'crystal', 'elk'];

// Starting pieces per target family, [min, max], by mode and target tier. A first bounded mix,
// to be tuned through playtesting; Merge down to one gets a few more pieces since it has one family.
const PIECES: Record<PuzzleMode, Partial<Record<Tier, readonly [number, number]>>> = {
  goals: { 2: [5, 8], 3: [8, 12] },
  one: { 2: [6, 9], 3: [9, 14] },
};

export const MAX_BOARD_SIDE = 8;
const MAX_ATTEMPTS = 20;

export function isSupportedConfig(config: PuzzleConfig): boolean {
  const { mode, tier, goals } = config;
  if (mode !== 'goals' && mode !== 'one') return false;
  if (!TARGET_TIERS.includes(tier)) return false;
  return mode === 'one' ? goals === 1 : GOAL_COUNTS.includes(goals);
}

const isSeed = (seed: number) => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;

/** Compact reproduction ID, e.g. `v1-goals-t4-g2-1x9k3` or `v1-one-t3-5f2a0`. Tiers are shown 1-based. */
export function puzzleId(config: PuzzleConfig, seed: number): string {
  const goals = config.mode === 'goals' ? `-g${config.goals}` : '';
  return `v${GENERATOR_VERSION}-${config.mode}-t${config.tier + 1}${goals}-${seed.toString(36)}`;
}

/** The config and seed in an ID made by this generator version, or null. */
export function parsePuzzleId(id: string): { config: PuzzleConfig; seed: number } | null {
  const m = /^v(\d+)-(goals|one)-t(\d)(?:-g(\d))?-([0-9a-z]{1,7})$/.exec(id.trim().toLowerCase());
  if (!m || Number(m[1]) !== GENERATOR_VERSION) return null;
  const mode = m[2] as PuzzleMode;
  if ((mode === 'goals') !== (m[4] !== undefined)) return null;
  const config: PuzzleConfig = { mode, tier: (Number(m[3]) - 1) as Tier, goals: mode === 'goals' ? Number(m[4]) : 1 };
  const seed = parseInt(m[5], 36);
  return isSupportedConfig(config) && isSeed(seed) ? { config, seed } : null;
}

/** Uniform integer in [0, n) from a seeded stream (rejection sampling avoids modulo bias). */
function seededRandom(seed: number): (n: number) => number {
  let state = seed >>> 0;
  return (n) => {
    const limit = 2 ** 32 - (2 ** 32 % n);
    for (;;) {
      const draw = nextUint32(state);
      state = draw.state;
      if (draw.value < limit) return draw.value % n;
    }
  };
}

function shuffle<T>(list: T[], rand: (n: number) => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Starting pieces for one target and the forward merge plan that turns them into it, or null. */
function decompose(
  family: Family, target: Tier, [min, max]: readonly [number, number], rand: (n: number) => number,
): { items: Item[]; plan: PlannedMerge[] } | null {
  const counts = [0, 0, 0, 0];
  counts[target] = 1;
  let pieces = 1;
  const want = min + rand(max - min + 1);
  const splits: PlannedMerge[] = [];
  while (pieces < want) {
    const options: PlannedMerge[] = [];
    for (let t = 1; t <= target; t++) {
      const tier = (t - 1) as Tier;
      if (counts[t] >= 1 && pieces + 2 <= max) options.push({ family, tier, size: 3 });
      if (counts[t] >= 2 && pieces + 3 <= max) options.push({ family, tier, size: 5 });
    }
    if (options.length === 0) break;
    const split = options[rand(options.length)];
    counts[split.tier + 1] -= split.size === 3 ? 1 : 2;
    counts[split.tier] += split.size;
    pieces += split.size === 3 ? 2 : 3;
    splits.push(split);
  }
  if (pieces < min) return null;
  const items = counts.flatMap((n, tier) => Array.from({ length: n }, (): Item => ({ family, tier: tier as Tier })));
  return { items, plan: splits.reverse() };
}

/** Square board side for `pieces` items, leaving roughly a third of the cells free to work in. */
export function boardSide(pieces: number): number {
  return Math.max(4, Math.ceil(Math.sqrt(pieces + Math.ceil(pieces / 2) + 2)));
}

const same = (a: Pos, b: Pos) => a.row === b.row && a.col === b.col;
const STEPS: readonly [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];

// Candidate gathering sites: connected cell shapes holding `n` cells (2: dominoes; 4: lines and squares).
function sites(rows: number, cols: number, n: number): Pos[][] {
  const shapes: [number, number][][] = n === 2
    ? [[[0, 0], [0, 1]], [[0, 0], [1, 0]]]
    : [[[0, 0], [0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]]];
  const out: Pos[][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const shape of shapes) {
        const cells = shape.map(([dr, dc]) => ({ row: r + dr, col: c + dc }));
        if (cells.every((p) => p.row < rows && p.col < cols)) out.push(cells);
      }
    }
  }
  return out;
}

/**
 * Plays `plan` on `board` with the real drop() rules and returns the moves, or null if a step
 * cannot be arranged. Each merge either uses an existing from/to pair whose merge is exactly the
 * planned size, or gathers size-1 matching items into a site whose neighbours hold no other
 * matching item (moving into empty cells or swapping with different items), then drops one more.
 */
export function findWinningMoves(board: Board, plan: readonly PlannedMerge[]): Move[] | null {
  let current = board;
  const moves: Move[] = [];
  const play = (from: Pos, to: Pos) => {
    const result = drop(current, from, to);
    current = result.board;
    moves.push({ from, to });
    return result;
  };

  for (const step of plan) {
    const matches = (c: Cell) => !!c && c.family === step.family && c.tier === step.tier;
    const found: Pos[] = [];
    current.forEach((r, row) => r.forEach((c, col) => { if (matches(c)) found.push({ row, col }); }));
    if (found.length < step.size) return null;

    const direct = found.flatMap((to) => found.map((from) => ({ from, to })))
      .find(({ from, to }) => !same(from, to) && previewMerge(current, from, to).length === step.size);
    if (direct) {
      if (play(direct.from, direct.to).consumed.length !== step.size) return null;
      continue;
    }

    const rows = current.length;
    const cols = current[0].length;
    let best: { site: Pos[]; movers: Pos[]; from: Pos; placed: number } | null = null;
    for (const site of sites(rows, cols, step.size - 1)) {
      const inSite = (p: Pos) => site.some((s) => same(s, p));
      const placed = site.filter((p) => matches(current[p.row][p.col])).length;
      const need = site.length - placed;
      const touching = (p: Pos) => !inSite(p) && site.some((s) => Math.abs(s.row - p.row) + Math.abs(s.col - p.col) === 1);
      const outside = found.filter((p) => !inSite(p));
      const blockers = outside.filter(touching);
      // Matching neighbours would join the group, so they must be the items moved in or dropped.
      if (blockers.length > need + 1) continue;
      const ordered = [...blockers, ...outside.filter((p) => !touching(p))];
      if (best && placed <= best.placed) continue;
      best = { site, movers: ordered.slice(0, need), from: ordered[need], placed };
    }
    if (!best) return null;
    const targets = best.site.filter((p) => !matches(current[p.row][p.col]));
    for (let i = 0; i < best.movers.length; i++) {
      const kind = play(best.movers[i], targets[i]).kind;
      if (kind !== 'move' && kind !== 'swap') return null;
    }
    if (play(best.from, best.site[0]).consumed.length !== step.size) return null;
  }
  return moves;
}

/** Whether `moves` win `definition` through the session and status rules, and only at the last move. */
function replayWins(definition: LevelDefinition, moves: readonly Move[]): boolean {
  let state = startSession(definition);
  if (moves.length === 0 || evaluateStatus(state) !== 'playing') return false;
  for (let i = 0; i < moves.length; i++) {
    const next = applyDrop(state, moves[i].from, moves[i].to);
    if (next === state) return false;
    state = next;
    if (evaluateStatus(state) !== (i === moves.length - 1 ? 'won' : 'playing')) return false;
  }
  return true;
}

function candidate(config: PuzzleConfig, seed: number, rand: (n: number) => number): GeneratedPuzzle | null {
  const families = shuffle([...FAMILIES], rand).slice(0, config.goals);
  const parts = families.map((f) => decompose(f, config.tier, PIECES[config.mode][config.tier]!, rand));
  if (parts.some((p) => p === null)) return null;
  const items = parts.flatMap((p) => p!.items);
  const side = boardSide(items.length);
  if (side > MAX_BOARD_SIDE) return null;
  const cells = shuffle(Array.from({ length: side * side }, (_, i) => i), rand);
  const board: Cell[][] = Array.from({ length: side }, () => Array.from({ length: side }, (): Cell => null));
  items.forEach((item, i) => { board[Math.floor(cells[i] / side)][cells[i] % side] = item; });

  const targets = families.map((family): Item => ({ family, tier: config.tier }));
  const goal: LevelGoal = config.mode === 'one'
    ? { kind: 'leaveOne', item: targets[0] }
    : targets.length === 1 ? { kind: 'item', item: targets[0] } : { kind: 'items', items: targets };
  const definition: LevelDefinition = { seed, board, supply: [], goal, earlyLoss: false };
  const witness = findWinningMoves(board, parts.flatMap((p) => p!.plan));
  if (!witness || !replayWins(definition, witness)) return null;
  return { id: puzzleId(config, seed), config, seed, definition, witness };
}

/** The verified puzzle for `config` and `seed` (deterministic). Throws for unsupported input or if no candidate verifies. */
export function generatePuzzle(config: PuzzleConfig, seed: number): GeneratedPuzzle {
  if (!isSupportedConfig(config)) throw new Error('Unsupported puzzle configuration');
  if (!isSeed(seed)) throw new Error('Puzzle seed must be a 32-bit unsigned integer');
  const rand = seededRandom(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const puzzle = candidate(config, seed, rand);
    if (puzzle) return puzzle;
  }
  throw new Error(`No verified puzzle found for ${puzzleId(config, seed)}`);
}
