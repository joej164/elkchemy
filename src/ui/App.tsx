import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { LEVELS, nextLevelIndex, type Level } from '../levels';
import { MAX_TIER, type Item } from '../board';
import { generatePuzzle, type GeneratedPuzzle, type PuzzleConfig } from '../generator';
import type { LevelDefinition, LevelGoal, SessionState } from '../session';
import { hasItem } from '../status';
import { availableTasks, isOpen, nextLocked, sealedRegion, type Region, type Task, type TaskUnlock } from '../regions';
import { Board, LockIcon, RuneGate, SymbolIcon } from './Board';
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
import { ItemArt, itemLabel, PrizeArt } from './ItemArt';
import { UpdateControl } from './UpdateControl';
import {
  branchPlates, isConcealed, isLargeBoard, itemCount, objectiveText, plateItems, prizeText, progressText, statusMessage, taskNeed, unlockNeed,
} from './messages';
import { useMusic } from './useMusic';
import { JOURNEY_MUSIC, PALACE_MUSIC, PUZZLE_MUSIC, WOODLAND_MUSIC } from '../music';
import { useEffects } from './useEffects';
import { actionEffect, palaceOpeningPending } from './audioEvents';
import type { EffectCue } from '../effects';
import {
  canPlaceSupply, canUndo, canUnlock, initUi, nextSupplyItem, openedRegion, reduceUi, supplyRemaining,
  type LastAction,
} from './controller';

function plural(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}

