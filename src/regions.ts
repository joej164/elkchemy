import type { Board, Item, Pos } from './board';
import type { LevelDefinition, SessionState } from './session';

/**
 * A rectangular area of a region level's board; the regions cover the board exactly, without overlap.
 * Region 0 is open from the start. The others unlock in list order, each once `unlock.item` (its family at
 * its tier or higher) is in region `unlock.in`, an earlier region. Unlocking consumes and moves nothing.
 * Items never leave their region: drops stay inside one open region and merge groups stop at its border.
 */
export interface Region {
  readonly name: string;
  readonly row: number;
  readonly col: number;
  readonly rows: number;
  readonly cols: number;
  readonly unlock?: { readonly item: Item; readonly in: number };
}

export function inRegion(r: Region, p: Pos): boolean {
  return p.row >= r.row && p.row < r.row + r.rows && p.col >= r.col && p.col < r.col + r.cols;
}

/** The index of the region holding `p`, or -1. */
export function regionAt(regions: readonly Region[], p: Pos): number {
  return regions.findIndex((r) => inRegion(r, p));
}

/** Region `index` is open: the first region, or one already unlocked. */
export function isOpen(state: SessionState, index: number): boolean {
  return index >= 0 && index <= state.unlocked;
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
  return state.level.regions && n < state.level.regions.length ? n : null;
}

/** Whether the next region's unlock item is present, so Unlock would open it. */
export function unlockReady(state: SessionState): boolean {
  const n = nextLocked(state);
  if (n === null) return false;
  const { regions } = state.level;
  const { item, in: from } = regions![n].unlock!;
  return hasItemIn(state.board, regions![from], item);
}

/**
 * Throws for region configurations the rules and status checks do not support; does nothing for other levels.
 * Supported: a rectangular board split exactly into two or more rectangular regions, region 0 open, each later
 * region unlocked from an earlier one, no supply, and an item goal inside the last region.
 */
export function validateRegions(level: LevelDefinition): void {
  const { regions, board, goal } = level;
  if (!regions) {
    if (goal.kind === 'item' && goal.region !== undefined) throw new Error('Unsupported level: a goal region needs regions');
    return;
  }
  const fail = (why: string): never => { throw new Error(`Unsupported region level: ${why}`); };
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
    if (r.unlock && !(Number.isInteger(r.unlock.in) && r.unlock.in >= 0 && r.unlock.in < i)) {
      fail(`region ${i} must unlock from an earlier region`);
    }
  });
  if (owner.some((r) => r.includes(-1))) fail('regions must cover the whole board');
  if (level.supply.length > 0) fail('supply is not supported');
  if (goal.kind !== 'item' || goal.region !== regions.length - 1) fail('the goal must be one item in the last region');
}
