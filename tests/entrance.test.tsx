import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Family, Item, Pos, Tier } from '../src/board';
import {
  EAST, EAST_POCKET, EAST_TASK, ENTRANCE_LEVEL, FORECOURT, FORK, OPEN_FORK_TASK, OPEN_TERRACES_TASK, REVEAL_FORECOURT_TASK,
  REVEAL_POCKET_TASK, SOUTH, UPPER, WEST, WEST_TASK,
} from '../src/entrance';
import { LEVELS } from '../src/levels';
import { isFixed, isOpen, regionAt, roomOf, sealedRegion, validateRegions } from '../src/regions';
import {
  applyDrop, canDrop, collect, isCellOpen, partySpots, previewDrop, retry, standOnPlate, startSession, treasureRevealed, undo,
  type LevelDefinition, type SessionState,
} from '../src/session';
import { evaluateStatus, strandedRoom } from '../src/status';
import { announcement, App, describeAction, Game } from '../src/ui/App';
import { Board } from '../src/ui/Board';
import { viewCue } from '../src/ui/camera';
import { actionEffect } from '../src/ui/audioEvents';
import {
  bubbleOpen, canMoveAlisha, canPickUp, initUi, plateRevealed, reduceUi, storyDue, type UiAction, type UiState,
} from '../src/ui/controller';
import {
  afterEntranceOpening, afterStoryDue, ALISHA_LINE, ENTRANCE_OPENING_MS, entranceGuide, STORY_DELAY_MS,
} from '../src/ui/entranceGuide';
import { HelpButton } from '../src/ui/HelpButton';
import { LevelPicker } from '../src/ui/LevelPicker';
import { helpObjective, objectiveText, roomsHelp } from '../src/ui/messages';
import { APPROACH_PANELS, ENTRANCE_STORY, ENTRY_PANELS, INSIDE_PANELS } from '../src/ui/StoryArt';
import { comicBeats } from '../src/ui/Comic';
import STORYBOARD from '../docs/story/chapter-one-review.html?raw';

// Coordinates are (row, column) from 0 on the 20 × 11 map (see src/entrance.ts).
const p = (row: number, col: number): Pos => ({ row, col });
const it_ = (family: Family, tier: Tier): Item => ({ family, tier });
const regions = ENTRANCE_LEVEL.regions!;
const tasks = ENTRANCE_LEVEL.tasks!;
const party = { ...ENTRANCE_LEVEL.party!, waiting: ENTRANCE_LEVEL.party!.waiting!, door: ENTRANCE_LEVEL.party!.door! };
const PLATE = p(1, 5);
const DOOR = p(0, 5);

type Move = [Pos, Pos];
const m = (moves: [number, number, number, number][]): Move[] => moves.map(([a, b, c, d]) => [p(a, b), p(c, d)]);
const OPEN_FORK = m([[18, 5, 17, 4], [17, 4, 16, 7]]);
const OPEN_TERRACES = m([[13, 7, 14, 5], [14, 7, 14, 5], [14, 5, 12, 5], [14, 6, 13, 5], [14, 7, 12, 5]]);
const FINISH_WEST = m([[10, 2, 9, 2], [10, 3, 9, 2], [9, 2, 8, 0], [10, 1, 9, 0], [10, 3, 8, 0], [9, 3, 8, 2], [8, 2, 8, 3]]);
const REVEAL_POCKET = m([[10, 9, 9, 8], [9, 8, 8, 10]]);
const FINISH_EAST = [...REVEAL_POCKET, ...m([[6, 9, 9, 9], [8, 7, 6, 9], [10, 7, 6, 9], [9, 9, 10, 10], [6, 9, 10, 9], [10, 7, 10, 10]])];
const REVEAL_FORECOURT = m([[5, 5, 5, 4], [4, 4, 5, 4], [4, 7, 5, 7], [5, 4, 4, 5], [5, 7, 4, 5]]);
const BRANCHES = { west: FINISH_WEST, east: FINISH_EAST };

function play(s: SessionState, moves: readonly Move[]): SessionState {
  for (const [from, to] of moves) {
    const next = applyDrop(s, from, to);
    expect(next, `${JSON.stringify(from)} → ${JSON.stringify(to)}`).not.toBe(s);
    expect(evaluateStatus(next)).toBe('playing');
    s = next;
  }
  return s;
}
const openRegions = (s: SessionState) => regions.map((_, i) => i).filter((i) => isOpen(s, i));
const terracesOpen = () => play(play(startSession(ENTRANCE_LEVEL), OPEN_FORK), OPEN_TERRACES);
const upperOpen = (order: 'west-east' | 'east-west' = 'west-east') => {
  const [a, b] = order === 'west-east' ? [FINISH_WEST, FINISH_EAST] : [FINISH_EAST, FINISH_WEST];
  return play(play(terracesOpen(), a), b);
};

const run = (s: UiState, ...actions: UiAction[]) => actions.reduce(reduceUi, s);
/** The story scene due, if any, read to the end, as a player taps through it. */
const read = (s: UiState) => (storyDue(s) === null ? s : reduceUi(s, { type: 'finishStory' }));
/** `run`, reading each story scene due before the next action (the last action's scene is left due). */
const through = (s: UiState, ...actions: UiAction[]) => actions.reduce((u, a) => reduceUi(read(u), a), s);
/** The loose (movable) items on open cells. */
const items = (ui: UiState) => ui.session.board.flatMap((r, row) => r.flatMap((c, col) =>
  (c && isCellOpen(ui.session, p(row, col)) && !isFixed(ui.session, p(row, col)) ? [p(row, col)] : [])));
const drops = (moves: readonly Move[]): UiAction[] => moves.map(([from, to]) => ({ type: 'drop', from, to }));
const tap = (pos: Pos): UiAction => ({ type: 'tap', pos });
const ALL_MOVES = [...OPEN_FORK, ...OPEN_TERRACES, ...FINISH_WEST, ...FINISH_EAST, ...REVEAL_FORECOURT];
/** The game with the forecourt just revealed and its scene (C1-08B) read: Alisha's bubble showing. */
const revealedUi = () => read(through(initUi(ENTRANCE_LEVEL), ...drops(ALL_MOVES)));
/** The bubble tapped away: Alisha can move. */
const readyUi = () => run(revealedUi(), { type: 'dismissBubble' });
/**
 * Once the forecourt is revealed every piece on the map is fixed on a done task's plate, so checks that need a loose item
 * put two Grove tier 1 into the forecourt itself, beside the plate (the hardest case: same room).
 */
