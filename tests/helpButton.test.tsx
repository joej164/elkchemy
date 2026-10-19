import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LevelGoal } from '../src/session';
import { HelpButton } from '../src/ui/HelpButton';
import { App, Game, puzzleLabel } from '../src/ui/App';
import { PlaySetup } from '../src/ui/PlaySetup';
import { RELEASE_NOTES, ReleaseNotes } from '../src/ui/ReleaseNotes';
import { SONGS, Scores } from '../src/ui/Scores';
import { generatePuzzle } from '../src/generator';
import { LEVELS } from '../src/levels';

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

  it('uses no external assets', () => {
    expect(html).not.toContain('http');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('url(');
  });
});
