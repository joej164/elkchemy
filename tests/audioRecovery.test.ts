import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '../src/effects';
import { BackgroundMusic, PUZZLE_MUSIC, WOODLAND_MUSIC } from '../src/music';
import { onAudioGesture } from '../src/ui/audioEvents';

// Simulated interruptions: a context the device suspended (or Safari's "interrupted") while the page stays visible.
// This exercises the recovery logic only; it does not show what a physical iPad does.
type State = 'suspended' | 'running' | 'closed' | 'interrupted';
interface Voice { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }
interface FakeContext {
  state: State; voices: Voice[];
  resume: ReturnType<typeof vi.fn>; suspend: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>;
}

let contexts: FakeContext[];
let fetcher: ReturnType<typeof vi.fn>;
const response = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
const gain = () => ({
  gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
  connect: vi.fn(), disconnect: vi.fn(),
});

beforeEach(() => {
  contexts = [];
  vi.stubGlobal('AudioContext', vi.fn(function () {
    const c: FakeContext & Record<string, unknown> = {
      state: 'suspended', voices: [], destination: {}, currentTime: 0,
      resume: vi.fn(async () => { if (c.state !== 'closed') c.state = 'running'; }),
      suspend: vi.fn(async () => { if (c.state !== 'closed') c.state = 'suspended'; }),
      close: vi.fn(async () => { c.state = 'closed'; }),
      createGain: gain,
      decodeAudioData: async () => ({ duration: 1 }),
      createBufferSource: () => {
        const v = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), onended: null, loop: false };
        c.voices.push(v);
        return v;
      },
    };
    contexts.push(c);
    return c;
  }));
  fetcher = vi.fn(async () => response());
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => vi.unstubAllGlobals());

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The window and one board item's art, with DOM event dispatch reduced to what matters here: the window's capture
 * listeners run first, and only while the target is in the document; a removed element still hears its own events.
 */
function page() {
  const win = new EventTarget();
  const art = new EventTarget();
  let attached = true;
  const fire = (type: string, props: Record<string, unknown> = {}) => {
    const at = () => Object.defineProperty(Object.assign(new Event(type), props), 'target', { value: art });
    if (attached) win.dispatchEvent(at());
    art.dispatchEvent(at());
  };
  const touch = { pointerType: 'touch' };
  return {
    win, art, fire,
    remove: () => { attached = false; },
    restore: () => { attached = true; },
    /** A touch press: pointerdown, touchstart, then `during` (a drop, in the board's pointerup), pointerup, touchend. */
    touchPress(during?: () => void) {
      fire('pointerdown', touch);
      fire('touchstart');
      if (during) art.addEventListener('pointerup', during, { once: true });
      fire('pointerup', touch);
      fire('touchend');
    },
  };
}

describe('gestures that may resume audio', () => {
  it('pointerup from any pointer and keydown recover; a touch\'s touchend only asks again, even once its item is gone', () => {
    const { win, fire, remove, restore, touchPress } = page();
    const recover = vi.fn<(again: boolean) => void>();
    const stop = onAudioGesture(win, recover);
    touchPress();
    expect(recover.mock.calls).toEqual([[false], [true]]);   // pointerup, then touchend
    recover.mockClear();
    touchPress(remove);                                        // the drop removes the touched item
    expect(recover.mock.calls).toEqual([[false], [true]]);   // touchend still heard, on the removed element
    recover.mockClear();
    restore();
    for (const pointerType of ['mouse', 'pen']) { fire('pointerdown', { pointerType }); fire('pointerup', { pointerType }); }
    fire('keydown');
    fire('keydown');
    expect(recover.mock.calls).toEqual([[false], [false], [false], [false]]);
    recover.mockClear();
    fire('touchstart');
    fire('touchend');                                          // no pointerup (e.g. cancelled): touchend recovers
    expect(recover.mock.calls).toEqual([[false]]);
    recover.mockClear();
    fire('touchstart');
    stop();
    touchPress();
    fire('keydown');
    expect(recover).not.toHaveBeenCalled();                    // cleanup also forgets the touched element
  });

  it('before this fix, a touch drop that removed its item left recovery to a touchend the window never heard', () => {
    const { win, art, fire, remove } = page();
    const recover = vi.fn();
    // The previous wiring: pointerup only for mouse and pen, touchend on the window.
    const pointer = (e: Event) => { if ((e as PointerEvent).pointerType !== 'touch') recover(); };
    win.addEventListener('pointerup', pointer, { capture: true });
    win.addEventListener('touchend', recover, { capture: true });
    fire('touchstart');
    art.addEventListener('pointerup', remove, { once: true });
    fire('pointerup', { pointerType: 'touch' });
    fire('touchend');
    expect(recover).not.toHaveBeenCalled();
  });
});

