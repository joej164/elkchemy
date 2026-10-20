import {
  availableTasks, isOpen, nextLocked, sealedRegion, unlockReady, type GateSymbol, type Plate, type Region, type Task, type TaskUnlock,
} from '../regions';
import type { Item } from '../board';
import type { Recipe } from '../recipes';
import { contentCells, craftReady, treasureRevealed, type LevelGoal, type Prize, type SessionState } from '../session';
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
  ukulele: {
    name: 'ukulele case', verb: 'open', opened: 'open, a ukulele inside',
    done: 'Opened the ukulele case: a ukulele is inside.',
    won: 'Goal complete! You found a ukulele in the case.',
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
/** Merge to treasure: a closed chest without room for its contents, and no merge left to make room. */
export const NO_ROOM_MESSAGE = 'No room to open the chest and no merges left—Undo, Retry, or New Puzzle.';

/** Region levels with no useful merge and no unlock left (there is no New Puzzle). */
export const REGION_STUCK_MESSAGE = 'No useful merges left—Undo or Retry.';

export const PAN_HINT = 'Drag empty ground to pan.';

/** Container levels: a batch's identical items counted together, in order of first appearance. */
export function batchGroups(items: readonly Item[]): { item: Item; n: number }[] {
  const groups: { item: Item; n: number }[] = [];
  for (const item of items) {
    const g = groups.find((x) => x.item.family === item.family && x.item.tier === item.tier);
    if (g) g.n++; else groups.push({ item, n: 1 });
  }
  return groups;
}

/** Container levels: a batch of items, e.g. "3 × Loose photos, tier 1 of 5". */
export function batchText(items: readonly Item[]): string {
  return listOf(batchGroups(items).map(({ item, n }) => `${n} × ${itemLabel(item)}`));
}
export const LARGE_BOARD_HINT = `${PAN_HINT} For far moves, tap an item, pan, then tap where it goes.`;

/** "A, B and C" (or "A and B", or "A"; `or` for "A, B or C"). */
function listOf(words: readonly string[], joiner = 'and'): string {
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} ${joiner} ${words[words.length - 1]}` : words[0];
}

/**
 * Region levels: what the next region needs, e.g. "Grove, tier 3 of 5 in Mossy Clearing", or in room levels
 * "Grove, tier 2 of 5 and Song, tier 2 of 5 on the pressure plates in Pressure Hall". With tasks (`tasks` given), what
 * its task needs, or for a region needing several, "Fern Glade, Crystal Glade and Woodland Lodge complete".
 */
export function unlockNeed(regions: readonly Region[], index: number, tasks?: readonly Task[]): string {
  const u = regions[index].unlock!;
  if ('tasks' in u) {
    if (u.tasks.length > 1) return `${listOf(u.tasks.map((t) => regions[tasks![t].in].name))} complete`;
    return taskNeed(regions, tasks![u.tasks[0]]);
  }
  const room = regions[u.in].name;
  if ('item' in u) return `${itemLabel(u.item)} in ${room}`;
  if (u.kind === 'stone') return `${itemLabel(u.plates[0].item)} alone on the stone in ${room}`;
  return `${plateItems(u.plates)} on the pressure ${u.plates.length > 1 ? 'plates' : 'plate'} in ${room}`;
}

/** Levels with tasks: what a task needs, e.g. "Song, tier 3 of 5 on the pressure plate in Songbird Glade". */
export function taskNeed(regions: readonly Region[], task: Task): string {
  return `${plateItems(task.plates)} on the pressure ${task.plates.length > 1 ? 'plates' : 'plate'} in ${regions[task.in].name}`;
}

/** Room levels: the items some plates need, e.g. "Grove, tier 2 of 5 and Song, tier 2 of 5". */
export function plateItems(plates: readonly Plate[]): string {
  return listOf(plates.map((pl) => itemLabel(pl.item)));
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
 * concealed part of a room is mentioned only once `unlocked` (the last region opened, or with tasks, whether a region is
 * open) has opened it. With `tasks`, the completions that open the region needing several are explained instead.
 */
export function roomsHelp(regions: readonly Region[], unlocked: number | ((i: number) => boolean) = 0, tasks?: readonly Task[]): string {
  const open = typeof unlocked === 'number' ? (i: number) => i <= unlocked : unlocked;
  const stone = regions.some((r) => !!r.unlock && 'kind' in r.unlock && r.unlock.kind === 'stone');
  const shared = regions.map((r, i) => {
    if (r.joins === undefined) return '';
    const host = regions[r.joins].name;
    if (!isConcealed(r)) return ` ${r.name} is part of ${host}'s room: once its gate opens, items move, swap and merge between the two.`;
    return open(i) ? ` More of ${host} has been revealed: items move, swap and merge anywhere in it.` : '';
  });
  const sealed = tasks ? sealedRegion(regions) : -1;
  if (sealed >= 0) {
    const names = (regions[sealed].unlock as TaskUnlock).tasks.map((t) => regions[tasks![t].in].name);
    return 'Marked tiles work by themselves, on the move that puts exactly the items shown on them: they open rune gates, ' +
      `or complete ${listOf(names, 'or')}, in any order. Each one completed lights its symbol on the gate to ` +
      `${regions[sealed].name}, and ${allOf(names.length)} open it.${shared.join('')} Items never leave their own room.`;
  }
  return 'Each rune gate opens by itself on the move that puts exactly the items shown on its room\'s marked tiles' +
    `${stone ? '; a stone must hold the only item left in its room' : ''}.${shared.join('')} Items never leave their own room.`;
}

