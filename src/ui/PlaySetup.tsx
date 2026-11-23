import { useId, useState, type FormEvent, type ReactNode } from 'react';
import landscapeArt from '../assets/art/alisha-elk-play-landscape-v4.webp';
import portraitArt from '../assets/art/alisha-elk-play-portrait-v1.webp';
import { SceneArt } from './SceneArt';
import { MAX_TIER } from '../board';
import {
  generatePuzzle, GENERATOR_VERSIONS, GOAL_COUNTS, parsePuzzleId, TARGET_TIERS, TREASURE_TIERS, type GeneratedPuzzle, type PuzzleConfig,
  type PuzzleMode,
} from '../generator';

const MODES: readonly (readonly [PuzzleMode, string])[] = [
  ['goals', 'Merge to goals'], ['one', 'Merge down to one'], ['treasure', 'Merge to treasure'],
];
const MODE_TEXT: Record<PuzzleMode, string> = {
  goals: 'Make the goal items. Leftover pieces are fine.',
  one: 'One family of items. Finish with exactly one item, at the target tier.',
  treasure: 'Merge pieces into the recipe\'s two ingredients, drop one onto the other to craft its chest, open it, and merge up to the goal.',
};

const tiersFor = (mode: PuzzleMode) => (mode === 'treasure' ? TREASURE_TIERS : TARGET_TIERS);

/** A new mode keeps the chosen target tier when that mode offers it, and otherwise takes its lowest tier. */
export function switchMode(config: PuzzleConfig, mode: PuzzleMode): PuzzleConfig {
  const tiers = tiersFor(mode);
  return { ...config, mode, tier: tiers.includes(config.tier) ? config.tier : tiers[0] };
}

/**
 * Load puzzle code: the exact starting board of a puzzle ID (see parsePuzzleId), rebuilt by the generator version it
 * names, or the reason it can't be. Surrounding whitespace and letter case don't matter. Nothing but the start is
 * restored: a code holds no moves.
 */
export function loadPuzzle(code: string): { readonly puzzle: GeneratedPuzzle } | { readonly error: string } {
  const text = code.trim();
  if (!text) return { error: 'Type or paste a puzzle code first.' };
  const parsed = parsePuzzleId(text);
  if (!parsed) {
    const version = /^v(\d+)-/i.exec(text);
    return {
      error: version && !GENERATOR_VERSIONS.includes(Number(version[1]))
        ? `That code is from a version of the puzzle maker this game can't load (v${Number(version[1])}).`
        : "That isn't a puzzle code this game can load. Check it and try again.",
    };
  }
  try {
    return { puzzle: generatePuzzle(parsed.config, parsed.seed, parsed.version) };
  } catch {
    return { error: "Couldn't rebuild that puzzle. Check the code and try again." };
  }
}

function Choice<T extends string | number>({ name, legend, options, value, onChange }: {
  name: string; legend: string; options: readonly (readonly [T, string])[]; value: T; onChange: (value: T) => void;
}) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="choice-options">
        {options.map(([v, label]) => (
          <label key={v} className={`choice-option${v === value ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={v} checked={v === value} onChange={() => onChange(v)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Puzzles screen (Home's Puzzles): choose a generated puzzle's mode and settings, or load a puzzle code (`onLoad`, given
 * the text as typed; `loadError` says why the last one couldn't be loaded).
 */
export function PlaySetup({ config, onConfig, onStart, onLoad, onHome, error, loadError, musicControl }: {
  config: PuzzleConfig;
  onConfig: (config: PuzzleConfig) => void;
  onStart: () => void;
  onLoad?: (code: string) => void;
  onHome: () => void;
  error?: string;
  loadError?: string;
  musicControl: ReactNode;
}) {
  const [code, setCode] = useState('');
  const codeId = useId();
  const load = (e: FormEvent) => {
    e.preventDefault();
    onLoad?.(code);
  };
  return (
    <div className="page scene-page play-setup">
      {/* Web copies of artwork/play/alisha-elk-play-*.png (see src/assets/art/README.md). */}
      <SceneArt landscape={landscapeArt} portrait={portraitArt}
        alt="An elk-eared disc golfer with glasses and leafy antlers on a sunlit woodland trail" />
      <div className="scene-top">
        <button type="button" className="back-button" data-action="home" onClick={onHome}>‹ Home</button>
        <div className="title-controls">{musicControl}</div>
      </div>
      <section className="panel menu-card scene-main" aria-label="Puzzle settings">
        <h1>Puzzles</h1>
        <Choice name="mode" legend="Mode" options={MODES} value={config.mode}
          onChange={(mode) => onConfig(switchMode(config, mode))} />
        <p className="menu-note">{MODE_TEXT[config.mode]}</p>
        <div className="choice-row">
          {/* Merge to treasure offers its own goal tiers; the recipe comes with the puzzle. */}
          <Choice name="tier" legend="Target tier"
            options={tiersFor(config.mode).map((t) => [t, `Tier ${t + 1} of ${MAX_TIER + 1}`] as const)}
            value={config.tier} onChange={(tier) => onConfig({ ...config, tier })} />
          {config.mode === 'goals' && (
            <Choice name="goals" legend="Goals" options={GOAL_COUNTS.map((n) => [n, String(n)] as const)}
              value={config.goals} onChange={(goals) => onConfig({ ...config, goals })} />
          )}
        </div>
        <button type="button" className="btn" data-action="start-puzzle" onClick={onStart}>Start puzzle</button>
        {error && <p className="menu-error" role="alert">{error}</p>}
        {onLoad && (
          <form className="load-code" onSubmit={load} aria-label="Load a puzzle code">
            <label htmlFor={codeId}>Puzzle code</label>
            <p className="menu-note load-note" id={`${codeId}-note`}>Paste a puzzle&rsquo;s ID to play it again from the start.</p>
            <input id={codeId} className="puzzle-id" data-load-code type="text" value={code} placeholder="e.g. v4-goals-t3-g1-1x9k3"
              spellCheck={false} autoComplete="off" autoCapitalize="none" autoCorrect="off" enterKeyHint="go"
              aria-invalid={loadError ? true : undefined} aria-describedby={`${codeId}-note${loadError ? ` ${codeId}-error` : ''}`}
              onChange={(e) => setCode(e.target.value)} />
            <button type="submit" className="btn" data-action="load-puzzle">Load</button>
            {loadError && <p id={`${codeId}-error`} className="menu-error" role="alert">{loadError}</p>}
          </form>
        )}
      </section>
    </div>
  );
}
