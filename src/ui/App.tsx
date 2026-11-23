import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { LEVELS, nextLevelIndex, type Level } from '../levels';
import { MAX_TIER, type Item } from '../board';
import { generatePuzzle, TREASURE_TIERS, treasureConfig, type GeneratedPuzzle, type PuzzleConfig } from '../generator';
import { RECIPES, recipeById, type ItemRecipe, type Recipe } from '../recipes';
import { alishaPlate, containerShown, type Container, type LevelDefinition, type LevelGoal, type SessionState } from '../session';
import { ATTIC_LEVEL } from '../attic';
import { hasItem } from '../status';
import { availableTasks, isOpen, nextLocked, sealedRegion, type Region, type Task, type TaskUnlock } from '../regions';
import { Board, ContainerArt, LockIcon, RuneGate, SymbolIcon } from './Board';
import { Comic, ComicOverlay, type ComicScene } from './Comic';
import { CLOSING_PANELS, memoryMusicOn, OPENING_PANELS } from './atticStory';
import { afterOpening, BookOpening } from './BookOpening';
import { atticGuide } from './atticGuide';
import { afterEntranceOpening, afterRecipeIdle, afterStoryDue, ENTRANCE_OPENING_MS } from './entranceGuide';
import { CHAPTER_ONE } from './chapterOne';
import { HelpButton } from './HelpButton';
import { Home } from './Home';
import { LevelPicker } from './LevelPicker';
import { loadPuzzle, PlaySetup } from './PlaySetup';
import { PuzzleId } from './PuzzleId';
import { ReleaseNotes } from './ReleaseNotes';
import { Scores } from './Scores';
import { SceneArt } from './SceneArt';
import gameLandscapeArt from '../assets/art/woodland-cheering-landscape-v1.webp';
import gamePortraitArt from '../assets/art/woodland-cheering-portrait-v1.webp';
import { ChestArt, DustSheetArt, ItemArt, itemLabel, itemName, PrizeArt } from './ItemArt';
import { UpdateControl } from './UpdateControl';
import {
  batchText, branchPlates, isConcealed, isLargeBoard, itemCount, objectiveText, PAN_HINT, plateItems, prizeText, progressText, statusMessage,
  taskNeed, unlockNeed, workshopHint,
} from './messages';
import { useMusic } from './useMusic';
import { JOURNEY_MUSIC, PALACE_MUSIC, PUZZLE_MUSIC, WOODLAND_MUSIC } from '../music';
import { useEffects } from './useEffects';
import { actionEffect, palaceOpeningPending } from './audioEvents';
import type { EffectCue } from '../effects';
import {
  canPlaceSupply, canUndo, canUnlock, initUi, nextSupplyItem, openedRegion, partitionShown, reduceUi, storyDue, storyHeld, storyLifted, supplyRemaining, workshopProgress,
  type LastAction, type UiState,
} from './controller';

function plural(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}

/**
 * The live announcement of the last action. `tasks` (levels with tasks): what its checkpoint did is said instead.
 * `recipe` (Merge to treasure): names the chest and its contents. `containers` (the attic): names a container opened
 * and what came out, or one the action uncovered.
 */
export function describeAction(
  a: LastAction | null, noun: string, goal: LevelGoal, regions?: readonly Region[], tasks?: readonly Task[], recipe?: Recipe,
  containers?: readonly Container[],
): string {
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
  const uncovered = 'revealed' in a && a.revealed !== undefined ? containers?.[a.revealed] : undefined;
  const reveal = uncovered ? ` Under the dust sheet: an ${uncovered.name}, holding ${batchText(uncovered.contents)}. Tap it to open it.` : '';
  switch (a.kind) {
    case 'move': return `Moved an item.${gate}${reveal}`;
    case 'swap': return `Swapped two items.${gate}${reveal}`;
    case 'place': return `Placed ${itemLabel(a.item)} in row ${a.at.row + 1}, column ${a.at.col + 1}.`;
    case 'unlock': return `Unlocked ${regions?.[a.region]?.name ?? 'an area'}.`;
    case 'collect': return prizeText(goal).done;
    // The palace rescue's trap: Alisha's plate opened the rooms across the gallery and shut her in.
    case 'stand': return a.progress
      ? `Alisha stood on the plate.${progressText(a.progress.tasks, a.progress.regions, goal, regions!, tasks!)} A crystal partition closed behind her.`
      : prizeText(goal).done;
    case 'openGoal': return goal.kind === 'item' ? `Opened the ${itemName(goal.item)}.` : '';
    case 'craft': {
      if (!a.made) return `Crafted the ${recipe?.name ?? 'chest'}. Tap it to open it.`;
      const opens = goal.kind === 'item' && goal.open && a.made.family === goal.item.family && a.made.tier >= goal.item.tier;
      return `Made ${itemLabel(a.made)}.${opens ? ' Tap it to open it.' : ''}`;
    }
    case 'open': return recipe ? `Opened the ${recipe.name}: three ${itemLabel(recipe.contents.item)}.` : 'Opened the chest.';
    case 'unpack': {
      const c = containers?.[a.container];
      return c ? `Opened the ${c.name}: ${batchText(c.contents)}.` : 'Opened the box.';
    }
    case 'undo': return 'Undid the last action.';
    case 'retry': return `${noun} restarted.`;
    case 'merge':
      return `Merged ${a.consumed} into ${plural(a.consumed === 3 ? 1 : 2)}: ${itemLabel(a.result as Item)}.${gate}${reveal}`;
  }
}

