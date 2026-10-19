import { describe, expect, it } from 'vitest';
import { CACHE_LEVEL, HOLLOW_LEVEL, RUNE_LEVEL } from '../src/levels';
import { direct, GLOW_MS, OPEN_MS, palaceShots, viewCue, type Frames, type Phase, type View } from '../src/ui/camera';
import { initUi, reduceUi, type UiAction, type UiState } from '../src/ui/controller';
import type { Point } from '../src/ui/navigation';

/** Animation frames on a fake clock, about 60 a second. */
function fakeFrames() {
  let now = 0;
  let id = 0;
  const queue = new Map<number, (now: number) => void>();
  const frames: Frames = {
    request: (cb) => { queue.set(++id, cb); return id; },
    cancel: (n) => { queue.delete(n); },
    now: () => now,
  };
  const advance = (ms: number) => {
    const end = now + ms;
    while (now < end) {
      now = Math.min(end, now + 16);
      const due = [...queue.values()];
      queue.clear();
      due.forEach((cb) => cb(now));
    }
  };
  return { frames, advance, pending: () => queue.size, time: () => now };
}

/** A viewport whose scroll range is [0, 1000] on both axes; it records every position the camera writes. */
function fakeView() {
  let at: Point = { x: 0, y: 0 };
  const writes: Point[] = [];
  const view: View = {
    read: () => at,
    write: (to) => {
      at = { x: Math.min(1000, Math.max(0, to.x)), y: Math.min(1000, Math.max(0, to.y)) };
      writes.push(at);
      return at;
    },
  };
  return { view, writes, at: () => at, scrollTo: (p: Point) => { at = p; } };
}

const GATE: Point = { x: 600, y: 300 };
const INSIDE: Point = { x: 0, y: 0 };

/** A palace opening, recording when each stage is shown and where the view is then. */
function palace(instant: boolean) {
  const clock = fakeFrames();
  const v = fakeView();
  v.scrollTo({ x: 1000, y: 700 });
  const shown: { phase: Phase | null; t: number; at: Point }[] = [];
  let interrupted = 0;
  const shots = palaceShots(instant, () => GATE, () => INSIDE, (phase) => shown.push({ phase, t: clock.time(), at: v.at() }));
  const camera = direct(shots, v.view, clock.frames, instant, () => { interrupted++; });
  return { clock, v, shown, camera, interrupted: () => interrupted };
}

describe('Automatic camera moves', () => {
  it('pans smoothly: the view passes through many positions on the way, never back, and stops exactly on the target', () => {
    const clock = fakeFrames();
    const v = fakeView();
    const camera = direct([{ pan: () => ({ x: 800, y: 400 }) }], v.view, clock.frames, false, () => {});
    clock.advance(1000);
    const xs = v.writes.map((p) => p.x);
    const between = xs.filter((x) => x > 0 && x < 800);
    expect(between.length).toBeGreaterThan(10);               // not a jump
    xs.slice(1).forEach((x, k) => expect(x).toBeGreaterThanOrEqual(xs[k]));
    expect(v.at()).toEqual({ x: 800, y: 400 });
    expect([camera.playing(), clock.pending()]).toEqual([false, 0]);
  });

  it('a long pan stays brief: it arrives within 0.7 seconds', () => {
    const clock = fakeFrames();
    const v = fakeView();
    direct([{ pan: () => ({ x: 1000, y: 1000 }) }], v.view, clock.frames, false, () => {});
    clock.advance(704);
    expect(v.at()).toEqual({ x: 1000, y: 1000 });
  });

  it('stopped mid-pan (a new action, Retry or leaving the level), it moves and shows nothing more, however long', () => {
    const { clock, v, shown, camera } = palace(false);
    clock.advance(200);
    const at = v.at();
    camera.stop();
    const writes = v.writes.length;
    clock.advance(10_000);
    expect([v.writes.length, v.at(), clock.pending(), camera.playing()]).toEqual([writes, at, 0, false]);
    expect(shown.map((s) => s.phase)).toEqual(['travel']);
  });

  it('when the player pans meanwhile, it stops where the player left the view, without snapping back, and says so once', () => {
    const { clock, v, shown, interrupted } = palace(false);
    clock.advance(200);
    v.scrollTo({ x: 900, y: 650 });                          // a drag, a scrollbar or a focus scroll
    const writes = v.writes.length;
    clock.advance(10_000);
    expect([v.writes.length, v.at(), interrupted(), clock.pending()]).toEqual([writes, { x: 900, y: 650 }, 1, 0]);
    expect(shown.map((s) => s.phase)).toEqual(['travel']);   // the board then shows the open palace (see Board)
  });
});

