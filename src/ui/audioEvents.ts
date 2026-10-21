import { openedRegion, type UiState } from './controller';
import { viewCue } from './camera';

import type { EffectCue } from '../effects';

/** One sound per successful action; presentation and selection never create gameplay events. */
export function actionEffect(state: UiState): EffectCue | null {
  const action = state.lastAction;
  if (!action || action.kind === 'undo' || action.kind === 'retry') return null;
  // Room levels' treasure and the attic's Picture Book: opening the prize is the win.
  if (action.kind === 'collect' || action.kind === 'openGoal') return 'case-victory';
  // Merge to treasure: crafting and opening are steps, not the win (which is the final merge's own sound). The attic's
  // crafting (the Picture Book, still to be opened) is a step too.
  if (action.kind === 'craft') return 'completion';
  if (action.kind === 'open') return 'discovery';
  // Container levels (the attic): opening a container, or uncovering one, is a discovery.
  if (action.kind === 'unpack' || ('revealed' in action && action.revealed !== undefined)) return 'discovery';
  const progress = 'progress' in action ? action.progress : undefined;
  const opened = openedRegion(action);
  const regions = progress?.regions ?? (opened === null ? [] : [opened]);
  if (regions.some((i) => {
    const r = state.session.level.regions?.[i];
    return r?.hidden && r.joins !== undefined;
  })) return 'discovery';
  if (regions.length || progress?.tasks.length) return 'completion';
  if (action.kind === 'merge') return action.consumed === 5 ? 'merge-five' : 'merge-three';
  return null;
}

/** This action's completion sound belongs to the board's visible opening callback. */
export function palaceOpeningPending(state: UiState): boolean {
  return viewCue(state)?.kind === 'palace';
}

/**
 * Calls `recover` for user gestures of the kinds browsers accept for starting audio, in the capture phase, so it runs
 * before the gesture's own handlers (a drop, and the cue it plays):
 * - pointerup, from any pointer. For touch it comes before the drop, which may remove the touched item.
 * - touchend, iOS Safari's usual audio-unlock event, kept in case Safari ignores pointerup. It goes to the element the
 *   touch began on, and once a drop has removed that element it never reaches the window, so it is heard there.
 * - keydown.
 * `again` is true for a later event of the same press (touchend after pointerup): resume may be asked for again, but
 * nothing may be cancelled, as the gesture's own cue may have started. Returns the cleanup.
 */
export function onAudioGesture(target: EventTarget, recover: (again: boolean) => void): () => void {
  let called = false;
  let touched: EventTarget | null = null;
  const end = () => { recover(called); called = true; };
  const untrack = () => { touched?.removeEventListener('touchend', end); touched = null; };
  const begin = () => { called = false; };
  const touchstart = (e: Event) => {
    begin();
    untrack();
    touched = e.target;
    touched?.addEventListener('touchend', end, { once: true, passive: true });
  };
  const listeners: [string, (e: Event) => void][] = [
    ['pointerdown', begin], ['touchstart', touchstart], ['pointerup', end], ['keydown', () => recover(false)],
  ];
  for (const [type, listener] of listeners) target.addEventListener(type, listener, { capture: true, passive: true });
  return () => {
    untrack();
    for (const [type, listener] of listeners) target.removeEventListener(type, listener, { capture: true });
  };
}
