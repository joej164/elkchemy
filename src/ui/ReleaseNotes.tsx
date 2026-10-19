import type { ReactNode } from 'react';

// Player-facing release history, newest first. Plain words only: the internal record of changes,
// verification and limitations is docs/release-notes.md. Check the newest entry's date before deploying.
export interface ReleaseNote { readonly title: string; readonly date: string; readonly notes: readonly string[] }

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    title: 'The Rune Gates',
    date: 'October 19, 2026',
    notes: [
      'A new experimental level: three rooms connected by rune gates.',
      'Put the requested items on the marked tiles and the next gate opens by itself. Opening fixes those items in place and clears Undo; Retry restarts everything.',
      'Find the disc-golf backpack in the final room and tap it to collect it.',
    ],
  },
  {
    title: 'Open the woodland gates',
    date: 'October 18, 2026',
    notes: [
      'The Hidden Hollow now has wooden gates on its locked areas. When the requested item is ready, the gate glows—tap it to open the area.',
      'The Unlock button still works, and Undo can close the area again.',
    ],
  },
  {
    title: 'The Hidden Hollow',
    date: 'October 18, 2026',
    notes: [
      'A new woodland puzzle with three areas. Make the requested items to unlock the next area, then complete the final crystal goal.',
      'Choose any of the six handcrafted puzzles from the Levels page.',
      'Undo can reverse an unlock. Retry restarts the puzzle and returns the view to the starting clearing.',
    ],
  },
  {
    title: 'Woodland scenes',
    date: 'October 18, 2026',
    notes: [
      'The home screen is now a painted woodland scene with the Elkchemy elk.',
      'The Play screen has its own scene on a disc golf trail while you choose a puzzle.',
    ],
  },
  {
    title: 'Sheet music',
    date: 'October 18, 2026',
    notes: [
      'New Music / Scores page on the home screen: Woodland Stroll and Curious Clearing, arranged for clarinet and ukulele.',
      'Each song has a one-page clarinet part and a one-page ukulele part with chords and TAB, ready to print.',
    ],
  },
  {
    title: 'A home for the elk',
    date: 'October 18, 2026',
    notes: [
      'A new home screen with the Elkchemy elk. Choose Play, Levels, or Release notes, and tap Home to come back.',
      'When a puzzle has no merges left, it now tells you, so you can Undo, Retry, or start a New Puzzle.',
      'Undo always takes back your last real move. Dropping an item onto a matching one that cannot merge no longer uses it up.',
      'A Copy button next to the puzzle ID copies it in one tap.',
    ],
  },
  {
    title: 'New puzzles every time',
    date: 'October 18, 2026',
    notes: [
      'Play brand-new puzzles in two modes: Merge to goals, or Merge down to one.',
      'Pick the target tier, and for Merge to goals, how many goals to make.',
      'Retry a puzzle from the start, or tap New puzzle for a fresh one.',
      'Every puzzle has an ID. If something seems wrong, share the ID so the same puzzle can be checked.',
      'Tips for panning appear whenever a board is bigger than the screen.',
    ],
  },
  {
    title: 'Five levels and music',
    date: 'October 18, 2026',
    notes: [
      'Five handcrafted levels, from Sprouting Grove to The Faraway Grove, a big board you can pan around.',
      'Optional background music. Tap Music to turn it on or off.',
      'Check for updates at the bottom of the screen to get the newest version.',
    ],
  },
];

export function ReleaseNotes({ onHome, musicControl }: { onHome: () => void; musicControl: ReactNode }) {
  return (
    <div className="page">
      <header className="title-row">
        <h1>Release notes</h1>
        <div className="title-controls">{musicControl}</div>
      </header>
      <button type="button" className="back-button" data-action="home" onClick={onHome}>‹ Home</button>
      {RELEASE_NOTES.map((r) => (
        <section key={r.title} className="panel note-card" aria-label={r.title}>
          <h2>{r.title}</h2>
          <p className="note-date">{r.date}</p>
          <ul>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}
