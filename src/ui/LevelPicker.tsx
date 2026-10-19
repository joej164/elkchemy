import type { ReactNode } from 'react';
import type { Level } from '../levels';

/** Levels page: every handcrafted level, any of which can be played; `current` is the one the sequence is up to. */
export function LevelPicker({ levels, current, onPick, onHome, musicControl }: {
  levels: readonly Level[];
  current: number;
  onPick: (index: number) => void;
  onHome: () => void;
  musicControl: ReactNode;
}) {
  return (
    <div className="page">
      <header className="title-row">
        <h1>Levels</h1>
        <div className="title-controls">{musicControl}</div>
      </header>
      <button type="button" className="back-button" data-action="home" onClick={onHome}>‹ Home</button>
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
  );
}