const LOOSE = p(2, 4);
const withLoose = (ui: UiState): UiState => {
  const b = ui.session.board.map((r) => [...r]);
  b[2][4] = it_('grove', 0);
  b[2][6] = it_('grove', 0);
  return { ...ui, session: { ...ui.session, board: b } };
};
const board = (s: UiState, sceneShowing = false) => renderToStaticMarkup(<Board state={s} dispatch={() => {}} scene="entrance" sceneShowing={sceneShowing} />);
const game = () => renderToStaticMarkup(
  <Game definition={ENTRANCE_LEVEL} label="Story prototype · Palace entrance" musicControl={null} onHome={() => {}} scene="entrance"
    guide={entranceGuide} winLabel="Enter the palace" onWin={() => {}} />,
);
// Nothing on the board before the final reveal may name or show the forecourt, the entrance or Alisha's plate.
const SPOILER = /forecourt|palace entrance|data-door|character-plate|Alisha&#x27;s|speech-bubble|stand Alisha|standing on/i;

afterEach(() => { vi.useRealTimers(); });

describe('Palace entrance prototype: layout and inventory', () => {
  it('is one connected 20 × 11 map of seven regions (six rooms, one concealed part), outside the numbered levels', () => {
    expect(() => validateRegions(ENTRANCE_LEVEL)).not.toThrow();
    expect(() => startSession(ENTRANCE_LEVEL)).not.toThrow();
    expect(ENTRANCE_LEVEL.board).toHaveLength(20);
    ENTRANCE_LEVEL.board.forEach((r) => expect(r).toHaveLength(11));
    expect(regions.map((r) => [r.name, r.row, r.col, r.rows, r.cols])).toEqual([
      ['Southern clearing', 16, 3, 3, 5], ['Forked path', 12, 3, 3, 5], ['West terrace', 8, 0, 3, 4], ['East terrace', 8, 7, 3, 4],
      ['East terrace concealed part', 5, 9, 2, 2], ['Upper approach', 4, 3, 3, 5], ['Palace forecourt', 1, 3, 2, 5],
    ]);
    expect(regions.map((_, i) => roomOf(regions, i))).toEqual([SOUTH, FORK, WEST, EAST, EAST, UPPER, FORECOURT]);
    expect([regions[EAST_POCKET].hidden, regions[EAST_POCKET].link, regions[FORECOURT].hidden, regions[FORECOURT].building])
      .toEqual([true, p(7, 9), true, undefined]);
    expect(sealedRegion(regions)).toBe(UPPER);
    expect(regions.map((r) => (r.unlock && 'tasks' in r.unlock ? r.unlock.tasks : null))).toEqual([
      null, [OPEN_FORK_TASK], [OPEN_TERRACES_TASK], [OPEN_TERRACES_TASK], [REVEAL_POCKET_TASK], [WEST_TASK, EAST_TASK], [REVEAL_FORECOURT_TASK],
    ]);
    expect([tasks[WEST_TASK].symbol, tasks[EAST_TASK].symbol]).toEqual(['crystal', 'note']);
    expect(ENTRANCE_LEVEL.goal).toEqual({ kind: 'treasure', at: PLATE, prize: 'entrance' });
    // The original nine are untouched, and the prototype is not one of them.
    expect(LEVELS.map((l) => l.name)).toEqual(['Sprouting Grove', 'Songbird Chorus', 'Lone Elk', 'Crystal Fives', 'The Faraway Grove',
      'The Hidden Hollow', 'The Rune Gates', 'The Hidden Cache', 'The Crystal Palace']);
    expect(LEVELS.some((l) => l.definition === ENTRANCE_LEVEL)).toBe(false);
  });

  it('puts the characters and the entrance on scenery, never on an item cell or a route', () => {
    for (const q of [party.start.alisha, party.start.fiona, party.waiting.alisha, party.waiting.fiona, DOOR]) {
      expect(regionAt(regions, q)).toBe(-1);
      expect(ENTRANCE_LEVEL.board[q.row][q.col]).toBeNull();
    }
    const bad = (change: Partial<typeof party>): LevelDefinition => ({ ...ENTRANCE_LEVEL, party: { ...party, ...change } });
    expect(() => startSession(bad({ door: PLATE }))).toThrow(/Unsupported party level/);
    expect(() => startSession(bad({ start: { alisha: p(17, 3), fiona: party.start.fiona } }))).toThrow(/Unsupported party level/);
    expect(() => startSession(bad({ waiting: { alisha: p(3, 5), fiona: party.waiting.fiona } }))).toThrow(/Unsupported party level/); // the gate
    expect(() => startSession({ ...ENTRANCE_LEVEL, party: undefined })).toThrow(/Unsupported party level/);
  });

  it('has Chapter 1 inventories: strandable, every room can fill its tiles at the start (choices: tests/chapter.test.tsx)', () => {
    expect(ENTRANCE_LEVEL.strandable).toBe(true);
    expect(strandedRoom(startSession(ENTRANCE_LEVEL))).toBe(-1);
  });
});

