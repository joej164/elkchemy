import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SoundEffects } from '../src/effects';
import type { MusicState } from '../src/music';

let voices: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[];
let effects: SoundEffects;
let fetcher: ReturnType<typeof vi.fn>;
let context: { resume: ReturnType<typeof vi.fn>; suspend: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
let changed: ReturnType<typeof vi.fn<(state: MusicState) => void>>;
const response = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
beforeEach(() => {
  voices = [];
  context = { resume: vi.fn(async () => {}), suspend: vi.fn(async () => {}), close: vi.fn(async () => {}) };
  vi.stubGlobal('AudioContext', vi.fn(function () { return {
    ...context, destination: {},
    createGain: () => ({ gain: { value: 1 }, connect: vi.fn() }),
    decodeAudioData: async () => ({ duration: 1 }),
    createBufferSource: () => {
      const voice = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), onended: null };
      voices.push(voice); return voice;
    },
  }; }));
  fetcher = vi.fn(async () => response());
  vi.stubGlobal('fetch', fetcher);
  changed = vi.fn<(state: MusicState) => void>();
  effects = new SoundEffects(changed);
});
afterEach(() => { effects.dispose(); vi.unstubAllGlobals(); });
const settled = async () => { await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith({ enabled: true, loading: false, error: false })); };

it('is lazy and unlocks on enable without fetching music or effects', async () => {
  effects.play('merge-three');
  expect(AudioContext).not.toHaveBeenCalled();
  await effects.setEnabled(true);
  expect(context.resume).toHaveBeenCalledOnce();
  expect(fetcher).not.toHaveBeenCalled();
  effects.play('merge-three'); await settled();
  expect(fetcher).toHaveBeenCalledWith('/audio/merge-three.wav', expect.anything());
  expect(voices).toHaveLength(1);
});

it('bounds voices and caches decoded cues', async () => {
  await effects.setEnabled(true);
  for (let i = 0; i < 5; i++) { effects.play('merge-three'); await settled(); }
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(voices[0].stop).toHaveBeenCalledOnce();
  expect(voices[1].stop).toHaveBeenCalledOnce();
  effects.stop();
  expect(voices.every((voice) => voice.stop.mock.calls.length === 1)).toBe(true);
});

it('drops superseded delayed cues and prevents playback after stop, hide or disable', async () => {
  await effects.setEnabled(true);
  let finish!: (value: ReturnType<typeof response>) => void;
  fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  effects.play('merge-three');
  effects.play('discovery'); await settled();
  finish(response());
  await Promise.resolve(); await Promise.resolve();
  expect(voices).toHaveLength(1);
  effects.setVisible(false);
  expect(voices[0].stop).toHaveBeenCalledOnce();
  effects.play('discovery');
  await effects.setEnabled(false);
  expect(voices).toHaveLength(1);
});

it.each(['stop', 'mute', 'dispose'] as const)('invalidates pending playback on %s', async (action) => {
  await effects.setEnabled(true);
  let finish!: (value: ReturnType<typeof response>) => void;
  fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  effects.play('completion');
  if (action === 'stop') effects.stop();
  if (action === 'mute') await effects.setEnabled(false);
  if (action === 'dispose') effects.dispose();
  finish(response());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(voices).toHaveLength(0);
});

it('failure disables effects safely and a later enable retries', async () => {
  await effects.setEnabled(true);
  fetcher.mockRejectedValueOnce(new Error('offline'));
  effects.play('case-victory');
  await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith({ enabled: false, loading: false, error: true }));
  await effects.setEnabled(true);
  effects.play('case-victory'); await settled();
  expect(voices).toHaveLength(1);
});
