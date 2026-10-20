import { drop, MAX_TIER, previewMerge, type Board, type Cell, type Family, type Item, type Pos, type Tier } from './board';
import { finalItem, recipeById } from './recipes';
import { applyDrop, nextUint32, openChest, startSession, type LevelDefinition, type LevelGoal } from './session';
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
//
// Merge to treasure builds the recipe's ingredients (from fixed inventories since version 4) and, for a tier-5 goal,
// supporting pieces the same way; its winning line then drops one ingredient onto the other (crafting the chest), opens
// the chest and merges.
//
// Version 4 changes only Merge to treasure's ingredients: each starts as one of five fixed inventories, chosen evenly
// (INGREDIENT_PLANS), instead of version 3's random splits within 5–8 pieces. Version 3 IDs reproduce their boards.
//
// Version 3 makes Merge to treasure's catalog of four recipes and its goals of tier 4 or 5, with crafting by dropping
// one ingredient onto the other. Merge to goals and Merge down to one generate exactly as in version 2. Version 2's
// treasure IDs (one recipe, `v2-treasure-woodland-…`, its goal tier 4) still reproduce their original boards, which
// are now played with the drop-to-craft rules (their Craft button is gone).
//
// Version 2 adds tier-5 targets, boards up to 10 × 10, and (Merge to goals) spare pieces. Version 1 IDs still
// reproduce their original boards: version 1 keeps its tiers, its 8 × 8 limit and no spares, and draws the same
// random numbers in the same order.

export const GENERATOR_VERSION = 4;
/** Versions whose IDs this generator still reproduces. */
export const GENERATOR_VERSIONS: readonly number[] = [1, 2, 3, 4];

export type PuzzleMode = 'goals' | 'one' | 'treasure';

/**
 * `tier` uses Item.tier numbering (2 is shown as tier 3 of 5). `goals` is always 1 for 'one' and 'treasure'.
 * 'treasure': `recipe` names it (see recipes.ts), and `tier` is its final item's.
 */
export interface PuzzleConfig {
  readonly mode: PuzzleMode;
  readonly tier: Tier;
  readonly goals: number;
  readonly recipe?: string;
}

export const TARGET_TIERS: readonly Tier[] = [2, 3, 4];
/** Merge to treasure (version 3): goal tiers 4 and 5 of 5. */
export const TREASURE_TIERS: readonly Tier[] = [3, 4];
const V1_TIERS: readonly Tier[] = [2, 3];
export const GOAL_COUNTS: readonly number[] = [1, 2, 3];

export interface Move { readonly from: Pos; readonly to: Pos }
/** A step of a winning line: a drop (crafting included), or (Merge to treasure) opening the chest. */
export type Step = Move | { readonly action: 'open' };

export interface GeneratedPuzzle {
  readonly id: string;
  readonly config: PuzzleConfig;
  readonly seed: number;
  readonly definition: LevelDefinition;
  /** A verified winning sequence for `definition` (drops only, except in Merge to treasure). Never shown to the player. */
  readonly witness: readonly Step[];
}

/** A planned merge of `size` items of one family at `tier`. */
export interface PlannedMerge { readonly family: Family; readonly tier: Tier; readonly size: 3 | 5 }

const FAMILIES: readonly Family[] = ['grove', 'song', 'crystal', 'elk'];

// Starting pieces per target family, [min, max], by mode and target tier. A first bounded mix,
// to be tuned through playtesting; Merge down to one gets a few more pieces since it has one family.
// Tier 5 (version 2) starts from mostly middle-tier pieces, so its chains are longer without a much bigger board.
const PIECES: Record<'goals' | 'one', Partial<Record<Tier, readonly [number, number]>>> = {
  goals: { 2: [5, 8], 3: [8, 12], 4: [11, 16] },
  one: { 2: [6, 9], 3: [9, 14], 4: [14, 20] },
};

/** The largest board side: 8 in version 1, 10 since (tier 5 and three goals with spares need up to 10 × 10). */
export const MAX_BOARD_SIDE = 10;
const maxSide = (version: number) => (version === 1 ? 8 : MAX_BOARD_SIDE);
const MAX_ATTEMPTS = 20;