describe('Palace entrance prototype: room progression', () => {
  it('opens the Forked path, then both terraces together, each move through the real session rules', () => {
    let s = startSession(ENTRANCE_LEVEL);
    expect(openRegions(s)).toEqual([SOUTH]);
    s = play(s, OPEN_FORK);
    expect([openRegions(s), s.done, s.undo]).toEqual([[SOUTH, FORK], [OPEN_FORK_TASK], null]);
    s = play(s, OPEN_TERRACES);
    expect([openRegions(s), s.done]).toEqual([[SOUTH, FORK, WEST, EAST], [OPEN_FORK_TASK, OPEN_TERRACES_TASK]]);
    expect([isOpen(s, EAST_POCKET), isOpen(s, UPPER), isOpen(s, FORECOURT)]).toEqual([false, false, false]);
  });

  it.each(['west-east', 'east-west'] as const)('completes the terraces %s: the Upper approach opens only on the second, by records', (order) => {
    let s = terracesOpen();
    const [first, second] = order === 'west-east' ? ['west', 'east'] as const : ['east', 'west'] as const;
    s = play(s, BRANCHES[first]);
    const firstTask = first === 'west' ? WEST_TASK : EAST_TASK;
    expect(s.done).toContain(firstTask);
    expect(s.undo).toBeNull();
    expect(isOpen(s, UPPER)).toBe(false);
    s = play(s, BRANCHES[second]);
    expect([s.done.includes(WEST_TASK), s.done.includes(EAST_TASK), isOpen(s, UPPER), s.undo]).toEqual([true, true, true, null]);
    expect(isOpen(s, FORECOURT)).toBe(false);
    s = play(s, REVEAL_FORECOURT);
    expect([isOpen(s, FORECOURT), treasureRevealed(s), s.undo]).toEqual([true, true, null]);
    expect(evaluateStatus(standOnPlate(s, PLATE))).toBe('won');
  });

  it('keeps completion records permanent: Undo never reopens a terrace task, and fixed plate items cannot be moved out', () => {
    let s = play(terracesOpen(), FINISH_WEST);
    expect(isFixed(s, p(8, 0)) && isFixed(s, p(8, 3))).toBe(true);
    expect(canDrop(s, p(8, 0), p(9, 2))).toBe(false);
    s = applyDrop(s, ...FINISH_EAST[0]);                         // an ordinary move after the checkpoint
    const back = undo(s);
    expect(back.done).toContain(WEST_TASK);
    expect(undo(back)).toBe(back);                               // never past the checkpoint
    // Items never cross rooms: the West terrace's crystal can't reach the East terrace or the Upper approach.
    expect(canDrop(s, p(9, 0), p(9, 9))).toBe(false);
    expect(canDrop(s, p(9, 0), p(5, 5))).toBe(false);
  });

  it('keeps the East terrace\'s concealed part shut and its song unmergeable until its marked tile reveals it', () => {
    let s = terracesOpen();
    expect([isCellOpen(s, p(5, 9)), isCellOpen(s, p(7, 9))]).toEqual([false, false]);
    expect(previewDrop(s, p(8, 7), p(10, 7))).toEqual([]);       // two Song tier 1 alone can't merge
    expect(canDrop(s, p(5, 10), p(9, 9))).toBe(false);
    s = play(s, REVEAL_POCKET);
    expect([isOpen(s, EAST_POCKET), isCellOpen(s, p(7, 9)), s.done.includes(EAST_TASK)]).toEqual([true, true, false]);
    expect(canDrop(s, p(5, 10), p(9, 9))).toBe(true);            // one room now
  });

  it('restores the whole initial level on Retry, from any point', () => {
    const start = startSession(ENTRANCE_LEVEL);
    for (const s of [terracesOpen(), upperOpen(), play(upperOpen(), REVEAL_FORECOURT), standOnPlate(play(upperOpen(), REVEAL_FORECOURT), PLATE)]) {
      expect(retry(s)).toEqual(start);
    }
  });
});

