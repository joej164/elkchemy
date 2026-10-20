import type { Item, Pos, Tier } from '../board';
import { inRegion, isFixed, isOpen, nextLocked, regionAt, roomOf, unlockReady } from '../regions';
import {
  applyDrop, canDrop, chooseSupplyCell, collect, isCellOpen, openChest, placeSupplyRandom, previewDrop, retry, startSession,
  treasureRevealed, undo, unlock,
  type LevelDefinition, type SessionState,
} from '../session';
import { evaluateStatus, type GameStatus } from '../status';

/**
 * Levels with tasks: what a drop's checkpoint did: the tasks it completed and the regions that opened with them.
 */
export interface Progress { readonly tasks: readonly number[]; readonly regions: readonly number[] }

/**
 * `opened` (room levels): the region whose gate the drop opened, brought into view. With tasks, `progress` says what
 * the drop did, and `opened` is set only when it opened a single region that needed just that one task: regions opened
 * together are announced without moving the view. The region needing several tasks (level 9's palace) has its own
 * opening, played by the board (see viewCue in camera.ts).
 */
export type LastAction =
  | { readonly kind: 'move' | 'swap'; readonly opened?: number; readonly progress?: Progress }
  | { readonly kind: 'undo' | 'retry' | 'collect' | 'craft' | 'open' }
  | { readonly kind: 'place'; readonly at: Pos; readonly item: Item }
  | { readonly kind: 'unlock'; readonly region: number }
  | {
      readonly kind: 'merge';
      readonly consumed: 3 | 5;
      readonly input: Item;
      readonly result: Item;
      readonly cells: readonly Pos[];
      readonly outputs: readonly Pos[];
      readonly opened?: number;
      readonly progress?: Progress;
    };

/** The region the last action opened: by Unlock (or a gate), or, in room levels, by a drop. */
export function openedRegion(a: LastAction | null): number | null {
  if (a?.kind === 'unlock') return a.region;
  return a && 'opened' in a && a.opened !== undefined ? a.opened : null;
}

export interface UiState {
  readonly session: SessionState;
  readonly status: GameStatus;
  readonly selected: Pos | null;
  readonly lastAction: LastAction | null;
  readonly actionSeq: number;
  readonly musicArea: 'woodland' | 'palace';
}

export type UiAction =
  | { readonly type: 'tap'; readonly pos: Pos }
  | { readonly type: 'drop'; readonly from: Pos; readonly to: Pos }
  | { readonly type: 'placeSupply' }
  | { readonly type: 'unlock'; readonly region?: number }
  | { readonly type: 'undo' }
  | { readonly type: 'retry' }
  | { readonly type: 'clearSelection' };

const inBounds = (s: SessionState, p: Pos): boolean =>
  Number.isInteger(p.row) && Number.isInteger(p.col) &&
  p.row >= 0 && p.row < s.board.length && p.col >= 0 && p.col < s.board[p.row].length;

const samePos = (a: Pos, b: Pos): boolean => a.row === b.row && a.col === b.col;

const isOver = (state: UiState): boolean => state.status !== 'playing';

function withSession(prev: UiState, session: SessionState, lastAction: LastAction): UiState {
  return { session, status: evaluateStatus(session), selected: null, lastAction, actionSeq: prev.actionSeq + 1, musicArea: prev.musicArea };
}

export function initUi(level: LevelDefinition): UiState {
  const session = startSession(level);
  return { session, status: evaluateStatus(session), selected: null, lastAction: null, actionSeq: 0, musicArea: 'woodland' };
}

export function nextSupplyItem(state: UiState): Item | null {
  const { level, supplyIndex } = state.session;
  return level.supply[supplyIndex] ?? null;
}

export function supplyRemaining(state: UiState): number {
  return state.session.level.supply.length - state.session.supplyIndex;
}

export function canPlaceSupply(state: UiState): boolean {
  return state.status === 'playing' && supplyRemaining(state) > 0 &&
    state.session.board.some((r) => r.some((c) => c === null));
}

/** Region levels: whether Unlock (or, with `region`, that region's gate) would open the next region now. */
export function canUnlock(state: UiState, region?: number): boolean {
  return state.status === 'playing' && unlockReady(state.session) && (region === undefined || region === nextLocked(state.session));
}

/** Whether the item at `pos` can be picked up (tapped to select, or dragged): playing, not locked away and not fixed. */
export function canPickUp(state: UiState, pos: Pos): boolean {
  const { session } = state;
  return !isOver(state) && inBounds(session, pos) && session.board[pos.row][pos.col] !== null && isCellOpen(session, pos) &&
    !isFixed(session, pos);
}

/** Room levels: the treasure is visible (its room is open, and its task done), collected or not. */
export function treasureShown(state: UiState): boolean {
  return treasureRevealed(state.session);
}

/** Whether a drop of the item at `from` onto `to` would be accepted (it may still change nothing). */
export function canDropAt(state: UiState, from: Pos, to: Pos): boolean {
  return !isOver(state) && !samePos(from, to) && canDrop(state.session, from, to);
}

