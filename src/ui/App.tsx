import { useReducer, useState, type ReactNode } from 'react';
import { LEVELS, nextLevelIndex, type Level } from '../levels';
import type { Item } from '../board';
import { generatePuzzle, type GeneratedPuzzle, type PuzzleConfig } from '../generator';
import type { LevelDefinition } from '../session';
import { hasItem } from '../status';
import { nextLocked, type Region } from '../regions';
import { Board, LockIcon, RuneGate } from './Board';
import { HelpButton } from './HelpButton';
import { Home } from './Home';
import { LevelPicker } from './LevelPicker';
import { PlaySetup } from './PlaySetup';
import { PuzzleId } from './PuzzleId';
import { ReleaseNotes } from './ReleaseNotes';
import { Scores } from './Scores';
import { SceneArt } from './SceneArt';
import gameLandscapeArt from '../assets/art/woodland-cheering-landscape-v1.webp';
import gamePortraitArt from '../assets/art/woodland-cheering-portrait-v1.webp';
import { BackpackArt, ItemArt, itemLabel } from './ItemArt';
import { UpdateControl } from './UpdateControl';
import { isLargeBoard, itemCount, objectiveText, statusMessage, TREASURE_NAME, unlockNeed } from './messages';
import { useMusic } from './useMusic';
import { PUZZLE_MUSIC, WOODLAND_MUSIC } from '../music';
import {
  canPlaceSupply, canUndo, canUnlock, initUi, nextSupplyItem, openedRegion, reduceUi, supplyRemaining,
  type LastAction,
} from './controller';

function plural(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}

function describeAction(a: LastAction | null, noun: string, regions?: readonly Region[]): string {
  if (!a) return '';
  // Room levels: a drop that opened a gate says so.
  const opened = a.kind !== 'unlock' && openedRegion(a);
  const gate = opened ? ` The rune gate to ${regions?.[opened]?.name ?? 'the next room'} opened.` : '';
  switch (a.kind) {
    case 'move': return `Moved an item.${gate}`;
    case 'swap': return `Swapped two items.${gate}`;
    case 'place': return `Placed ${itemLabel(a.item)} in row ${a.at.row + 1}, column ${a.at.col + 1}.`;
    case 'unlock': return `Unlocked ${regions?.[a.region]?.name ?? 'an area'}.`;
    case 'collect': return `Collected the ${TREASURE_NAME}.`;
    case 'undo': return 'Undid the last action.';
    case 'retry': return `${noun} restarted.`;
    case 'merge':
      return `Merged ${a.consumed} into ${plural(a.consumed === 3 ? 1 : 2)}: ${itemLabel(a.result as Item)}.${gate}`;
  }
}

type Screen =
  | { readonly kind: 'home' }
  | { readonly kind: 'play'; readonly error?: string }
  | { readonly kind: 'notes' }
  | { readonly kind: 'scores' }
  | { readonly kind: 'pick' }
  | { readonly kind: 'levels' }
  | { readonly kind: 'puzzle'; readonly puzzle: GeneratedPuzzle };

const isSongGoal = (d: LevelDefinition) => d.goal.kind === 'item' && d.goal.item.family === 'song';

/** A fresh seed for a new puzzle, never `avoid`. Only the choice of seed is random; generation from it is deterministic. */
function randomSeed(avoid?: number): number {
  for (;;) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    if (seed !== avoid) return seed;
  }
}

export function puzzleLabel(config: PuzzleConfig): string {
  const tier = `Tier ${config.tier + 1} of 4`;
  if (config.mode === 'one') return `Merge down to one · ${tier}`;
  return `Merge to goals · ${tier} · ${config.goals} ${config.goals === 1 ? 'goal' : 'goals'}`;
}

