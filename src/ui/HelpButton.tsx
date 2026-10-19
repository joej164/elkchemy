import { useId, useRef } from 'react';
import type { LevelGoal } from '../session';
import { helpObjective, LARGE_BOARD_HINT } from './messages';
import './help.css';

/** `puzzle`: a generated puzzle (no supply, no next level, New puzzle available). */
export function HelpButton({ goal, largeBoard = false, puzzle = false }: { goal: LevelGoal; largeBoard?: boolean; puzzle?: boolean }) {
  const dialogId = useId();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const open = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    closeRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="help-trigger"
        data-action="help"
        aria-label="How to play"
        aria-haspopup="dialog"
        aria-controls={dialogId}
        onClick={open}
      >
        ?
      </button>
      <dialog
        ref={dialogRef}
        id={dialogId}
        className="help-dialog"
        data-help-dialog
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="help-content">
          <h2 id={titleId}>How to play</h2>
          <ul>
            <li>{helpObjective(goal)}{puzzle ? '' : ' Winning unlocks the next level.'}</li>
            <li>Drag an item, or tap it then tap where it should go.</li>
            <li>Drop onto a matching item to merge its connected group. Merge 3 for 1 upgraded item; merge 5 for 2.</li>
            {largeBoard && <li>{LARGE_BOARD_HINT} Center board recenters the view.</li>}
            <li>Dropping onto a different item swaps them; nothing merges on its own.</li>
            {puzzle ? (
              <li>Everything you need is already on the board; there is no supply.</li>
            ) : (
              <li>Add supply puts the next item in a random empty cell.</li>
            )}
            {puzzle ? (
              <li>Undo takes back your last action; Retry restarts this puzzle; New puzzle makes a fresh one.</li>
            ) : (
              <li>Undo takes back your last action; Retry restarts this level.</li>
            )}
          </ul>
          <button
            ref={closeRef}
            type="button"
            className="help-close"
            data-action="help-close"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