/** Levels with tasks: the regions that open by task `t` alone. */
function opensBy(regions: readonly Region[], t: number): number[] {
  return regions.flatMap((r, i) => (r.unlock && 'tasks' in r.unlock && r.unlock.tasks.length === 1 && r.unlock.tasks[0] === t ? [i] : []));
}

/**
 * Levels with tasks: the marked tiles task `t` (completing a room) asks for now. Until the room's concealed part is
 * found, that is only the tile that reveals it, so nothing names the concealed part.
 */
export function branchPlates(session: SessionState, t: number): readonly Plate[] {
  const regions = session.level.regions!;
  const tasks = session.level.tasks!;
  const finder = availableTasks(session).find((f) => f !== t && tasks[f].in === tasks[t].in && opensBy(regions, f).some((i) => isConcealed(regions[i])));
  return tasks[finder ?? t].plates;
}

/**
 * Levels with tasks: the next steps. A task opening rune gates comes first; then the tasks completing the rooms that
 * open the sealed region, in any order, named briefly (the checklist shows what each needs; only the last one's need
 * is spelled out here, and a room's concealed part is asked for only by its marked tile); then the task that reveals the
 * treasure, which is then tapped. A discovery, or the sealed region opening, is told once, on the move that did it.
 */
function taskStep(state: UiState): string {
  const { session } = state;
  const { goal } = session.level;
  const regions = session.level.regions!;
  const tasks = session.level.tasks!;
  if (goal.kind !== 'treasure') return '';
  const { name, verb } = prizeText(goal);
  const home = regions[regions.length - 1].name;
  if (treasureRevealed(session)) return `The ${name} is in ${home}. Tap it to ${verb} it.`;
  const available = availableTasks(session);
  const opened = state.lastAction && 'progress' in state.lastAction ? state.lastAction.progress?.regions ?? [] : [];
  if (goal.task !== undefined && available.includes(goal.task)) {
    const { plates } = tasks[goal.task];
    // On the move that opens it, a short line (the case is named on the next); the banner then stays two lines on iPad.
    if (opened.includes(regions.length - 1)) return `${home} is open: put ${plateItems(plates)} on its marked tiles.`;
    return `Put ${taskNeed(regions, tasks[goal.task])} to find the ${name}.`;
  }
  const sealed = sealedRegion(regions);
  const needs = sealed < 0 ? [] : (regions[sealed].unlock as TaskUnlock).tasks;
  const branches = needs.filter((t) => available.includes(t));
  if (branches.length > 0) {
    const found = opened.filter((i) => isConcealed(regions[i]))
      .map((i) => `More of ${regions[regions[i].joins!].name} has been revealed. `).join('');
    const palace = regions[sealed].name;
    if (branches.length === 1) {
      const room = regions[tasks[branches[0]].in].name;
      // On the discovery move the checklist alone shows the new needs, so the banner stays short.
      if (found) return `${found}Complete ${room} to open ${palace}.`;
      const plates = branchPlates(session, branches[0]);
      return `Complete ${room} to open ${palace}: put ${plateItems(plates)} on its marked ${plates.length > 1 ? 'tiles' : 'tile'}.`;
    }
    if (branches.length === needs.length) return `${found}Complete the ${countWord(needs.length)} branches in any order to open ${palace}.`;
    const rooms = listOf(branches.map((t) => regions[tasks[t].in].name));
    return `${found}Complete ${rooms} in ${branches.length === 2 ? 'either' : 'any'} order to open ${palace}.`;
  }
  const t = available.find((a) => opensBy(regions, a).length > 0);
  if (t === undefined) return '';
  const opens = opensBy(regions, t);
  // Gates to every room the sealed region needs: the checklist names them, so the banner just counts them.
  const branchRooms = needs.map((n) => tasks[n].in);
  const to = opens.length > 1 && opens.length === branchRooms.length && opens.every((i) => branchRooms.includes(i))
    ? `all ${countWord(opens.length)} branches` : listOf(opens.map((i) => regions[i].name));
  return `Put ${taskNeed(regions, tasks[t])} to open the rune ${opens.length > 1 ? 'gates' : 'gate'} to ${to}.`;
}

