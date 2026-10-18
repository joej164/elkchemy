export interface MusicState {
  enabled: boolean;
  loading: boolean;
  error: boolean;
}

export const WOODLAND_MUSIC = '/audio/woodland-stroll.wav';
export const PUZZLE_MUSIC = '/audio/curious-clearing.wav';

/** One looping voice; no audio context or requests until the player enables music. */
export class BackgroundMusic {
  enabled = false;
  private loading = false;
  private error = false;
  private visible = true;
  private disposed = false;
  private revision = 0;
  private track = WOODLAND_MUSIC;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();

  constructor(private changed: (state: MusicState) => void) {}

  private publish() {
    if (!this.disposed) this.changed({ enabled: this.enabled, loading: this.loading, error: this.error });
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (this.disposed) return;
    this.enabled = enabled;
    this.error = false;
    if (enabled && this.visible) return this.play();
    this.revision++;
    this.loading = false;
    this.publish();
    await this.context?.suspend().catch(() => {});
  }

  setTrack(track: string): void {
    if (this.disposed || this.track === track) return;
    this.track = track;
    this.revision++;
    this.stopSource();
    if (this.enabled && this.visible) void this.play();
  }

  setVisible(visible: boolean): void {
    if (this.disposed || this.visible === visible) return;
    this.visible = visible;
    if (visible && this.enabled) void this.play();
    else {
      this.revision++;
      this.loading = false;
      this.publish();
      void this.context?.suspend().catch(() => {});
    }
  }

  private async buffer(track: string): Promise<AudioBuffer> {
    let pending = this.buffers.get(track);
    if (!pending) {
      const context = this.context!;
      pending = (async () => {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 15_000);
        try {
          const response = await fetch(track, { signal: abort.signal });
          if (!response.ok) throw new Error('Music unavailable');
          return await context.decodeAudioData(await response.arrayBuffer());
        } finally { clearTimeout(timer); }
      })();
      this.buffers.set(track, pending);
      // Failed loads may be retried with the next deliberate tap.
      void pending.catch(() => { this.buffers.delete(track); });
    }
    return pending;
  }

  private async play(): Promise<void> {
    const revision = ++this.revision;
    this.loading = true;
    this.publish();
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.gain.value = 0.35;
        this.gain.connect(this.context.destination);
      }
      // Called immediately from the enable button, before awaiting a network request.
      await this.context.resume();
      if (revision !== this.revision || !this.enabled || !this.visible || this.disposed) return;
      if (!this.source) {
        const buffer = await this.buffer(this.track);
        if (revision !== this.revision || !this.enabled || !this.visible || this.disposed) return;
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(this.gain!);
        source.start();
        this.source = source;
      }
      if (revision !== this.revision || this.disposed) return;
      this.loading = false;
      this.publish();
    } catch {
      if (revision !== this.revision || this.disposed) return;
      this.enabled = false;
      this.loading = false;
      this.error = true;
      this.stopSource();
      void this.context?.suspend().catch(() => {});
      this.publish();
    }
  }

  private stopSource() {
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
  }

  dispose(): void {
    this.disposed = true;
    this.revision++;
    this.stopSource();
    void this.context?.close().catch(() => {});
    this.buffers.clear();
  }
}
