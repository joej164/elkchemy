import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LevelGoal } from '../src/session';
import { HelpButton } from '../src/ui/HelpButton';
import { App, Game, puzzleLabel } from '../src/ui/App';
import { LevelPicker } from '../src/ui/LevelPicker';
import { PlaySetup } from '../src/ui/PlaySetup';
import { RELEASE_NOTES, ReleaseNotes } from '../src/ui/ReleaseNotes';
import { SONGS, Scores } from '../src/ui/Scores';
import { generatePuzzle } from '../src/generator';
import { LEVELS } from '../src/levels';
import { Board } from '../src/ui/Board';
import { initUi, reduceUi, type UiAction, type UiState } from '../src/ui/controller';

const itemGoal: LevelGoal = { kind: 'item', item: { family: 'song', tier: 2 } };
const html = renderToStaticMarkup(<HelpButton goal={itemGoal} />);
const leaveHtml = renderToStaticMarkup(<HelpButton goal={{ kind: 'leaveOne' }} />);
const attr = (tag: string, name: string) => new RegExp(`<${tag}[^>]*?\\s${name}="([^"]*)"`).exec(html)?.[1];

describe('HelpButton', () => {
  it('renders an accessible trigger linked to the dialog', () => {
    const trigger = /<button[^>]*data-action="help"[^>]*>/.exec(html)?.[0] ?? '';
    expect(trigger).toContain('aria-label="How to play"');
    expect(trigger).toContain('aria-haspopup="dialog"');
    const dialogId = attr('dialog', 'id');
    expect(dialogId).toBeTruthy();
    expect(trigger).toContain(`aria-controls="${dialogId}"`);
  });

  it('renders a closed dialog labelled by its heading with a Close button', () => {
    const dialog = /<dialog[^>]*>/.exec(html)?.[0] ?? '';
    expect(dialog).toContain('data-help-dialog');
    expect(dialog).not.toMatch(/\sopen[\s=>]/);
    const titleId = attr('dialog', 'aria-labelledby');
    expect(html).toContain(`<h2 id="${titleId}">How to play</h2>`);
    expect(html).toMatch(/<button[^>]*data-action="help-close"[^>]*>Close<\/button>/);
  });

  it('has concise help content', () => {
    expect(html).toContain('Merge 3 for 1 upgraded item; merge 5 for 2.');
    expect(html).toContain('random empty cell');
    expect(html).toContain('Undo');
    expect(html).toContain('Retry');
    expect((html.match(/<li>/g) ?? []).length).toBeLessThanOrEqual(7);
  });

  it('states the active objective', () => {
    expect(html).toContain('<li>Goal: make Song, tier 3 of 4. Winning unlocks the next level.</li>');
    expect(leaveHtml).toContain('Goal: use all supply and finish with exactly one item on the board.');
    expect(leaveHtml).not.toContain('Song');
    expect(html).toContain('Retry restarts this level.');
    expect((leaveHtml.match(/<li>/g) ?? []).length).toBeLessThanOrEqual(7);
  });

  it('shows the pan advice bullet only for large boards', () => {
    const items: LevelGoal = { kind: 'items', items: [{ family: 'grove', tier: 3 }] };
    const big = renderToStaticMarkup(<HelpButton goal={items} largeBoard />);
    expect(big).toContain('Goal: have all one goal items on the board at once.');
    expect(big).toContain('Drag empty ground to pan.');
    expect(big).toContain('Center board');
    expect((big.match(/<li>/g) ?? []).length).toBeLessThanOrEqual(7);
    expect(html).not.toContain('Center board');
  });

  it('App opens on the home screen: woodland elk scene, Play, Levels, Release notes, music and updates', () => {
    const app = renderToStaticMarkup(<App />);
    expect(app).toMatch(/<source media="\(orientation: portrait\)" srcSet="[^"]*woodland-home-portrait-v1\.webp"/);
    expect(app).toMatch(/<img src="[^"]*woodland-home-landscape-v1\.webp"[^>]*alt="A friendly golden elk/);
    expect(app).toContain('class="app is-page is-scene"');
    expect(app).toMatch(/<h1>Elkchemy<\/h1>/);
    for (const action of ['play', 'play-levels', 'scores', 'release-notes', 'music', 'check-updates']) {
      expect(app).toContain(`data-action="${action}"`);
    }
    expect(app).not.toContain('Levels continue'); // only once past level 1
    expect(app).not.toContain('data-board');
    expect(app).not.toContain('data-action="start-puzzle"');
  });

  it('the Play screen offers both modes and a way home', () => {
    const play = renderToStaticMarkup(<PlaySetup config={{ mode: 'goals', tier: 3, goals: 1 }} onConfig={() => {}}
      onStart={() => {}} onHome={() => {}} musicControl={null} />);
    expect(play).toContain('Merge to goals');
    expect(play).toContain('Merge down to one');
    expect(play).toContain('>Goals</legend>');
    expect(play).toContain('data-action="start-puzzle"');
    expect(play).toContain('data-action="home"');
    expect(play).toMatch(/srcSet="[^"]*alisha-elk-play-portrait-v1\.webp"/);
    expect(play).toMatch(/<img src="[^"]*alisha-elk-play-landscape-v4\.webp"/);
    expect(play).toContain('<h1>Play</h1>');
    const one = renderToStaticMarkup(<PlaySetup config={{ mode: 'one', tier: 3, goals: 1 }} onConfig={() => {}}
      onStart={() => {}} onHome={() => {}} musicControl={null} error="Couldn't make a puzzle." />);
    expect(one).not.toContain('>Goals</legend>');
    expect(one).toContain('role="alert"');
  });

  it('the scores page lists each song with its score, printable and download links, and a way home', () => {
    const page = renderToStaticMarkup(<Scores onHome={() => {}} musicControl={null} />);
    expect(page).toContain('data-action="home"');
    expect(SONGS.map((song) => song.title)).toEqual(['Woodland Stroll', 'Curious Clearing']);
    for (const song of SONGS) {
      expect(page).toContain(`<h2 id="score-${song.id}">${song.title}</h2>`);
      for (const part of ['clarinet', 'ukulele'] as const) {
        expect(page).toContain(`src="${song[part]}"`);
        expect(page).toContain(`download="${song.id}-${part}.svg"`);
        expect(page).toContain(`Open ${part} part to print`);
        expect(song[part]).toMatch(new RegExp(`${part}\\.svg$`));
      }
      expect(page).toContain(`download="${song.id}.musicxml"`);
    }
    expect(page).toContain('B♭ clarinet part');
    expect(page).toContain('Ukulele part (chords and TAB)');
    expect(page).toMatch(/synthesized/);
  });

  it('release notes are player-facing, newest first, with a way home', () => {
    const notes = renderToStaticMarkup(<ReleaseNotes onHome={() => {}} musicControl={null} />);
    expect(notes).toContain('data-action="home"');
    expect(notes.indexOf(RELEASE_NOTES[0].title)).toBeLessThan(notes.indexOf(RELEASE_NOTES[1].title));
    const text = RELEASE_NOTES.flatMap((r) => [r.title, r.date, ...r.notes]).join(' ');
    expect(text).not.toMatch(/test|Chromium|Playwright|Codex|Claude|generator|witness|seed|\.ts\b|build \d|verified/i);
  });

  it('a handcrafted level shows its label, objective and supply', () => {
    const game = renderToStaticMarkup(<Game definition={LEVELS[0].definition} label="Level 1 of 5 · Sprouting Grove"
      musicControl={null} onHome={() => {}} winLabel="Next level" onWin={() => {}} />);
    expect(game).toContain('Level 1 of 5 · Sprouting Grove');
    expect(game).toContain('Goal: make Grove, tier 3 of 4');
    expect(game).toContain('data-action="supply"');
    expect(game).toContain('data-action="home"');
    expect(game).not.toContain('data-action="next-level"');
    expect(game).not.toContain('data-puzzle-id');
    expect(game).toMatch(/<picture class="scene-art is-game"><source media="\(orientation: portrait\)" srcSet="[^"]*woodland-cheering-portrait-v1\.webp"/);
    expect(game).toMatch(/<img src="[^"]*woodland-cheering-landscape-v1\.webp"[^>]*alt=""/);
  });

  it('a generated puzzle shows its ID and New puzzle, with no supply', () => {
    const puzzle = generatePuzzle({ mode: 'one', tier: 3, goals: 1 }, 7);
    const game = renderToStaticMarkup(<Game definition={puzzle.definition} label={puzzleLabel(puzzle.config)}
      puzzleId={puzzle.id} musicControl={null} onHome={() => {}} onNewPuzzle={() => {}} />);
    expect(game).toContain('Merge down to one · Tier 4 of 4');
    expect(game).toMatch(new RegExp(`<input[^>]*class="puzzle-id"[^>]*readOnly=""[^>]*value="${puzzle.id}"`));
    expect(game).toContain('data-action="copy-puzzle-id"');
    expect(game).toContain('>Copy</button>');
    expect(game).not.toContain('puzzle-info');
    expect(game).toContain('Goal: merge down to one');
    expect(game).toContain('data-action="new-puzzle"');
    expect(game).toContain('data-action="undo"');
    expect(game).toContain('data-action="retry"');
    expect(game).toContain('data-action="home"');
    expect(game).not.toContain('data-action="supply"');
    expect(game).not.toMatch(/Add supply|Next supply|Supply left/);
    expect(game).toContain('there is no supply.');
    expect(game).not.toContain('next level');
    expect(game).toContain('Retry restarts this puzzle; New puzzle makes a fresh one.');
    expect(game).toContain('woodland-cheering-landscape-v1.webp');
    expect(puzzleLabel({ mode: 'goals', tier: 2, goals: 2 })).toBe('Merge to goals · Tier 3 of 4 · 2 goals');
  });

  it('the Levels page lists every level, any of which can be picked, marking the one up next', () => {
    const page = renderToStaticMarkup(<LevelPicker levels={LEVELS} current={2} onPick={() => {}} onHome={() => {}} musicControl={null} />);
    expect(page).toContain('<h1>Levels</h1>');
    expect(page).toContain('data-action="home"');
    expect((page.match(/data-action="pick-level"/g) ?? []).length).toBe(LEVELS.length);
    LEVELS.forEach((l, i) => {
      expect(page).toContain(l.name);
      expect(page).toContain(`data-level="${i + 1}"`);
      expect(page).toContain(`Level ${i + 1}: `);
    });
    expect((page.match(/aria-current="step"/g) ?? []).length).toBe(1);
    expect(page).toMatch(/aria-current="step"[^>]*>(?:(?!<\/button>).)*Lone Elk(?:(?!<\/button>).)*Up next/);
    expect(page).not.toContain('disabled');
  });

  it('the region level shows its goal region, the next lock and an Unlock button instead of supply', () => {
    const level = LEVELS[5];
    const game = renderToStaticMarkup(<Game definition={level.definition} label={`Level 6 of 6 · ${level.name}`}
      musicControl={null} onHome={() => {}} winLabel="Play again from level 1" onWin={() => {}} />);
    expect(game).toContain('Level 6 of 6 · The Hidden Hollow');
    expect(game).toContain('Goal: make Crystal, tier 4 of 4 in Crystal Hollow');
    expect(game).toContain('<strong>Locked: Songbird Glade</strong><br/>Needs Grove, tier 3 of 4 in Mossy Clearing');
    expect(game).toMatch(/<button type="button" class="btn btn-unlock" data-action="unlock" disabled=""[^>]*>/);
    expect(game).toContain('<span>Unlock Songbird Glade</span>');
    expect(game).not.toMatch(/data-action="supply"|Add supply|Next supply|Supply left/);
    // Both locked regions carry a gate showing what opens them, unavailable until ready; every region is outlined.
    expect((game.match(/class="region(?: is-locked)?"/g) ?? []).length).toBe(3);
    expect((game.match(/class="region is-locked"/g) ?? []).length).toBe(2);
    expect(game).toContain('Needs Song, tier 3 of 4 in Songbird Glade');
    expect(game).toContain('<button type="button" class="gate" data-gate="1" aria-disabled="true" aria-label="Songbird Glade gate, locked. Needs Grove, tier 3 of 4 in Mossy Clearing.">');
    expect(game).toContain('<button type="button" class="gate" data-gate="2" aria-disabled="true" aria-label="Crystal Hollow gate, locked. Needs Song, tier 3 of 4 in Songbird Glade.">');
    expect(game).not.toMatch(/Ready: tap to open|gate-ready/);
    // Locked cells say so and are disabled; open cells name their region.
    expect(game).toContain('aria-label="Row 1, column 1, Crystal Hollow, locked: Crystal, tier 1 of 4"');
    expect(game).toMatch(/aria-label="Row 4, column 5, Songbird Glade, locked: Song, tier 1 of 4" aria-pressed="false" aria-disabled="true"/);
    expect(game).toMatch(/aria-label="Row 4, column 1, Mossy Clearing: Grove, tier 1 of 4" aria-pressed="false" tabindex/);
    expect(game).toContain('tap the gate or press Unlock; the item stays');
    expect(game).toContain('Undo takes back your last action, even an unlock');
    expect(game).toContain('Make Grove, tier 3 of 4 in Mossy Clearing to unlock Songbird Glade.');
  });

  it('the room level shows terrain, closed rune gates in their passages and marked tiles, with no Unlock button', () => {
    const level = LEVELS[6];
    const game = renderToStaticMarkup(<Game definition={level.definition} label={`Level 7 of 7 · ${level.name}`}
      musicControl={null} onHome={() => {}} winLabel="Play again from level 1" onWin={() => {}} />);
    expect(game).toContain('Goal: find the disc-golf backpack in Treasure Nook');
    expect(game).toContain('<strong>Rune gate: Stone Chamber</strong><br/>Needs Grove, tier 2 of 4 and Song, tier 2 of 4 on the pressure plates in Pressure Hall');
    expect(game).not.toMatch(/data-action="unlock"|data-action="supply"|class="gate/);
    expect((game.match(/class="terrain"/g) ?? []).length).toBe(25);
    expect(game).toContain('<div class="passage is-across" data-passage="1" role="img" aria-label="Rune gate to Stone Chamber, closed">');
    expect(game).toContain('<div class="passage" data-passage="2" role="img" aria-label="Rune gate to Treasure Nook, closed">');
    expect((game.match(/class="region is-locked is-room"/g) ?? []).length).toBe(2);
    expect(game).toContain('aria-label="Row 1, column 3, Pressure Hall, pressure plate for Grove, tier 2 of 4: empty"');
    expect(game).toContain('aria-label="Row 3, column 6, Stone Chamber, locked, stone for Crystal, tier 3 of 4: empty"');
    // The backpack stays hidden: its cell reads as an ordinary locked cell.
    expect(game).toContain('aria-label="Row 7, column 5, Treasure Nook, locked: empty"');
    expect(game).not.toMatch(/has-treasure|tap to collect/);
    expect(game).toContain('data-backpack="closed"');                    // the goal panel: closed until collected
    expect(game).not.toContain('data-backpack="open"');
    expect(game).toContain('the items shown on its room&#x27;s marked tiles');
    expect(game).toContain('An opened gate is a checkpoint');
    expect(game).toContain('Put Grove, tier 2 of 4 and Song, tier 2 of 4 on the pressure plates in Pressure Hall to open the rune gate to Stone Chamber.');
  });

  it('the Rune Gates backpack is hidden, then closed, opens on collection; fixed items show a bare padlock', () => {
    const run = (s: UiState, ...actions: UiAction[]) => actions.reduce(reduceUi, s);
    const drop = ([fr, fc]: number[], [tr, tc]: number[]): UiAction => ({ type: 'drop', from: { row: fr, col: fc }, to: { row: tr, col: tc } });
    const board = (s: UiState) => renderToStaticMarkup(<Board state={s} dispatch={() => {}} />);
    const start = initUi(LEVELS[6].definition);
    const revealed = run(start, drop([1, 2], [0, 1]), drop([0, 1], [0, 2]), drop([2, 1], [2, 0]), drop([2, 0], [2, 2]),
      drop([1, 4], [2, 4]), drop([3, 6], [3, 4]), drop([1, 6], [3, 5]), drop([3, 5], [2, 5]));
    expect(board(start)).not.toContain('data-backpack');
    const closed = board(revealed);
    expect(closed).toContain('data-backpack="closed"');
    expect(closed).toContain('disc-golf backpack, closed, tap to collect');
    expect((closed.match(/class="fixed-lock"/g) ?? []).length).toBe(3);
    expect(closed).not.toContain('plate-mark');                            // every plate is fixed: no badges left
    const won = run(revealed, { type: 'tap', pos: { row: 6, col: 4 } });
    expect(won.status).toBe('won');
    expect(board(won)).toContain('data-backpack="open"');
    expect(board(won)).toContain('disc-golf backpack, open, collected');
    const undone = run(won, { type: 'undo' });
    expect(undone.session.unlocked).toBe(2);
    expect(board(undone)).toContain('data-backpack="closed"');
    expect(board(run(won, { type: 'retry' }))).not.toContain('data-backpack');
  });

  it('a ready gate glows, says so, and is the only gate offered', () => {
    // The Clearing's key already made: the Glade's gate is ready; the Hollow's is not (it is not next).
    const board = LEVELS[5].definition.board.map((r) => [...r]);
    board[4][3] = { family: 'grove', tier: 2 };
    const game = renderToStaticMarkup(<Game definition={{ ...LEVELS[5].definition, board }} label="Level 6 of 6"
      musicControl={null} onHome={() => {}} winLabel="Play again from level 1" onWin={() => {}} />);
    expect(game).toContain('<button type="button" class="gate is-ready" data-gate="1" aria-label="Songbird Glade gate. Needs Grove, tier 3 of 4 in Mossy Clearing. Ready: tap to open.">');
    expect(game).toContain('<span class="gate-ready">Tap to open</span>');
    expect((game.match(/class="gate-ready"/g) ?? []).length).toBe(1);
    expect(game).toContain('data-gate="2" aria-disabled="true"');
    expect(game).toMatch(/data-action="unlock"(?![^>]*disabled)/);
    expect(game).toContain('Songbird Glade is ready. Tap its gate or press Unlock Songbird Glade.');
  });

  it('uses no external assets', () => {
    expect(html).not.toContain('http');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('url(');
  });
});