const SYMBOL_NAMES: Record<GateSymbol, string> = { fern: 'fern', crystal: 'crystal', note: 'musical note' };

/**
 * Levels with tasks: the announcement of what a drop's checkpoint did, e.g. " Crystal Glade is complete: its crystal is
 * lit on the gate to Crystal Palace. The rune gate to Crystal Palace opened." (empty when it did nothing). A concealed
 * part of a room is announced as more of that room.
 */
export function progressText(tasksDone: readonly number[], opened: readonly number[], goal: LevelGoal, regions: readonly Region[], tasks: readonly Task[]): string {
  const sealed = sealedRegion(regions);
  const parts = tasksDone.flatMap((t) => {
    const { symbol } = tasks[t];
    if (symbol) return [`${regions[tasks[t].in].name} is complete: its ${SYMBOL_NAMES[symbol]} is lit on the gate to ${regions[sealed].name}.`];
    if (goal.kind === 'treasure' && goal.task === t) return [`A closed ${prizeText(goal).name} appeared in ${regions[regions.length - 1].name}.`];
    return [];
  });
  const shown = opened.filter((i) => !isConcealed(regions[i])).map((i) => regions[i].name);
  for (const i of opened) if (isConcealed(regions[i])) parts.push(`More of ${regions[regions[i].joins!].name} was revealed, with more items to use.`);
  if (shown.length > 0) parts.push(`The rune ${shown.length > 1 ? 'gates' : 'gate'} to ${listOf(shown)} opened.`);
  return parts.map((part) => ` ${part}`).join('');
}

