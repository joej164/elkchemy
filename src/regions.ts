import type { Board, Item, Pos } from './board';
import type { LevelDefinition, SessionState } from './session';

/** Room levels: a marked tile and the exact item (family and tier) its gate needs on it. */
export interface Plate { readonly row: number; readonly col: number; readonly item: Item }

/** Opens with the Unlock button (or the region's gate) once `item`, its family at its tier or higher, is in region `in`. */
export interface ItemUnlock { readonly item: Item; readonly in: number }

/**
 * Room levels: opens by itself, as part of the move that leaves exactly each plate's item on its plate in region `in`.
 * `pressure` plates allow other items in that room; a `stone` (one plate) must hold the only item left in it. The rune
 * gate stands in `passage`, a terrain cell beside both rooms; a region reached through its `link` has none. Opening is
 * a checkpoint: the plate items stay fixed in place and Undo history is cleared.
 */
export interface PlateUnlock {
  readonly kind: 'pressure' | 'stone';
  readonly plates: readonly Plate[];
  readonly in: number;
  readonly passage?: Pos;
}

/**
 * Levels with tasks (see LevelDefinition.tasks): opens by itself on the move that completes the last of `tasks`, all
 * done for good. Its rune gate stands in `passage`, on a route of scenery cells (`passage` plus `path`, in any order)
 * that leads from room `from` to this region; a region reached through its `link` has neither.
 */
export interface TaskUnlock {
  readonly tasks: readonly number[];
  readonly from?: number;
  readonly passage?: Pos;
  readonly path?: readonly Pos[];
}

/**
 * Levels with tasks: marked tiles in region `in` that, on the move leaving exactly each plate's item on its plate
 * (other items may stay, as on pressure plates), are done for good. Doing one is a checkpoint: its plate items stay
 * fixed and Undo history is cleared. `symbol`: the emblem it lights on the gate it helps open, for a task that is one of
 * several a region needs.
 */
export interface Task {
  readonly in: number;
  readonly plates: readonly Plate[];
  readonly symbol?: GateSymbol;
}

export type GateSymbol = 'fern' | 'crystal' | 'note';

/**
 * A rectangular area of a region level's board (plus, in room levels, an optional `link` cell), without overlap. Item-goal levels split the board exactly; in room
 * levels (a treasure goal) the cells outside every region are empty terrain. Region 0 is open from the start. The
 * others open in list order from an earlier region `unlock.in`; opening consumes and moves nothing.
 * Items never leave their room: drops stay inside one room's open regions and merge groups stop at its border. Each
 * region is its own room unless it `joins` another.
 */
export interface Region {
  readonly name: string;
  readonly row: number;
  readonly col: number;
  readonly rows: number;
  readonly cols: number;
  readonly unlock?: ItemUnlock | PlateUnlock | TaskUnlock;
  /**
   * Room levels: this region is part of an earlier region's room, so once both are open, items move, swap and merge
   * between them as within one room. Opening it still follows its own `unlock`.
   */
  readonly joins?: number;
  /**
   * Room levels: until it opens, its cells (link included) are drawn as plain terrain: no tiles, items or outline. A
   * hidden building is drawn sealed instead: its outline and exterior stay, but its floor is blank, with no items or
   * marked tiles, and none of its cells is a cell (no labels, focus, taps or drops).
   */
  readonly hidden?: boolean;
  /**
   * Room levels, hidden joined regions: one cell outside the rectangle, beside it and the region it joins, that belongs
   * to this region (hidden, opened and owned with it) and connects the two as ordinary floor. It replaces a passage.
   */
  readonly link?: Pos;
  /** Room levels: drawn as a building, its exterior in the terrain around it (scenery only). */
  readonly building?: 'lodge' | 'palace';
}

export function inRegion(r: Region, p: Pos): boolean {
  if (r.link && r.link.row === p.row && r.link.col === p.col) return true;
  return p.row >= r.row && p.row < r.row + r.rows && p.col >= r.col && p.col < r.col + r.cols;
}

/** The index of the region holding `p`, or -1. */
export function regionAt(regions: readonly Region[], p: Pos): number {
  return regions.findIndex((r) => inRegion(r, p));
}

/** The room region `index` belongs to: the region it joins, or its own index (-1 stays -1). */
export function roomOf(regions: readonly Region[], index: number): number {
  return regions[index]?.joins ?? index;
}

