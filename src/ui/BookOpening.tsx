import type { CSSProperties } from 'react';
import { BookPageArt, PictureBookCoverArt } from './ItemArt';
import type { UiState } from './controller';

/** How long the Picture Book's opening plays before Continue is enabled. Its CSS (app.css) fits within this. */
export const BOOK_OPENING_MS = 2200;

/**
 * Once the last action opened the goal item (`openGoal`, the attic's Picture Book), calls `done` after its opening
 * has played (enabling Continue). A timer, so it never waits on animation events. Returns the cancel, for the next action (Retry) or
 * leaving, after which it never calls `done`; undefined for any other action.
 */
export function afterOpening(state: UiState, done: () => void, ms = BOOK_OPENING_MS): (() => void) | undefined {
  if (state.lastAction?.kind !== 'openGoal') return undefined;
  const timer = setTimeout(done, ms);
  return () => clearTimeout(timer);
}

/**
 * The Picture Book opening, over the board: its cover (the item's own cover art) lifts and three pages turn, each with
 * small photographs on both sides, and it stays open until Continue. Under reduced motion it is shown open at once.
 * Decorative.
 */
export function BookOpening() {
  return (
    <div className="book-opening" aria-hidden="true" data-book-opening>
      <div className="book-opening-book">
        <span className="book-opening-pages"><BookPageArt page={6} /></span>
        {[0, 1, 2].map((i) => (
          <span key={i} className="book-opening-leaf" style={{ '--leaf': i } as CSSProperties}>
            <span className="book-opening-page"><BookPageArt page={i * 2} /></span>
            <span className="book-opening-page is-back"><BookPageArt page={i * 2 + 1} /></span>
          </span>
        ))}
        <span className="book-opening-cover">
          <span className="book-opening-front"><PictureBookCoverArt /></span>
          <span className="book-opening-back" />
        </span>
      </div>
    </div>
  );
}
