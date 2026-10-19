import { openedRegion, type UiState } from './controller';
import { viewCue } from './camera';

import type { EffectCue } from '../effects';

/** One sound per successful action; presentation and selection never create gameplay events. */
export function actionEffect(state: UiState): EffectCue | null {
  const action = state.lastAction;
  if (!action || action.kind === 'undo' || action.kind === 'retry') return null;
  if (action.kind === 'collect') return 'case-victory';
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
