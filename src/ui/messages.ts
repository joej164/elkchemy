import { nextLocked, unlockReady, type Region } from '../regions';
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

/** Region levels: where the goal must be made, as " in <region>". */
function goalPlace(goal: LevelGoal, regions?: readonly Region[]): string {
  return goal.kind === 'item' && goal.region !== undefined && regions ? ` in ${regions[goal.region].name}` : '';
}

export function objectiveText(goal: LevelGoal, regions?: readonly Region[]): string {
  if (goal.kind === 'item') return `Goal: make ${itemLabel(goal.item)}${goalPlace(goal, regions)}`;
  if (goal.kind === 'items') return `Goal: make ${allOf(goal.items.length)}`;
  if (goal.item) return `Goal: merge down to one ${itemLabel(goal.item)}`;
  return 'Goal: use all supply and leave exactly one item';
}

/** Objective sentence for the help dialog. */
export function helpObjective(goal: LevelGoal, regions?: readonly Region[]): string {
  if (goal.kind === 'item') return `Goal: make ${itemLabel(goal.item)}${goalPlace(goal, regions)}.`;
  if (goal.kind === 'items') return `Goal: have ${allOf(goal.items.length)} goal items on the board at once.`;
  if (goal.item) return `Goal: merge everything down to exactly one item: ${itemLabel(goal.item)}.`;
  return 'Goal: use all supply and finish with exactly one item on the board.';
}

/** Owner-approved text for a generated puzzle with no merges left. */
export const NO_MERGES_MESSAGE = 'No merges left—Undo, Retry, or New Puzzle.';

/** Region levels with no useful merge and no unlock left (there is no New Puzzle). */
export const REGION_STUCK_MESSAGE = 'No useful merges left—Undo or Retry.';

const PAN_HINT = 'Drag empty ground to pan.';
export const LARGE_BOARD_HINT = `${PAN_HINT} For far moves, tap an item, pan, then tap where it goes.`;

/** Region levels: what the next region needs, e.g. "Grove, tier 3 of 4 in Mossy Clearing". */
export function unlockNeed(regions: readonly Region[], index: number): string {
  const { item, in: from } = regions[index].unlock!;
  return `${itemLabel(item)} in ${regions[from].name}`;
}

/** Region levels: the next step, from the next unlock to the goal. */
function regionStep(state: UiState): string {
  const { session } = state;
  const { regions, goal } = session.level;
  const n = nextLocked(session);
  if (n === null) return `Merge items to make ${goal.kind === 'item' ? itemLabel(goal.item) : 'the goal'}${goalPlace(goal, regions)}.`;
  const name = regions![n].name;
  if (unlockReady(session)) return `${name} is ready. Press Unlock ${name}.`;
  return `Make ${unlockNeed(regions!, n)} to unlock ${name}.`;
}

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
  const { goal, regions } = state.session.level;
  if (state.status === 'playing') {
    if (regions) return pannable ? `${regionStep(state)} ${PAN_HINT}` : regionStep(state);
    return pannable ? LARGE_BOARD_HINT : playingMessage(goal, state.session.level.supply.length > 0);
  }
  if (state.status === 'won') {
    if (goal.kind === 'items') return `Goal complete! You made ${allOf(goal.items.length)}.`;
    if (goal.kind === 'item') return `Goal complete! You made ${itemLabel(goal.item)}${goalPlace(goal, regions)}.`;
    const last = state.session.board.flat().find((c) => c !== null);
    return last ? `Goal complete! Only ${itemLabel(last)} remains.` : 'Goal complete!';
  }
  if (regions) return REGION_STUCK_MESSAGE;
  if (state.session.level.earlyLoss === false) return NO_MERGES_MESSAGE;
  if (goal.kind === 'items') return 'A goal item can no longer be made. Undo or retry.';
  if (goal.kind === 'item') {
    return `The goal is out of reach with the ${FAMILY_NAMES[goal.item.family]} items left. Undo or retry.`;
  }
  return 'You can no longer finish with exactly one item. Undo or retry.';
}