/** The live announcement of the last action. `tasks` (levels with tasks): what its checkpoint did is said instead. */
export function describeAction(a: LastAction | null, noun: string, goal: LevelGoal, regions?: readonly Region[], tasks?: readonly Task[]): string {
  if (!a) return '';
  // Room levels: a drop that opened a gate says so; one that revealed a concealed part of a room says that instead.
  const opened = a.kind !== 'unlock' && openedRegion(a);
  const area = opened ? regions?.[opened] : undefined;
  const host = area?.joins !== undefined ? regions![area.joins].name : '';
  const progress = 'progress' in a ? a.progress : undefined;
  const gate = progress ? progressText(progress.tasks, progress.regions, goal, regions!, tasks!)
    : !opened ? ''
    : area && isConcealed(area) ? ` More of ${host} was revealed, with more items to use.`
    : ` The rune gate to ${area?.name ?? 'the next room'} opened.${host ? ` Its items join ${host}'s.` : ''}`;
  switch (a.kind) {
    case 'move': return `Moved an item.${gate}`;
    case 'swap': return `Swapped two items.${gate}`;
    case 'place': return `Placed ${itemLabel(a.item)} in row ${a.at.row + 1}, column ${a.at.col + 1}.`;
    case 'unlock': return `Unlocked ${regions?.[a.region]?.name ?? 'an area'}.`;
    case 'collect': return prizeText(goal).done;
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
  const tier = `Tier ${config.tier + 1} of ${MAX_TIER + 1}`;
  if (config.mode === 'one') return `Merge down to one · ${tier}`;
  return `Merge to goals · ${tier} · ${config.goals} ${config.goals === 1 ? 'goal' : 'goals'}`;
}

export function App({ levels = LEVELS }: { levels?: readonly Level[] }) {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [index, setIndex] = useState(0);
  const [config, setConfig] = useState<PuzzleConfig>({ mode: 'goals', tier: 3, goals: 1 });
  const active = screen.kind === 'levels' ? levels[index].definition : screen.kind === 'puzzle' ? screen.puzzle.definition : null;
  const [musicArea, setMusicArea] = useState<'woodland' | 'palace'>('woodland');
  const palaceLevel = active?.regions?.some((r) => r.building === 'palace');
  const music = useMusic(palaceLevel ? musicArea === 'palace' ? PALACE_MUSIC : JOURNEY_MUSIC
    : active && isSongGoal(active) ? PUZZLE_MUSIC : WOODLAND_MUSIC);
  const effects = useEffects();
  const musicControl = (
    <>
      <button type="button" className="music-button" data-action="music"
        aria-label={music.enabled ? 'Mute music' : music.error ? 'Retry music' : 'Turn music on'}
        aria-pressed={music.enabled} aria-busy={music.loading}
        onClick={music.toggle}>
        <span aria-hidden="true">♪</span> Music: {music.error ? 'retry' : music.enabled ? 'on' : 'off'}
      </button>
      <button type="button" className="music-button effects-button" data-action="effects"
        aria-label={effects.error ? 'Retry sound effects' : effects.enabled ? 'Turn sound effects off' : 'Turn sound effects on'}
        aria-pressed={effects.enabled} aria-busy={effects.loading} onClick={effects.toggle}>
        <span className="effects-full">Sound effects</span><span className="effects-short" aria-hidden="true">Effects</span>: {effects.error ? 'retry' : effects.enabled ? 'on' : 'off'}
      </button>
      <span className="sr-only" role="status">
        {effects.error ? 'Sound effects could not play. Tap Sound effects to try again.' : effects.loading ? 'Loading sound effects.' : ''}
      </span>
      <span className="sr-only" role="status">
        {music.error ? 'Music could not play. Tap Music to try again.' : music.loading ? 'Loading music.' : ''}
      </span>
    </>
  );
  // Bumped on every screen change, Next level and New puzzle, so the game remounts even when the definition repeats.
  const [run, setRun] = useState(0);
  const show = (next: Screen) => { setMusicArea('woodland'); effects.stop(); setScreen(next); setRun((r) => r + 1); };
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
    <main className={`app${inGame ? ' is-game' : ' is-page'}${scene ? ' is-scene' : ''}${screen.kind === 'scores' ? ' is-wide' : ''}${
      screen.kind === 'pick' ? ' is-levels' : ''}${active?.tasks ? ' has-checklist' : ''}`}>
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
        <Game key={run} onMusicAreaChange={setMusicArea} playEffect={effects.play} stopEffects={effects.stop} definition={levels[index].definition} musicControl={musicControl} onHome={toHome}
          label={`Level ${index + 1} of ${levels.length} · ${levels[index].name}`}
          winLabel={nextLevelIndex(index, levels.length) === 0 ? 'Play again from level 1' : 'Next level'}
          onWin={() => { setMusicArea('woodland'); setIndex(nextLevelIndex(index, levels.length)); setRun((r) => r + 1); }} />
      )}
      {screen.kind === 'puzzle' && (
        <Game key={run} onMusicAreaChange={setMusicArea} playEffect={effects.play} stopEffects={effects.stop} definition={screen.puzzle.definition} musicControl={musicControl} onHome={toHome}
          label={puzzleLabel(screen.puzzle.config)} puzzleId={screen.puzzle.id}
          onNewPuzzle={() => startPuzzle(screen.puzzle.config, screen.puzzle.seed)} />
      )}
      <footer className="app-footer">
        <UpdateControl />
      </footer>
    </main>
  );
}

/**
 * Levels with tasks: until the first gate opens, what opens it (as for other room levels); then a checklist of the rooms
 * the sealed region needs, each with its symbol (lit once done) and what it asks for now, and the sealed region itself.
 */
