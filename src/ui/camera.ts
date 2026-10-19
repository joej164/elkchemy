import type { Pos } from '../board';
import { sealedRegion, type TaskUnlock } from '../regions';
import { openedRegion, type UiState } from './controller';
import type { Point } from './navigation';

/**
 * What the board's view does after the last action:
 * - `start`: Retry returns to the first region, at once;
 * - `region`: a region the action opened is brought into view;
 * - `palace` (levels with tasks): the action opened the sealed region (the Crystal Palace), so the view goes to its gate
 *   while its symbols glow and it opens, then to the region.
 * An action that opens several regions together (level 9's branches) moves nothing, so there is never more than one cue.
 */
export type Cue =
  | { readonly kind: 'start' }
  | { readonly kind: 'region'; readonly region: number }
  | { readonly kind: 'palace'; readonly region: number; readonly gate: Pos };

export function viewCue(state: UiState): Cue | null {
  const a = state.lastAction;
  const { regions, tasks } = state.session.level;
  if (!a || !regions) return null;
  if (a.kind === 'retry') return { kind: 'start' };
  const sealed = tasks ? sealedRegion(regions) : -1;
  const gate = sealed !== -1 ? (regions[sealed].unlock as TaskUnlock).passage : undefined;
  if (gate && 'progress' in a && a.progress?.regions.includes(sealed)) return { kind: 'palace', region: sealed, gate };
  const opened = openedRegion(a);
  return opened === null ? null : { kind: 'region', region: opened };
}

/** The palace opening's stages, while it plays: the view on its way to the gate, the symbols glowing, the gate opening. */
export type Phase = 'travel' | 'glow' | 'opening';

/** How long the lit symbols glow once the view reaches the gate, and how long the gate takes to open. */
export const GLOW_MS = 800;
export const OPEN_MS = 600;

/** An automatic pan's length: longer for longer distances, from 250ms to 700ms. */
export function panMs(distance: number): number {
  return Math.round(Math.min(700, 250 + distance / 2));
}

/** Ease in and out (cubic): starts and stops gently. */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * One step of a camera move: pan to a scroll offset (worked out when the step starts, from the layout then; null
 * stays put), hold for a time, or run a callback.
 */
export type Shot = { readonly pan: () => Point | null } | { readonly hold: number } | { readonly then: () => void };

/** The board viewport's scroll offset. `write` returns where the browser actually put it (it clamps). */
export interface View { read(): Point; write(to: Point): Point }

/** Animation frames, as `requestAnimationFrame` gives them. */
export interface Frames { request(cb: (now: number) => void): number; cancel(id: number): void; now(): number }

export interface Camera { stop(): void; playing(): boolean }

/**
 * Plays `shots` in order: pans ease over `panMs`, holds wait, callbacks run. `instant` (reduced motion, or Retry) plays
 * everything at once: pans jump, holds are skipped. If anything else moves the view meanwhile (a scrollbar, a focus
 * scroll), the camera stops where the view is and calls `interrupted`. `stop` cancels it: nothing further happens.
 */
export function direct(shots: readonly Shot[], view: View, frames: Frames, instant: boolean, interrupted: () => void): Camera {
  let live = true;
  let frame = 0;
  let i = 0;
  let step: { start: number; ms: number; from?: Point; to?: Point } | null = null;
  let last = view.read();
  const tick = (now: number) => {
    if (!live) return;
    const at = view.read();
    if (Math.abs(at.x - last.x) > 1 || Math.abs(at.y - last.y) > 1) {
      live = false;
      interrupted();
      return;
    }
    while (i < shots.length) {
      if (!step) {
        const shot = shots[i];
        if ('then' in shot) {
          i++;
          shot.then();
          if (!live) return;
          continue;
        }
        if ('hold' in shot) {
          if (instant) { i++; continue; }
          step = { start: now, ms: shot.hold };
        } else {
          const to = shot.pan();
          const from = view.read();
          const distance = to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
          if (!to || distance < 1) { i++; continue; }
          if (instant) { last = view.write(to); i++; continue; }
          step = { start: now, ms: panMs(distance), from, to };
        }
      }
      const t = Math.min(1, Math.max(0, (now - step.start) / step.ms));
      const { from, to } = step;
      if (from && to) {
        const k = ease(t);
        last = view.write({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
      }
      if (t < 1) {
        frame = frames.request(tick);
        return;
      }
      step = null;
      i++;
    }
    live = false;
  };
  tick(frames.now());
  return {
    stop: () => {
      live = false;
      frames.cancel(frame);
    },
    playing: () => live,
  };
}

/**
 * The palace opening: the view goes to the gate (`gate` works out where) while the gate still looks closed, the lit
 * symbols glow, the gate opens, and the view moves on to the region (`inside`) if it needs to. `show` sets the stage
 * the board draws (null: the session as it is). `instant` (reduced motion) only moves the view, at once, to where the
 * opening ends, and shows no stages: the board draws the open gate and its lit symbols throughout.
 */
export function palaceShots(instant: boolean, gate: () => Point | null, inside: () => Point | null,
  show: (phase: Phase | null) => void): Shot[] {
  if (instant) return [{ pan: gate }, { pan: inside }];
  return [
    { then: () => show('travel') },
    { pan: gate },
    { then: () => show('glow') },
    { hold: GLOW_MS },
    { then: () => show('opening') },
    { hold: OPEN_MS },
    { pan: inside },
    { then: () => show(null) },
  ];
}