export function isSupportedConfig(config: PuzzleConfig, version = GENERATOR_VERSION): boolean {
  const { mode, tier, goals, recipe } = config;
  if (mode === 'treasure') {
    const r = recipe === undefined ? undefined : recipeById(recipe);
    if (!r || goals !== 1) return false;
    // Version 2 had the Woodland chest only, its contents' merge the goal.
    if (version === 2) return r.id === 'woodland' && tier === finalItem(r).tier;
    return version >= 3 && TREASURE_TIERS.includes(tier);
  }
  if ((mode !== 'goals' && mode !== 'one') || recipe !== undefined) return false;
  if (!(version === 1 ? V1_TIERS : TARGET_TIERS).includes(tier)) return false;
  return mode === 'one' ? goals === 1 : GOAL_COUNTS.includes(goals);
}

const isSeed = (seed: number) => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;

/** The config for Merge to treasure with a recipe and goal tier (default: its contents' merge, tier 4). */
export function treasureConfig(recipe: string, tier?: Tier): PuzzleConfig {
  const r = recipeById(recipe);
  return { mode: 'treasure', tier: tier ?? (r ? finalItem(r).tier : 0), goals: 1, recipe };
}

/**
 * Compact reproduction ID, e.g. `v3-goals-t5-g2-1x9k3`, `v1-one-t3-5f2a0` or `v3-treasure-songbird-t5-3k1`
 * (`v2-treasure-woodland-3k1` in version 2, which had no tier choice). Tiers are shown 1-based.
 */
export function puzzleId(config: PuzzleConfig, seed: number, version = GENERATOR_VERSION): string {
  if (config.mode === 'treasure') {
    return `v${version}-treasure-${config.recipe}${version >= 3 ? `-t${config.tier + 1}` : ''}-${seed.toString(36)}`;
  }
  const goals = config.mode === 'goals' ? `-g${config.goals}` : '';
  return `v${version}-${config.mode}-t${config.tier + 1}${goals}-${seed.toString(36)}`;
}

/** The config, seed and version in an ID made by a version this generator reproduces, or null. */
export function parsePuzzleId(id: string): { config: PuzzleConfig; seed: number; version: number } | null {
  const m = /^v(\d+)-(?:(goals|one)-t(\d)(?:-g(\d))?|treasure-([a-z]+)(?:-t(\d))?)-([0-9a-z]{1,7})$/.exec(id.trim().toLowerCase());
  const version = Number(m?.[1]);
  if (!m || !GENERATOR_VERSIONS.includes(version)) return null;
  const seed = parseInt(m[7], 36);
  if (m[5] !== undefined) {
    // Version 3 names the goal tier; version 2 had none.
    if ((m[6] !== undefined) !== (version >= 3)) return null;
    const config = treasureConfig(m[5], m[6] === undefined ? undefined : (Number(m[6]) - 1) as Tier);
    return isSupportedConfig(config, version) && isSeed(seed) ? { config, seed, version } : null;
  }
  const mode = m[2] as PuzzleMode;
  if ((mode === 'goals') !== (m[4] !== undefined)) return null;
  const config: PuzzleConfig = { mode, tier: (Number(m[3]) - 1) as Tier, goals: mode === 'goals' ? Number(m[4]) : 1 };
  return isSupportedConfig(config, version) && isSeed(seed) ? { config, seed, version } : null;
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
  const counts = Array.from({ length: MAX_TIER + 1 }, () => 0);
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

/** Whether `steps` win `definition` through the session and status rules, and only at the last step. */
function replayWins(definition: LevelDefinition, steps: readonly Step[]): boolean {
  let state = startSession(definition);
  if (steps.length === 0 || evaluateStatus(state) !== 'playing') return false;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const next = 'action' in step ? openChest(state) : applyDrop(state, step.from, step.to);
    if (next === state) return false;
    state = next;
    if (evaluateStatus(state) !== (i === steps.length - 1 ? 'won' : 'playing')) return false;
  }
  return true;
}

/**
 * Version 2, Merge to goals: up to two spare pieces of a goal's family, each at a tier its plan merges. A set then
 * holds more than its merge needs, so the player chooses which pieces to merge (or makes a 5 → 2 merge instead);
 * spares may be left over, as any leftover may in this mode.
 */
function spares(family: Family, plan: readonly PlannedMerge[], rand: (n: number) => number): Item[] {
  return Array.from({ length: rand(3) }, (): Item => ({ family, tier: plan[rand(plan.length)].tier }));
}