export function App({ levels = LEVELS }: { levels?: readonly Level[] }) {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [index, setIndex] = useState(0);
  const [config, setConfig] = useState<PuzzleConfig>({ mode: 'goals', tier: 3, goals: 1 });
  const active = screen.kind === 'levels' ? levels[index].definition : screen.kind === 'puzzle' ? screen.puzzle.definition : null;
  const music = useMusic(active && isSongGoal(active) ? PUZZLE_MUSIC : WOODLAND_MUSIC);
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
  // Bumped on every screen change, Next level and New puzzle, so the game remounts even when the definition repeats.
  const [run, setRun] = useState(0);
  const show = (next: Screen) => { setScreen(next); setRun((r) => r + 1); };
  // Generation is bounded and only returns verified puzzles; if it fails, nothing unverified is shown.
  const startPuzzle = (cfg: PuzzleConfig, avoid?: number) => {
    try {
      show({ kind: 'puzzle', puzzle: generatePuzzle(cfg, randomSeed(avoid)) });
    } catch {
      show({ kind: 'play', error: "Couldn't make a puzzle with those settings. Please try again." });
    }
  };
  const toHome = () => show({ kind: 'home' });
  const inGame = screen.kind === 'levels' || screen.kind === 'puzzle';
  // Home and Play are drawn over full-screen artwork (SceneArt).
  const scene = screen.kind === 'home' || screen.kind === 'play';

  return (
    <main className={`app${inGame ? ' is-game' : ' is-page'}${scene ? ' is-scene' : ''}${screen.kind === 'scores' ? ' is-wide' : ''}`}>
      {screen.kind === 'home' && (
        <Home musicControl={musicControl} onPlay={() => show({ kind: 'play' })}
          onLevels={() => show({ kind: 'pick' })} onScores={() => show({ kind: 'scores' })}
          onReleaseNotes={() => show({ kind: 'notes' })}
          levelsNote={index > 0 ? `Levels continue at level ${index + 1} of ${levels.length}, ${levels[index].name}.` : undefined} />
      )}
      {screen.kind === 'play' && (
        <PlaySetup config={config} onConfig={setConfig} error={screen.error} musicControl={musicControl} onHome={toHome}
          onStart={() => startPuzzle({ ...config, goals: config.mode === 'one' ? 1 : config.goals })} />
      )}
      {screen.kind === 'notes' && <ReleaseNotes musicControl={musicControl} onHome={toHome} />}
      {screen.kind === 'scores' && <Scores musicControl={musicControl} onHome={toHome} />}
      {screen.kind === 'pick' && (
        <LevelPicker levels={levels} current={index} musicControl={musicControl} onHome={toHome}
          onPick={(i) => { setIndex(i); show({ kind: 'levels' }); window.scrollTo(0, 0); }} />
      )}
      {screen.kind === 'levels' && (
        <Game key={run} definition={levels[index].definition} musicControl={musicControl} onHome={toHome}
          label={`Level ${index + 1} of ${levels.length} · ${levels[index].name}`}
          winLabel={nextLevelIndex(index, levels.length) === 0 ? 'Play again from level 1' : 'Next level'}
          onWin={() => { setIndex(nextLevelIndex(index, levels.length)); setRun((r) => r + 1); }} />
      )}
      {screen.kind === 'puzzle' && (
        <Game key={run} definition={screen.puzzle.definition} musicControl={musicControl} onHome={toHome}
          label={puzzleLabel(screen.puzzle.config)} puzzleId={screen.puzzle.id}
          onNewPuzzle={() => startPuzzle(screen.puzzle.config, screen.puzzle.seed)} />
      )}
      <footer className="app-footer">
        <UpdateControl />
      </footer>
    </main>
  );
}

interface GameProps {
  definition: LevelDefinition;
  label: string;
  musicControl: ReactNode;
  onHome: () => void;
  /** Handcrafted levels: the button offered after winning. */
  winLabel?: string;
  onWin?: () => void;
  /** Generated puzzles: the reproduction ID, and New puzzle (offered throughout). */
  puzzleId?: string;
  onNewPuzzle?: () => void;
}

