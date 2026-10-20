import type { MusicState } from './music';

export type EffectCue = 'merge-three' | 'merge-five' | 'discovery' | 'completion' | 'case-victory';

/** Independent, opt-in effects. Pending actions expire rather than queueing behind downloads. */
export class SoundEffects {
  enabled = false;
  private visible = true;
  private disposed = false;
  private revision = 0;
  private request = 0;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private voices: AudioBufferSourceNode[] = [];
  private buffers = new Map<EffectCue, Promise<AudioBuffer>>();

  constructor(private changed: (state: MusicState) => void) {}

  private publish(loading = false, error = false) {
    if (!this.disposed) this.changed({ enabled: this.enabled, loading, error });
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (this.disposed) return;
    this.enabled = enabled;
    const revision = ++this.revision;
    this.stop();
    this.publish();
    if (!enabled || !this.visible) {
      await this.context?.suspend().catch(() => {});
      return;
    }
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.gain.value = 0.45;
        this.gain.connect(this.context.destination);
      }
      await this.context.resume();
    } catch {
      if (revision === this.revision) this.fail();
    }
  }

  setVisible(visible: boolean): void {
    if (this.disposed || this.visible === visible) return;
    this.visible = visible;
    this.stop();
    if (visible && this.enabled) void this.setEnabled(true);
    else void this.context?.suspend().catch(() => {});
  }

  /**
   * As BackgroundMusic.recover. Cues started or loading while the context was stopped are cancelled first, so they
   * never play late; the gesture's own cue comes after this. `again` (a later event of the same gesture; see
   * onAudioGesture) only asks to resume again: by then that gesture's own cue may have started.
   */
  recover(again = false): void {
    const state = this.context?.state;
    if (!this.enabled || !this.visible || this.disposed || !state || state === 'running' || state === 'closed') return;
    if (!again) this.stop();
    void this.context!.resume().catch(() => {});
  }

  private buffer(cue: EffectCue): Promise<AudioBuffer> {
    let pending = this.buffers.get(cue);
    if (!pending) {
      const context = this.context!;
      pending = (async () => {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 15_000);
        try {
          const response = await fetch(`/audio/${cue}.wav`, { signal: abort.signal });
          if (!response.ok) throw new Error('Effect unavailable');
          return await context.decodeAudioData(await response.arrayBuffer());
        } finally { clearTimeout(timer); }
      })();
      this.buffers.set(cue, pending);
      void pending.catch(() => this.buffers.delete(cue));
    }
    return pending;
  }

  play(cue: EffectCue): void {
    if (!this.enabled || !this.visible || this.disposed || !this.context) return;
    const request = ++this.request;
    this.publish(true);
    void this.buffer(cue).then((buffer) => {
      if (request !== this.request || !this.enabled || !this.visible || this.disposed) return;
      if (this.voices.length >= 3) {
        const oldest = this.voices.shift()!;
        oldest.stop();
        oldest.disconnect();
      }
      const source = this.context!.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gain!);
      source.onended = () => {
        this.voices = this.voices.filter((voice) => voice !== source);
        source.disconnect();
      };
      this.voices.push(source);
      source.start();
      this.publish();
    }).catch(() => {
      if (request === this.request && !this.disposed) this.fail();
    });
  }

  stop(): void {
    this.request++;
    for (const voice of this.voices) { voice.stop(); voice.disconnect(); }
    this.voices = [];
    this.publish();
  }

  private fail(): void {
    this.enabled = false;
    this.stop();
    void this.context?.suspend().catch(() => {});
    this.publish(false, true);
  }

  dispose(): void {
    this.disposed = true;
    this.revision++;
    this.stop();
    this.buffers.clear();
    void this.context?.close().catch(() => {});
  }
}
