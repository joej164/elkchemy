import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundEffects, type EffectCue } from '../effects';
import type { MusicState } from '../music';

export function useEffects() {
  const player = useRef<SoundEffects | null>(null);
  const [state, setState] = useState<MusicState>({ enabled: false, loading: false, error: false });
  useEffect(() => {
    const effects = new SoundEffects(setState);
    player.current = effects;
    const visibility = () => effects.setVisible(!document.hidden);
    const hide = () => effects.setVisible(false);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', visibility);
      effects.dispose();
      player.current = null;
    };
  }, []);
  const toggle = useCallback(() => {
    if (player.current) void player.current.setEnabled(!player.current.enabled);
  }, []);
  const play = useCallback((cue: EffectCue) => player.current?.play(cue), []);
  const stop = useCallback(() => player.current?.stop(), []);
  return { ...state, toggle, play, stop };
}
