import { useEffect, useRef, useState } from 'react';
import { BackgroundMusic, type MusicState } from '../music';
import { onAudioGesture } from './audioEvents';

export function useMusic(track: string) {
  const player = useRef<BackgroundMusic | null>(null);
  const [state, setState] = useState<MusicState>({ enabled: false, loading: false, error: false });

  useEffect(() => {
    const music = new BackgroundMusic(setState);
    player.current = music;
    music.setTrack(track);
    const visibility = () => music.setVisible(!document.hidden);
    const hide = () => music.setVisible(false);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', visibility);
    const stopRecovery = onAudioGesture(window, () => music.recover());
    return () => {
      stopRecovery();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', visibility);
      music.dispose();
      player.current = null;
    };
  }, []);

  useEffect(() => { player.current?.setTrack(track); }, [track]);

  return { ...state, toggle: () => {
    if (player.current) void player.current.setEnabled(!player.current.enabled);
  } };
}
