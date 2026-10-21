import { drop, previewMerge, type Board, type Cell, type Item, type Pos } from './board';
import { isIngredientPair, type Recipe } from './recipes';
import {
  availableTasks, isFixed, isOpen, nextLocked, platesHold, platesMet, regionAt, roomOf, unlockReady, validateRegions, type Region, type Task,
} from './regions';

/**
 * `item`: make `item` (its family at its tier or higher) anywhere on the board; with `region` (region levels),
 *   inside that region once it is open. With `open` (container levels: the attic's Big Memory Book), making it is not
 *   yet the win: it must then be opened by a tap (see openGoal).
 * `items`: have every target in `items` (each its family at its tier or higher) on the board at
 *   once. A target counts as complete while such an item is present; targets need distinct families.
 * `leaveOne`: place all supply and finish with exactly one item on the board; with `item`, that
 *   last item must be exactly `item` (its family at exactly its tier).
 * `treasure` (room levels): collect the treasure at `at`, hidden in the last room until it opens, by tapping it.
 *   `prize` is what it is: a disc-golf backpack (the default), a clarinet case or a ukulele case. With `task` (levels
 *   with tasks), it stays hidden until that task, in its room, is done. Its cell never holds an item.
 */
export type LevelGoal =
  | { readonly kind: 'item'; readonly item: Item; readonly region?: number; readonly open?: boolean }
  | { readonly kind: 'items'; readonly items: readonly Item[] }
  | { readonly kind: 'leaveOne'; readonly item?: Item }
  | { readonly kind: 'treasure'; readonly at: Pos; readonly prize?: Prize; readonly task?: number };

export type Prize = 'backpack' | 'clarinet' | 'ukulele';

/**
 * A placed container (the attic story prototype): it stands on its own cell, which holds no item, and holds a fixed
 * batch of one or more items, shown before opening. With `hiddenUntil`, it stays covered (a dust sheet) until that item
 * (its family at its tier or higher) is on the board. Tapping an uncovered one opens it (see openContainer). `art` is
 * how it is drawn: stored belongings (a shoebox) or the special keepsake box.
 */
export interface Container {
  readonly at: Pos;
  readonly name: string;
  readonly art: 'shoebox' | 'keepsake-box';
  readonly contents: readonly Item[];
  readonly hiddenUntil?: Item;
}

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
   * Region levels (see regions.ts): rectangular areas unlocked in order; items never leave their room.
   * Their status always uses the region rule in status.ts, whatever `earlyLoss` says.
   */
  readonly regions?: readonly Region[];
  /**
   * Room levels: marked tiles that, once done, open regions (each later region then opens when all of its tasks are
   * done, in any order) or reveal the treasure. Done tasks stay done; see Task in regions.ts.
   */
  readonly tasks?: readonly Task[];
  /**
   * Merge to treasure (generated puzzles): the board's one recipe. Its ingredients craft its chest when one is dropped
   * onto the other (see craftAt); the chest opens to its contents (see openChest); everything then merges into the
   * goal (`leaveOne` with that item: it alone left, and no closed chest).
   */
  readonly recipe?: Recipe;
  /**
   * Container levels (the attic): placed containers, each opened once by a tap (a checkpoint). They need no supply,
   * regions or recipe; status never reports a loss (see evaluateStatus), so such a level must be built so it can't be
   * stranded (tests/attic.test.ts checks the attic).
   */
  readonly containers?: readonly Container[];
}

export interface SessionSnapshot {
  readonly board: Board;
  readonly supplyIndex: number;
  readonly rngState: number;
  readonly moves: number;
  /** Regions unlocked so far: regions 0..unlocked are open (always 0 for levels without regions). */
  readonly unlocked: number;
  /**
   * Room levels: the treasure has been collected. Levels with an `open` item goal: the goal item has been opened
   * (see openGoal). Always false otherwise.
   */
  readonly collected: boolean;
  /** Levels with tasks: the tasks done so far, in the order done (always empty otherwise). */
  readonly done: readonly number[];
  /** Recipe levels: where the crafted, still closed chest stands (its cell holds no item), or null. */
  readonly chest: Pos | null;
  /** Recipe levels: the chest has been opened (it is gone, its contents on the board). */
  readonly opened: boolean;
  /** Container levels: the containers opened so far, in the order opened (always empty otherwise). */
  readonly unpacked: readonly number[];
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
  return {
    board: s.board, supplyIndex: s.supplyIndex, rngState: s.rngState, moves: s.moves, unlocked: s.unlocked, collected: s.collected,
    done: s.done, chest: s.chest, opened: s.opened, unpacked: s.unpacked,
  };
}

