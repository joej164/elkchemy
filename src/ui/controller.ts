import { previewMerge, type Item, type Pos, type Tier } from '../board';
import {
  applyDrop, chooseSupplyCell, placeSupplyRandom, retry, startSession, undo,
  type LevelDefinition, type SessionState,
} from '../session';
import { evaluateStatus, type GameStatus } from '../status';

export type LastAction =
  | { readonly kind: 'move' | 'swap' | 'undo' | 'retry' }
  | { readonly kind: 'place'; readonly at: Pos; readonly item: Item }
  | {
      readonly kind: 'merge';
      readonly consumed: 3 | 5;
      readonly input: Item;
      readonly result: Item;
      readonly cells: readonly Pos[];
      readonly outputs: readonly Pos[];
    };

export interface UiState {
  readonly session: SessionState;
  readonly status: GameStatus;
  readonly selected: Pos | null;
  readonly lastAction: LastAction | null;
  readonly actionSeq: number;
}

export type UiAction =
  | { readonly type: 'tap'; readonly pos: Pos }
  | { readonly type: 'drop'; readonly from: Pos; readonly to: Pos }
  | { readonly type: 'placeSupply' }
  | { readonly type: 'undo' }
  | { readonly type: 'retry' }
  | { readonly type: 'clearSelection' };

const inBounds = (s: SessionState, p: Pos): boolean =>
  Number.isInteger(p.row) && Number.isInteger(p.col) &&
  p.row >= 0 && p.row < s.board.length && p.col >= 0 && p.col < s.board[p.row].length;

const samePos = (a: Pos, b: Pos): boolean => a.row === b.row && a.col === b.col;

const isOver = (state: UiState): boolean => state.status !== 'playing';

function withSession(prev: UiState, session: SessionState, lastAction: LastAction): UiState {
  return { session, status: evaluateStatus(session), selected: null, lastAction, actionSeq: prev.actionSeq + 1 };
}

export function initUi(level: LevelDefinition): UiState {
  const session = startSession(level);
  return { session, status: evaluateStatus(session), selected: null, lastAction: null, actionSeq: 0 };
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

/** Cells to celebrate: goal items for an item or items goal; for Leave one, the last item once won. */
export function goalCells(state: UiState): Pos[] {
  const { goal } = state.session.level;
  if (goal.kind === 'leaveOne' && state.status !== 'won') return [];
  const cells: Pos[] = [];
  state.session.board.forEach((r, row) => r.forEach((c, col) => {
    if (!c) return;
    const targets = goal.kind === 'item' ? [goal.item] : goal.kind === 'items' ? goal.items : null;
    if (targets === null || targets.some((t) => c.family === t.family && c.tier >= t.tier)) cells.push({ row, col });
  }));
  return cells;
}

export function canUndo(state: UiState): boolean {
  return state.session.undo !== null;
}

export function previewCells(state: UiState, from: Pos, to: Pos): Pos[] {
  const { session } = state;
  if (isOver(state) || !inBounds(session, from) || !inBounds(session, to) || samePos(from, to)) return [];
  if (session.board[from.row][from.col] === null) return [];
  return previewMerge(session.board, from, to);
}

function doDrop(state: UiState, from: Pos, to: Pos): UiState {
  const { session } = state;
  if (isOver(state) || !inBounds(session, from) || !inBounds(session, to) || samePos(from, to)) return state;
  const src = session.board[from.row][from.col];
  if (src === null) return state;

  let lastAction: LastAction;
  if (session.board[to.row][to.col] === null) {
    lastAction = { kind: 'move' };
  } else {
    const cells = previewMerge(session.board, from, to);
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
  return next === session ? state : withSession(state, next, lastAction);
}

export function reduceUi(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'drop':
      return doDrop(state, action.from, action.to);
    case 'tap': {
      const { pos } = action;
      const { session, selected } = state;
      if (isOver(state) || !inBounds(session, pos)) return state;
      if (selected === null) {
        return session.board[pos.row][pos.col] === null ? state : { ...state, selected: pos };
      }
      if (samePos(selected, pos)) return { ...state, selected: null };
      return doDrop(state, selected, pos);
    }
    case 'placeSupply': {
      if (isOver(state)) return state;
      const pick = chooseSupplyCell(state.session);
      if (pick === null) return state;
      const item = nextSupplyItem(state)!;
      const next = placeSupplyRandom(state.session);
      return withSession(state, next, { kind: 'place', at: pick.at, item });
    }
    case 'undo':
      return canUndo(state) ? withSession(state, undo(state.session), { kind: 'undo' }) : state;
    case 'retry':
      return withSession(state, retry(state.session), { kind: 'retry' });
    case 'clearSelection':
      return state.selected === null ? state : { ...state, selected: null };
  }
}
