import type { ReactNode } from 'react';
import landscapeArt from '../assets/art/woodland-home-landscape-v1.webp';
import portraitArt from '../assets/art/woodland-home-portrait-v1.webp';
import { SceneArt } from './SceneArt';

/** Home screen: the woodland scene with the elk, and the ways in. */
export function Home({ onPlay, onLevels, onAttic, onScores, onReleaseNotes, levelsNote, musicControl }: {
  onPlay: () => void;
  /** The Attic, the opening-story prototype (outside the Levels sequence). */
  onAttic: () => void;
  onLevels: () => void;
  onScores: () => void;
  onReleaseNotes: () => void;
  /** Where Levels will continue, once past level 1. */
  levelsNote?: string;
  musicControl: ReactNode;
}) {
  return (
    <div className="page scene-page home">
      {/* Web copies of artwork/home/woodland-home-*-v1.png (see src/assets/art/README.md). */}
      <SceneArt landscape={landscapeArt} portrait={portraitArt}
        alt="A friendly golden elk with leafy antlers in a sunlit woodland clearing" />
      <div className="scene-top">
        <button type="button" className="scene-chip" data-action="release-notes" onClick={onReleaseNotes}>
          Release notes
        </button>
        <div className="title-controls">{musicControl}</div>
      </div>
      <div className="scene-main">
        <h1>Elkchemy</h1>
        <nav className="home-nav" aria-label="Main">
          <button type="button" className="btn" data-action="play" onClick={onPlay}>Play</button>
          <button type="button" className="btn" data-action="play-levels" onClick={onLevels}>Levels</button>
          {/* Side by side, so the prototype's entry adds no height to Home. */}
          <button type="button" className="btn btn-quiet is-half" data-action="attic" onClick={onAttic}>
            <span className="btn-two-line">Story prototype:<br />The Attic</span>
          </button>
          <button type="button" className="btn btn-quiet is-half" data-action="scores" onClick={onScores}>Music / Scores</button>
        </nav>
        {levelsNote && <p className="home-note">{levelsNote}</p>}
      </div>
    </div>
  );
}