/** Container levels: each container on its own empty cell, holding at least one item, with nothing else unsupported. */
function validateContainers(level: LevelDefinition): void {
  const { containers, board } = level;
  if (!containers) return;
  const cells = new Set<string>();
  for (const c of containers) {
    const key = `${c.at.row},${c.at.col}`;
    if (!inBounds(board, c.at) || board[c.at.row][c.at.col] !== null || cells.has(key) || c.contents.length === 0) {
      throw new Error('Unsupported container level');
    }
    cells.add(key);
  }
  if (level.supply.length > 0 || level.regions || level.recipe) throw new Error('Unsupported container level');
}

/** Throws for unsupported region levels (see validateRegions) and container levels (see validateContainers). */
export function startSession(level: LevelDefinition): SessionState {
  validateRegions(level);
  validateContainers(level);
  return {
    level, board: level.board, supplyIndex: 0, rngState: level.seed, moves: 0, unlocked: 0, collected: false, done: [],
    chest: null, opened: false, unpacked: [], undo: null,
  };
}

/**
 * Whether a drop from `from` to `to` is allowed at all: an item to a cell, and in region levels, between open regions
 * of one room (usually one region; see Region.joins) and touching no fixed item or the treasure's cell (room levels).
 */
export function canDrop(state: SessionState, from: Pos, to: Pos): boolean {
  const { board, level } = state;
  if (!inBounds(board, from) || !inBounds(board, to) || board[from.row][from.col] === null) return false;
  if (state.chest && state.chest.row === to.row && state.chest.col === to.col) return false;
  if (closedContainerAt(state, to) !== -1) return false;
  const { regions, goal } = level;
  if (!regions) return true;
  if (goal.kind === 'treasure' && goal.at.row === to.row && goal.at.col === to.col) return false;
  const a = regionAt(regions, from);
  const b = regionAt(regions, to);
  return isOpen(state, a) && isOpen(state, b) && roomOf(regions, a) === roomOf(regions, b) &&
    !isFixed(state, from) && !isFixed(state, to);
}

/** Whether the cell can be played: always, except inside a locked region. */
export function isCellOpen(state: SessionState, p: Pos): boolean {
  return !state.level.regions || isOpen(state, regionAt(state.level.regions, p));
}

/**
 * Region levels: merge groups only grow through the open regions of the source's room, and never take a fixed item
 * (room levels).
 */
function connects(state: SessionState, from: Pos): ((p: Pos) => boolean) | undefined {
  const { regions } = state.level;
  if (!regions) return undefined;
  const room = roomOf(regions, regionAt(regions, from));
  return (p) => {
    const i = regionAt(regions, p);
    return isOpen(state, i) && roomOf(regions, i) === room && !isFixed(state, p);
  };
}

/** The cells an allowed drop would merge (see previewMerge), or [] if it would not merge or is not allowed. */
export function previewDrop(state: SessionState, from: Pos, to: Pos): Pos[] {
  if (!canDrop(state, from, to) || (from.row === to.row && from.col === to.col)) return [];
  return previewMerge(state.board, from, to, connects(state, from));
}

/**
 * Applies a drop as one move. A drop that leaves the board unchanged (onto an identical item that
 * cannot merge, which drop() reports as a swap) is not a move: it must not replace the single undo step.
 * Room levels: a move that fills the next room's plates exactly opens its gate as part of the move. Opening is a
 * checkpoint: the Undo step is cleared, so only Retry closes the gate again. With tasks, a move that fills every plate
 * of a task in an open region does it (any number at once), as one checkpoint; the regions waiting on it open with it.
 */