/** Cells to celebrate: goal items for an item or items goal (inside the goal region, if any); for Leave one, the last item once won. */
export function goalCells(state: UiState): Pos[] {
  const { goal, regions } = state.session.level;
  if (goal.kind === 'treasure') return state.status === 'won' ? [goal.at] : [];
  if (goal.kind === 'leaveOne' && state.status !== 'won') return [];
  const area = goal.kind === 'item' && goal.region !== undefined ? regions?.[goal.region] : undefined;
  const cells: Pos[] = [];
  state.session.board.forEach((r, row) => r.forEach((c, col) => {
    if (!c || (area && !inRegion(area, { row, col }))) return;
    const targets = goal.kind === 'item' ? [goal.item] : goal.kind === 'items' ? goal.items : null;
    if (targets === null || targets.some((t) => c.family === t.family && c.tier >= t.tier)) cells.push({ row, col });
  }));
  return cells;
}

export function canUndo(state: UiState): boolean {
  return state.session.undo !== null;
}

export function previewCells(state: UiState, from: Pos, to: Pos): Pos[] {
  return canDropAt(state, from, to) ? previewDrop(state.session, from, to) : [];
}

/** The player's last playable room interaction, independent of camera movement and gate openings. */
function areaAt(state: UiState, pos: Pos): UiState['musicArea'] {
  const regions = state.session.level.regions;
  if (!regions || !isCellOpen(state.session, pos)) return state.musicArea;
  const room = roomOf(regions, regionAt(regions, pos));
  return regions[room]?.building === 'palace' ? 'palace' : 'woodland';
}

function doDrop(state: UiState, from: Pos, to: Pos): UiState {
  const { session } = state;
  if (!canDropAt(state, from, to)) return state;
  const src = session.board[from.row][from.col]!;

  let lastAction: LastAction;
  if (session.board[to.row][to.col] === null) {
    lastAction = { kind: 'move' };
  } else {
    const cells = previewDrop(session, from, to);
    const consumed = cells.length;
    lastAction = consumed === 3 || consumed === 5
      ? {
          kind: 'merge', consumed, input: src, cells,
          result: { family: src.family, tier: (src.tier + 1) as Tier },
          outputs: consumed === 5 ? [to, from] : [to],
        }
      : { kind: 'swap' };
  }
  const next = applyDrop(session, from, to);
  if (next === session) return state;
  state = { ...state, musicArea: areaAt(state, to) };
  // Merge to treasure: one ingredient dropped onto the other crafted the chest (instead of swapping them).
  if (next.chest && !session.chest) return withSession(state, next, { kind: 'craft' });
  if (next.done.length > session.done.length) {
    const { regions } = session.level;
    const opened = regions!.flatMap((r, i) => (isOpen(next, i) && !isOpen(session, i) ? [i] : []));
    const progress = { tasks: next.done.slice(session.done.length), regions: opened };
    const one = opened.length === 1 && (regions![opened[0]].unlock as { tasks: readonly number[] }).tasks.length === 1;
    return withSession(state, next, one ? { ...lastAction, opened: opened[0], progress } : { ...lastAction, progress });
  }
  return withSession(state, next, next.unlocked > session.unlocked ? { ...lastAction, opened: next.unlocked } : lastAction);
}

export function reduceUi(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'drop':
      return doDrop(state, action.from, action.to);
    case 'tap': {
      const { pos } = action;
      const { session, selected } = state;
      if (isOver(state) || !inBounds(session, pos)) return state;
      // Room levels: tapping the revealed treasure collects it, whatever is selected.
      const { goal } = session.level;
      if (goal.kind === 'treasure' && samePos(goal.at, pos)) {
        const found = collect(session);
        if (found !== session) return withSession({ ...state, musicArea: areaAt(state, pos) }, found, { kind: 'collect' });
      }
      // Merge to treasure: tapping the closed chest opens it, whatever is selected.
      if (session.chest && samePos(session.chest, pos)) {
        const opened = openChest(session);
        return opened === session ? state : withSession(state, opened, { kind: 'open' });
      }
      // Completed plate items still choose their room's music, without moving them or creating a gameplay event.
      if (session.board[pos.row][pos.col] && isCellOpen(session, pos) && isFixed(session, pos)) {
        return { ...state, selected: null, musicArea: areaAt(state, pos) };
      }
      if (selected === null) return canPickUp(state, pos) ? { ...state, selected: pos, musicArea: areaAt(state, pos) } : state;
      if (samePos(selected, pos)) return { ...state, selected: null };
      // A tap that changes nothing (onto an identical item that cannot merge) still ends the selection.
      const next = doDrop(state, selected, pos);
      return next === state ? { ...state, selected: null } : next;
    }
    case 'placeSupply': {
      if (isOver(state)) return state;
      const pick = chooseSupplyCell(state.session);
      if (pick === null) return state;
      const item = nextSupplyItem(state)!;
      const next = placeSupplyRandom(state.session);
      return withSession(state, next, { kind: 'place', at: pick.at, item });
    }
    case 'unlock': {
      if (isOver(state)) return state;
      const next = unlock(state.session, action.region);
      return next === state.session ? state : withSession(state, next, { kind: 'unlock', region: next.unlocked });
    }
    case 'undo':
      return canUndo(state) ? withSession(state, undo(state.session), { kind: 'undo' }) : state;
    case 'retry':
      return withSession({ ...state, musicArea: 'woodland' }, retry(state.session), { kind: 'retry' });
    case 'clearSelection':
      return state.selected === null ? state : { ...state, selected: null };
  }
}