describe('a touch drag whose drop removes the touched item', () => {
  let music: BackgroundMusic;
  let effects: SoundEffects;
  let stops: (() => void)[];
  let dom: ReturnType<typeof page>;
  beforeEach(async () => {
    music = new BackgroundMusic(() => {});
    effects = new SoundEffects(() => {});
    dom = page();
    stops = [onAudioGesture(dom.win, () => music.recover()), onAudioGesture(dom.win, (again) => effects.recover(again))];
    await music.setEnabled(true);
    await effects.setEnabled(true);
  });
  afterEach(() => { stops.forEach((stop) => stop()); music.dispose(); effects.dispose(); });

  /** Both contexts stopped by the device; resume then takes a while, as on a real device. Returns its completion. */
  function interrupt() {
    const pending: (() => void)[] = [];
    for (const c of contexts) {
      c.state = 'suspended';
      c.resume.mockImplementation(() => new Promise<void>((done) => pending.push(() => { c.state = 'running'; done(); })));
    }
    return () => pending.splice(0).forEach((finish) => finish());
  }
  const effectVoices = () => contexts[1].voices;
  // The board's drop: it removes the touched item and plays the merge cue (React's effect, after the drop).
  const drop = () => { dom.remove(); effects.play('merge-three'); };

  it.each([['cached', true], ['still loading', false]] as const)(
    'recovers both before the drop; a later touchend cannot cancel its cue (%s)', async (_name, cached) => {
      if (cached) { effects.play('merge-three'); await flush(); }
      const warm = effectVoices().length;
      const resumed = interrupt();
      let finish!: (value: ReturnType<typeof response>) => void;
      if (!cached) fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
      effects.play('discovery');                                 // a cue from while audio was stopped
      await flush();
      const stale = effectVoices().slice(warm);
      dom.fire('pointerdown', { pointerType: 'touch' });
      dom.fire('touchstart');
      dom.art.addEventListener('pointerup', drop, { once: true });
      dom.fire('pointerup', { pointerType: 'touch' });
      expect(contexts.map((c) => c.resume.mock.calls.length)).toEqual([2, 2]); // asked within pointerup, before the drop
      stale.forEach((v) => expect(v.stop).toHaveBeenCalledOnce());
      await flush();
      if (!cached) finish(response());
      await flush();
      const fresh = effectVoices()[effectVoices().length - 1];
      expect(stale).not.toContain(fresh);
      dom.fire('touchend');                                      // on the removed item; the resume is still pending
      expect(contexts.map((c) => c.resume.mock.calls.length)).toEqual([3, 3]); // asked again (Safari's unlock event)
      resumed();
      await flush();
      expect(contexts.map((c) => c.state)).toEqual(['running', 'running']);
      expect(fresh.stop).not.toHaveBeenCalled();                  // the drop's own cue plays
      expect(effectVoices()).toHaveLength(warm + stale.length + 1);
      expect(contexts[0].voices).toHaveLength(1);                 // the same music loop, never restarted
    });

  it('a new touch cancels cues left from an earlier one whose resume never completed', async () => {
    interrupt();
    dom.touchPress(drop);
    await flush();
    const first = effectVoices()[effectVoices().length - 1];
    expect(first.stop).not.toHaveBeenCalled();
    const next = page();
    stops.push(onAudioGesture(next.win, (again) => effects.recover(again)));
    next.touchPress();                                         // still stopped: that cue was never heard
    expect(first.stop).toHaveBeenCalledOnce();
  });
});

