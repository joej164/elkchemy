import { availableTasks, type TaskUnlock } from '../regions';
import { bubbleOpen, plateRevealed, type UiState } from './controller';
import { statusMessage, taskNeed } from './messages';

/** What Alisha says, in her speech bubble, once her plate is revealed. */
export const ALISHA_LINE = 'I can stand on that plate.';

/**
 * The palace entrance prototype's banner: the room steps as in other levels with tasks (statusMessage), except that the
 * task revealing the forecourt never names it, then Alisha's bubble and her plate, then the open entrance.
 */
export function entranceGuide(state: UiState): string {
  const { session } = state;
  if (state.status === 'won') return 'The palace entrance is open!';
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