/**
 * What the live region says after the last action (describeAction), as the board shows it: the regions held back under
 * fog for the story scene it made due (see storyHeld) are left out, so they are neither named nor said to open until the
 * scene has been read; then their opening is said on its own (see storyLifted). The palace rescue's partition is said to
 * open when the board shows it opening (see partitionShown).
 */
export function announcement(state: UiState, noun: string): string {
  const { goal, regions, tasks, recipe, containers, party } = state.session.level;
  const lifted = storyLifted(state);
  if (lifted.length > 0) return progressText([], lifted, goal, regions!, tasks!).trim();
  // The palace rescue: once Fiona has asked about the release, the partition opens and Alisha steps out, said on its own.
  if (partitionShown(state) === 'opening') return 'The crystal partition opened: Alisha is free.';
  const held = storyHeld(state);
  let a = state.lastAction;
  if (a && held.length > 0 && 'progress' in a && a.progress) {
    const opened = 'opened' in a && a.opened !== undefined && !held.includes(a.opened) ? a.opened : undefined;
    a = { ...a, opened, progress: { ...a.progress, regions: a.progress.regions.filter((i) => !held.includes(i)) } } as LastAction;
  }
  // A release with no talk or scene before it opens the partition at once.
  const released = !!party?.trap && partitionShown(state) === null && !!a && 'progress' in a && !!a.progress?.tasks.includes(party.trap.release);
  return `${describeAction(a, noun, goal, regions, tasks, recipe, containers)}${released ? ' The crystal partition opened: Alisha is free.' : ''}`;
}

type Screen =
  | { readonly kind: 'home' }
  | { readonly kind: 'play'; readonly error?: string; readonly loadError?: string }
  | { readonly kind: 'notes' }
  | { readonly kind: 'scores' }
  | { readonly kind: 'pick' }
  | { readonly kind: 'levels' }
  | { readonly kind: 'puzzle'; readonly puzzle: GeneratedPuzzle }
  // The Attic (story prototype, from Levels): its opening comic, the puzzle, then its closing comic.
  | { readonly kind: 'attic'; readonly phase: 'opening' | 'play' | 'closing' }
  // A Chapter 1 level (from Levels, development only): its opening comic, the puzzle (with its own story scenes), then
  // its closing comic, if any, and on to the next level.
  | { readonly kind: 'chapter'; readonly level: number; readonly phase: 'opening' | 'play' | 'closing' };

/**
 * Whether Chapter 1 is in the app (offered in Levels): in the development preview (/dev/) and the local dev server (`npm
 * run dev`). A production build has it false at build time, so the chapter's screens and scenes are left out of its code
 * (Vite still copies the imported draft art into its assets, unreferenced).
 */
export const STORY_PREVIEW = __DEV_PREVIEW__ || import.meta.env.DEV;

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
  if (config.mode === 'treasure') return `Merge to treasure · ${tier} · ${recipeById(config.recipe ?? '')?.name ?? 'Recipe'}`;
  if (config.mode === 'one') return `Merge down to one · ${tier}`;
  return `Merge to goals · ${tier} · ${config.goals} ${config.goals === 1 ? 'goal' : 'goals'}`;
}

