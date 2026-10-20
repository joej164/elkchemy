import type { ReactNode } from 'react';
import landscapeArt from '../assets/art/alisha-elk-play-landscape-v4.webp';
import portraitArt from '../assets/art/alisha-elk-play-portrait-v1.webp';
import { SceneArt } from './SceneArt';
import { MAX_TIER } from '../board';
import { GOAL_COUNTS, TARGET_TIERS, TREASURE_TIERS, type PuzzleConfig, type PuzzleMode } from '../generator';

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

/** Play screen: choose a generated puzzle's mode and settings. */
export function PlaySetup({ config, onConfig, onStart, onHome, error, musicControl }: {
  config: PuzzleConfig;
  onConfig: (config: PuzzleConfig) => void;
  onStart: () => void;
  onHome: () => void;
  error?: string;
  musicControl: ReactNode;
}) {
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
        <h1>Play</h1>
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
      </section>
    </div>
  );
}