export function applyDrop(state: SessionState, from: Pos, to: Pos): SessionState {
  const { board } = state;
  if (!canDrop(state, from, to)) return state;
  const src = board[from.row][from.col]!;
  if (from.row === to.row && from.col === to.col) return state;
  const crafted = craftAt(state, from, to);
  if (crafted) return crafted;
  const result = drop(board, from, to, connects(state, from));
  if (result.kind === 'none') return state;
  const tgt = board[to.row][to.col];
  if (result.kind === 'swap' && tgt && tgt.family === src.family && tgt.tier === src.tier) return state;
  const next = { ...state, board: result.board, moves: state.moves + 1, undo: snapshot(state) };
  if (state.level.tasks) {
    const tasks = state.level.tasks;
    const met = availableTasks(state).filter((i) => platesHold(result.board, tasks[i].plates));
    return met.length > 0 ? { ...next, done: [...state.done, ...met], undo: null } : next;
  }
  const n = nextLocked(state);
  return n !== null && platesMet(result.board, state.level.regions!, n) ? { ...next, unlocked: n, undo: null } : next;
}

/** Room levels: whether the treasure is there to collect: its room is open (and its task, if any, done). */
export function treasureRevealed(state: SessionState): boolean {
  const { goal, regions } = state.level;
  if (goal.kind !== 'treasure') return false;
  return isOpen(state, regionAt(regions!, goal.at)) && (goal.task === undefined || state.done.includes(goal.task));
}

/** Room levels: collects the treasure once it is revealed. One undoable move. */
export function collect(state: SessionState): SessionState {
  if (state.level.goal.kind !== 'treasure' || state.collected || !treasureRevealed(state)) return state;
  return { ...state, collected: true, moves: state.moves + 1, undo: snapshot(state) };
}

/** Levels with an `open` item goal: whether the item at `p` is the made goal item, not yet opened. */
export function goalOpenableAt(state: SessionState, p: Pos): boolean {
  const { goal } = state.level;
  const c = state.board[p.row]?.[p.col];
  return goal.kind === 'item' && !!goal.open && !state.collected && !!c && c.family === goal.item.family && c.tier >= goal.item.tier;
}

/**
 * Levels with an `open` item goal: opens the made goal item at `p`, once (it stays on the board). This wins, and is a
 * checkpoint: Undo is cleared.
 */
export function openGoal(state: SessionState, p: Pos): SessionState {
  if (!goalOpenableAt(state, p)) return state;
  return { ...state, collected: true, moves: state.moves + 1, undo: null };
}

/** Recipe levels: the one chest has not been crafted yet. */
const canStillCraft = (state: SessionState) => !!state.level.recipe && !state.chest && !state.opened;

/** Recipe levels: whether crafting is possible now: no chest yet, and both ingredients (exact family and tier) here. */
export function craftReady(state: SessionState): boolean {
  if (!canStillCraft(state)) return false;
  const items = state.board.flat();
  return state.level.recipe!.ingredients.every(({ item, count }) =>
    items.filter((c) => c && c.family === item.family && c.tier === item.tier).length >= count);
}

/**
 * Recipe levels: the drop of one ingredient onto the other (either way round) crafts the chest: those two items are
 * consumed, every other piece stays, and the chest stands at the destination. One undoable move. Null for any other
 * drop, which keeps its ordinary meaning (a swap, for two different items).
 */
export function craftAt(state: SessionState, from: Pos, to: Pos): SessionState | null {
  if (!canStillCraft(state)) return null;
  const a = state.board[from.row]?.[from.col];
  const b = state.board[to.row]?.[to.col];
  if (!a || !b || !isIngredientPair(state.level.recipe!, a, b)) return null;
  const board: Cell[][] = state.board.map((r) => [...r]);
  board[from.row][from.col] = null;
  board[to.row][to.col] = null;
  return { ...state, board, chest: { row: to.row, col: to.col }, moves: state.moves + 1, undo: snapshot(state) };
}