export function App({ levels = LEVELS }: { levels?: readonly Level[] }) {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [index, setIndex] = useState(0);
  const [config, setConfig] = useState<PuzzleConfig>({ mode: 'goals', tier: 3, goals: 1 });
  // Chapter 1 (development preview): the level up next, kept in memory only, apart from the numbered levels' progress.
  const [chapterNext, setChapterNext] = useState(0);
  const chapter = STORY_PREVIEW && screen.kind === 'chapter' ? CHAPTER_ONE[screen.level] : null;
  const active = screen.kind === 'levels' ? levels[index].definition : screen.kind === 'puzzle' ? screen.puzzle.definition
    : screen.kind === 'attic' && screen.phase === 'play' ? ATTIC_LEVEL
    : chapter && screen.kind === 'chapter' && screen.phase === 'play' ? chapter.definition
    : null;
  const [musicArea, setMusicArea] = useState<'woodland' | 'palace'>('woodland');
  // The closing comic's last picture, the woodland memory, brings in Woodland Journey once revealed, for the rest of it.
  const [memoryMusic, setMemoryMusic] = useState(false);
  const palaceLevel = active?.regions?.some((r) => r.building === 'palace');
  const music = useMusic(memoryMusic ? JOURNEY_MUSIC : palaceLevel ? musicArea === 'palace' ? PALACE_MUSIC : JOURNEY_MUSIC
    : chapter?.palace ? PALACE_MUSIC : active && isSongGoal(active) ? PUZZLE_MUSIC : WOODLAND_MUSIC);
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
  const show = (next: Screen) => { setMusicArea('woodland'); setMemoryMusic(false); effects.stop(); setScreen(next); setRun((r) => r + 1); };
  // Generation is bounded and only returns verified puzzles; if it fails, nothing unverified is shown.
  const startPuzzle = (cfg: PuzzleConfig, avoid?: number) => {
    try {
      const seed = randomSeed(avoid);
      // Merge to treasure: the seed picks the board's one recipe (in the ID), so New puzzle may bring another and Retry
      // keeps it.
      const config = cfg.mode === 'treasure' ? treasureConfig(RECIPES[seed % RECIPES.length].id, cfg.tier) : cfg;
      show({ kind: 'puzzle', puzzle: generatePuzzle(config, seed) });
    } catch {
      show({ kind: 'play', error: "Couldn't make a puzzle with those settings. Please try again." });
    }
  };
  const toHome = () => show({ kind: 'home' });
  // Chapter 1: each level leads into the next one's opening; after the last, back to Levels.
  const openChapter = (level: number) => { show({ kind: 'chapter', level, phase: 'opening' }); window.scrollTo(0, 0); };
  const afterChapter = (level: number) => (level + 1 < CHAPTER_ONE.length ? openChapter(level + 1) : show({ kind: 'pick' }));
  const inGame = screen.kind === 'levels' || screen.kind === 'puzzle' || ((screen.kind === 'attic' || screen.kind === 'chapter') && screen.phase === 'play');
  const comic = (screen.kind === 'attic' || screen.kind === 'chapter') && screen.phase !== 'play';
  // Home and Play are drawn over full-screen artwork (SceneArt).
  const scene = screen.kind === 'home' || screen.kind === 'play';

  return (
    <main className={`app${inGame ? ' is-game' : ' is-page'}${scene ? ' is-scene' : ''}${screen.kind === 'scores' ? ' is-wide' : ''}${comic ? ' is-comic' : ''}${
      screen.kind === 'pick' ? ' is-levels' : ''}${active?.tasks ? ' has-checklist' : ''}${screen.kind === 'attic' ? ' is-attic' : ''}`}>
      {screen.kind === 'home' && (
        <Home musicControl={musicControl} onPlay={() => show({ kind: 'play' })}
          onStory={STORY_PREVIEW ? () => { show({ kind: 'attic', phase: 'opening' }); window.scrollTo(0, 0); } : undefined}
          onLevels={() => show({ kind: 'pick' })} onScores={() => show({ kind: 'scores' })}
          onReleaseNotes={() => show({ kind: 'notes' })}
          levelsNote={index > 0 ? `Levels continue at level ${index + 1} of ${levels.length}, ${levels[index].name}.` : undefined} />
      )}
      {screen.kind === 'play' && (
        <PlaySetup config={config} onConfig={setConfig} error={screen.error} loadError={screen.loadError} musicControl={musicControl}
          onHome={toHome}
          onLoad={(code) => {
            // A puzzle code reopens that puzzle's exact start (by the generator version it names); nothing else is restored.
            const loaded = loadPuzzle(code);
            if ('puzzle' in loaded) show({ kind: 'puzzle', puzzle: loaded.puzzle });
            else setScreen({ kind: 'play', loadError: loaded.error });
          }}
          onStart={() => startPuzzle(config.mode === 'treasure'
            ? treasureConfig(RECIPES[0].id, TREASURE_TIERS.includes(config.tier) ? config.tier : TREASURE_TIERS[0])
            : { ...config, goals: config.mode === 'one' ? 1 : config.goals })} />
      )}
      {screen.kind === 'notes' && <ReleaseNotes musicControl={musicControl} onHome={toHome} preview={STORY_PREVIEW} />}
      {screen.kind === 'scores' && <Scores musicControl={musicControl} onHome={toHome} />}
      {screen.kind === 'pick' && (
        <LevelPicker levels={levels} current={index} musicControl={musicControl} onHome={toHome}
          onPick={(i) => { setIndex(i); show({ kind: 'levels' }); window.scrollTo(0, 0); }}
          onAttic={() => { show({ kind: 'attic', phase: 'opening' }); window.scrollTo(0, 0); }}
          chapter={STORY_PREVIEW ? { names: CHAPTER_ONE.map((c) => c.name), next: chapterNext, onPick: openChapter } : undefined} />
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
      {screen.kind === 'attic' && screen.phase === 'opening' && (
        <Comic key={run} title="The Attic" label="Opening" panels={OPENING_PANELS}
          finish={{ prompt: 'Tap to start tidying.', name: 'Start tidying' }}
          onFinish={() => show({ kind: 'attic', phase: 'play' })} onHome={toHome} musicControl={musicControl} />
      )}
      {/* With Chapter 1, the Attic is its prologue and leads into its first level, as each level leads into the next. */}
      {screen.kind === 'attic' && screen.phase === 'closing' && (
        <Comic key={run} title="The Attic" label="Ending" panels={CLOSING_PANELS}
          finish={STORY_PREVIEW ? { prompt: 'Tap to continue.', name: 'Continue' } : { prompt: 'Tap to return to Levels.', name: 'Back to Levels' }}
          onFinish={() => (STORY_PREVIEW ? openChapter(0) : show({ kind: 'pick' }))} onPanel={(i) => setMemoryMusic((on) => memoryMusicOn(on, i))}
          onHome={toHome} musicControl={musicControl} />
      )}
      {screen.kind === 'attic' && screen.phase === 'play' && (
        <Game key={run} onMusicAreaChange={setMusicArea} playEffect={effects.play} stopEffects={effects.stop} definition={ATTIC_LEVEL}
          musicControl={musicControl} onHome={toHome} label="Story prototype · The Attic" scene="attic" guide={atticGuide}
          winLabel="Continue" onWin={() => show({ kind: 'attic', phase: 'closing' })} />
      )}
      {chapter && screen.kind === 'chapter' && screen.phase === 'opening' && (
        <Comic key={run} title={chapter.name} label="Opening" panels={chapter.opening} finish={{ prompt: 'Tap to start.', name: 'Start' }}
          onFinish={() => show({ ...screen, phase: 'play' })} onHome={toHome} musicControl={musicControl} />
      )}
      {chapter && screen.kind === 'chapter' && screen.phase === 'play' && (
        <Game key={run} onMusicAreaChange={setMusicArea} playEffect={effects.play} stopEffects={effects.stop} definition={chapter.definition}
          musicControl={musicControl} onHome={toHome} label={`Chapter 1 · ${screen.level + 1} of ${CHAPTER_ONE.length} · ${chapter.name}`}
          scene={chapter.scene} guide={chapter.guide} story={chapter.story && { title: chapter.name, scenes: chapter.story }}
          winLabel={chapter.winLabel}
          onWin={() => {
            setChapterNext(screen.level + 1 < CHAPTER_ONE.length ? screen.level + 1 : 0);
            if (chapter.closing) show({ ...screen, phase: 'closing' }); else afterChapter(screen.level);
          }} />
      )}
      {chapter && screen.kind === 'chapter' && screen.phase === 'closing' && chapter.closing && (
        <Comic key={run} title={chapter.name} label="Ending" panels={chapter.closing}
          finish={screen.level + 1 < CHAPTER_ONE.length ? { prompt: 'Tap to continue.', name: 'Continue' }
            : { prompt: 'To be continued…', name: 'Back to Levels' }}
          onFinish={() => afterChapter(screen.level)} onHome={toHome} musicControl={musicControl} />
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
 * A level with no sealed region (Beyond the gate: one room after another) shows what opens the next gate throughout.
 * `held`: regions held back for a story scene due (see storyHeld), shown as still closed.
 */
export function TaskPanel({ session, held = [] }: { session: SessionState; held?: readonly number[] }) {
  const regions = session.level.regions!;
  const tasks = session.level.tasks!;
  const sealed = sealedRegion(regions);
  if (sealed === -1 || !regions.some((_, i) => i > 0 && isOpen(session, i))) {
    const opens = (t: number) => regions.filter((r, i) => i > 0 && (r.unlock as TaskUnlock).tasks.includes(t));
    const t = availableTasks(session).find((i) => opens(i).length > 0);
    if (t === undefined) {
      return (
        <div className="panel next-area" data-next-area>
          <div className="art"><span className="art-glyph" aria-hidden="true">✓</span></div>
          <p><strong>All gates open</strong></p>
        </div>
      );
    }
    // A room still hidden, or a concealed part of one, is not named: only the marked tiles and what they need.
    const { plates } = tasks[t];
    if (opens(t).some((r) => r.hidden || isConcealed(r)) && plates.length > 0) {
      return (
        <div className="panel next-area" data-next-area>
          <div className="art"><ItemArt item={plates[0].item} /></div>
          <p><strong>Marked {plates.length > 1 ? 'tiles' : 'tile'} in {regions[tasks[t].in].name}</strong><br />Needs {plateItems(plates)}</p>
        </div>
      );
    }
    const names = opens(t).map((r) => r.name);
    return (
      <div className="panel next-area" data-next-area>
        <div className="art"><RuneGate /></div>
        <p><strong>Rune {names.length > 1 ? 'gates' : 'gate'}: {names.join(', ')}</strong><br />Needs {taskNeed(regions, tasks[t])}</p>
      </div>
    );
  }
  const needs = (regions[sealed].unlock as TaskUnlock).tasks;
  const open = isOpen(session, sealed);
  const lit = needs.filter((t) => session.done.includes(t)).length;
  return (
    <div className="panel next-area is-checklist" data-next-area>
      <ul className="checklist" aria-label={`Progress to ${regions[sealed].name}`}>
        {needs.map((t) => {
          const done = session.done.includes(t);
          const reachable = isOpen(session, tasks[t].in) && !held.includes(tasks[t].in);
          const plates = branchPlates(session, t);
          return (
            <li key={t} className={done ? 'is-done' : undefined} data-task={t}>
              <span className="check-symbol" aria-hidden="true"><SymbolIcon symbol={tasks[t].symbol!} lit={done} /></span>
              {/* A room still hidden (the woodland cleanup's depot) is not named before it is found. */}
              <span className="check-name">{regions[tasks[t].in].hidden && !reachable ? 'Not found yet' : regions[tasks[t].in].name}</span>
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

/**
 * Container levels (the attic): a checklist of the boxes. A covered one shows what uncovers it; an uncovered one what it
 * holds (fixed, shown before opening); an opened one is ticked.
 */
export function ContainerPanel({ session }: { session: SessionState }) {
  const containers = session.level.containers!;
  return (
    <div className="panel next-area is-checklist is-containers" data-containers>
      <ul className="checklist" aria-label="Boxes">
        {containers.map((c, i) => {
          const opened = session.unpacked.includes(i);
          const shown = containerShown(session, i);
          const need = c.hiddenUntil;
          return (
            <li key={c.name} className={opened ? 'is-done' : undefined} data-container-row={i}>
              <span className="check-symbol" aria-hidden="true">{shown ? <ContainerArt art={c.art} /> : <DustSheetArt />}</span>
              <span className="check-name">{shown ? c.name[0].toUpperCase() + c.name.slice(1) : 'Dust sheet'}</span>
              <span className="check-state">
                {opened ? <span className="check-mark" aria-hidden="true">✓</span>
                  : !shown && need ? (
                    <span className="check-need" aria-hidden="true">tidy: <span className="check-item"><ItemArt item={need} /></span></span>
                  ) : (
                    <span className="check-need" aria-hidden="true">
                      {c.contents.length} × <span className="check-item"><ItemArt item={c.contents[0]} /></span>
                    </span>
                  )}
                <span className="sr-only">
                  : {opened ? 'opened' : !shown && need ? `make ${itemLabel(need)} to finish tidying` : `holds ${batchText(c.contents)}`}
                </span>
              </span>
            </li>
          );
        })}
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
  /**
   * Handcrafted levels: the button offered after winning (the level's final action on the board). With an `open` item
   * goal (the attic), opening the goal item wins, and the button is enabled once its opening has played (see BookOpening).
   */
  winLabel?: string;
  onWin?: () => void;
  /** Generated puzzles: the reproduction ID, and New puzzle (offered throughout). */
  puzzleId?: string;
  onNewPuzzle?: () => void;
  /**
   * The attic story prototype: its own room in place of the woodland backdrop and tiles. Chapter 1: the woodland
   * ('entrance') or the palace's marble halls ('palace'), with tiles' edges hidden while idle (see Board).
   */
  scene?: 'attic' | 'entrance' | 'palace';
  /** A level's own banner text, in place of statusMessage (the attic's step-by-step guidance). */
  guide?: (state: UiState) => string;
  /**
   * Party levels: the story scenes shown during play, by id (see storyDue), and their comic's title. Each is shown over
   * the paused game once due (after STORY_DELAY_MS), one line at a time; reading it to the end returns to the board.
   */
  story?: { readonly title: string; readonly scenes: Readonly<Record<string, ComicScene>> };
}

/**
 * Merge to treasure: the board's one recipe on a sign by it (each ingredient with its exact tier and count, ticked once
 * on the board, then the chest and its fixed contents) and the goal. Crafting is a drop of one ingredient onto the
 * other on the board; the banner and Help say so.
 */
export function RecipeSign({ recipe, state }: { recipe: Recipe; state: UiState }) {
  const { session } = state;
  const { goal } = session.level;
  const items = session.board.flat();
  const crafted = !!session.chest || session.opened;
  const contents = recipe.contents;
  return (
    <section className="panel goal is-wide recipe" aria-label={`Recipe: ${recipe.name}`} data-recipe={recipe.id}>
      <div className="recipe-row">
        {recipe.ingredients.map(({ item, count }, i) => {
          const have = crafted || items.filter((c) => c && c.family === item.family && c.tier === item.tier).length >= count;
          return (
            <span key={`${item.family}${item.tier}`} className="recipe-step">
              {i > 0 && <span className="recipe-op" aria-hidden="true">+</span>}
              <span className={`recipe-part${have ? ' is-done' : ''}`} role="img"
                aria-label={`${count} × ${itemLabel(item)}${have ? ', ready' : ''}`}>
                <span className="recipe-count" aria-hidden="true">{count}×</span>
                <span className="art"><ItemArt item={item} /></span>
                {have && <span className="target-check" aria-hidden="true">✓</span>}
              </span>
            </span>
          );
        })}
        <span className="recipe-op" aria-hidden="true">→</span>
        <span className={`recipe-part${crafted ? ' is-done' : ''}`} role="img" aria-label={`${recipe.name}${crafted ? ', crafted' : ''}`}>
          <span className="art"><ChestArt /></span>
        </span>
        <span className="recipe-op" aria-hidden="true">→</span>
        <span className={`recipe-part${session.opened ? ' is-done' : ''}`} role="img"
          aria-label={`${contents.count} × ${itemLabel(contents.item)} inside`}>
          <span className="recipe-count" aria-hidden="true">{contents.count}×</span>
          <span className="art"><ItemArt item={contents.item} /></span>
        </span>
      </div>
      {goal.kind === 'leaveOne' && goal.item && <p className="recipe-goal">Goal: make {itemLabel(goal.item)}</p>}
    </section>
  );
}

/**
 * An item recipe (the attic): a compact reminder in the goal panel, in the recipe sign's style: the two ingredients (each
 * ticked once on the board), what they make (ticked once made), and the goal.
 */
export function CraftSign({ craft, state }: { craft: ItemRecipe; state: UiState }) {
  const { board, level } = state.session;
  const made = hasItem(board, craft.result);
  const part = (item: Item, done: boolean, word: string) => (
    <span className={`recipe-part${done ? ' is-done' : ''}`} role="img" aria-label={`${itemLabel(item)}${done ? `, ${word}` : ''}`}>
      <span className="art"><ItemArt item={item} /></span>
      {done && <span className="target-check" aria-hidden="true">✓</span>}
    </span>
  );
  return (
    <section className="panel goal recipe" aria-label="Recipe" data-craft>
      <div className="recipe-row">
        {craft.ingredients.map((item, i) => (
          <span key={`${item.family}${item.tier}`} className="recipe-step">
            {i > 0 && <span className="recipe-op" aria-hidden="true">+</span>}
            {part(item, made || board.some((r) => r.some((c) => !!c && c.family === item.family && c.tier === item.tier)), 'ready')}
          </span>
        ))}
        <span className="recipe-op" aria-hidden="true">→</span>
        {part(craft.result, made, 'made')}
      </div>
      <p className="recipe-goal">{objectiveText(level.goal)}</p>
    </section>
  );
}

export function Game({
  definition, label, musicControl, onHome, winLabel, onWin, puzzleId, onNewPuzzle, onMusicAreaChange, playEffect, stopEffects, scene, guide,
  story,
}: GameProps) {
  const [state, dispatch] = useReducer(reduceUi, definition, initUi);
  const handled = useRef(0);
  const palacePlayed = useRef(0);
  // A winning action with its own presentation on the board enables the next-level button once that has played: the
  // palace entrance opening (at once under reduced motion) and the attic's Picture Book opening. Until then the button
  // stays in place, disabled. The wait is cancelled by the next action (Retry) and by leaving (Home).
  const [presented, setPresented] = useState(-1);
  useEffect(() => {
    const seq = state.actionSeq;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return afterEntranceOpening(state, () => setPresented(seq), still ? 0 : ENTRANCE_OPENING_MS)
      ?? afterOpening(state, () => setPresented(seq));
  }, [state.actionSeq]);
  const presenting = (!!state.session.level.party?.door && state.lastAction?.kind === 'stand') || state.lastAction?.kind === 'openGoal';
  // Party levels: a story scene due is shown once the board has shown the move that made it due; the wait is cancelled
  // the same way. Reading it changes neither the session nor actionSeq.
  const due = storyDue(state);
  const [storyReady, setStoryReady] = useState(-1);
  useEffect(() => {
    const seq = state.actionSeq;
    return afterStoryDue(state, () => setStoryReady(seq));
  }, [state.actionSeq, due]);
  const storyScene = due !== null && storyReady === state.actionSeq ? story?.scenes[due] : undefined;
  // The regions held back for it, under fog and not named until it has been read (see storyHeld).
  const held = storyHeld(state);
  // A workshop's recipe hint (the bird room): shown once the player has gone RECIPE_HINT_MS without progress on the recipe
  // (see workshopProgress), and until the next progress or Retry (which start the wait again) or leaving. It hides while
  // the board is paused for talk or a scene, and comes back after unless there was progress.
  const recipeKey = workshopProgress(state);
  const workshopTip = workshopHint(state);
  const [hintFor, setHintFor] = useState<string | null>(null);
  useEffect(() => setHintFor(null), [recipeKey]);
  useEffect(() => afterRecipeIdle(state, () => setHintFor(recipeKey)), [recipeKey, workshopTip !== null]);
  const recipeHint = workshopTip !== null && hintFor === recipeKey ? workshopTip : null;
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
  const { goal, regions, tasks, recipe, containers, craft, party, workshop } = state.session.level;
  const nextArea = regions ? nextLocked(state.session) : null;
  const nextUnlock = nextArea !== null ? regions![nextArea].unlock : undefined;
  const concealedPlates = nextArea !== null && isConcealed(regions![nextArea]) && nextUnlock && 'plates' in nextUnlock
    ? nextUnlock.plates : null;
  const plateRoom = nextUnlock && !('tasks' in nextUnlock) ? regions![nextUnlock.in].name : '';
  const unlockable = canUnlock(state);
  // Room levels: gates open by themselves, so there is no Unlock button; the goal is the treasure.
  const rooms = goal.kind === 'treasure';
  const single = goal.kind === 'items' || goal.kind === 'treasure' ? undefined : goal.item;
  // Once won, the next-level button sits beside Home in the first row of the controls: in levels with tasks (level 9 and
  // the chapter's room levels), so Undo, Retry and Home stay on an iPad's screen, and in every story level (the attic and
  // Chapter 1, which have a scene), so Continue is always in the same place after the level's final action.
  const nextBesideHome = !!tasks || scene !== undefined;
  const next = nextSupplyItem(state);
  const left = supplyRemaining(state);
  const canSupply = canPlaceSupply(state);
  const over = state.status !== 'playing';
  // Measured by Board once laid out (and on resize); until then, guessed from the board's size.
  const [pannable, setPannable] = useState(() => isLargeBoard(definition.board));
  // The workshop's hint, once due, takes the banner's place (the next step for its recipe), so nothing moves on screen.
  const guided = recipeHint ?? guide?.(state);
  const message = guided === undefined ? statusMessage(state, pannable)
    : pannable && state.status === 'playing' && !recipeHint ? `${guided} ${PAN_HINT}` : guided;
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
  } else if (containers || definition.supply.length === 0) {
    // Container levels have no supply: their boxes are on the board. Nor has Meet Fiona: its pieces are all there.
  } else if (canSupply) hint = 'Lands in a random empty cell';
  else if (!over) hint = left <= 0 ? 'No supply left' : 'Board is full';

  return (
    <>
      {/* Decorative: web copies of artwork/gameplay/woodland-cheering-*-v1.png, behind the unchanged board layout. */}
      {scene !== 'attic' && <SceneArt className="is-game" landscape={gameLandscapeArt} portrait={gamePortraitArt} alt="" />}
      <header className={`info${regions ? ' has-regions' : ''}${containers ? ' has-containers' : ''}`}>
        <div className="title-row">
          <h1>Elkchemy</h1>
          <div className="title-controls">
            {musicControl}
            <HelpButton goal={goal} largeBoard={pannable} puzzle={puzzle} regions={regions} tasks={tasks} recipe={recipe} containers={!!containers}
              workshop={workshop !== undefined ? regions![workshop].name : undefined}
              craft={craft} unlocked={tasks ? (i: number) => isOpen(state.session, i) && !held.includes(i) : state.session.unlocked}
              party={party ? ((alishaPlate(state.session) && held.length === 0) || state.session.collected || state.session.done.some((t) => tasks![t].alisha)
                ? 'plate' : 'hidden') : undefined} />
          </div>
        </div>
        <p className="level-label">{label}</p>
        {recipe && workshop === undefined ? <RecipeSign recipe={recipe} state={state} /> : craft ? <CraftSign craft={craft} state={state} /> : (
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
        )}
        {regions && tasks && <TaskPanel session={state.session} held={held} />}
        {/* The palace rescue: the workshop's recipe, while its room is open and its chest still to open. */}
        {recipe && workshop !== undefined && isOpen(state.session, workshop) && !state.session.opened && <RecipeSign recipe={recipe} state={state} />}
        {containers && <ContainerPanel session={state.session} />}
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
        {!puzzle && !regions && !containers && definition.supply.length > 0 && (
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

      <Board state={state} dispatch={dispatch} onOverflowChange={setPannable} onPalaceOpening={palaceOpening} onPresentationCancel={stopEffects}
        scene={scene} sceneShowing={storyScene !== undefined} />
      {state.lastAction?.kind === 'openGoal' && <BookOpening />}

      <div className={`banner is-${state.status}${recipeHint ? ' is-hint' : ''}`} data-status={state.status}>
        {state.status === 'won' && <span className="banner-icon" aria-hidden="true">★</span>}
        {state.status === 'lost' && <span className="banner-icon" aria-hidden="true">✖</span>}
        <span>{message}</span>
      </div>

      <div className="sr-only" aria-live="polite" role="status">
        {announcement(state, puzzle ? 'Puzzle' : 'Level')} {over ? message : ''}
      </div>
      {/* The workshop's hint, said once when it comes (the banner itself isn't announced). */}
      {workshop !== undefined && <div className="sr-only" aria-live="polite" role="status" data-recipe-hint>{recipeHint ?? ''}</div>}

      {storyScene && (
        <ComicOverlay key={due} title={story!.title} label={storyScene.label} panels={storyScene.panels}
          finish={{ prompt: 'Tap to return to the board.', name: 'Back to the board' }}
          onFinish={() => dispatch({ type: 'finishStory' })} onHome={() => leave(onHome)} musicControl={musicControl} />
      )}

      <section className="controls" aria-label="Controls">
        {puzzle ? (
          <button type="button" className="btn btn-next" data-action="new-puzzle" onClick={() => leave(onNewPuzzle)}>
            New puzzle
          </button>
        ) : state.status === 'won' ? (
          nextBesideHome ? (
            <div className="row">
              {/* Enabled once the win's own presentation has played (the palace entrance or the Picture Book opening); it
                  stays in place, disabled, until then. */}
              <button type="button" className="btn btn-next" data-action="next-level"
                disabled={presenting && presented !== state.actionSeq} onClick={onWin}>{winLabel}</button>
              {homeButton}
            </div>
          ) : (
            <button type="button" className="btn btn-next" data-action="next-level" onClick={onWin}>
              {winLabel}
            </button>
          )
        ) : rooms || containers || (!puzzle && !regions && definition.supply.length === 0) ? null : regions ? (
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
        {!puzzle && !containers && definition.supply.length + (regions?.length ?? 0) > 0 && (hint || !tasks) && <p className="hint" id="supply-hint">{hint}</p>}
        <div className={`row${workshop !== undefined && state.status === 'playing' ? ' has-workshop-home' : ''}`}>
          <button type="button" className="btn" data-action="undo" disabled={!canUndo(state)}
            onClick={() => dispatch({ type: 'undo' })}>Undo</button>
          <button type="button" className="btn" data-action="retry"
            onClick={() => dispatch({ type: 'retry' })}>Retry</button>
          {workshop !== undefined && state.status === 'playing' && homeButton}
        </div>
        {!(nextBesideHome && state.status === 'won') && !(workshop !== undefined && state.status === 'playing') && homeButton}
        {puzzle && <PuzzleId id={puzzleId} />}
      </section>
    </>
  );
}
