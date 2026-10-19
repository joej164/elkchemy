import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Level } from '../levels';

/**
 * Levels page: every handcrafted level, any of which can be played; `current` is the one the sequence is up to. The list
 * scrolls in its own window below the title and Home, and opens with the current level in view.
 */
export function LevelPicker({ levels, current, onPick, onHome, musicControl }: {
  levels: readonly Level[];
  current: number;
  onPick: (index: number) => void;
  onHome: () => void;
  musicControl: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    const entry = list?.querySelector<HTMLElement>('[aria-current]');
    if (!list || !entry) return;
    // Centre the current entry in the window (the browser clamps at either end).
    const box = list.getBoundingClientRect();
    const at = entry.getBoundingClientRect();
    list.scrollTop += at.top - box.top - (list.clientHeight - at.height) / 2;
  }, []);
  return (
    <div className="page level-page">
      <header className="title-row">
        <h1>Levels</h1>
        <div className="title-controls">{musicControl}</div>
      </header>
      <button type="button" className="back-button" data-action="home" onClick={onHome}>‹ Home</button>
      <div ref={listRef} className="level-scroll" data-level-scroll>
        <ol className="level-list">
          {levels.map((level, i) => (
            <li key={level.name}>
              <button type="button" className="btn level-choice" data-action="pick-level" data-level={i + 1}
                aria-current={i === current ? 'step' : undefined} onClick={() => onPick(i)}>
                <span className="level-number" aria-hidden="true">{i + 1}</span>
                <span>
                  <span className="sr-only">Level {i + 1}: </span>
                  {level.name}
                </span>
                {i === current && <span className="level-next">Up next</span>}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
