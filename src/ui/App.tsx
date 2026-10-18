import { useReducer, useState, type ReactNode } from 'react';
import { LEVELS, nextLevelIndex, type Level } from '../levels';
import type { Item } from '../board';
import { hasItem } from '../status';
import { Board } from './Board';
import { HelpButton } from './HelpButton';
import { ItemArt, itemLabel } from './ItemArt';
import { UpdateControl } from './UpdateControl';
import { isLargeBoard, itemCount, objectiveText, statusMessage } from './messages';
import { useMusic } from './useMusic';
import { PUZZLE_MUSIC, WOODLAND_MUSIC } from '../music';
import {
  canPlaceSupply, canUndo, initUi, nextSupplyItem, reduceUi, supplyRemaining,
  type LastAction,
} from './controller';

function plural(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}

function describeAction(a: LastAction | null): string {
  if (!a) return '';
  switch (a.kind) {
    case 'move': return 'Moved an item.';
    case 'swap': return 'Swapped two items.';
    case 'place': return `Placed ${itemLabel(a.item)} in row ${a.at.row + 1}, column ${a.at.col + 1}.`;
    case 'undo': return 'Undid the last action.';
    case 'retry': return 'Level restarted.';
    case 'merge':
      return `Merged ${a.consumed} into ${plural(a.consumed === 3 ? 1 : 2)}: ${itemLabel(a.result as Item)}.`;
  }
}

export function App({ levels = LEVELS }: { levels?: readonly Level[] }) {
  const [index, setIndex] = useState(0);
  const music = useMusic(levels[index].definition.goal.kind === 'item' &&
    levels[index].definition.goal.item.family === 'song' ? PUZZLE_MUSIC : WOODLAND_MUSIC);
  const musicControl = (
    <>
      <button type="button" className="music-button" data-action="music"
        aria-label={music.enabled ? 'Mute music' : music.error ? 'Retry music' : 'Turn music on'}
        aria-pressed={music.enabled} aria-busy={music.loading}
        onClick={music.toggle}>
        <span aria-hidden="true">♪</span> Music: {music.error ? 'retry' : music.enabled ? 'on' : 'off'}
      </button>
      <span className="sr-only" role="status">
        {music.error ? 'Music could not play. Tap Music to try again.' : music.loading ? 'Loading music.' : ''}
      </span>
    </>
  );
  // Bumped on every Next level / Play again, so the game remounts even when the index repeats.
  const [run, setRun] = useState(0);
  return (
    <main className="app">
      <Game key={run} index={index} levels={levels} musicControl={musicControl}
        onNext={() => { setIndex(nextLevelIndex(index, levels.length)); setRun((r) => r + 1); }} />
      <footer className="app-footer">
        <UpdateControl />
      </footer>
    </main>
  );
}

function Game({ index, levels, onNext, musicControl }: { index: number; levels: readonly Level[]; onNext: () => void; musicControl: ReactNode }) {
  const [state, dispatch] = useReducer(reduceUi, levels[index].definition, initUi);
  const goal = state.session.level.goal;
  const next = nextSupplyItem(state);
  const left = supplyRemaining(state);
  const canSupply = canPlaceSupply(state);
  const over = state.status !== 'playing';
  const message = statusMessage(state);

  let hint = '';
  if (canSupply) hint = 'Lands in a random empty cell';
  else if (!over) hint = left <= 0 ? 'No supply left' : 'Board is full';

  return (
    <>
      <header className="info">
        <div className="title-row">
          <h1>Elkchemy</h1>
          <div className="title-controls">
            {musicControl}
            <HelpButton goal={goal} largeBoard={isLargeBoard(state.session.board)} />
          </div>
        </div>
        <p className="level-label">Level {index + 1} of {levels.length} · {levels[index].name}</p>
        <div className="panel goal">
          {goal.kind === 'items' ? (
            <div className="targets">
              {goal.items.map((t) => {
                const done = hasItem(state.session.board, t);
                return (
                  <span key={t.family} className={`art target${done ? ' is-done' : ''}`} role="img"
                    aria-label={`${itemLabel(t)}: ${done ? 'done' : 'not yet'}`}>
                    <ItemArt item={t} />
                    {done && <span className="target-check" aria-hidden="true">✓</span>}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="art">
              {goal.kind === 'item' ? <ItemArt item={goal.item} /> : <span className="art-glyph" aria-hidden="true">1</span>}
            </div>
          )}
          <p>
            {objectiveText(goal)}
            {goal.kind === 'items' && <><br />{goal.items.filter((t) => hasItem(state.session.board, t)).length} of {goal.items.length} done</>}
            {goal.kind === 'leaveOne' && <><br />On board: {itemCount(state)}</>}
          </p>
        </div>
        <div className="panel supply-info">
          <div className="art">{next ? <ItemArt item={next} /> : <span className="art-empty" aria-hidden="true" />}</div>
          <p>
            <strong>Next supply</strong>
            <br />
            {next ? itemLabel(next) : 'No supply left'}
            <br />
            Supply left: {left}
          </p>
        </div>
      </header>

      <Board state={state} dispatch={dispatch} />

      <div className={`banner is-${state.status}`} data-status={state.status}>
        {state.status === 'won' && <span className="banner-icon" aria-hidden="true">★</span>}
        {state.status === 'lost' && <span className="banner-icon" aria-hidden="true">✖</span>}
        <span>{message}</span>
      </div>

      <div className="sr-only" aria-live="polite" role="status">
        {describeAction(state.lastAction)} {over ? message : ''}
      </div>

      <section className="controls" aria-label="Controls">
        {state.status === 'won' ? (
          <button type="button" className="btn btn-next" data-action="next-level" onClick={onNext}>
            {nextLevelIndex(index, levels.length) === 0 ? 'Play again from level 1' : 'Next level'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-supply"
            data-action="supply"
            disabled={!canSupply}
            aria-describedby="supply-hint"
            onClick={() => dispatch({ type: 'placeSupply' })}
          >
            {next && <span className="btn-art" aria-hidden="true"><ItemArt item={next} /></span>}
            <span>Add supply</span>
          </button>
        )}
        <p className="hint" id="supply-hint">{hint}</p>
        <div className="row">
          <button type="button" className="btn" data-action="undo" disabled={!canUndo(state)}
            onClick={() => dispatch({ type: 'undo' })}>Undo</button>
          <button type="button" className="btn" data-action="retry"
            onClick={() => dispatch({ type: 'retry' })}>Retry</button>
        </div>
      </section>
    </>
  );
}
