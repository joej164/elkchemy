import { useId, useRef } from 'react';
import type { Region, Task } from '../regions';
import type { LevelGoal } from '../session';
import { helpObjective, isConcealed, LARGE_BOARD_HINT, roomsHelp } from './messages';
import './help.css';

/**
 * `puzzle`: a generated puzzle (no supply, no next level, New puzzle available). `regions`: a region level (no supply).
 * `unlocked`: the regions open so far (the last one, or with `tasks`, whether each is open), so a concealed part of a room
 * is explained only once found.
 */
export function HelpButton({ goal, largeBoard = false, puzzle = false, regions, unlocked = 0, tasks }: {
  goal: LevelGoal; largeBoard?: boolean; puzzle?: boolean; regions?: readonly Region[];
  unlocked?: number | ((i: number) => boolean); tasks?: readonly Task[];
}) {
  const dialogId = useId();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rooms = goal.kind === 'treasure';

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
            <li>{helpObjective(goal, regions)}{puzzle ? '' : ' Winning unlocks the next level.'}</li>
            <li>Drag an item, or tap it then tap where it should go.</li>
            <li>Drop onto a matching item to merge its connected group. Merge 3 for 1 upgraded item; merge 5 for 2.</li>
            {largeBoard && <li>{LARGE_BOARD_HINT} Center board recenters the view.</li>}
            <li>Dropping onto a different item swaps them; nothing merges on its own.</li>
            {rooms ? (
              <li>{roomsHelp(regions ?? [], unlocked, tasks)}</li>
            ) : regions ? (
              <li>
                Each locked area's gate shows the item that opens it. Make it in the area named, then tap the gate or press
                Unlock; the item stays where it is. Items never leave their own area.
              </li>
            ) : puzzle ? (
              <li>Everything you need is already on the board; there is no supply.</li>
            ) : (
              <li>Add supply puts the next item in a random empty cell.</li>
            )}
            {puzzle ? (
              <li>Undo takes back your last action; Retry restarts this puzzle; New puzzle makes a fresh one.</li>
            ) : rooms && regions?.some(isConcealed) ? (
              <li>
                A marked tile that has done its job is a checkpoint: its item stays fixed, and Undo can't go back past it.
                Retry restarts this level.
              </li>
            ) : rooms ? (
              <li>
                An opened gate is a checkpoint: its items stay fixed, and Undo can't go back past it. Retry restarts this
                level.
              </li>
            ) : (
              <li>Undo takes back your last action{regions ? ', even an unlock' : ''}; Retry restarts this level.</li>
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
