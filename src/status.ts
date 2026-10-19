import { MAX_TIER, type Board, type Family, type Item } from './board';
import type { SessionState } from './session';

// Supported assumption: the board is rectangular and
//   (non-null board cells) + (unspent supply items) <= rows * cols.
// Under this bound every unspent supply item can always be placed, and because
// swaps can exchange any two differing items anywhere on the board, items can be
// rearranged freely even on a full board. Resource counts alone therefore decide
// feasibility exactly. Space-constrained levels that violate the bound are
// unsupported (an Error is thrown); no spatial search is attempted.
//
// Leave one needs two more free cells: (board items) + (unspent supply) <= rows * cols - 2.
// Then at least two cells never hold a given family and tier, so any wanted 3-merge can be
// isolated from other matching items (a 5-merge is never forced). Merges, moves and swaps
// never raise that total, so a level that starts within the bound stays within it.

export type GameStatus = 'playing' | 'won' | 'lost';

export function maxPromotions(count: number): number {
  let best = 0;
  for (let a = 0; a * 5 <= count; a++) {
    best = Math.max(best, 2 * a + Math.floor((count - 5 * a) / 3));
  }
  return best;
}

function checkCapacity(board: Board, unspent: number, headroom: number): void {
  const width = board[0]?.length ?? 0;
  if (board.some((r) => r.length !== width)) {
    throw new Error('Unsupported level: board must be rectangular');
  }
  const occupied = board.reduce((n, r) => n + r.filter((c) => c !== null).length, 0);
  if (occupied + unspent > board.length * width - headroom) {
    throw new Error('Unsupported level: board items plus unspent supply exceed board capacity');
  }
}

/** Whether `goal` (its family at its tier or higher) is on the board. */
export function hasItem(board: Board, goal: Item): boolean {
  return board.some((row) => row.some((c) => !!c && c.family === goal.family && c.tier >= goal.tier));
}

/** Whether `goal` can still be made from its family's board items and unspent supply (counts only). */
function canMake(state: SessionState, goal: Item): boolean {
  const { board, level, supplyIndex } = state;
  const unspent = level.supply.slice(supplyIndex);
  const counts: number[] = Array.from({ length: goal.tier }, () => 0);
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.family === goal.family && cell.tier < goal.tier) counts[cell.tier]++;
    }
  }
  let suppliedGoal = 0;
  for (const item of unspent) {
    if (item.family !== goal.family) continue;
    if (item.tier >= goal.tier) suppliedGoal++;
    else counts[item.tier]++;
  }

  let carry = 0;
  for (let t = 0; t < goal.tier; t++) carry = maxPromotions(counts[t] + carry);
  return carry + suppliedGoal >= 1;
}

function evaluateItemGoal(state: SessionState, goal: Item): GameStatus {
  if (hasItem(state.board, goal)) return 'won';
  checkCapacity(state.board, state.level.supply.length - state.supplyIndex, 0);
  return canMake(state, goal) ? 'playing' : 'lost';
}

// Each target is judged with the single-item calculation on its own family's items, which is
// exact only if no two targets share a family (they would otherwise count the same items twice).
function evaluateItemsGoal(state: SessionState, targets: readonly Item[]): GameStatus {
  if (new Set(targets.map((t) => t.family)).size !== targets.length) {
    throw new Error('Unsupported level: item targets must have distinct families');
  }
  const unmet = targets.filter((t) => !hasItem(state.board, t));
  if (unmet.length === 0) return 'won';
  checkCapacity(state.board, state.level.supply.length - state.supplyIndex, 0);
  return unmet.every((t) => canMake(state, t)) ? 'playing' : 'lost';
}

/**
 * Whether one family's items (counts per tier) can be merged down to exactly one item.
 * Every merge keeps at least one item of its family, so other families must be absent.
 * Items above the final item's tier could never be removed, so working upward, each tier
 * below the final one must be used up exactly by 3- and 5-merges (n = 3a + 5b, giving
 * a + 2b items one tier up), and the final tier must hold exactly one item with nothing above.
 * With `finalTier`, that last item must also be at exactly that tier.
 */
export function canLeaveOne(counts: readonly number[], finalTier?: number): boolean {
  let carries = new Set([0]);
  for (let t = 0; t <= MAX_TIER; t++) {
    const next = new Set<number>();
    for (const carry of carries) {
      const n = (counts[t] ?? 0) + carry;
      if (n === 1 && counts.slice(t + 1).every((c) => c === 0) && (finalTier === undefined || t === finalTier)) {
        return true;
      }
      if (t === MAX_TIER) continue;
      for (let b = 0; 5 * b <= n; b++) {
        if ((n - 5 * b) % 3 === 0) next.add((n - 5 * b) / 3 + 2 * b);
      }
    }
    carries = next;
  }
  return false;
}

function evaluateLeaveOne(state: SessionState, target: Item | undefined): GameStatus {
  const { board, level, supplyIndex } = state;
  if (isGoalMet(state)) return 'won';
  const items = board.flat().filter((c): c is Item => c !== null);
  const unspent = level.supply.slice(supplyIndex);

  checkCapacity(board, unspent.length, 2);

  const all = [...items, ...unspent];
  const families = new Set<Family>(all.map((i) => i.family));
  if (families.size !== 1 || (target && !families.has(target.family))) return 'lost';
  const counts = Array.from({ length: MAX_TIER + 1 }, () => 0);
  for (const i of all) counts[i.tier]++;
  return canLeaveOne(counts, target?.tier) ? 'playing' : 'lost';
}

/**
 * Whether any merge can still be made: some family has three or more items at one tier below the
 * maximum, on the board or in unspent supply. Matching items need not be adjacent, since free moves
 * and swaps can always gather three of them into a group (any board with two neighbouring cells).
 */
export function canArrangeMerge(state: SessionState): boolean {
  const { board, level, supplyIndex } = state;
  const counts = new Map<string, number>();
  for (const item of [...board.flat(), ...level.supply.slice(supplyIndex)]) {
    if (!item || item.tier >= MAX_TIER) continue;
    const key = `${item.family}${item.tier}`;
    const n = (counts.get(key) ?? 0) + 1;
    if (n >= 3) return true;
    counts.set(key, n);
  }
  return false;
}

/** Whether the level's goal is satisfied now. */
export function isGoalMet(state: SessionState): boolean {
  const { board, level, supplyIndex } = state;
  const { goal } = level;
  if (goal.kind === 'item') return hasItem(board, goal.item);
  if (goal.kind === 'items') return goal.items.every((t) => hasItem(board, t));
  const items = board.flat().filter((c): c is Item => c !== null);
  if (supplyIndex < level.supply.length || items.length !== 1) return false;
  return !goal.item || (items[0].family === goal.item.family && items[0].tier === goal.item.tier);
}

export function evaluateStatus(state: SessionState): GameStatus {
  const { goal } = state.level;
  // Generated puzzles: no early loss from counting, even after a fatal choice; 'lost' only once no merges are left.
  if (state.level.earlyLoss === false) {
    if (isGoalMet(state)) return 'won';
    return canArrangeMerge(state) ? 'playing' : 'lost';
  }
  if (goal.kind === 'item') return evaluateItemGoal(state, goal.item);
  if (goal.kind === 'items') return evaluateItemsGoal(state, goal.items);
  return evaluateLeaveOne(state, goal.item);
}