/** Region levels: the next step, from the next unlock to the goal. */
function regionStep(state: UiState): string {
  const { session } = state;
  const { regions, goal } = session.level;
  if (session.level.tasks) return taskStep(state);
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

/** Merge to treasure: what the recipe needs, e.g. "Grove, tier 3 of 5 and Crystal, tier 3 of 5". */
export function recipeNeed(recipe: Recipe): string {
  const parts = recipe.ingredients.map(({ item, count }) => `${count > 1 ? `${count} × ` : ''}${itemLabel(item)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/** Merge to treasure: the goal item (one of it, alone on the board). */
const recipeGoal = (goal: LevelGoal): Item | undefined => (goal.kind === 'leaveOne' ? goal.item : undefined);

/** Merge to treasure: the drop that crafts, e.g. "Drop Grove, tier 3 of 5 onto Crystal, tier 3 of 5, or the other way round". */
const craftDrop = (recipe: Recipe) => {
  const [a, b] = recipe.ingredients.map((i) => itemLabel(i.item));
  return `Drop ${a} onto ${b}, or the other way round`;
};

/** Merge to treasure: the next step, by stage. */
function recipeStep(state: UiState, recipe: Recipe): string {
  const { session } = state;
  const goal = recipeGoal(session.level.goal)!;
  const contents = recipe.contents;
  if (session.chest) {
    return contentCells(session) ? `Tap the ${recipe.name} to open it.`
      : `The ${recipe.name} needs ${contents.count - 1} empty cells to open. Merge items to make room.`;
  }
  if (session.opened) {
    return goal.tier === contents.item.tier + 1 ? `Merge the three ${itemLabel(contents.item)} into ${itemLabel(goal)}.`
      : `Merge everything into one ${itemLabel(goal)}.`;
  }
  if (craftReady(session)) return `${craftDrop(recipe)}, to craft the ${recipe.name}. Only those two are used.`;
  return `Merge pieces into ${recipeNeed(recipe)}, then drop one onto the other to craft the ${recipe.name}.`;
}

/** Merge to treasure: the help dialog's objective. */
export function recipeHelp(recipe: Recipe, goal: LevelGoal): string {
  const item = recipeGoal(goal);
  return `Goal: make ${item ? itemLabel(item) : 'the goal item'} with the ${recipe.name}, with nothing else left. Merge ` +
    `pieces into ${recipeNeed(recipe)}. ${craftDrop(recipe)} (or tap one, then the other), to craft the chest: only those ` +
    `two are used. Tap the chest to open it: ${contents(recipe)} come out. Opening the chest can't be undone.`;
}

const contents = (recipe: Recipe) => `three ${itemLabel(recipe.contents.item)}`;

/** `pannable`: the board overflows its viewport; defaults to the size-based guess. */
export function statusMessage(state: UiState, pannable = isLargeBoard(state.session.board)): string {
  const { goal, regions, recipe } = state.session.level;
  if (state.status === 'playing') {
    if (regions) return pannable ? `${regionStep(state)} ${PAN_HINT}` : regionStep(state);
    if (recipe) return pannable ? `${recipeStep(state, recipe)} ${PAN_HINT}` : recipeStep(state, recipe);
    return pannable ? LARGE_BOARD_HINT : playingMessage(goal, state.session.level.supply.length > 0);
  }
  if (state.status === 'won') {
    if (goal.kind === 'treasure') return prizeText(goal).won;
    if (goal.kind === 'items') return `Goal complete! You made ${allOf(goal.items.length)}.`;
    if (goal.kind === 'item') return `Goal complete! You made ${itemLabel(goal.item)}${goalPlace(goal, regions)}.`;
    if (recipe) return `Goal complete! You made ${itemLabel(recipeGoal(goal)!)} with the ${recipe.name}.`;
    const last = state.session.board.flat().find((c) => c !== null);
    return last ? `Goal complete! Only ${itemLabel(last)} remains.` : 'Goal complete!';
  }
  if (regions) return REGION_STUCK_MESSAGE;
  if (state.session.level.earlyLoss === false) return state.session.chest ? NO_ROOM_MESSAGE : NO_MERGES_MESSAGE;
  if (goal.kind === 'items') return 'A goal item can no longer be made. Undo or retry.';
  if (goal.kind === 'item') {
    return `The goal is out of reach with the ${FAMILY_NAMES[goal.item.family]} items left. Undo or retry.`;
  }
  return 'You can no longer finish with exactly one item. Undo or retry.';
}