/** Region `index` is open: the first region, or one already unlocked (with tasks: one whose tasks are all done). */
export function isOpen(state: SessionState, index: number): boolean {
  const { regions, tasks } = state.level;
  if (index < 0) return false;
  if (!tasks || index === 0) return index <= state.unlocked;
  return (regions![index].unlock as TaskUnlock).tasks.every((t) => state.done.includes(t));
}

/** Levels with tasks: the tasks still to do whose marked tiles are in an open region. */
export function availableTasks(state: SessionState): number[] {
  const { tasks } = state.level;
  return (tasks ?? []).flatMap((t, i) => (!state.done.includes(i) && isOpen(state, t.in) ? [i] : []));
}

/** Levels with tasks: the region that needs several tasks, each lighting its symbol on that region's gate (or -1). */
export function sealedRegion(regions: readonly Region[]): number {
  return regions.findIndex((r) => !!r.unlock && 'tasks' in r.unlock && r.unlock.tasks.length > 1);
}

/** Room levels: the scenery cells of the route to region `r` (its passage first, then its path), if any. */
export function routeOf(r: Region): Pos[] {
  const u = r.unlock;
  if (!u || 'item' in u || !u.passage) return [];
  return [u.passage, ...('path' in u && u.path ? u.path : [])];
}

/** Room levels: the room the route to region `r` leads from (-1 if none). */
export function routeFrom(r: Region): number {
  const u = r.unlock;
  return !u ? -1 : 'tasks' in u ? u.from ?? -1 : u.in;
}

/** Whether `item` (its family at its tier or higher) is inside region `r`. */
export function hasItemIn(board: Board, r: Region, item: Item): boolean {
  for (let row = r.row; row < r.row + r.rows; row++) {
    for (let col = r.col; col < r.col + r.cols; col++) {
      const c = board[row][col];
      if (c && c.family === item.family && c.tier >= item.tier) return true;
    }
  }
  return false;
}

/** The index of the next region to unlock, or null when every region is open (or the level has none). */
export function nextLocked(state: SessionState): number | null {
  const n = state.unlocked + 1;
  // Levels with tasks have no order: their regions open by tasks (see isOpen).
  return state.level.regions && !state.level.tasks && n < state.level.regions.length ? n : null;
}

/** Whether the next region's unlock item is present, so Unlock would open it (never for plates, which open by themselves). */
export function unlockReady(state: SessionState): boolean {
  const n = nextLocked(state);
  if (n === null) return false;
  const { regions } = state.level;
  const u = regions![n].unlock!;
  return 'item' in u && hasItemIn(state.board, regions![u.in], u.item);
}

/** Room levels: whether each plate holds exactly its item. */
export function platesHold(board: Board, plates: readonly Plate[]): boolean {
  return plates.every(({ row, col, item }) => {
    const c = board[row][col];
    return !!c && c.family === item.family && c.tier === item.tier;
  });
}

/** Room levels: whether region `index`'s plates hold exactly their items (and a stone's room nothing else). */
export function platesMet(board: Board, regions: readonly Region[], index: number): boolean {
  const u = regions[index].unlock;
  if (!u || !('plates' in u)) return false;
  const exact = platesHold(board, u.plates);
  if (!exact || u.kind === 'pressure') return exact;
  const r = regions[u.in];
  let items = 0;
  for (let row = r.row; row < r.row + r.rows; row++) {
    for (let col = r.col; col < r.col + r.cols; col++) if (board[row][col]) items++;
  }
  return items === u.plates.length;
}

/** Room levels: an opened gate's (or a done task's) plate items stay where they are; nothing moves, swaps or merges them. */
export function isFixed(state: SessionState, p: Pos): boolean {
  const { regions, tasks } = state.level;
  const at = (plates: readonly Plate[]) => plates.some((pl) => pl.row === p.row && pl.col === p.col);
  if (tasks) return tasks.some((t, i) => state.done.includes(i) && at(t.plates));
  return !!regions && regions.some((r, i) => i > 0 && i <= state.unlocked && !!r.unlock && 'plates' in r.unlock && at(r.unlock.plates));
}

/**
 * Throws for region configurations the rules and status checks do not support; does nothing for other levels.
 * Supported: two or more non-overlapping rectangular regions on a rectangular board, region 0 open, each later region
 * opened from an earlier one, and no supply. Either an item goal in the last region, with item unlocks and regions
 * covering the whole board; or (room levels) a treasure on an empty cell of the last region, with plate unlocks whose
 * plates lie in the room they open from and whose passage is a terrain cell beside both rooms, and empty terrain.
 * Only room levels may join or hide regions (never the first); a joined region names an earlier region that joins
 * nothing, and a stone's room has no joined part, since it counts only its own region's items. A hidden joined region
 * may have a `link` instead of a passage: a free cell beside it and the region it joins. (Only room-level code reads
 * links; the item-goal status checks still see rectangles.) A room level with `tasks` opens every later region by tasks
 * instead of plates (see validateTasks), and its treasure may wait for a task in its region.
 */
