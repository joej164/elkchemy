import { availableTasks, type TaskUnlock } from '../regions';
import { bubbleOpen, plateRevealed, storyDue, type UiState } from './controller';
import { statusMessage, taskNeed, workshopHint } from './messages';

/** What Alisha says, in her speech bubble, once her plate is revealed (the entrance's talk). */
export { ALISHA_LINE } from '../entrance';

/**
 * The palace entrance prototype's banner: the room steps as in other levels with tasks (statusMessage), except that the
 * task revealing the forecourt never names it, then the way clear (until the forecourt's story scene is read), Alisha's
 * bubble and her plate, then the open entrance.
 */
export function entranceGuide(state: UiState): string {
  const { session } = state;
  if (state.status === 'won') return 'The palace entrance is open!';
  if (state.status === 'lost') return statusMessage(state, false);
  // The forecourt's story scene (C1-08B) comes before Alisha speaks.
  if (plateRevealed(state) && storyDue(state) !== null) return 'The way north is clear.';
  if (bubbleOpen(state)) return 'Alisha has something to say. Tap her speech bubble to continue.';
  if (plateRevealed(state)) {
    return state.alishaSelected ? 'Now tap the glowing plate to stand Alisha on it.'
      : 'Drag Alisha onto the glowing plate, or tap her, then the plate.';
  }
  const regions = session.level.regions!;
  const tasks = session.level.tasks!;
  const last = regions.length - 1;
  const reveal = availableTasks(session).find((t) => (regions[last].unlock as TaskUnlock).tasks.includes(t));
  if (reveal !== undefined) return `Put ${taskNeed(regions, tasks[reveal])} to clear the way north.`;
  return statusMessage(state, false);
}

/** How long the palace entrance takes to open on the board (the plate sinks, then the doors swing), in app.css. */
export const ENTRANCE_OPENING_MS = 1500;

/**
 * Once the last action stood Alisha on her plate (`stand`), calls `ready` when the entrance has opened on the board, so
 * Enter the palace is offered only then. A timer, so it never waits on animation events. Returns the cancel, for the
 * next action (Retry) or leaving, after which it never calls `ready`; undefined for any other action.
 */
export function afterEntranceOpening(state: UiState, ready: () => void, ms = ENTRANCE_OPENING_MS): (() => void) | undefined {
  if (state.lastAction?.kind !== 'stand') return undefined;
  const timer = setTimeout(ready, ms);
  return () => clearTimeout(timer);
}

/**
 * How long a story scene waits after the move that makes it due, the board paused, so the board first shows what that
 * move did (the item on its marked tile, now fixed; Alisha on her plate) while the discovery cue plays (see actionEffect).
 * The regions it opened stay as they were until the scene has been read (see storyHeld); then they open on the board. The
 * same under reduced motion: the pause is for seeing the move, not for animation.
 */
export const STORY_DELAY_MS = 1500;

/**
 * A level whose win leads straight into its ending (Beyond the gate: Alisha stepping onto her plate beside the dog): once
 * the last action won, calls `done` after `ms`, the same pause as before a story scene. A timer, as above. Returns the
 * cancel, for the next action (Retry) or leaving, after which it never calls `done`; undefined unless just won.
 */
export function afterWinScene(state: UiState, done: () => void, ms = STORY_DELAY_MS): (() => void) | undefined {
  if (state.status !== 'won') return undefined;
  const timer = setTimeout(done, ms);
  return () => clearTimeout(timer);
}

/**
 * While a story scene is due (storyDue), calls `ready` after `ms`, for the scene to be shown then. A timer, as for the
 * entrance opening. Returns the cancel, for the next action (Retry), reading it or leaving, after which it never calls
 * `ready`; undefined when none is due.
 */
export function afterStoryDue(state: UiState, ready: () => void, ms = STORY_DELAY_MS): (() => void) | undefined {
  if (storyDue(state) === null) return undefined;
  const timer = setTimeout(ready, ms);
  return () => clearTimeout(timer);
}

/**
 * How long the player may go without progress on a workshop's recipe (see workshopProgress) before its hint shows (see
 * workshopHint): long enough to try things, short enough to help before giving up.
 */
export const RECIPE_HINT_MS = 30_000;

/**
 * While a workshop's hint could apply (see workshopHint), calls `ready` after `ms` without progress, for the hint to be
 * shown then. A timer, as above. Returns the cancel, for progress, Retry, a pause for talk or a scene, or leaving, after
 * which it never calls `ready`; undefined when no hint applies.
 */
export function afterRecipeIdle(state: UiState, ready: () => void, ms = RECIPE_HINT_MS): (() => void) | undefined {
  if (workshopHint(state) === null) return undefined;
  const timer = setTimeout(ready, ms);
  return () => clearTimeout(timer);
}
