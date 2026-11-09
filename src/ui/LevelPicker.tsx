import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Level } from '../levels';
import { ATTIC_LEVEL } from '../attic';
import { ItemArt } from './ItemArt';

/**
 * Levels page: every handcrafted level, any of which can be played; `current` is the one the sequence is up to. The list
 * scrolls in its own window below the title and Home, and opens with the current level in view. Above level 1, outside
 * the numbered list and its progress, sits the story prototype The Attic. With `chapter` (development preview only, see
 * STORY_PREVIEW) the list is Chapter 1 instead: the Attic as its prologue, then its levels, with their own progress (`next`
 * is up next); the original levels follow, unchanged, in a collapsed Previous levels section.
 */
export function LevelPicker({ levels, current, onPick, onAttic, chapter, onHome, musicControl }: {
  levels: readonly Level[];
  current: number;
  onPick: (index: number) => void;
  onAttic: () => void;
  chapter?: { readonly names: readonly string[]; readonly next: number; readonly onPick: (index: number) => void };
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
  const attic = (
    <button type="button" className="btn level-choice is-story" data-action="attic" onClick={onAttic}>
      <span className="level-number" aria-hidden="true">
        {ATTIC_LEVEL.goal.kind === 'item' && <ItemArt item={ATTIC_LEVEL.goal.item} />}
      </span>
      <span><span className="sr-only">{chapter ? 'Prologue: ' : 'Story prototype: '}</span>The Attic</span>
      <span className="level-next" aria-hidden="true">{chapter ? 'Prologue' : 'Story'}</span>
    </button>
  );
  const numbered = (
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
  );
  return (
    <div className="page level-page">
      <header className="title-row">
        <h1>Levels</h1>
        <div className="title-controls">{musicControl}</div>
      </header>
      <button type="button" className="back-button" data-action="home" onClick={onHome}>‹ Home</button>
      <div ref={listRef} className="level-scroll" data-level-scroll>
        {chapter ? (
          <>
            <section className="level-section" aria-labelledby="chapter-one-heading" data-chapter>
              <h2 id="chapter-one-heading" className="level-section-title">Chapter 1</h2>
              {attic}
              <ol className="level-list">
                {chapter.names.map((name, i) => (
                  <li key={name}>
                    <button type="button" className="btn level-choice" data-action="chapter-level" data-chapter-level={i + 1}
                      aria-current={i === chapter.next ? 'step' : undefined} onClick={() => chapter.onPick(i)}>
                      <span className="level-number" aria-hidden="true">{i + 1}</span>
                      <span><span className="sr-only">Chapter 1, level {i + 1}: </span>{name}</span>
                      {i === chapter.next && <span className="level-next">Up next</span>}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
            <details className="level-section previous-levels" data-previous-levels>
              <summary className="level-section-title">Previous levels</summary>
              {numbered}
            </details>
          </>
        ) : (
          <>
            {attic}
            {numbered}
          </>
        )}
      </div>
    </div>
  );
}