export function validateRegions(level: LevelDefinition): void {
  const { regions, board, goal } = level;
  if (!regions) {
    if (goal.kind === 'item' && goal.region !== undefined) throw new Error('Unsupported level: a goal region needs regions');
    if (goal.kind === 'treasure') throw new Error('Unsupported level: a treasure needs rooms');
    return;
  }
  const fail = (why: string): never => { throw new Error(`Unsupported region level: ${why}`); };
  const rooms = goal.kind === 'treasure';
  const { tasks } = level;
  if (tasks && !rooms) fail('only room levels have tasks');
  const width = board[0]?.length ?? 0;
  if (width === 0 || board.some((r) => r.length !== width)) fail('the board must be rectangular');
  if (regions.length < 2) fail('it needs at least two regions');
  const owner = board.map((r) => r.map(() => -1));
  regions.forEach((r, i) => {
    const whole = [r.row, r.col, r.rows, r.cols].every(Number.isInteger);
    if (!whole || r.rows < 1 || r.cols < 1 || r.row < 0 || r.col < 0 || r.row + r.rows > board.length || r.col + r.cols > width) {
      fail(`region ${i} must be a rectangle inside the board`);
    }
    for (let row = r.row; row < r.row + r.rows; row++) {
      for (let col = r.col; col < r.col + r.cols; col++) {
        if (owner[row][col] !== -1) fail('regions must not overlap');
        owner[row][col] = i;
      }
    }
    if (i === 0 && r.unlock) fail('the first region starts open');
    if (i > 0 && !r.unlock) fail(`region ${i} needs an unlock item`);
    if (r.unlock && ('tasks' in r.unlock) !== !!tasks) fail(tasks ? `region ${i} must open by tasks` : `region ${i} cannot open by tasks`);
    if (r.unlock && !('tasks' in r.unlock) && !(Number.isInteger(r.unlock.in) && r.unlock.in >= 0 && r.unlock.in < i)) {
      fail(`region ${i} must unlock from an earlier region`);
    }
    if (r.unlock && !('tasks' in r.unlock) && ('plates' in r.unlock) !== rooms) {
      fail(rooms ? `region ${i} must open by plates` : `region ${i} needs an unlock item`);
    }
    if ((r.joins !== undefined || r.hidden || r.link) && (!rooms || i === 0)) fail(`region ${i} cannot be joined or hidden`);
    if (r.building && !rooms) fail(`region ${i} cannot be a building`);
    if (r.joins !== undefined && !(Number.isInteger(r.joins) && r.joins >= 0 && r.joins < i && regions[r.joins].joins === undefined)) {
      fail(`region ${i} must join an earlier region that joins nothing`);
    }
  });
  if (!rooms && owner.some((r) => r.includes(-1))) fail('regions must cover the whole board');
  if (rooms) {
    const beside = (p: Pos, region: number) =>
      [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => owner[p.row + dr]?.[p.col + dc] === region);
    regions.forEach((r, i) => {
      if (!r.link) return;
      const { row, col } = r.link;
      if (r.joins === undefined || !r.hidden || owner[row]?.[col] !== -1 || !beside(r.link, i) || !beside(r.link, r.joins)) {
        fail(`region ${i}'s link must be a free cell beside it and the region it joins, on a hidden joined region`);
      }
      owner[row][col] = i;
    });
    if (board.some((r, row) => r.some((c, col) => c !== null && owner[row][col] === -1))) fail('terrain must be empty');
    if (tasks) validateTasks(level, owner, beside, fail);
    regions.forEach((r, i) => {
      const u = r.unlock;
      if (!u || !('plates' in u)) return;
      if (u.plates.length === 0 || (u.kind === 'stone' && u.plates.length !== 1)) fail(`region ${i} needs one stone or some plates`);
      if (u.plates.some((pl) => !inRegion(regions[u.in], pl))) fail(`region ${i}'s plates must be in region ${u.in}`);
      if (u.kind === 'stone' && regions.some((_, j) => j !== u.in && roomOf(regions, j) === roomOf(regions, u.in))) {
        fail(`region ${i}'s stone must be in a room without joined regions`);
      }
      if (!u.passage === !r.link) fail(`region ${i} needs a passage or a link, not both`);
      if (!u.passage) return;
      const { row, col } = u.passage;
      if (owner[row]?.[col] !== -1 || !beside(u.passage, u.in) || !beside(u.passage, i)) {
        fail(`region ${i}'s passage must be terrain beside both rooms`);
      }
    });
  }
  if (level.supply.length > 0) fail('supply is not supported');
  if (goal.kind === 'treasure') {
    const { row, col } = goal.at;
    if (regionAt(regions, goal.at) !== regions.length - 1 || board[row][col] !== null) {
      fail('the treasure must be on an empty cell of the last region');
    }
    if (goal.task !== undefined && tasks?.[goal.task]?.in !== regions.length - 1) fail('the treasure\'s task must be in its region');
  } else if (goal.kind !== 'item' || goal.region !== regions.length - 1) fail('the goal must be one item in the last region');
}