describe('The palace opening', () => {
  it('reaches the gate, lets the lit symbols glow, opens the gate, then moves on to the palace: in about two seconds', () => {
    const { clock, v, shown, interrupted } = palace(false);
    expect(shown).toEqual([{ phase: 'travel', t: 0, at: { x: 1000, y: 700 } }]);   // at once: the gate is drawn closed
    clock.advance(5000);
    const [travel, glow, opening, done] = shown;
    expect(shown.map((s) => s.phase)).toEqual(['travel', 'glow', 'opening', null]);
    expect(glow.at).toEqual(GATE);                            // the symbols glow only once the gate is in view
    expect(opening.t - glow.t).toBeGreaterThanOrEqual(GLOW_MS);
    expect(opening.at).toEqual(GATE);                          // and the gate opens there
    expect(done.t - opening.t).toBeGreaterThanOrEqual(OPEN_MS); // the view moves on only after the gate has opened
    expect(done.at).toEqual(INSIDE);
    expect(v.at()).toEqual(INSIDE);
    expect(done.t - travel.t).toBeLessThan(3000);
    expect(interrupted()).toBe(0);
  });

  it('under reduced motion, shows no stages (the open gate throughout) and jumps once to where the opening ends', () => {
    const { clock, v, shown } = palace(true);
    expect([shown, v.at(), clock.pending()]).toEqual([[], INSIDE, 0]);
  });

  it('stopped while the symbols glow, it never opens the gate or moves on later', () => {
    const { clock, v, shown, camera } = palace(false);
    clock.advance(800);
    expect(shown.map((s) => s.phase)).toEqual(['travel', 'glow']);
    camera.stop();
    clock.advance(10_000);
    expect(shown.map((s) => s.phase)).toEqual(['travel', 'glow']);
    expect(v.at()).toEqual(GATE);
  });
});

describe('Camera cues in earlier levels', () => {
  const run = (s: UiState, ...actions: UiAction[]) => actions.reduce(reduceUi, s);
  const drop = (a: number, b: number, c: number, d: number): UiAction => ({ type: 'drop', from: { row: a, col: b }, to: { row: c, col: d } });

  it('pans to each region a gate or Unlock opens, and to the start on Retry, as before', () => {
    expect(viewCue({ ...initUi(HOLLOW_LEVEL), lastAction: { kind: 'unlock', region: 1 } })).toEqual({ kind: 'region', region: 1 });
    let rune = run(initUi(RUNE_LEVEL), drop(1, 2, 0, 1), drop(0, 1, 0, 2), drop(2, 1, 2, 0));
    expect(viewCue(rune)).toBeNull();
    rune = run(rune, drop(2, 0, 2, 2));
    expect(viewCue(rune)).toEqual({ kind: 'region', region: 1 });
    let cache = run(initUi(CACHE_LEVEL), drop(1, 2, 0, 1), drop(0, 1, 0, 3));
    expect(viewCue(cache)).toEqual({ kind: 'region', region: 1 });
    cache = run(cache, drop(0, 5, 2, 0), drop(2, 0, 2, 5), drop(2, 5, 3, 2));
    expect(viewCue(cache)).toEqual({ kind: 'region', region: 2 });
    expect(viewCue(run(cache, { type: 'retry' }))).toEqual({ kind: 'start' });
  });
});
