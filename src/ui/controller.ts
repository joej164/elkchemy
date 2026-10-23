import type { Item, Pos, Tier } from '../board';
import { inRegion, isFixed, isOpen, nextLocked, regionAt, roomOf, unlockReady } from '../regions';
import {
  applyDrop, canDrop, chooseSupplyCell, closedContainerAt, collect, containerShown, craftedItem, goalOpenableAt, isCellOpen, openChest,
  openContainer, openGoal, placeSupplyRandom, previewDrop, releaseCells, retry, standOnPlate, startSession, treasureRevealed, undo, unlock,
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
 * `revealed` (container levels): the covered container the action uncovered. `unpack`: a container opened, its batch at
 * `cells`. `openGoal`: the made goal item opened (the attic's Picture Book), which wins.
 * `craft`: a recipe's chest crafted, or, with an item recipe (the attic), `made` crafted at `at`.
 * `stand` (the palace entrance prototype): Alisha stood on her plate, opening the palace entrance, which wins.
 */
export type LastAction =
  | { readonly kind: 'move' | 'swap'; readonly opened?: number; readonly progress?: Progress; readonly revealed?: number }
  | { readonly kind: 'undo' | 'retry' | 'collect' | 'open' | 'openGoal' | 'stand' }
  | { readonly kind: 'craft'; readonly made?: Item; readonly at?: Pos }
  | { readonly kind: 'unpack'; readonly container: number; readonly cells: readonly Pos[] }
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
      readonly revealed?: number;
    };

/** The region the last action opened: by Unlock (or a gate), or, in room levels, by a drop. */
export function openedRegion(a: LastAction | null): number | null {
  if (a?.kind === 'unlock') return a.region;
  return a && 'opened' in a && a.opened !== undefined ? a.opened : null;
}

/**
 * `alishaSelected` (party levels): Alisha is picked up (tapped), to be put on her plate by a tap on it. Any action, or an
 * item picked up, puts her down. `bubbleDismissed` (party levels): her speech bubble has been tapped away; Retry
 * brings it back with the rest of the level.
 */
export interface UiState {
  readonly session: SessionState;
  readonly status: GameStatus;
  readonly selected: Pos | null;
  readonly lastAction: LastAction | null;
  readonly actionSeq: number;
  readonly musicArea: 'woodland' | 'palace';
  readonly alishaSelected: boolean;
  readonly bubbleDismissed: boolean;
}

export type UiAction =
  | { readonly type: 'tap'; readonly pos: Pos }
  | { readonly type: 'drop'; readonly from: Pos; readonly to: Pos }
  | { readonly type: 'placeSupply' }
  | { readonly type: 'unlock'; readonly region?: number }
  | { readonly type: 'undo' }
  | { readonly type: 'retry' }
  | { readonly type: 'clearSelection' }
  // Party levels: tap Alisha (to pick her up or put her down), drop her on a cell (a drag, or a tap once picked up), and
  // tap her speech bubble away.
  | { readonly type: 'selectAlisha' }
  | { readonly type: 'placeAlisha'; readonly to: Pos }
  | { readonly type: 'dismissBubble' };

const inBounds = (s: SessionState, p: Pos): boolean =>
  Number.isInteger(p.row) && Number.isInteger(p.col) &&
  p.row >= 0 && p.row < s.board.length && p.col >= 0 && p.col < s.board[p.row].length;

const samePos = (a: Pos, b: Pos): boolean => a.row === b.row && a.col === b.col;

const isOver = (state: UiState): boolean => state.status !== 'playing';

function withSession(prev: UiState, session: SessionState, lastAction: LastAction): UiState {
  return {
    session, status: evaluateStatus(session), selected: null, lastAction, actionSeq: prev.actionSeq + 1, musicArea: prev.musicArea,
    alishaSelected: false, bubbleDismissed: prev.bubbleDismissed,
  };
}

export function initUi(level: LevelDefinition): UiState {
  const session = startSession(level);
  return {
    session, status: evaluateStatus(session), selected: null, lastAction: null, actionSeq: 0, musicArea: 'woodland',
    alishaSelected: false, bubbleDismissed: false,
  };
}

/** Party levels: Alisha's plate is revealed (with its room), so she can speak and then stand on it. */
export function plateRevealed(state: UiState): boolean {
  return !!state.session.level.party && treasureRevealed(state.session);
}

/**
 * Party levels: Alisha's speech bubble is showing: from the move that reveals her plate until it is tapped away (never
 * once she has stood on it). While it shows, the board is paused: only the bubble itself, Retry and leaving do anything.
 */
export function bubbleOpen(state: UiState): boolean {
  return plateRevealed(state) && !state.bubbleDismissed && !state.session.collected;
}

/** Party levels: Alisha can be picked up and put on her plate: it is revealed, her bubble dismissed, the game on. */
export function canMoveAlisha(state: UiState): boolean {
  return plateRevealed(state) && state.bubbleDismissed && state.status === 'playing';
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

/**
 * Whether the item at `pos` can be picked up (tapped to select, or dragged): playing, not locked away and not fixed, and
 * no speech bubble pausing the board.
 */
export function canPickUp(state: UiState, pos: Pos): boolean {
  const { session } = state;
  return !isOver(state) && !bubbleOpen(state) && inBounds(session, pos) && session.board[pos.row][pos.col] !== null &&
    isCellOpen(session, pos) && !isFixed(session, pos);
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

const itemCells = (state: UiState): Pos[] =>
  state.session.board.flatMap((r, row) => r.flatMap((c, col) => (c ? [{ row, col }] : [])));

/**
 * Tutorial guidance (the attic): the cells where the item at `from` would merge if dropped now (see previewCells), or,
 * with an item recipe, craft. Not every matching item is one: dropped onto an item whose group, without the item moved,
 * has fewer than two, it won't merge.
 */
export function mergeTargets(state: UiState, from: Pos): Pos[] {
  if (!canPickUp(state, from)) return [];
  return itemCells(state).filter((to) => previewCells(state, from, to).length > 0 || craftedItem(state.session, from, to));
}

/** Tutorial guidance (the attic): the items that would merge somewhere if picked up now. */
export function mergeSources(state: UiState): Pos[] {
  return itemCells(state).filter((from) => mergeTargets(state, from).length > 0);
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
  // An item recipe (the attic): one ingredient dropped onto the other crafts its result there (instead of swapping).
  const made = craftedItem(session, from, to);
  if (made) return withSession({ ...state, musicArea: areaAt(state, to) }, applyDrop(session, from, to), { kind: 'craft', made, at: to });

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
  // Container levels: the move that makes a covered container's item uncovers it.
  const revealed = session.level.containers?.findIndex((_, i) =>
    !session.unpacked.includes(i) && !containerShown(session, i) && containerShown(next, i)) ?? -1;
  if (revealed !== -1) return withSession(state, next, { ...lastAction, revealed });
  if (next.done.length > session.done.length) {
    const { regions } = session.level;
    const opened = regions!.flatMap((r, i) => (isOpen(next, i) && !isOpen(session, i) ? [i] : []));
    const progress = { tasks: next.done.slice(session.done.length), regions: opened };
    const one = opened.length === 1 && (regions![opened[0]].unlock as { tasks: readonly number[] }).tasks.length === 1;
    return withSession(state, next, one ? { ...lastAction, opened: opened[0], progress } : { ...lastAction, progress });
  }
  return withSession(state, next, next.unlocked > session.unlocked ? { ...lastAction, opened: next.unlocked } : lastAction);
}

/** Party levels: Alisha dropped on `to` (dragged, or tapped there once picked up). Only her revealed plate takes her. */
function placeAlisha(state: UiState, to: Pos): UiState {
  if (!canMoveAlisha(state)) return state;
  const next = standOnPlate(state.session, to);
  if (next === state.session) return state.alishaSelected ? { ...state, alishaSelected: false } : state;
  return withSession(state, next, { kind: 'stand' });
}

export function reduceUi(state: UiState, action: UiAction): UiState {
  // An open speech bubble pauses the board: nothing but tapping it away, Retry or putting things down does anything.
  if (bubbleOpen(state) && action.type !== 'dismissBubble' && action.type !== 'retry' && action.type !== 'clearSelection') return state;
  switch (action.type) {
    case 'drop':
      return doDrop(state, action.from, action.to);
    case 'dismissBubble':
      return bubbleOpen(state) ? { ...state, bubbleDismissed: true } : state;
    case 'selectAlisha':
      return canMoveAlisha(state) ? { ...state, selected: null, alishaSelected: !state.alishaSelected } : state;
    case 'placeAlisha':
      return placeAlisha(state, action.to);
    case 'tap': {
      const { pos } = action;
      const { session, selected } = state;
      if (isOver(state) || !inBounds(session, pos)) return state;
      // Alisha picked up: a tap on her plate stands her there; anywhere else puts her down, and does nothing more.
      if (state.alishaSelected) return placeAlisha(state, pos);
      // Room levels: tapping the revealed treasure collects it, whatever is selected.
      const { goal } = session.level;
      if (goal.kind === 'treasure' && samePos(goal.at, pos)) {
        const found = collect(session);
        if (found !== session) return withSession({ ...state, musicArea: areaAt(state, pos) }, found, { kind: 'collect' });
      }
      // An `open` item goal (the attic): tapping the made goal item opens it, whatever is selected. That wins.
      if (goalOpenableAt(session, pos)) return withSession(state, openGoal(session, pos), { kind: 'openGoal' });
      // Merge to treasure: tapping the closed chest opens it, whatever is selected.
      if (session.chest && samePos(session.chest, pos)) {
        const opened = openChest(session);
        return opened === session ? state : withSession(state, opened, { kind: 'open' });
      }
      // Container levels: tapping an uncovered container opens it, whatever is selected; a covered one does nothing but
      // end the selection. Without room it stays closed (the banner says so).
      const container = closedContainerAt(session, pos);
      if (container !== -1) {
        const cells = releaseCells(session, container);
        if (!cells) return state.selected === null ? state : { ...state, selected: null };
        return withSession(state, openContainer(session, container), { kind: 'unpack', container, cells });
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
      return withSession({ ...state, musicArea: 'woodland', bubbleDismissed: false }, retry(state.session), { kind: 'retry' });
    case 'clearSelection':
      return state.selected === null && !state.alishaSelected ? state : { ...state, selected: null, alishaSelected: false };
  }
}