/** The pieces shuffled onto a square board sized from their count, or null if it would be too big. */
function place(items: readonly Item[], version: number, rand: (n: number) => number): Cell[][] | null {
  const side = boardSide(items.length);
  if (side > maxSide(version)) return null;
  const cells = shuffle(Array.from({ length: side * side }, (_, i) => i), rand);
  const board: Cell[][] = Array.from({ length: side }, () => Array.from({ length: side }, (): Cell => null));
  items.forEach((item, i) => { board[Math.floor(cells[i] / side)][cells[i] % side] = item; });
  return board;
}

// Merge to treasure: pieces per ingredient (version 3), as for a tier-3 goal in Merge to goals (no spares); and per
// supporting item (a tier-5 goal), as many as each breaks into.
const TREASURE_PIECES: readonly [number, number] = [5, 8];
const SUPPORT_PIECES: readonly [number, number] = [3, 6];

/**
 * Version 4: the ways to make one ingredient from pieces one ("middle") and two ("low") tiers below it with nothing
 * left over, as forward merge plans of [tiers below, size]. Each fixes the merges: 9 low needs three 3-merges (a 5-merge
 * would strand one), 8 low one 5-merge, 6 low + 1 middle two 3-merges, 5 low + 1 middle the 5-merge. The sixth way,
 * 3 middle, is a single merge and is left out. Version 3's splits within 5–8 pieces gave 8 low to 45% and never 9.
 */
export const INGREDIENT_PLANS: readonly (readonly (readonly [1 | 2, 3 | 5])[])[] = [
  [[2, 3], [1, 3]],                 // 3 low + 2 middle
  [[2, 5], [1, 3]],                 // 5 low + 1 middle
  [[2, 3], [2, 3], [1, 3]],         // 6 low + 1 middle
  [[2, 5], [2, 3], [1, 3]],         // 8 low
  [[2, 3], [2, 3], [2, 3], [1, 3]], // 9 low
];

/** Version 4: an ingredient's starting pieces and merge plan, from an evenly chosen INGREDIENT_PLANS entry. */
function ingredientParts({ family, tier }: Item, rand: (n: number) => number): { items: Item[]; plan: PlannedMerge[] } {
  const plan = INGREDIENT_PLANS[rand(INGREDIENT_PLANS.length)]
    .map(([below, size]): PlannedMerge => ({ family, tier: (tier - below) as Tier, size }));
  const counts = Array.from({ length: MAX_TIER + 1 }, () => 0);
  counts[tier] = 1;
  for (const m of [...plan].reverse()) {
    counts[m.tier + 1] -= m.size === 3 ? 1 : 2;
    counts[m.tier] += m.size;
  }
  return { items: counts.flatMap((n, t) => Array.from({ length: n }, (): Item => ({ family, tier: t as Tier }))), plan };
}

/** Whether some sequence of 3- and 5-merges of one family's items (counts by tier) makes an item of `tier` or above. */
export function canReach(counts: readonly number[], tier: number): boolean {
  const seen = new Set<string>();
  const go = (c: number[]): boolean => {
    if (c.slice(tier).some((n) => n > 0)) return true;
    const key = c.join();
    if (seen.has(key)) return false;
    seen.add(key);
    for (let t = 0; t < tier; t++) {
      for (const [take, give] of [[3, 1], [5, 2]]) {
        if (c[t] < take) continue;
        const next = [...c];
        next[t] -= take;
        next[t + 1] += give;
        if (go(next)) return true;
      }
    }
    return false;
  };
  return go(Array.from({ length: MAX_TIER + 1 }, (_, t) => counts[t] ?? 0));
}

const positionOf = (board: Board, item: Item): Pos | null => {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const c = board[row][col];
      if (c && c.family === item.family && c.tier === item.tier) return { row, col };
    }
  }
  return null;
};

/**
 * Merge to treasure: each ingredient's starting pieces (see INGREDIENT_PLANS), and for a goal two tiers above the contents
 * (tier 5), two supporting items of the reward family at the contents' merge tier, decomposed too: with the contents'
 * merge they make the three that merge into the goal. The supporting pieces alone must never reach the goal's tier, so
 * the chest is needed. The winning line merges everything into the two ingredients (and the supporting items), drops
 * the first ingredient onto the second (crafting), opens the chest and merges up to the goal; it is replayed before
 * it is returned.
 */