describe('music recovery', () => {
  let music: BackgroundMusic;
  beforeEach(() => { music = new BackgroundMusic(() => {}); });
  afterEach(() => music.dispose());

  it.each<State>(['suspended', 'interrupted'])('resumes a %s context on a gesture, also when the next level keeps the track', async (state) => {
    await music.setEnabled(true);
    const [c] = contexts;
    expect([c.state, c.voices.length, c.resume.mock.calls.length]).toEqual(['running', 1, 1]);
    c.state = state;
    music.setTrack(WOODLAND_MUSIC);                  // same track: nothing to restart
    expect(c.resume).toHaveBeenCalledTimes(1);
    music.recover();
    expect(c.resume).toHaveBeenCalledTimes(2);       // synchronously, inside the gesture
    await flush();
    expect([c.state, c.voices.length, fetcher.mock.calls.length]).toEqual(['running', 1, 1]); // the same loop
    music.recover();
    expect(c.resume).toHaveBeenCalledTimes(2);       // running: no further calls
    expect(music.enabled).toBe(true);
  });

  it('never creates audio, unmutes or resumes while off, muted or hidden', async () => {
    music.recover();
    expect(contexts).toHaveLength(0);
    await music.setEnabled(true);
    await music.setEnabled(false);                   // mute suspends the context
    const [c] = contexts;
    music.recover();
    expect([c.state, c.resume.mock.calls.length, music.enabled]).toEqual(['suspended', 1, false]);
    await music.setEnabled(true);
    music.setVisible(false);
    music.recover();
    expect([c.state, c.resume.mock.calls.length]).toEqual(['suspended', 2]);
  });

  it('a gesture during a delayed load resumes the context; only the current track then starts', async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    await music.setEnabled(true);
    const [c] = contexts;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    music.setTrack(PUZZLE_MUSIC);
    await flush();
    c.state = 'suspended';
    music.recover();
    finish(response());
    await flush();
    expect(c.state).toBe('running');
    expect(c.voices).toHaveLength(2);
    expect(c.voices[0].stop).toHaveBeenCalled();     // crossfaded out
  });

  it('ignores a rejected resume without an unhandled promise or an error state', async () => {
    const changes: boolean[] = [];
    music.dispose();
    music = new BackgroundMusic((s) => changes.push(s.error));
    await music.setEnabled(true);
    const [c] = contexts;
    c.state = 'interrupted';
    c.resume.mockRejectedValueOnce(new Error('still interrupted'));
    music.recover();
    await flush();
    expect([music.enabled, changes[changes.length - 1]]).toEqual([true, false]);
    music.recover();                                 // a later gesture tries again
    await flush();
    expect(c.state).toBe('running');
  });
});

describe('effects recovery', () => {
  let effects: SoundEffects;
  beforeEach(() => { effects = new SoundEffects(() => {}); });
  afterEach(() => effects.dispose());

  it.each<State>(['suspended', 'interrupted'])('resumes a %s context; cues from while it was stopped never play late', async (state) => {
    await effects.setEnabled(true);
    const [c] = contexts;
    c.state = state;
    effects.play('merge-three');                     // silent: started on the stopped context
    await flush();
    expect(c.voices).toHaveLength(1);
    effects.recover();                               // the next gesture
    expect(c.voices[0].stop).toHaveBeenCalledOnce();
    expect(c.resume).toHaveBeenCalledTimes(2);
    effects.play('discovery');                       // that gesture's own cue
    await flush();
    expect([c.state, c.voices.length, c.voices[1].stop.mock.calls.length]).toEqual(['running', 2, 0]);
    effects.recover();
    expect([c.resume.mock.calls.length, c.voices[1].stop.mock.calls.length]).toEqual([2, 0]);
  });

  it('a cue still loading when the context stopped is dropped by recovery', async () => {
    await effects.setEnabled(true);
    const [c] = contexts;
    let finish!: (value: ReturnType<typeof response>) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    effects.play('completion');
    c.state = 'suspended';
    effects.recover();
    finish(response());
    await flush();
    expect(c.voices).toHaveLength(0);
  });

  it('never creates audio, unmutes or resumes while off or hidden', async () => {
    effects.recover();
    expect(contexts).toHaveLength(0);
    await effects.setEnabled(true);
    effects.setVisible(false);
    const [c] = contexts;
    effects.recover();
    expect(c.resume).toHaveBeenCalledTimes(1);
    effects.setVisible(true);
    await flush();
    await effects.setEnabled(false);
    effects.recover();
    expect([c.state, c.resume.mock.calls.length, effects.enabled]).toEqual(['suspended', 2, false]);
  });
});

describe('music and effects are recovered independently by the same gesture', () => {
  it.each(['effects only', 'music only', 'both', 'neither'] as const)('%s on', async (on) => {
    const music = new BackgroundMusic(() => {});
    const effects = new SoundEffects(() => {});
    const dom = page();
    const stops = [onAudioGesture(dom.win, () => music.recover()), onAudioGesture(dom.win, (again) => effects.recover(again))];
    if (on !== 'effects only' && on !== 'neither') await music.setEnabled(true);
    if (on !== 'music only' && on !== 'neither') await effects.setEnabled(true);
    expect(contexts).toHaveLength({ both: 2, neither: 0 }[on as string] ?? 1);
    for (const c of contexts) c.state = 'suspended';
    dom.touchPress(dom.remove);
    await flush();
    expect(contexts.map((c) => c.state)).toEqual(contexts.map(() => 'running'));
    expect(fetcher).toHaveBeenCalledTimes(on === 'music only' || on === 'both' ? 1 : 0);
    stops.forEach((stop) => stop());
    music.dispose();
    effects.dispose();
  });
});
