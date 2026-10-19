import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundMusic, PUZZLE_MUSIC, type MusicState } from '../src/music';

const response = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
const voice = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), loop: false });

describe('background music', () => {
  let voices: ReturnType<typeof voice>[];
  let context: {
    resume: ReturnType<typeof vi.fn>; suspend: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>;
    createGain: ReturnType<typeof vi.fn>; createBufferSource: ReturnType<typeof vi.fn>;
    decodeAudioData: ReturnType<typeof vi.fn>; destination: object; currentTime: number;
  };
  let construct: ReturnType<typeof vi.fn>;
  let fetcher: ReturnType<typeof vi.fn>;
  let changes: MusicState[];
  let music: BackgroundMusic;

  beforeEach(() => {
    voices = [];
    context = {
      resume: vi.fn(async () => {}), suspend: vi.fn(async () => {}), close: vi.fn(async () => {}),
      createGain: vi.fn(() => ({ gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
      createBufferSource: vi.fn(() => { const node = voice(); voices.push(node); return node; }),
      decodeAudioData: vi.fn(async () => ({ duration: 25 })), destination: {}, currentTime: 0,
    };
    construct = vi.fn(function () { return context; });
    fetcher = vi.fn(async () => response());
    vi.stubGlobal('AudioContext', construct);
    vi.stubGlobal('fetch', fetcher);
    changes = [];
    music = new BackgroundMusic((s) => changes.push(s));
  });
  afterEach(() => { music.dispose(); vi.unstubAllGlobals(); });

  it('starts off without initializing audio or fetching, even when the level changes', () => {
    music.setTrack(PUZZLE_MUSIC);
    music.setVisible(false);
    music.setVisible(true);
    expect(music.enabled).toBe(false);
    expect(construct).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('unlocks audio immediately on enable, then starts one quiet looping source', async () => {
    const playing = music.setEnabled(true);
    expect(context.resume).toHaveBeenCalledTimes(1);
    await playing;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(voices).toHaveLength(1);
    expect(voices[0].loop).toBe(true);
    expect(voices[0].start).toHaveBeenCalledTimes(1);
    expect(context.createGain.mock.results[0].value.gain.value).toBe(0.35);
    expect(changes[changes.length - 1]).toEqual({ enabled: true, loading: false, error: false });
  });

  it('mute suspends audio and unmute resumes the same source without another download', async () => {
    await music.setEnabled(true);
    await music.setEnabled(false);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(changes[changes.length - 1]?.enabled).toBe(false);
    await music.setEnabled(true);
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(voices).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('backgrounding pauses audio; returning resumes only when still enabled', async () => {
    await music.setEnabled(true);
    music.setVisible(false);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    music.setVisible(true);
    await vi.waitFor(() => expect(changes[changes.length - 1]?.loading).toBe(false));
    expect(voices).toHaveLength(1);
    expect(context.resume).toHaveBeenCalledTimes(2);
    await music.setEnabled(false);
    music.setVisible(false);
    music.setVisible(true);
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it('a delayed download cannot start playing after mute', async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const playing = music.setEnabled(true);
    await Promise.resolve();
    await music.setEnabled(false);
    finish(response());
    await playing;
    expect(voices).toHaveLength(0);
    expect(changes[changes.length - 1]).toEqual({ enabled: false, loading: false, error: false });
    await music.setEnabled(true);
    expect(voices).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('level changes replace the voice and reuse decoded tracks when returning', async () => {
    await music.setEnabled(true);
    music.setTrack(PUZZLE_MUSIC);
    await vi.waitFor(() => expect(voices).toHaveLength(2));
    expect(voices[0].stop).toHaveBeenCalledTimes(1);
    expect(voices[0].stop).toHaveBeenCalledWith(expect.any(Number));
    expect(fetcher.mock.calls[1][0]).toBe(PUZZLE_MUSIC);
    music.setTrack('/audio/woodland-stroll.wav');
    await vi.waitFor(() => expect(voices).toHaveLength(3));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the old loop until replacement is decoded, then crossfades for 250ms', async () => {
    await music.setEnabled(true);
    let finish!: (value: ReturnType<typeof response>) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    music.setTrack(PUZZLE_MUSIC);
    await Promise.resolve();
    expect(voices[0].stop).not.toHaveBeenCalled();
    finish(response());
    await vi.waitFor(() => expect(voices).toHaveLength(2));
    expect(voices[0].stop).toHaveBeenCalledWith(0.25);
    expect(context.createGain.mock.results[2].value.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 0.25);
    expect(context.createGain.mock.results[1].value.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 0.25);
  });

  it('ignores an obsolete replacement load after a newer track choice', async () => {
    await music.setEnabled(true);
    let finish!: (value: ReturnType<typeof response>) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    music.setTrack(PUZZLE_MUSIC);
    await Promise.resolve();
    music.setTrack('/audio/woodland-stroll.wav');
    finish(response());
    await vi.waitFor(() => expect(changes[changes.length - 1]?.loading).toBe(false));
    expect(voices).toHaveLength(1);
  });

  it('a failed load shows an off/retry state and a later tap can recover', async () => {
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await music.setEnabled(true);
    expect(changes[changes.length - 1]).toEqual({ enabled: false, loading: false, error: true });
    expect(voices).toHaveLength(0);
    await music.setEnabled(true);
    expect(changes[changes.length - 1]).toEqual({ enabled: true, loading: false, error: false });
    expect(voices).toHaveLength(1);
  });

  it('unmount closes audio and prevents a pending load from starting a voice', async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const playing = music.setEnabled(true);
    await Promise.resolve();
    music.dispose();
    const count = changes.length;
    finish(response());
    await playing;
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(voices).toHaveLength(0);
    expect(changes).toHaveLength(count);
  });
});
