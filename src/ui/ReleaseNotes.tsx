import type { ReactNode } from 'react';

// Player-facing release history, newest first. Plain words only: the internal record of changes,
// verification and limitations is docs/release-notes.md. Check the newest entry's date before deploying.
export interface ReleaseNote { readonly title: string; readonly date: string; readonly notes: readonly string[] }

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    title: 'A box of memories',
    date: 'October 20, 2026',
    notes: [
      'Try The Attic from Home: help Alisha and her granddaughter sort photos and uncover an old keepsake box.',
      'Open boxes for more keepsakes, then merge three old books into a special memory book.',
      'Illustrated story panels introduce Aunt Fiona and the beginning of Alisha’s adventures.',
    ],
  },
  {
    title: 'Sound recovery and more merge patterns',
    date: 'October 20, 2026',
    notes: [
      'Enabled audio can recover on your next tap, drag or key press after an interruption.',
      'Treasure ingredients now use five starting patterns, including nine small pieces that need three-piece merges.',
      'Older puzzle IDs still reproduce their boards. Music and Sound effects remain separate and start off.',
    ],
  },
  {
    title: 'More treasure recipes',
    date: 'October 19, 2026',
    notes: [
      'Craft a chest by dropping either ingredient onto the other, or tapping one and then the other. Only those two pieces are used.',
      'Treasure puzzles now choose from four recipes, with fixed chest rewards and a four-dot or five-dot final goal.',
      'The recipe sign shows what to make. Opening still clears Undo, and Retry keeps the same puzzle and recipe.',
    ],
  },
  {
    title: 'Merge to treasure',
    date: 'October 19, 2026',
    notes: [
      'A third generated puzzle mode: merge the ingredients shown on the recipe sign, then craft a Woodland chest.',
      'Crafting uses all remaining Grove and Crystal pieces. Tap the chest to reveal three Elk, then merge them into one to win.',
      'Crafting can be undone. Opening the chest clears Undo; Retry starts the same puzzle again.',
    ],
  },
  {
    title: 'Bigger puzzles, five-dot goals',
    date: 'October 19, 2026',
    notes: [
      'Both generated puzzle modes now offer five-dot goals, with longer merge chains and bigger boards.',
      'Merge to goals can include a few spare pieces, giving you more choices. Merge down to one still asks you to use everything.',
      'All items now use a five-dot scale. The nine woodland levels keep their existing goals.',
    ],
  },
  {
    title: 'Music and woodland sounds',
    date: 'October 19, 2026',
    notes: [
      'New woodland and palace music for The Crystal Palace. Interact with an item in either area to hear its music; panning keeps the current tune.',
      'Optional sounds for merges, discoveries, opening gates and finding treasure, across all levels and generated puzzles.',
      'Music and Sound effects have separate buttons. Both start off, so you can choose either or both.',
    ],
  },
  {
    title: 'The Crystal Palace',
    date: 'October 19, 2026',
    notes: [
      'A new, larger woodland level. Open your way to Songbird Glade, then explore Fern Glade, Crystal Glade and Woodland Lodge in any order.',
      'Each one you complete lights a symbol on the Crystal Palace gate. Light all three to open the palace, then find the ukulele case and tap it to open it.',
      'The Levels page now scrolls in its own window, starting at the level you are up to.',
    ],
  },
  {
    title: 'The Hidden Cache',
    date: 'October 19, 2026',
    notes: [
      'A new level in a forest clearing. Put the item shown on each marked tile, and find your way to a closed clarinet case.',
      'Tap the case to open it.',
    ],
  },
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
