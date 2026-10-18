import type { LevelGoal } from '../session';
import { FAMILY_NAMES, itemLabel } from './ItemArt';
import type { UiState } from './controller';

/** Short objective shown in the goal panel. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n);

/** Whether the board is larger than the standard 4x4 (so it may need panning). */
export function isLargeBoard(board: readonly (readonly unknown[])[]): boolean {
  return board.length > 4 || board.some((r) => r.length > 4);
}

export function objectiveText(goal: LevelGoal): string {
  if (goal.kind === 'item') return `Goal: make ${itemLabel(goal.item)}`;
  if (goal.kind === 'items') return `Goal: make all ${countWord(goal.items.length)}`;
  return 'Goal: use all supply and leave exactly one item';
}

/** Objective sentence for the help dialog. */
export function helpObjective(goal: LevelGoal): string {
  if (goal.kind === 'item') return `Goal: make ${itemLabel(goal.item)}.`;
  if (goal.kind === 'items') return `Goal: have all ${countWord(goal.items.length)} goal items on the board at once.`;
  return 'Goal: use all supply and finish with exactly one item on the board.';
}

export const LARGE_BOARD_HINT =
  'Drag empty ground to pan. For far moves, tap an item, pan, then tap where it goes.';

export function playingMessage(goal: LevelGoal): string {
  if (goal.kind === 'item') return `Merge items to make ${itemLabel(goal.item)}. Add supply when you need more.`;
  if (goal.kind === 'items') return `Merge items to make all ${countWord(goal.items.length)}. Add supply when you need more.`;
  return 'Merge everything down to one item. All supply must be placed.';
}

export function itemCount(state: UiState): number {
  return state.session.board.reduce((n, row) => n + row.filter((c) => c !== null).length, 0);
}

export function statusMessage(state: UiState): string {
  const { goal } = state.session.level;
  if (state.status === 'playing') {
    return isLargeBoard(state.session.board) ? LARGE_BOARD_HINT : playingMessage(goal);
  }
  if (state.status === 'won') {
    if (goal.kind === 'items') return `Goal complete! You made all ${countWord(goal.items.length)}.`;
    if (goal.kind === 'item') return `Goal complete! You made ${itemLabel(goal.item)}.`;
    const last = state.session.board.flat().find((c) => c !== null);
    return last ? `Goal complete! Only ${itemLabel(last)} remains.` : 'Goal complete!';
  }
  if (goal.kind === 'items') return 'A goal item can no longer be made. Undo or retry.';
  if (goal.kind === 'item') {
    return `The goal is out of reach with the ${FAMILY_NAMES[goal.item.family]} items left. Undo or retry.`;
  }
  return 'You can no longer finish with exactly one item. Undo or retry.';
}
