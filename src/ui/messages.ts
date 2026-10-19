import type { LevelGoal } from '../session';
import { FAMILY_NAMES, itemLabel } from './ItemArt';
import type { UiState } from './controller';

/** Short objective shown in the goal panel. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n);
const allOf = (n: number): string => (n === 2 ? 'both' : `all ${countWord(n)}`);

/**
 * A guess, before the board is measured, at whether it needs panning: more than 8 cells across or down.
 * The game replaces it with the measured overflow, which also covers smaller boards on narrow screens.
 */
export function isLargeBoard(board: readonly (readonly unknown[])[]): boolean {
  return board.length > 8 || board.some((r) => r.length > 8);
}

export function objectiveText(goal: LevelGoal): string {
  if (goal.kind === 'item') return `Goal: make ${itemLabel(goal.item)}`;
  if (goal.kind === 'items') return `Goal: make ${allOf(goal.items.length)}`;
  if (goal.item) return `Goal: merge down to one ${itemLabel(goal.item)}`;
  return 'Goal: use all supply and leave exactly one item';
}

/** Objective sentence for the help dialog. */
export function helpObjective(goal: LevelGoal): string {
  if (goal.kind === 'item') return `Goal: make ${itemLabel(goal.item)}.`;
  if (goal.kind === 'items') return `Goal: have ${allOf(goal.items.length)} goal items on the board at once.`;
  if (goal.item) return `Goal: merge everything down to exactly one item: ${itemLabel(goal.item)}.`;
  return 'Goal: use all supply and finish with exactly one item on the board.';
}

/** Owner-approved text for a generated puzzle with no merges left. */
export const NO_MERGES_MESSAGE = 'No merges left—Undo, Retry, or New Puzzle.';

export const LARGE_BOARD_HINT =
  'Drag empty ground to pan. For far moves, tap an item, pan, then tap where it goes.';

/** `hasSupply` false (generated puzzles): everything needed is already on the board. */
export function playingMessage(goal: LevelGoal, hasSupply = true): string {
  const more = hasSupply ? ' Add supply when you need more.' : '';
  if (goal.kind === 'item') return `Merge items to make ${itemLabel(goal.item)}.${more}`;
  if (goal.kind === 'items') return `Merge items to make ${allOf(goal.items.length)}.${more}`;
  if (goal.item) return `Merge everything down to one ${itemLabel(goal.item)}.`;
  return 'Merge everything down to one item. All supply must be placed.';
}

export function itemCount(state: UiState): number {
  return state.session.board.reduce((n, row) => n + row.filter((c) => c !== null).length, 0);
}

/** `pannable`: the board overflows its viewport; defaults to the size-based guess. */
export function statusMessage(state: UiState, pannable = isLargeBoard(state.session.board)): string {
  const { goal } = state.session.level;
  if (state.status === 'playing') {
    return pannable ? LARGE_BOARD_HINT : playingMessage(goal, state.session.level.supply.length > 0);
  }
  if (state.status === 'won') {
    if (goal.kind === 'items') return `Goal complete! You made ${allOf(goal.items.length)}.`;
    if (goal.kind === 'item') return `Goal complete! You made ${itemLabel(goal.item)}.`;
    const last = state.session.board.flat().find((c) => c !== null);
    return last ? `Goal complete! Only ${itemLabel(last)} remains.` : 'Goal complete!';
  }
  if (state.session.level.earlyLoss === false) return NO_MERGES_MESSAGE;
  if (goal.kind === 'items') return 'A goal item can no longer be made. Undo or retry.';
  if (goal.kind === 'item') {
    return `The goal is out of reach with the ${FAMILY_NAMES[goal.item.family]} items left. Undo or retry.`;
  }
  return 'You can no longer finish with exactly one item. Undo or retry.';
}