describe('Palace entrance prototype: concealment', () => {
  const states = () => {
    let s = initUi(ENTRANCE_LEVEL);
    const out = [s];
    for (const moves of [OPEN_FORK, OPEN_TERRACES, FINISH_WEST, REVEAL_POCKET, FINISH_EAST.slice(2), REVEAL_FORECOURT.slice(0, 2)]) {
      s = through(s, ...drops(moves));
      out.push(s);
    }
    return out;
  };

  it('shows neither the forecourt, the entrance, its gate nor Alisha\'s plate on the board until the final reveal', () => {
    for (const s of states()) {
      const html = board(s);
      expect(plateRevealed(s)).toBe(false);
      expect(html).not.toMatch(SPOILER);
      expect(html).not.toMatch(/data-row="[12]" data-col="[3-7]"/);                  // no forecourt cells
      expect(html).not.toContain('data-passage="6"');                                  // its gate is forest
      expect(html).not.toMatch(/terrain is-palace/);
      // Alisha and Fiona wait at the start, as pictures, beside the Southern clearing.
      expect(html).toContain('data-spot="alisha"');
      expect(html).toMatch(/data-spot="alisha"><span class="character is-alisha" role="img" aria-label="Alisha">/);
      expect(html).toMatch(/data-spot="fiona"><span class="character is-fiona" role="img" aria-label="Fiona, an elk">/);
      expect(partySpots(s.session)).toEqual(party.start);
      expect(html).not.toContain('data-alisha');                                       // not movable yet
    }
  });

  it('names nothing concealed in the banner, goal, checklist or Help before the reveal', () => {
    const texts = states().flatMap((s) => [
      entranceGuide(s), describeAction(s.lastAction, 'Level', ENTRANCE_LEVEL.goal, regions, tasks),
      roomsHelp(regions, (i) => isOpen(s.session, i), tasks),
    ]);
    texts.push(objectiveText(ENTRANCE_LEVEL.goal, regions), helpObjective(ENTRANCE_LEVEL.goal, regions));
    for (const t of texts) expect(t).not.toMatch(/forecourt|plate in Palace|concealed part|pocket/i);
    expect(objectiveText(ENTRANCE_LEVEL.goal, regions)).toBe('Goal: find the palace entrance');
    const help = renderToStaticMarkup(<HelpButton goal={ENTRANCE_LEVEL.goal} regions={regions} tasks={tasks} party="hidden" />);
    expect(help).toContain('Alisha and Fiona travel with you');
    expect(help).not.toMatch(/pressure plate\.|Drag Alisha|next level/);
    const html = game();
    expect(html).not.toMatch(/forecourt|Alisha's pressure plate|speech-bubble/i);
    expect(html).toContain('Goal: find the palace entrance');
  });

  it('steps through the rooms in the banner, never naming the forecourt', () => {
    const [start, fork, terraces, west, , , upper] = states();
    expect(entranceGuide(start)).toBe('Put Grove, tier 2 of 5 on the pressure plate in Southern clearing to open the rune gate to Forked path.');
    expect(entranceGuide(fork)).toBe('Put Song, tier 3 of 5 on the pressure plate in Forked path to open the rune gates to both branches.');
    expect(entranceGuide(terraces)).toBe('Complete the two branches in either order to open Upper approach.');
    expect(entranceGuide(west)).toBe('Complete East terrace to open Upper approach: put Grove, tier 2 of 5 on its marked tile.');
    expect(entranceGuide(upper)).toBe('Put Grove, tier 3 of 5 on the pressure plate in Upper approach to clear the way north.');
  });
});

describe('Palace entrance: the illustrated forest around the rooms', () => {
  // Every board position is drawn as one of these (the board is 20 × 11).
  const tiles = (html: string) => ({
    forest: html.match(/class="forest[ "]/g)?.length ?? 0, cells: html.match(/data-cell="true"/g)?.length ?? 0,
    fogged: html.match(/class="fogged"/g)?.length ?? 0, palace: html.match(/class="terrain is-palace/g)?.length ?? 0,
  });
  const link = regions.find((r) => r.link)!.link!;
  const clueAt = (html: string) => [...html.matchAll(/class="forest is-clue"[^>]*grid-row:(\d+) \/ span 1;grid-column:(\d+) \/ span 1/g)]
    .map((m) => p(+m[1] - 1, +m[2] - 1));

  it('lies under everything that is not a tile, with the hidden link\'s clue until it opens, never under fog or the palace front', () => {
    const total = ENTRANCE_LEVEL.board.length * ENTRANCE_LEVEL.board[0].length;
    // At the start: forest wherever there is no tile, the hidden link's cell its clue.
    const start = board(initUi(ENTRANCE_LEVEL));
    expect(tiles(start)).toEqual({ forest: total - tiles(start).cells, cells: tiles(start).cells, fogged: 0, palace: 0 });
    expect(clueAt(start)).toEqual([link]);
    expect(start).toMatch(/class="forest is-alt"/);
    // The East terrace's concealed part found: its cells and the link are tiles now, and the clue is gone.
    const pocket = through(initUi(ENTRANCE_LEVEL), ...drops([...OPEN_FORK, ...OPEN_TERRACES, ...FINISH_WEST, ...REVEAL_POCKET]));
    const found = board(pocket);
    expect(found).toMatch(new RegExp(`data-row="${link.row}" data-col="${link.col}"`));
    expect([clueAt(found), tiles(found).forest + tiles(found).cells]).toEqual([[], total]);
    // C1-08B showing: the forecourt under fog has no forest beneath; once read, none under the palace wall and entrance.
    const due = through(initUi(ENTRANCE_LEVEL), ...drops(ALL_MOVES));
    const fog = tiles(board(due, true));
    expect([fog.fogged > 0, fog.forest + fog.cells + fog.fogged]).toEqual([true, total]);
    const open = tiles(board(revealedUi()));
    expect([open.palace > 0, open.forest + open.cells + open.palace]).toEqual([true, total]);
    // Only Chapter 1's woodland has it: not the palace's halls, nor boards without a scene.
    for (const scene of ['palace', undefined] as const) {
      expect(renderToStaticMarkup(<Board state={initUi(ENTRANCE_LEVEL)} dispatch={() => {}} scene={scene} />)).not.toContain('class="forest');
    }
  });
});

describe('Palace entrance prototype: the reveal and Alisha\'s speech bubble', () => {
  it('reveals the forecourt, the entrance and the plate together on one move, announced, with Alisha beside them', () => {
    const before = through(initUi(ENTRANCE_LEVEL), ...drops(ALL_MOVES.slice(0, -1)));
    expect(plateRevealed(before)).toBe(false);
    const s = run(before, ...drops(ALL_MOVES.slice(-1)));
    expect([plateRevealed(s), bubbleOpen(s), canMoveAlisha(s), s.session.undo]).toEqual([true, true, false, null]);
    expect(storyDue(s)).toBe('C1-08B');                                                // the forecourt's scene comes first
    expect(partySpots(s.session)).toEqual(party.waiting);
    expect(describeAction(s.lastAction, 'Level', ENTRANCE_LEVEL.goal, regions, tasks)).toBe(
      'Merged 3 into 1 item: Grove, tier 3 of 5. The way north is clear: Palace forecourt, with the palace entrance and a pressure plate.');
    expect(viewCue(s)).toEqual({ kind: 'region', region: FORECOURT });
    // Until the forecourt's scene (C1-08B) has been read, there are no cells, wall, entrance, plate or bubble, and Alisha
    // and Fiona are where they were; the move is announced without it. Only the move's own result shows (Grove 3 fixed on
    // its tile). Through the pause it looks as it did before the move (forest, no fog); once the scene is showing over the
    // board it is under fog, its shape only.
    const html = board(s);
    const forest = (h: string) => h.match(/class="terrain"/g)?.length;
    expect(html).not.toMatch(SPOILER);
    expect([html.includes('data-fog='), forest(html)]).toEqual([false, forest(board(before))]);
    expect(board(s, true)).not.toMatch(SPOILER);
    expect(board(s, true)).toContain(`<div class="region is-fog" data-fog="${FORECOURT}" aria-hidden="true"`);
    expect(announcement(s, 'Level')).toBe('Merged 3 into 1 item: Grove, tier 3 of 5.');
    expect(html).toContain('class="board is-entrance is-paused"');
    expect(html).toContain('aria-label="Row 5, column 6, Upper approach, pressure plate for Grove, tier 3 of 5, fixed: Grove, tier 3 of 5"');
    expect(html.match(/data-spot="(alisha|fiona)"/g)).toHaveLength(2);
    expect(entranceGuide(s)).toBe('The way north is clear.');
    const at = (q: Pos) => `style="grid-row:${q.row + 1} / span 1;grid-column:${q.col + 1} / span 1"`;
    // Read: the forecourt, the entrance and the plate appear, Alisha and Fiona beside them, and her bubble.
    const read_ = read(s);
    const shown = board(read_);
    expect(shown).toContain('aria-label="The palace entrance, closed"');
    expect(shown).toContain('aria-label="Row 2, column 6, Palace forecourt: Alisha&#x27;s pressure plate"');
    expect(shown).toMatch(/<button type="button" class="speech-bubble" data-bubble="true" data-speaker="alisha"><span class="sr-only">Alisha says: <\/span><span class="bubble-text">I can stand on that plate\.<\/span><span class="bubble-prompt">Tap to continue<\/span><\/button>/);
    expect(ALISHA_LINE).toBe('I can stand on that plate.');
    expect(shown).toContain(`class="bubble-anchor is-alisha" ${at(party.waiting.alisha)}`);
    expect(shown).toContain('class="board is-entrance is-paused"');                       // the bubble still pauses it
    expect(shown).not.toContain('data-fog=');
    expect(shown).toContain(`<div class="region is-fog is-lifting" data-fog-lifting="${FORECOURT}" aria-hidden="true"`);
    expect(announcement(read_, 'Level')).toBe('The way north is clear: Palace forecourt, with the palace entrance and a pressure plate.');
    expect(entranceGuide(read_)).toBe('Alisha has something to say. Tap her speech bubble to continue.');
  });

  it('pauses the board while open: taps, drops, Alisha, Undo and supply do nothing; only the bubble\'s own action dismisses it', () => {
    expect(items(revealedUi())).toEqual([]);                                           // every original piece is fixed now
    const s = withLoose(revealedUi());
    const blocked: UiAction[] = [
      tap(LOOSE), tap(PLATE), { type: 'drop', from: LOOSE, to: p(2, 5) }, { type: 'drop', from: LOOSE, to: PLATE }, { type: 'undo' },
      { type: 'placeSupply' }, { type: 'unlock' }, { type: 'selectAlisha' }, { type: 'placeAlisha', to: PLATE }, { type: 'clearSelection' },
    ];
    for (const a of blocked) expect(run(s, a), a.type).toBe(s);
    expect(canPickUp(s, LOOSE)).toBe(false);
    expect(canPickUp(run(s, { type: 'dismissBubble' }), LOOSE)).toBe(true);
    // Dismissing changes no game state, consumes no move and leaves nothing selected.
    const open = run(s, { type: 'dismissBubble' });
    expect([bubbleOpen(open), open.session, open.actionSeq, open.selected, open.alishaSelected]).toEqual([false, s.session, s.actionSeq, null, false]);
    expect(run(open, { type: 'dismissBubble' })).toBe(open);
    expect(canMoveAlisha(open)).toBe(true);
    const html = board(open);
    expect(html).not.toContain('speech-bubble');
    expect(html).toMatch(/<button type="button" class="character is-alisha is-ready" data-alisha="true" aria-pressed="false" aria-label="Alisha: drag her onto the glowing plate, or tap to pick her up">/);
    expect(html).toContain('class="cell is-character-plate is-ready"');
    expect(entranceGuide(open)).toBe('Drag Alisha onto the glowing plate, or tap her, then the plate.');
  });

  it('comes back with the level on Retry, and Retry works while it is open', () => {
    const retried = run(revealedUi(), { type: 'retry' });
    expect([retried.session, retried.talkHeard.length > 0, bubbleOpen(retried)]).toEqual([startSession(ENTRANCE_LEVEL), false, false]);
    const again = through(retried, ...drops(ALL_MOVES));
    expect(bubbleOpen(again)).toBe(true);
    const afterDismiss = run(readyUi(), { type: 'retry' });
    expect([afterDismiss.talkHeard.length > 0, afterDismiss.session]).toEqual([false, startSession(ENTRANCE_LEVEL)]);
  });
});

describe('Palace entrance prototype: placing Alisha', () => {
  it('stands her on the plate by a drag: the entrance opens for good, a checkpoint and the win', () => {
    const s = run(readyUi(), { type: 'placeAlisha', to: PLATE });
    expect([s.status, s.session.collected, s.session.undo, s.lastAction]).toEqual(['won', true, null, { kind: 'stand' }]);
    expect(partySpots(s.session)).toEqual({ ...party.waiting, alisha: PLATE });
    expect(describeAction(s.lastAction, 'Level', ENTRANCE_LEVEL.goal, regions, tasks))
      .toBe('Alisha stood on the plate. It sank with a click, and the palace entrance opened.');
    expect(actionEffect(s)).toBe('case-victory');
    expect(viewCue(s)).toEqual({ kind: 'entrance', plate: PLATE, door: DOOR });
    expect(entranceGuide(s)).toBe('The palace entrance is open!');
    const html = board(s);
    expect(html).toContain('aria-label="The palace entrance, open"');
    expect(html).toContain('data-door="open"');
    expect(html).toContain('class="is-opening"');
    expect(html).toContain('Alisha&#x27;s pressure plate: Alisha is standing on it, and the palace entrance is open');
    expect(html).toContain('data-character-plate="pressed"');
    expect(html).not.toContain('data-spot="alisha"');                                  // she has left her spot
    expect(html).toContain('data-spot="fiona"');
  });

  it('stands her on the plate by tap-then-tap (the keyboard does the same through the same buttons)', () => {
    const picked = run(readyUi(), { type: 'selectAlisha' });
    expect([picked.alishaSelected, entranceGuide(picked)]).toEqual([true, 'Now tap the glowing plate to stand Alisha on it.']);
    const html = board(picked);
    expect(html).toContain('aria-pressed="true" aria-label="Alisha, picked up: now choose her plate"');
    expect(html).toContain('class="cell is-character-plate is-alisha-target"');
    expect(html).toContain('Alisha&#x27;s pressure plate, tap to stand Alisha here');
    expect(html).toContain('class="board is-entrance is-placing"');
    expect(run(picked, { type: 'selectAlisha' }).alishaSelected).toBe(false);       // tapping her again puts her down
    expect(run(picked, { type: 'clearSelection' }).alishaSelected).toBe(false);     // Escape
    const won = run(picked, tap(PLATE));
    expect([won.status, won.session.collected]).toEqual(['won', true]);
  });

  it('rejects every other destination: she stays, nothing changes, and a tap elsewhere only puts her down', () => {
    const ready = readyUi();
    for (const to of [p(2, 5), p(4, 5), p(5, 3), party.waiting.fiona, DOOR, p(16, 7), p(-1, 0)]) {
      expect(run(ready, { type: 'placeAlisha', to })).toBe(ready);
    }
    const picked = run(ready, { type: 'selectAlisha' });
    const put = run(picked, tap(p(5, 3)));                                             // an item: no move, no selection
    expect([put.alishaSelected, put.selected, put.session, put.actionSeq]).toEqual([false, null, picked.session, picked.actionSeq]);
    expect(partySpots(put.session)).toEqual(party.waiting);
  });

  it('cannot reach the plate before it is revealed, or while the bubble is open', () => {
    for (const s of [initUi(ENTRANCE_LEVEL), through(initUi(ENTRANCE_LEVEL), ...drops(ALL_MOVES.slice(0, -1))), revealedUi()]) {
      expect(canMoveAlisha(s)).toBe(false);
      expect(run(s, { type: 'selectAlisha' })).toBe(s);
      expect(run(s, { type: 'placeAlisha', to: PLATE })).toBe(s);
      if (!plateRevealed(s)) expect(standOnPlate(s.session, PLATE)).toBe(s.session);
    }
  });

  it('never lets an item onto the plate or open it: no drop, no tap-tap, no collecting tap', () => {
    const ready = withLoose(readyUi());
    const item = LOOSE;
    expect(canDrop(ready.session, item, p(2, 5))).toBe(true);                           // an ordinary move is fine
    expect(canDrop(ready.session, item, PLATE)).toBe(false);
    expect(applyDrop(ready.session, item, PLATE)).toBe(ready.session);
    expect(run(ready, { type: 'drop', from: item, to: PLATE })).toBe(ready);
    const picked = run(ready, tap(item));
    expect(picked.selected).toEqual(item);
    const tapped = run(picked, tap(PLATE));
    expect([tapped.session, tapped.selected, tapped.status]).toEqual([ready.session, null, 'playing']);
    expect(run(ready, tap(PLATE))).toBe(ready);                                         // nothing selected: nothing
    expect(collect(ready.session)).toBe(ready.session);
  });

  it('opens the entrance once: repeated placement, taps and Undo change nothing after the win', () => {
    const won = run(readyUi(), { type: 'placeAlisha', to: PLATE });
    for (const a of [{ type: 'placeAlisha', to: PLATE }, tap(PLATE), { type: 'selectAlisha' }, { type: 'undo' }, { type: 'dismissBubble' }] as UiAction[]) {
      expect(run(won, a), a.type).toBe(won);
    }
    expect(standOnPlate(won.session, PLATE)).toBe(won.session);
    const retried = run(won, { type: 'retry' });
    expect([retried.session, retried.status, retried.talkHeard.length > 0, retried.alishaSelected])
      .toEqual([startSession(ENTRANCE_LEVEL), 'playing', false, false]);
    expect(viewCue(retried)).toEqual({ kind: 'start' });
  });
});

describe('Palace entrance prototype: finishing', () => {
  it('offers Enter the palace once the opening has played, once, and Retry or leaving cancels the wait', () => {
    vi.useFakeTimers();
    const won = run(readyUi(), { type: 'placeAlisha', to: PLATE });
    const ready = vi.fn();
    afterEntranceOpening(won, ready);
    vi.advanceTimersByTime(ENTRANCE_OPENING_MS - 1);
    expect(ready).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(ENTRANCE_OPENING_MS * 3);
    expect(ready).toHaveBeenCalledTimes(1);
    const later = vi.fn();
    const cancel = afterEntranceOpening(won, later)!;
    vi.advanceTimersByTime(ENTRANCE_OPENING_MS - 100);
    cancel();                                                                           // Retry, Home or unmounting
    vi.advanceTimersByTime(ENTRANCE_OPENING_MS * 3);
    expect(later).not.toHaveBeenCalled();
    expect(afterEntranceOpening(run(won, { type: 'retry' }), later)).toBeUndefined();
    expect(afterEntranceOpening(readyUi(), later)).toBeUndefined();
  });

  it('has an illustrated entry scene, C1-09, one line at a time; C1-10 now opens the Crystal Palace (storyboard order)', () => {
    expect(ENTRY_PANELS.map((panel) => panel.id)).toEqual(['C1-09']);
    expect(INSIDE_PANELS.map((panel) => panel.id)).toEqual(['C1-10']);
    expect([comicBeats(ENTRY_PANELS).length, comicBeats(INSIDE_PANELS).length]).toEqual([6, 5]);
    expect([...ENTRY_PANELS, ...INSIDE_PANELS].flatMap((panel) => panel.lines).some((l) => l.speaker === undefined)).toBe(false);  // no narration
  });

  it('shows the Help line for Alisha\'s plate once it is revealed', () => {
    const help = renderToStaticMarkup(<HelpButton goal={ENTRANCE_LEVEL.goal} regions={regions} tasks={tasks} party="plate" />);
    expect(help).toContain('Drag Alisha onto her glowing pressure plate, or tap her, then the plate. Items can&#x27;t stand on it');
    expect(help).toContain('Goal: open the rune gates northward and find the palace entrance.');
  });
});

describe('Palace entrance prototype: story scenes', () => {
  // The storyboard (STORYBOARD) is the source of truth for the scenes' pictures and words (each figure's dialogue, one
  // <p> per line).
  const figure = (code: string) => {
    const fig = STORYBOARD.match(new RegExp(`<figure class="shot" id="${code}">([\\s\\S]*?)</figure>`))?.[1] ?? '';
    const lines = [...fig.matchAll(/<p><strong>(\w+):<\/strong> “([^”]*)”<\/p>/g)].map(([, speaker, text]) => ({ speaker, text }));
    expect(fig.match(/“/g)?.length, `${code}: every quoted line parsed`).toBe(lines.length);
    return { source: fig.match(/<img src="[^"]*\/([^"/]+)\.png"/)?.[1], lines };
  };
  const ALL_PANELS = [...APPROACH_PANELS, ...ENTRANCE_STORY['C1-08A'].panels, ...ENTRANCE_STORY['C1-08B'].panels, ...ENTRY_PANELS, ...INSIDE_PANELS];
  const WEST_ITEM = p(9, 3);                                                           // a West terrace Grove tier 1
  /** Both terraces just opened: the terrace junction's scene due. */
  const junction = () => through(initUi(ENTRANCE_LEVEL), ...drops([...OPEN_FORK, ...OPEN_TERRACES]));

  it('uses the storyboard\'s current pictures and dialogue for C1-08 to C1-10, word for word, in order', () => {
    expect(ALL_PANELS.map((panel) => panel.id)).toEqual(['C1-08', 'C1-08A', 'C1-08B', 'C1-09', 'C1-10']);
    for (const panel of ALL_PANELS) {
      const { source, lines } = figure(panel.id);
      expect(lines.length, panel.id).toBeGreaterThan(0);
      expect(panel.lines, panel.id).toEqual(lines);
      // The delivery copy of the storyboard's own image (src/assets/art/README.md): 08-palace-approach-draft-v2.png →
      // chapter-one-08-palace-approach-v2.webp.
      expect(source, panel.id).toBeDefined();
      expect(renderToStaticMarkup(<>{panel.art}</>), panel.id)
        .toMatch(new RegExp(`<img src="[^"]*/chapter-one-${source!.replace('-draft-', '-')}\\.webp" alt=""/>$`));
      expect(panel.description).toMatch(/^Alisha and Fiona /);
    }
    expect(STORYBOARD).toContain(`<strong>On-board Alisha bubble:</strong> “${ALISHA_LINE}”`);
    expect(ENTRANCE_LEVEL.party!.story).toEqual([{ id: 'C1-08A', task: OPEN_TERRACES_TASK }, { id: 'C1-08B', task: REVEAL_FORECOURT_TASK }]);
  });

  it('shows the terrace junction (C1-08A) on the move that opens both terraces, the entrance still concealed', () => {
    const before = through(initUi(ENTRANCE_LEVEL), ...drops([...OPEN_FORK, ...OPEN_TERRACES.slice(0, -1)]));
    expect(storyDue(initUi(ENTRANCE_LEVEL))).toBeNull();                                // C1-08 is shown before play
    expect(storyDue(before)).toBeNull();                                                 // not for the Forked path
    const s = run(before, ...drops(OPEN_TERRACES.slice(-1)));
    expect(storyDue(s)).toBe('C1-08A');
    expect([isOpen(s.session, WEST), isOpen(s.session, EAST), isOpen(s.session, UPPER), plateRevealed(s)]).toEqual([true, true, false, false]);
    expect(board(s)).not.toMatch(SPOILER);
    expect(board(s)).toContain('class="board is-entrance is-paused"');
    // Until it has been read, both terraces' gates are drawn and labelled shut, nothing glows, and the move is announced
    // without them. The move's own result shows, with the discovery cue. Through the pause the terraces look as they did
    // before the move (locked, their items showing, no fog); once the scene is showing over the board they are under fog:
    // their shape, no cells or items.
    const fog = (u: UiState, i: number, showing = false) => board(u, showing).includes(`<div class="region is-fog" data-fog="${i}" aria-hidden="true"`);
    const lifting = (u: UiState, i: number) => board(u).includes(`<div class="region is-fog is-lifting" data-fog-lifting="${i}" aria-hidden="true"`);
    const terraceCells = (u: UiState, showing = false, locked = '') =>
      board(u, showing).match(new RegExp(`aria-label="Row \\d+, column \\d+, (West|East) terrace${locked}`, 'g'))?.length ?? 0;
    expect([terraceCells(before), terraceCells(before, false, ', locked')]).toEqual([24, 24]);
    expect([fog(s, WEST), fog(s, EAST), terraceCells(s), terraceCells(s, false, ', locked'), board(s).includes('data-fx="unlock"')])
      .toEqual([false, false, 24, 24, false]);
    expect([fog(s, WEST, true), fog(s, EAST, true), terraceCells(s, true)]).toEqual([true, true, 0]);
    const gate = (u: UiState, i: number) => board(u).match(new RegExp(`<div class="(passage[^"]*)" data-passage="${i}"[^>]*aria-label="([^"]*)"`))!;
    for (const [i, name] of [[WEST, 'West'], [EAST, 'East']] as const) {
      expect([gate(s, i)[1].includes('is-open'), gate(s, i)[2]], name).toEqual([false, `Rune gate to ${name} terrace, closed`]);
    }
    expect(board(s)).toContain('Forked path, pressure plate for Song, tier 3 of 5, fixed');
    expect(announcement(s, 'Level')).toBe('Merged 3 into 1 item: Song, tier 3 of 5.');
    expect(actionEffect(s)).toBe('discovery');
    // Read: the fog lifts off both, which open, glowing (the East terrace, a room with a joined part, is outlined cell by
    // cell, each glowing), their gates open, and their opening is announced then.
    const r = read(s);
    expect([fog(r, WEST), fog(r, EAST), lifting(r, WEST), lifting(r, EAST), terraceCells(r)]).toEqual([false, false, true, true, 24]);
    expect(board(r)).toMatch(new RegExp(`data-region="${WEST}"[^>]*><span data-fx="unlock"`));
    expect(board(r)).toMatch(/aria-label="Row \d+, column \d+, East terrace[^"]*"[^>]*>(?:(?!<\/button>).)*<span data-fx="unlock"/);
    for (const [i, name] of [[WEST, 'West'], [EAST, 'East']] as const) {
      expect([gate(r, i)[1].includes('is-open'), gate(r, i)[2]], name).toEqual([true, `Rune gate to ${name} terrace, open`]);
    }
    expect(announcement(r, 'Level')).toBe('The rune gates to West terrace and East terrace opened.');
    // The next move: the fog is gone for good, and the move is announced as usual.
    const next = run(r, ...drops(FINISH_WEST.slice(0, 1)));
    expect([lifting(next, WEST), lifting(next, EAST), announcement(next, 'Level')]).toEqual([false, false, 'Moved an item.']);
  });

  it('pauses the board while due: nothing but reading it, Retry and putting things down does anything; reading is not a move', () => {
    const s = junction();
    const blocked: UiAction[] = [
      tap(WEST_ITEM), { type: 'drop', from: WEST_ITEM, to: p(8, 3) }, { type: 'undo' }, { type: 'placeSupply' }, { type: 'unlock' },
      { type: 'dismissBubble' }, { type: 'selectAlisha' }, { type: 'placeAlisha', to: PLATE }, { type: 'clearSelection' },
    ];
    for (const a of blocked) expect(run(s, a), a.type).toBe(s);
    expect(canPickUp(s, WEST_ITEM)).toBe(false);
    const r = run(s, { type: 'finishStory' });
    // The session (board, moves, Undo, tasks), actionSeq and the last action are untouched: dialogue is never a move.
    expect([r.session, r.actionSeq, r.lastAction, r.status, r.storySeen]).toEqual([s.session, s.actionSeq, s.lastAction, s.status, ['C1-08A']]);
    expect(r.session).toBe(s.session);
    expect([storyDue(r), canPickUp(r, WEST_ITEM)]).toEqual([null, true]);
    expect(run(r, { type: 'finishStory' })).toBe(r);                                    // nothing due: nothing to read
  });

  it('shows each scene once per attempt: never again on later moves or Undo, and Undo can\'t go back past its move', () => {
    const s = junction();
    expect(s.session.undo).toBeNull();                                                   // its move was a checkpoint
    let r = read(s);
    r = run(r, ...drops(FINISH_WEST.slice(0, 1)));
    expect(storyDue(r)).toBeNull();
    r = run(r, { type: 'undo' });
    expect([r.lastAction?.kind, r.session.undo, r.session.done.includes(OPEN_TERRACES_TASK), storyDue(r)]).toEqual(['undo', null, true, null]);
    // Every later move, through to the reveal, plays straight on: only the forecourt's scene comes, once.
    const rest = [...FINISH_WEST, ...FINISH_EAST, ...REVEAL_FORECOURT];
    for (const [i, [from, to]] of rest.entries()) {
      const next = run(r, { type: 'drop', from, to });
      expect(next, `move ${i}`).not.toBe(r);
      expect(storyDue(next), `move ${i}`).toBe(i === rest.length - 1 ? 'C1-08B' : null);
      r = next;
    }
  });

  it('shows the forecourt (C1-08B) once it is revealed, before Alisha\'s bubble can be tapped away', () => {
    const s = through(initUi(ENTRANCE_LEVEL), ...drops(ALL_MOVES));
    expect([storyDue(s), plateRevealed(s), bubbleOpen(s), s.session.undo]).toEqual(['C1-08B', true, true, null]);
    expect(run(s, { type: 'dismissBubble' })).toBe(s);
    const r = read(s);
    expect([storyDue(r), bubbleOpen(r), r.session, r.actionSeq]).toEqual([null, true, s.session, s.actionSeq]);
    const ready = run(r, { type: 'dismissBubble' });
    expect([bubbleOpen(ready), canMoveAlisha(ready)]).toEqual([false, true]);
    expect(actionEffect(s)).toBe('discovery');
    const won = run(ready, { type: 'placeAlisha', to: PLATE });
    expect([won.status, storyDue(won), won.storySeen]).toEqual(['won', null, ['C1-08A', 'C1-08B']]);
  });

  it('starts again on Retry, from any point (while a scene is due, too): each is shown again when its move is made again', () => {
    for (const s of [junction(), read(junction()), through(initUi(ENTRANCE_LEVEL), ...drops(ALL_MOVES)), revealedUi(), readyUi()]) {
      const retried = run(s, { type: 'retry' });
      expect([retried.session, retried.storySeen, storyDue(retried), retried.talkHeard.length > 0]).toEqual([startSession(ENTRANCE_LEVEL), [], null, false]);
      expect(storyDue(through(retried, ...drops([...OPEN_FORK, ...OPEN_TERRACES])))).toBe('C1-08A');
    }
  });

  it('waits for the board to show the move before showing a scene; Retry, reading it or leaving cancels the wait', () => {
    vi.useFakeTimers();
    const ready = vi.fn();
    const cancel = afterStoryDue(junction(), ready)!;
    vi.advanceTimersByTime(STORY_DELAY_MS - 1);
    expect(ready).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(STORY_DELAY_MS * 3);
    expect(ready).toHaveBeenCalledTimes(1);
    cancel();
    const later = vi.fn();
    afterStoryDue(junction(), later)!();                                                // Retry, reading it, Home or unmounting
    vi.advanceTimersByTime(STORY_DELAY_MS * 3);
    expect(later).not.toHaveBeenCalled();
    for (const s of [initUi(ENTRANCE_LEVEL), read(junction()), run(junction(), { type: 'retry' }), revealedUi()]) {
      expect(afterStoryDue(s, later)).toBeUndefined();
    }
  });
});

describe('Palace entrance prototype: camera', () => {
  it('opens the Upper approach with the sealed-gate presentation on the second terrace, whichever it is', () => {
    for (const order of ['west-east', 'east-west'] as const) {
      const [a, b] = order === 'west-east' ? [FINISH_WEST, FINISH_EAST] : [FINISH_EAST, FINISH_WEST];
      let s = through(initUi(ENTRANCE_LEVEL), ...drops([...OPEN_FORK, ...OPEN_TERRACES, ...a]));
      expect(viewCue(s)).toBeNull();
      s = through(s, ...drops(b));
      expect(viewCue(s)).toEqual({ kind: 'palace', region: UPPER, gate: p(7, 5) });
    }
  });
});