/**
 * Recipe levels: the cells a closed chest's contents go to: its own cell, then the nearest empty cells (by distance,
 * then reading order). Null if there are too few empty cells: the chest then stays closed.
 */
export function contentCells(state: SessionState): Pos[] | null {
  const { chest, level } = state;
  if (!chest || !level.recipe) return null;
  return releaseFrom(state.board, chest, level.recipe.contents.count, []);
}

/**
 * Where `count` items released from the container at `at` go: `at` itself, then the nearest empty cells (by distance,
 * then reading order), never a `reserved` cell. Null if there are too few.
 */
function releaseFrom(board: Board, at: Pos, count: number, reserved: readonly Pos[]): Pos[] | null {
  const empty: Pos[] = [];
  board.forEach((r, row) => r.forEach((c, col) => {
    const p = { row, col };
    if (c === null && !(row === at.row && col === at.col) && !reserved.some((q) => q.row === row && q.col === col)) empty.push(p);
  }));
  const d = (p: Pos) => Math.abs(p.row - at.row) + Math.abs(p.col - at.col);
  empty.sort((a, b) => d(a) - d(b) || a.row - b.row || a.col - b.col);
  return empty.length >= count - 1 ? [at, ...empty.slice(0, count - 1)] : null;
}

/** Container levels: the index of the closed container (covered or not) standing at `p`, or -1. */
export function closedContainerAt(state: SessionState, p: Pos): number {
  const { containers } = state.level;
  if (!containers) return -1;
  return containers.findIndex((c, i) => c.at.row === p.row && c.at.col === p.col && !state.unpacked.includes(i));
}

/** Container levels: whether container `i` is uncovered: it has no `hiddenUntil`, or that item is on the board. */
export function containerShown(state: SessionState, i: number): boolean {
  const need = state.level.containers?.[i]?.hiddenUntil;
  if (!need) return true;
  return state.board.some((r) => r.some((c) => !!c && c.family === need.family && c.tier >= need.tier));
}

/**
 * Container levels: the cells container `i`'s contents go to, in order (see releaseFrom; other closed containers' cells
 * are never used), or null if there is too little room: it then stays closed. Null too unless it is closed and shown.
 */
export function releaseCells(state: SessionState, i: number): Pos[] | null {
  const containers = state.level.containers;
  const c = containers?.[i];
  if (!c || state.unpacked.includes(i) || !containerShown(state, i)) return null;
  const reserved = containers!.flatMap((o, j) => (j !== i && !state.unpacked.includes(j) ? [o.at] : []));
  return releaseFrom(state.board, c.at, c.contents.length, reserved);
}

/**
 * Container levels: opens container `i`, once, releasing its whole batch (see releaseCells) and removing it; without
 * room nothing changes. A checkpoint: Undo is cleared.
 */
export function openContainer(state: SessionState, i: number): SessionState {
  const cells = releaseCells(state, i);
  if (!cells) return state;
  const { contents } = state.level.containers![i];
  const board: Cell[][] = state.board.map((r) => [...r]);
  cells.forEach((p, k) => { board[p.row][p.col] = { ...contents[k] }; });
  return { ...state, board, unpacked: [...state.unpacked, i], moves: state.moves + 1, undo: null };
}

/** Recipe levels: opens the chest, once, putting its contents in place (see contentCells). A checkpoint: Undo is cleared. */
export function openChest(state: SessionState): SessionState {
  const cells = contentCells(state);
  if (!cells) return state;
  const { item } = state.level.recipe!.contents;
  const board: Cell[][] = state.board.map((r) => [...r]);
  for (const p of cells) board[p.row][p.col] = { ...item };
  return { ...state, board, chest: null, opened: true, moves: state.moves + 1, undo: null };
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
  const { board, supplyIndex, rngState, moves, unlocked, collected, done, chest, opened, unpacked } = state.undo;
  return { level: state.level, board, supplyIndex, rngState, moves, unlocked, collected, done, chest, opened, unpacked, undo: null };
}

export function retry(state: SessionState): SessionState {
  return startSession(state.level);
}