/**
 * Levels with tasks (called by validateRegions once regions and links are placed in `owner`): every later region opens
 * by tasks, each task's plates lie in one region, on cells no other task uses, and are not already met; a task's region
 * opens only by earlier tasks, so every task can be reached. Routes: a passage (and path) of free terrain cells, connected,
 * from an earlier room to the region; or a link. The one region needing several tasks names a symbol for each.
 */
function validateTasks(
  level: LevelDefinition, owner: number[][], beside: (p: Pos, region: number) => boolean, fail: (why: string) => never,
): void {
  const regions = level.regions!;
  const tasks = level.tasks!;
  regions.forEach((r, i) => {
    const u = r.unlock as TaskUnlock | undefined;
    if (u && (u.tasks.length === 0 || new Set(u.tasks).size !== u.tasks.length ||
      u.tasks.some((n) => !(Number.isInteger(n) && n >= 0 && n < tasks.length)))) fail(`region ${i} needs distinct tasks`);
  });
  const plates = new Set<string>();
  tasks.forEach((t, i) => {
    if (!(Number.isInteger(t.in) && t.in >= 0 && t.in < regions.length) || t.plates.length === 0) fail(`task ${i} needs plates in a region`);
    for (const pl of t.plates) {
      const key = `${pl.row},${pl.col}`;
      if (!inRegion(regions[t.in], pl) || plates.has(key)) fail(`task ${i}'s plates must be in region ${t.in}, on cells of their own`);
      plates.add(key);
    }
    const u = regions[t.in].unlock as TaskUnlock | undefined;
    if (u && u.tasks.some((n) => n >= i)) fail(`task ${i}'s region must open by earlier tasks`);
    if (platesHold(level.board, t.plates)) fail(`task ${i} must not be done at the start`);
  });
  const routes = new Set<string>();
  regions.forEach((r, i) => {
    const u = r.unlock as TaskUnlock | undefined;
    if (!u) return;
    if (u.tasks.length > 1 && (sealedRegion(regions) !== i || u.tasks.some((n) => !tasks[n].symbol) ||
      new Set(u.tasks.map((n) => tasks[n].symbol)).size !== u.tasks.length)) {
      fail(`region ${i} is the one region needing several tasks, each with its own symbol`);
    }
    if (!u.passage === !r.link || (u.path && !u.passage)) fail(`region ${i} needs a passage or a link, not both`);
    if (!u.passage) return;
    const route = routeOf(r);
    const from = u.from ?? -1;
    if (!(Number.isInteger(from) && from >= 0 && from < regions.length && from !== i)) fail(`region ${i}'s route needs a room to lead from`);
    const key = (p: Pos) => `${p.row},${p.col}`;
    for (const p of route) {
      if (owner[p.row]?.[p.col] !== -1 || routes.has(key(p))) fail(`region ${i}'s route must be free terrain`);
      routes.add(key(p));
    }
    const reached = new Set([key(route[0])]);
    for (let grew = true; grew;) {
      grew = false;
      for (const p of route) {
        if (reached.has(key(p))) continue;
        if (route.some((q) => reached.has(key(q)) && Math.abs(q.row - p.row) + Math.abs(q.col - p.col) === 1)) {
          reached.add(key(p));
          grew = true;
        }
      }
    }
    if (reached.size !== route.length || !route.some((p) => beside(p, from)) || !route.some((p) => beside(p, i))) {
      fail(`region ${i}'s route must join room ${from} to it`);
    }
  });
}
