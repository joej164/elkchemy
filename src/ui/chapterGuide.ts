import type { Tier } from '../board';
import { itemTasks } from '../regions';
import { trapped } from '../session';
import { canMoveAlisha, talkShown, type UiState } from './controller';
import { itemLabel } from './ItemArt';
import { statusMessage, taskNeed } from './messages';

/** Party levels: while a speech bubble shows, who is talking and how to go on. */
export function talkPrompt(state: UiState): string | null {
  const line = talkShown(state);
  return line ? `${line.who === 'alisha' ? 'Alisha' : 'Fiona'} has something to say. Tap her speech bubble to continue.` : null;
}

/** Party levels: once Alisha can stand on her plate, how to put her there. */
export function alishaPrompt(state: UiState): string | null {
  if (!canMoveAlisha(state)) return null;
  return state.alishaSelected ? 'Now tap the glowing plate to stand Alisha on it.'
    : 'Drag Alisha onto the glowing plate, or tap her, then the plate.';
}

/**
 * Chapter 1 room levels' banner: whoever is talking, then Alisha's plate, then the room steps (statusMessage), except that
 * a task named in `phrases` (by index) says what doing it is for, in the level's own words, so a hidden room is never
 * named before it is found (e.g. "to clear the fallen branches").
 */
export function chapterGuide(phrases: Readonly<Record<number, string>> = {}): (state: UiState) => string {
  return (state) => {
    if (state.status !== 'playing') return statusMessage(state, false);
    const talk = talkPrompt(state) ?? alishaPrompt(state);
    if (talk) return talk;
    const { session } = state;
    const tasks = session.level.tasks!;
    const t = itemTasks(session).find((i) => phrases[i] !== undefined);
    if (t !== undefined) return `Put ${taskNeed(session.level.regions!, tasks[t])} ${phrases[t]}.`;
    if (trapped(session)) return `Alisha is shut in. ${statusMessage(state, false)}`;
    return statusMessage(state, false);
  };
}

const grove = (tier: Tier) => itemLabel({ family: 'grove', tier });

/**
 * Meet Fiona's banner: the three-merge refresher, then the five-merge lesson, one step at a time. Two three-merges leave
 * too few for the goal, reported at once, so the banner explains it and asks for Undo.
 */
export function meetFionaGuide(state: UiState): string {
  const count = (tier: number) => state.session.board.flat().filter((c) => c?.family === 'grove' && c.tier === tier).length;
  if (state.status === 'won') return `Goal complete! You made ${grove(2)}, and the way through the woods is clear.`;
  if (state.status === 'lost') {
    return `Three made just one, so too few are left. Undo, then gather four ${grove(0)} together and drop the fifth onto them: `
      + 'five make two!';
  }
  const [one, two] = [count(0), count(1)];
  if (two >= 3) return `Now merge the three ${grove(1)} into ${grove(2)}.`;
  if (one === 8) return `Drop a ${grove(0)} onto two that touch: three make one ${grove(1)}.`;
  if (one === 5) return `Now try five: gather four ${grove(0)} together, then drop the fifth onto them. Five make two!`;
  if (one === 3 && two === 2) return `Five made two! Merge the last three ${grove(0)} for one more.`;
  return statusMessage(state, false);
}
