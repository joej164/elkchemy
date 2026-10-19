import { isOpen, nextLocked, unlockReady, type Plate, type Region } from '../regions';
import type { LevelGoal, Prize } from '../session';
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

/**
 * Room levels: the treasure the last room hides. `verb`: what a tap on it does; `opened`: its cell's state once tapped;
 * `done`: the announcement of that tap; `won`: the win message.
 */
export interface PrizeText { readonly name: string; readonly verb: string; readonly opened: string; readonly done: string; readonly won: string }
export const PRIZES: Record<Prize, PrizeText> = {
  backpack: {
    name: 'disc-golf backpack', verb: 'collect', opened: 'open, collected',
    done: 'Collected the disc-golf backpack.', won: 'Goal complete! You found the disc-golf backpack.',
  },
  clarinet: {
    name: 'clarinet case', verb: 'open', opened: 'open, an assembled clarinet inside',
    done: 'Opened the clarinet case: an assembled clarinet is inside.',
    won: 'Goal complete! You opened the clarinet case and found an assembled clarinet.',
  },
};

/** The text for a room level's treasure (the backpack unless the goal names another prize). */
export function prizeText(goal: LevelGoal): PrizeText {
  return PRIZES[goal.kind === 'treasure' && goal.prize ? goal.prize : 'backpack'];
}

/** Region levels: where the goal must be made (or, in room levels, found), as " in <region>". */
function goalPlace(goal: LevelGoal, regions?: readonly Region[]): string {
  if (goal.kind === 'treasure' && regions) return ` in ${regions[regions.length - 1].name}`;
  return goal.kind === 'item' && goal.region !== undefined && regions ? ` in ${regions[goal.region].name}` : '';
}

export function objectiveText(goal: LevelGoal, regions?: readonly Region[]): string {
  if (goal.kind === 'treasure') return `Goal: find the ${prizeText(goal).name}${goalPlace(goal, regions)}`;
  if (goal.kind === 'item') return `Goal: make ${itemLabel(goal.item)}${goalPlace(goal, regions)}`;
  if (goal.kind === 'items') return `Goal: make ${allOf(goal.items.length)}`;
  if (goal.item) return `Goal: merge down to one ${itemLabel(goal.item)}`;
  return 'Goal: use all supply and leave exactly one item';
}

/** Objective sentence for the help dialog. */
export function helpObjective(goal: LevelGoal, regions?: readonly Region[]): string {
  if (goal.kind === 'treasure') {
    const { verb, name } = prizeText(goal);
    const gates = regions?.filter((r) => !!r.unlock && 'passage' in r.unlock && !!r.unlock.passage).length ?? 0;
    return `Goal: open the rune ${gates === 1 ? 'gate' : 'gates'} and ${verb} the ${name}${goalPlace(goal, regions)}.`;
  }
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

/**
 * Region levels: what the next region needs, e.g. "Grove, tier 3 of 4 in Mossy Clearing", or in room levels
 * "Grove, tier 2 of 4 and Song, tier 2 of 4 on the pressure plates in Pressure Hall".
 */
export function unlockNeed(regions: readonly Region[], index: number): string {
  const u = regions[index].unlock!;
  const room = regions[u.in].name;
  if ('item' in u) return `${itemLabel(u.item)} in ${room}`;
  if (u.kind === 'stone') return `${itemLabel(u.plates[0].item)} alone on the stone in ${room}`;
  return `${plateItems(u.plates)} on the pressure ${u.plates.length > 1 ? 'plates' : 'plate'} in ${room}`;
}

/** Room levels: the items some plates need, e.g. "Grove, tier 2 of 4 and Song, tier 2 of 4". */
export function plateItems(plates: readonly Plate[]): string {
  const items = plates.map((pl) => itemLabel(pl.item));
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0];
}

/**
 * Room levels: a hidden region joining another room is a concealed part of that room. Nothing names or describes it
 * before it opens; afterwards it is spoken of as more of that room.
 */
export function isConcealed(region: Region): boolean {
  return !!region.hidden && region.joins !== undefined;
}

/**
 * Room levels: the help dialog's rule for gates and rooms. The stone's rule appears only where there is a stone; a
 * concealed part of a room is mentioned only once `unlocked` has opened it.
 */
export function roomsHelp(regions: readonly Region[], unlocked = 0): string {
  const stone = regions.some((r) => !!r.unlock && 'kind' in r.unlock && r.unlock.kind === 'stone');
  const shared = regions.map((r, i) => {
    if (r.joins === undefined) return '';
    const host = regions[r.joins].name;
    if (!isConcealed(r)) return ` ${r.name} is part of ${host}'s room: once its gate opens, items move, swap and merge between the two.`;
    return i <= unlocked ? ` More of ${host} has been revealed: items move, swap and merge anywhere in it.` : '';
  });
  return 'Each rune gate opens by itself on the move that puts exactly the items shown on its room\'s marked tiles' +
    `${stone ? '; a stone must hold the only item left in its room' : ''}.${shared.join('')} Items never leave their own room.`;
}

/** Region levels: the next step, from the next unlock to the goal. */
function regionStep(state: UiState): string {
  const { session } = state;
  const { regions, goal } = session.level;
  const n = nextLocked(session);
  if (goal.kind === 'treasure') {
    const { name, verb } = prizeText(goal);
    if (n === null) return `${regions![regions!.length - 1].name} is open. Tap the ${name} to ${verb} it.`;
    const u = regions![n].unlock!;
    // A concealed part of the clearing: only the marked tile is asked for.
    if (isConcealed(regions![n]) && 'plates' in u) {
      return `Put ${plateItems(u.plates)} on the marked ${u.plates.length > 1 ? 'tiles' : 'tile'}.`;
    }
    const how = 'kind' in u && u.kind === 'stone' ? 'Merge down to' : 'Put';
    const shared = regions!.map((r, i) => {
      if (r.joins === undefined || !isOpen(session, i)) return '';
      const host = regions![r.joins].name;
      return isConcealed(r) ? ` More of ${host} has been revealed, with more items to use.` : ` Items move and merge between ${host} and ${r.name}.`;
    }).join('');
    return `${how} ${unlockNeed(regions!, n)} to open the rune gate to ${regions![n].name}.${shared}`;
  }
  if (n === null) return `Merge items to make ${goal.kind === 'item' ? itemLabel(goal.item) : 'the goal'}${goalPlace(goal, regions)}.`;
  const name = regions![n].name;
  if (unlockReady(session)) return `${name} is ready. Tap its gate or press Unlock ${name}.`;
  return `Make ${unlockNeed(regions!, n)} to unlock ${name}.`;
}

/** `hasSupply` false (generated puzzles): everything needed is already on the board. */
export function playingMessage(goal: LevelGoal, hasSupply = true): string {
  const more = hasSupply ? ' Add supply when you need more.' : '';
  if (goal.kind === 'item') return `Merge items to make ${itemLabel(goal.item)}.${more}`;
  if (goal.kind === 'items') return `Merge items to make ${allOf(goal.items.length)}.${more}`;
  if (goal.kind === 'treasure') return `Find the ${prizeText(goal).name}.`;
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
    if (goal.kind === 'treasure') return prizeText(goal).won;
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
