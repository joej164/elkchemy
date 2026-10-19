import type { ReactNode } from 'react';
import woodlandClarinet from '../../docs/music/woodland-stroll-clarinet.svg?url';
import woodlandUkulele from '../../docs/music/woodland-stroll-ukulele.svg?url';
import woodlandXml from '../../docs/music/woodland-stroll.musicxml?url';
import clearingClarinet from '../../docs/music/curious-clearing-clarinet.svg?url';
import clearingUkulele from '../../docs/music/curious-clearing-ukulele.svg?url';
import clearingXml from '../../docs/music/curious-clearing.musicxml?url';

// To add a song: add its loop and arrangement in artwork/music (score.json and scores.mjs), run
// `npm run music:scores`, then add an entry here with its generated files.
export interface Song {
  readonly id: string; readonly title: string; readonly about: string;
  readonly clarinet: string; readonly ukulele: string; readonly musicXml: string;
}

export const SONGS: readonly Song[] = [
  { id: 'woodland-stroll', title: 'Woodland Stroll', about: 'The main game tune. Concert key D major, 76 beats per minute.',
    clarinet: woodlandClarinet, ukulele: woodlandUkulele, musicXml: woodlandXml },
  { id: 'curious-clearing', title: 'Curious Clearing', about: 'The Songbird Chorus tune. Concert key G major, 92 beats per minute.',
    clarinet: clearingClarinet, ukulele: clearingUkulele, musicXml: clearingXml },
];

const PARTS = [
  { key: 'clarinet', label: 'B♭ clarinet part' },
  { key: 'ukulele', label: 'Ukulele part (chords and TAB)' },
] as const;

export function Scores({ onHome, musicControl }: { onHome: () => void; musicControl: ReactNode }) {
  return (
    <div className="page">
      <header className="title-row">
        <h1>Music scores</h1>
        <div className="title-controls">{musicControl}</div>
      </header>
      <button type="button" className="back-button" data-action="home" onClick={onHome}>‹ Home</button>
      <p className="scores-intro">
        Arrangements of the game music for B♭ clarinet and ukulele, as separate one-page parts. The clarinet part is
        written for B♭ clarinet; the ukulele part, chord names, and TAB are at concert pitch. The game itself plays
        synthesized instruments.
      </p>
      {SONGS.map((song) => (
        <section key={song.id} className="panel score-card" aria-labelledby={`score-${song.id}`} data-song={song.id}>
          <h2 id={`score-${song.id}`}>{song.title}</h2>
          <p>{song.about}</p>
          {PARTS.map((part) => (
            <div key={part.key} className="score-part" data-part={part.key}>
              <h3>{part.label}</h3>
              <div className="score-scroll">
                <img className="score" src={song[part.key]} alt={`${song.title}: ${part.label}, eight bars`} />
              </div>
              <p className="score-links">
                <a href={song[part.key]} target="_blank" rel="noopener" data-link="open">Open {part.key} part to print</a>
                <a href={song[part.key]} download={`${song.id}-${part.key}.svg`} data-link="download">Download {part.key} part (SVG)</a>
              </p>
            </div>
          ))}
          <p className="score-links">
            <a href={song.musicXml} download={`${song.id}.musicxml`} data-link="musicxml">Both parts for notation apps (MusicXML)</a>
          </p>
        </section>
      ))}
    </div>
  );
}
