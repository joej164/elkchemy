import { drop, previewMerge, type Board, type Item, type Pos } from './board';
import { isOpen, nextLocked, regionAt, unlockReady, validateRegions, type Region } from './regions';

/**
 * `item`: make `item` (its family at its tier or higher) anywhere on the board; with `region` (region levels),
 *   inside that region once it is open.
 * `items`: have every target in `items` (each its family at its tier or higher) on the board at
 *   once. A target counts as complete while such an item is present; targets need distinct families.
 * `leaveOne`: place all supply and finish with exactly one item on the board; with `item`, that
 *   last item must be exactly `item` (its family at exactly its tier).
 */
export type LevelGoal =
  | { readonly kind: 'item'; readonly item: Item; readonly region?: number }
  | { readonly kind: 'items'; readonly items: readonly Item[] }
  | { readonly kind: 'leaveOne'; readonly item?: Item };

export interface LevelDefinition {
  readonly seed: number;
  readonly board: Board;
  readonly supply: readonly Item[];
  readonly goal: LevelGoal;
  /**
   * Default true: report 'lost' as soon as resource counts make the goal unreachable (handcrafted levels).
   * false: report 'lost' only once no merge can be arranged at all (generated puzzles).
   */
  readonly earlyLoss?: boolean;
  /**
   * Region levels (see regions.ts): rectangular areas unlocked in order; items never leave their region.
   * Their status always uses the region rule in status.ts, whatever `earlyLoss` says.
   */
  readonly regions?: readonly Region[];
}

export interface SessionSnapshot {
  readonly board: Board;
  readonly supplyIndex: number;
  readonly rngState: number;
  readonly moves: number;
  /** Regions unlocked so far: regions 0..unlocked are open (always 0 for levels without regions). */
  readonly unlocked: number;
}

export interface SessionState extends SessionSnapshot {
  readonly level: LevelDefinition;
  readonly undo: SessionSnapshot | null;
}

function inBounds(board: Board, p: Pos): boolean {
  return (
    Number.isInteger(p.row) && Number.isInteger(p.col) &&
    p.row >= 0 && p.row < board.length && p.col >= 0 && p.col < board[p.row].length
  );
}

function snapshot(s: SessionState): SessionSnapshot {
  return { board: s.board, supplyIndex: s.supplyIndex, rngState: s.rngState, moves: s.moves, unlocked: s.unlocked };
}

/** Throws for unsupported region levels (see validateRegions). */
export function startSession(level: LevelDefinition): SessionState {
  validateRegions(level);
  return { level, board: level.board, supplyIndex: 0, rngState: level.seed, moves: 0, unlocked: 0, undo: null };
}

/** Whether a drop from `from` to `to` is allowed at all: an item to a cell, and in region levels, inside one open region. */
export function canDrop(state: SessionState, from: Pos, to: Pos): boolean {
  const { board, level } = state;
  if (!inBounds(board, from) || !inBounds(board, to) || board[from.row][from.col] === null) return false;
  if (!level.regions) return true;
  const r = regionAt(level.regions, from);
  return r === regionAt(level.regions, to) && isOpen(state, r);
}

/** Whether the cell can be played: always, except inside a locked region. */
export function isCellOpen(state: SessionState, p: Pos): boolean {
  return !state.level.regions || isOpen(state, regionAt(state.level.regions, p));
}

/** Region levels: merge groups only grow inside the source's region. */
function connects(state: SessionState, from: Pos): ((p: Pos) => boolean) | undefined {
  const { regions } = state.level;
  if (!regions) return undefined;
  const r = regionAt(regions, from);
  return (p) => regionAt(regions, p) === r;
}

/** The cells an allowed drop would merge (see previewMerge), or [] if it would not merge or is not allowed. */
export function previewDrop(state: SessionState, from: Pos, to: Pos): Pos[] {
  if (!canDrop(state, from, to) || (from.row === to.row && from.col === to.col)) return [];
  return previewMerge(state.board, from, to, connects(state, from));
}

/**
 * Applies a drop as one move. A drop that leaves the board unchanged (onto an identical item that
 * cannot merge, which drop() reports as a swap) is not a move: it must not replace the single undo step.
 */
export function applyDrop(state: SessionState, from: Pos, to: Pos): SessionState {
  const { board } = state;
  if (!canDrop(state, from, to)) return state;
  const src = board[from.row][from.col]!;
  if (from.row === to.row && from.col === to.col) return state;
  const result = drop(board, from, to, connects(state, from));
  if (result.kind === 'none') return state;
  const tgt = board[to.row][to.col];
  if (result.kind === 'swap' && tgt && tgt.family === src.family && tgt.tier === src.tier) return state;
  return { ...state, board: result.board, moves: state.moves + 1, undo: snapshot(state) };
}

/**
 * Region levels: opens the next region once its unlock item is present. One undoable move; the item stays put.
 * `region` (a gate's own region): refused unless it is that next region, so a later gate never opens another.
 */
export function unlock(state: SessionState, region?: number): SessionState {
  if (region !== undefined && region !== nextLocked(state)) return state;
  if (!unlockReady(state)) return state;
  return { ...state, unlocked: state.unlocked + 1, moves: state.moves + 1, undo: snapshot(state) };
}

export function placeSupply(state: SessionState, at: Pos): SessionState {
  const { board, level, supplyIndex } = state;
  if (supplyIndex >= level.supply.length) return state;
  if (!inBounds(board, at) || board[at.row][at.col] !== null) return state;
  const rows = board.map((r, i) => (i === at.row ? r.map((c, j) => (j === at.col ? level.supply[supplyIndex] : c)) : r));
  return { ...state, board: rows, supplyIndex: supplyIndex + 1, moves: state.moves + 1, undo: snapshot(state) };
}

/** One step of the seeded generator shared by supply placement and puzzle generation. */
export function nextUint32(state: number): { value: number; state: number } {
  const s = ((state >>> 0) + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: s };
}

/** Pure: the cell a random supply placement would use and the advanced rng state, or null if supply is exhausted or no cell is empty. Never changes `state`. */
export function chooseSupplyCell(state: SessionState): { at: Pos; rngState: number } | null {
  const { board, level, supplyIndex } = state;
  if (supplyIndex >= level.supply.length) return null;
  const empties: Pos[] = [];
  board.forEach((r, row) => r.forEach((c, col) => { if (c === null) empties.push({ row, col }); }));
  const n = empties.length;
  if (n === 0) return null;
  const limit = 2 ** 32 - (2 ** 32 % n);
  let rng = state.rngState >>> 0;
  let draw = nextUint32(rng);
  rng = draw.state;
  while (draw.value >= limit) {
    draw = nextUint32(rng);
    rng = draw.state;
  }
  return { at: empties[draw.value % n], rngState: rng };
}

/** Places the next supply item in a uniformly random empty cell. No-op (same reference) when chooseSupplyCell is null. */
export function placeSupplyRandom(state: SessionState): SessionState {
  const pick = chooseSupplyCell(state);
  if (!pick) return state;
  return { ...placeSupply(state, pick.at), rngState: pick.rngState };
}

export function undo(state: SessionState): SessionState {
  if (state.undo === null) return state;
  const { board, supplyIndex, rngState, moves, unlocked } = state.undo;
  return { level: state.level, board, supplyIndex, rngState, moves, unlocked, undo: null };
}

export function retry(state: SessionState): SessionState {
  return startSession(state.level);
}