export function Game({ definition, label, musicControl, onHome, winLabel, onWin, puzzleId, onNewPuzzle }: GameProps) {
  const [state, dispatch] = useReducer(reduceUi, definition, initUi);
  const puzzle = puzzleId !== undefined;
  const { goal, regions } = state.session.level;
  const nextArea = regions ? nextLocked(state.session) : null;
  const unlockable = canUnlock(state);
  // Room levels: gates open by themselves, so there is no Unlock button; the goal is the treasure.
  const rooms = goal.kind === 'treasure';
  const single = goal.kind === 'items' || goal.kind === 'treasure' ? undefined : goal.item;
  const next = nextSupplyItem(state);
  const left = supplyRemaining(state);
  const canSupply = canPlaceSupply(state);
  const over = state.status !== 'playing';
  // Measured by Board once laid out (and on resize); until then, guessed from the board's size.
  const [pannable, setPannable] = useState(() => isLargeBoard(definition.board));
  const message = statusMessage(state, pannable);
  // Nothing is saved, so leaving mid-attempt discards it: ask once a move has been made.
  const leave = (go?: () => void) => {
    if (!go) return;
    if (over || state.session.moves === 0 ||
      window.confirm(`Leave this ${puzzle ? 'puzzle' : 'level'}? Your current attempt will be discarded.`)) go();
  };

  let hint = '';
  if (rooms) {
    if (!over && nextArea !== null) hint = 'Gates open by themselves and stay open';
  } else if (regions) {
    if (!over) hint = nextArea === null ? '' : unlockable ? 'The item stays where it is' : `Needs ${unlockNeed(regions, nextArea)}`;
  } else if (canSupply) hint = 'Lands in a random empty cell';
  else if (!over) hint = left <= 0 ? 'No supply left' : 'Board is full';

  return (
    <>
      {/* Decorative: web copies of artwork/gameplay/woodland-cheering-*-v1.png, behind the unchanged board layout. */}
      <SceneArt className="is-game" landscape={gameLandscapeArt} portrait={gamePortraitArt} alt="" />
      <header className={`info${regions ? ' has-regions' : ''}`}>
        <div className="title-row">
          <h1>Elkchemy</h1>
          <div className="title-controls">
            {musicControl}
            <HelpButton goal={goal} largeBoard={pannable} puzzle={puzzle} regions={regions} />
          </div>
        </div>
        <p className="level-label">{label}</p>
        <div className={`panel goal${puzzle ? ' is-wide' : ''}`}>
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
              {rooms ? <BackpackArt open={state.session.collected} /> : single ? <ItemArt item={single} /> : <span className="art-glyph" aria-hidden="true">1</span>}
            </div>
          )}
          <p>
            {objectiveText(goal, regions)}
            {goal.kind === 'items' && <><br />{goal.items.filter((t) => hasItem(state.session.board, t)).length} of {goal.items.length} done</>}
            {goal.kind === 'leaveOne' && <><br />On board: {itemCount(state)}</>}
          </p>
        </div>
        {regions && (
          <div className="panel next-area" data-next-area>
            <div className="art">
              {nextArea === null ? <span className="art-glyph" aria-hidden="true">✓</span>
                : rooms ? <RuneGate />
                : <ItemArt item={(regions[nextArea].unlock as { item: Item }).item} />}
            </div>
            <p>
              {nextArea !== null ? (
                <><strong>{rooms ? 'Rune gate' : 'Locked'}: {regions[nextArea].name}</strong><br />Needs {unlockNeed(regions, nextArea)}</>
              ) : <strong>{rooms ? 'All gates open' : 'All areas open'}</strong>}
            </p>
          </div>
        )}
        {!puzzle && !regions && (
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
        )}
      </header>

      <Board state={state} dispatch={dispatch} onOverflowChange={setPannable} />

      <div className={`banner is-${state.status}`} data-status={state.status}>
        {state.status === 'won' && <span className="banner-icon" aria-hidden="true">★</span>}
        {state.status === 'lost' && <span className="banner-icon" aria-hidden="true">✖</span>}
        <span>{message}</span>
      </div>

      <div className="sr-only" aria-live="polite" role="status">
        {describeAction(state.lastAction, puzzle ? 'Puzzle' : 'Level', regions)} {over ? message : ''}
      </div>

      <section className="controls" aria-label="Controls">
        {puzzle ? (
          <button type="button" className="btn btn-next" data-action="new-puzzle" onClick={() => leave(onNewPuzzle)}>
            New puzzle
          </button>
        ) : state.status === 'won' ? (
          <button type="button" className="btn btn-next" data-action="next-level" onClick={onWin}>
            {winLabel}
          </button>
        ) : rooms ? null : regions ? (
          // Stays in place (disabled) once every area is open, so Undo and Retry never shift under a finger.
          <button type="button" className="btn btn-unlock" data-action="unlock" disabled={!unlockable}
            aria-describedby="supply-hint" onClick={() => dispatch({ type: 'unlock' })}>
            <span className="btn-art" aria-hidden="true"><LockIcon open={nextArea === null} /></span>
            <span>{nextArea !== null ? `Unlock ${regions[nextArea].name}` : 'All areas open'}</span>
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
        {!puzzle && <p className="hint" id="supply-hint">{hint}</p>}
        <div className="row">
          <button type="button" className="btn" data-action="undo" disabled={!canUndo(state)}
            onClick={() => dispatch({ type: 'undo' })}>Undo</button>
          <button type="button" className="btn" data-action="retry"
            onClick={() => dispatch({ type: 'retry' })}>Retry</button>
        </div>
        <button type="button" className="btn btn-quiet" data-action="home" onClick={() => leave(onHome)}>Home</button>
        {puzzle && <PuzzleId id={puzzleId} />}
      </section>
    </>
  );
}