function treasureCandidate(config: PuzzleConfig, seed: number, version: number, rand: (n: number) => number): GeneratedPuzzle | null {
  const recipe = recipeById(config.recipe!)!;
  const content = recipe.contents.item;
  const tall = config.tier > content.tier + 1;
  const ingredients = recipe.ingredients.flatMap(({ item, count }) =>
    Array.from({ length: count }, () =>
      (version >= 4 ? ingredientParts(item, rand) : decompose(item.family, item.tier, TREASURE_PIECES, rand))));
  const support = tall ? [0, 1].map(() => decompose(content.family, (content.tier + 1) as Tier, SUPPORT_PIECES, rand)) : [];
  const parts = [...ingredients, ...support];
  if (parts.some((p) => p === null)) return null;
  const supportItems = support.flatMap((p) => p!.items);
  const counts = Array.from({ length: MAX_TIER + 1 }, () => 0);
  for (const it of supportItems) counts[it.tier]++;
  if (tall && canReach(counts, config.tier)) return null;
  const board = place(parts.flatMap((p) => p!.items), version, rand);
  if (!board) return null;
  const goalItem: Item = { family: content.family, tier: config.tier };
  const definition: LevelDefinition = {
    seed, board, supply: [], goal: { kind: 'leaveOne', item: goalItem }, earlyLoss: false, recipe,
  };
  const merges = findWinningMoves(board, parts.flatMap((p) => p!.plan));
  if (!merges) return null;
  let state = startSession(definition);
  for (const m of merges) state = applyDrop(state, m.from, m.to);
  const [a, b] = recipe.ingredients.map((i) => positionOf(state.board, i.item));
  if (!a || !b) return null;
  const craft: Move = { from: a, to: b };
  state = openChest(applyDrop(state, a, b));
  const finish: PlannedMerge[] = [{ family: content.family, tier: content.tier, size: 3 }];
  if (tall) finish.push({ family: content.family, tier: (content.tier + 1) as Tier, size: 3 });
  const last = findWinningMoves(state.board, finish);
  if (!last) return null;
  const witness: Step[] = [...merges, craft, { action: 'open' }, ...last];
  if (!replayWins(definition, witness)) return null;
  return { id: puzzleId(config, seed, version), config, seed, definition, witness };
}

function candidate(config: PuzzleConfig, seed: number, version: number, rand: (n: number) => number): GeneratedPuzzle | null {
  const families = shuffle([...FAMILIES], rand).slice(0, config.goals);
  const parts = families.map((f) => decompose(f, config.tier, PIECES[config.mode as 'goals' | 'one'][config.tier]!, rand));
  if (parts.some((p) => p === null)) return null;
  const extra = version >= 2 && config.mode === 'goals' ? families.flatMap((f, i) => spares(f, parts[i]!.plan, rand)) : [];
  const items = [...parts.flatMap((p) => p!.items), ...extra];
  const board = place(items, version, rand);
  if (!board) return null;

  const targets = families.map((family): Item => ({ family, tier: config.tier }));
  const goal: LevelGoal = config.mode === 'one'
    ? { kind: 'leaveOne', item: targets[0] }
    : targets.length === 1 ? { kind: 'item', item: targets[0] } : { kind: 'items', items: targets };
  const definition: LevelDefinition = { seed, board, supply: [], goal, earlyLoss: false };
  const witness = findWinningMoves(board, parts.flatMap((p) => p!.plan));
  if (!witness || !replayWins(definition, witness)) return null;
  return { id: puzzleId(config, seed, version), config, seed, definition, witness };
}

/**
 * The verified puzzle for `config` and `seed` (deterministic), by the current generator or, for an older ID, the
 * `version` it names. Throws for unsupported input or if no candidate verifies.
 */
export function generatePuzzle(config: PuzzleConfig, seed: number, version = GENERATOR_VERSION): GeneratedPuzzle {
  if (!GENERATOR_VERSIONS.includes(version) || !isSupportedConfig(config, version)) throw new Error('Unsupported puzzle configuration');
  if (!isSeed(seed)) throw new Error('Puzzle seed must be a 32-bit unsigned integer');
  const rand = seededRandom(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const puzzle = config.mode === 'treasure' ? treasureCandidate(config, seed, version, rand) : candidate(config, seed, version, rand);
    if (puzzle) return puzzle;
  }
  throw new Error(`No verified puzzle found for ${puzzleId(config, seed, version)}`);
}