export function TaskPanel({ session }: { session: SessionState }) {
  const regions = session.level.regions!;
  const tasks = session.level.tasks!;
  if (!regions.some((_, i) => i > 0 && isOpen(session, i))) {
    const t = availableTasks(session)[0];
    const names = regions.flatMap((r, i) => (i > 0 && (r.unlock as TaskUnlock).tasks.includes(t) ? [r.name] : []));
    return (
      <div className="panel next-area" data-next-area>
        <div className="art"><RuneGate /></div>
        <p><strong>Rune {names.length > 1 ? 'gates' : 'gate'}: {names.join(', ')}</strong><br />Needs {taskNeed(regions, tasks[t])}</p>
      </div>
    );
  }
  const sealed = sealedRegion(regions);
  const needs = (regions[sealed].unlock as TaskUnlock).tasks;
  const open = isOpen(session, sealed);
  const lit = needs.filter((t) => session.done.includes(t)).length;
  return (
    <div className="panel next-area is-checklist" data-next-area>
      <ul className="checklist" aria-label={`Progress to ${regions[sealed].name}`}>
        {needs.map((t) => {
          const done = session.done.includes(t);
          const reachable = isOpen(session, tasks[t].in);
          const plates = branchPlates(session, t);
          return (
            <li key={t} className={done ? 'is-done' : undefined} data-task={t}>
              <span className="check-symbol" aria-hidden="true"><SymbolIcon symbol={tasks[t].symbol!} lit={done} /></span>
              <span className="check-name">{regions[tasks[t].in].name}</span>
              <span className="check-state">
                {done ? <span className="check-mark" aria-hidden="true">✓</span>
                  : !reachable ? <span className="check-lock" aria-hidden="true"><LockIcon /></span>
                  : plates.map((pl) => (
                    <span key={`${pl.row},${pl.col}`} className="check-need" aria-hidden="true">
                      <span className="check-item"><ItemArt item={pl.item} /></span>tier {pl.item.tier + 1} of {MAX_TIER + 1}
                    </span>
                  ))}
                <span className="sr-only">: {done ? 'complete' : !reachable ? 'gate closed' : `needs ${plateItems(plates)}`}</span>
              </span>
            </li>
          );
        })}
        <li className={open ? 'is-done' : undefined} data-task="sealed">
          <span className="check-symbol check-lock" aria-hidden="true"><LockIcon open={open} /></span>
          <span className="check-name">{regions[sealed].name}</span>
          <span className="check-state">
            {open ? 'Open' : `${lit} of ${needs.length}`}<span className="sr-only">{open ? '' : ' symbols lit, sealed'}</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

interface GameProps {
  onMusicAreaChange?: (area: 'woodland' | 'palace') => void;
  playEffect?: (cue: EffectCue) => void;
  stopEffects?: () => void;
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

export function Game({ definition, label, musicControl, onHome, winLabel, onWin, puzzleId, onNewPuzzle, onMusicAreaChange, playEffect, stopEffects }: GameProps) {
  const [state, dispatch] = useReducer(reduceUi, definition, initUi);
  const handled = useRef(0);
  const palacePlayed = useRef(0);
  useEffect(() => { onMusicAreaChange?.(state.musicArea); }, [state.musicArea, onMusicAreaChange]);
  useEffect(() => () => stopEffects?.(), [stopEffects]);
  useEffect(() => {
    if (handled.current === state.actionSeq) return;
    handled.current = state.actionSeq;
    if (state.lastAction?.kind === 'undo' || state.lastAction?.kind === 'retry') stopEffects?.();
    if (!palaceOpeningPending(state)) {
      const cue = actionEffect(state);
      if (cue) playEffect?.(cue);
    }
  }, [state.actionSeq, playEffect, stopEffects]);
  const palaceOpening = (seq: number) => {
    if (seq !== state.actionSeq || palacePlayed.current === seq || !palaceOpeningPending(state)) return;
    palacePlayed.current = seq;
    playEffect?.('completion');
  };
  const puzzle = puzzleId !== undefined;
  const { goal, regions, tasks } = state.session.level;
  const nextArea = regions ? nextLocked(state.session) : null;
  const nextUnlock = nextArea !== null ? regions![nextArea].unlock : undefined;
  const concealedPlates = nextArea !== null && isConcealed(regions![nextArea]) && nextUnlock && 'plates' in nextUnlock
    ? nextUnlock.plates : null;
  const plateRoom = nextUnlock && !('tasks' in nextUnlock) ? regions![nextUnlock.in].name : '';
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

  const homeButton = <button type="button" className="btn btn-quiet" data-action="home" onClick={() => leave(onHome)}>Home</button>;

  let hint = '';
  // Levels with tasks (level 9) draw no hint row at all, to keep their controls on screen; Help explains the gates.
  if (rooms) {
    if (!over && !tasks && nextArea !== null) hint = 'Gates open by themselves and stay open';
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
            <HelpButton goal={goal} largeBoard={pannable} puzzle={puzzle} regions={regions} tasks={tasks}
              unlocked={tasks ? (i: number) => isOpen(state.session, i) : state.session.unlocked} />
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
              {goal.kind === 'treasure' ? <PrizeArt prize={goal.prize} open={state.session.collected} />
                : single ? <ItemArt item={single} /> : <span className="art-glyph" aria-hidden="true">1</span>}
            </div>
          )}
          <p>
            {objectiveText(goal, regions)}
            {goal.kind === 'items' && <><br />{goal.items.filter((t) => hasItem(state.session.board, t)).length} of {goal.items.length} done</>}
            {goal.kind === 'leaveOne' && <><br />On board: {itemCount(state)}</>}
          </p>
        </div>
        {regions && tasks && <TaskPanel session={state.session} />}
        {regions && !tasks && (
          <div className="panel next-area" data-next-area>
            <div className="art">
              {nextArea === null ? <span className="art-glyph" aria-hidden="true">✓</span>
                : concealedPlates ? <ItemArt item={concealedPlates[0].item} />
                : rooms ? <RuneGate />
                : <ItemArt item={(regions[nextArea].unlock as { item: Item }).item} />}
            </div>
            <p>
              {/* A concealed part of a room is not named: only its marked tile and item are. */}
              {nextArea !== null && concealedPlates ? (
                <><strong>Marked {concealedPlates.length > 1 ? 'tiles' : 'tile'} in {plateRoom}</strong><br />Needs {plateItems(concealedPlates)}</>
              ) : nextArea !== null ? (
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

      <Board state={state} dispatch={dispatch} onOverflowChange={setPannable} onPalaceOpening={palaceOpening} onPresentationCancel={stopEffects} />

      <div className={`banner is-${state.status}`} data-status={state.status}>
        {state.status === 'won' && <span className="banner-icon" aria-hidden="true">★</span>}
        {state.status === 'lost' && <span className="banner-icon" aria-hidden="true">✖</span>}
        <span>{message}</span>
      </div>

      <div className="sr-only" aria-live="polite" role="status">
        {describeAction(state.lastAction, puzzle ? 'Puzzle' : 'Level', goal, regions, tasks)} {over ? message : ''}
      </div>

      <section className="controls" aria-label="Controls">
        {puzzle ? (
          <button type="button" className="btn btn-next" data-action="new-puzzle" onClick={() => leave(onNewPuzzle)}>
            New puzzle
          </button>
        ) : state.status === 'won' ? (
          // Level 9 (a level with tasks): once won, Home sits beside the next-level button, so no row is added and
          // Undo, Retry and Home stay on an iPad's screen.
          tasks ? (
            <div className="row">
              <button type="button" className="btn btn-next" data-action="next-level" onClick={onWin}>{winLabel}</button>
              {homeButton}
            </div>
          ) : (
            <button type="button" className="btn btn-next" data-action="next-level" onClick={onWin}>
              {winLabel}
            </button>
          )
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
        {!puzzle && (hint || !tasks) && <p className="hint" id="supply-hint">{hint}</p>}
        <div className="row">
          <button type="button" className="btn" data-action="undo" disabled={!canUndo(state)}
            onClick={() => dispatch({ type: 'undo' })}>Undo</button>
          <button type="button" className="btn" data-action="retry"
            onClick={() => dispatch({ type: 'retry' })}>Retry</button>
        </div>
        {!(tasks && state.status === 'won') && homeButton}
        {puzzle && <PuzzleId id={puzzleId} />}
      </section>
    </>
  );
}
