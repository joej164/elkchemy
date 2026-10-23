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
import { evaluateStatus } from '../src/status';
import { App, describeAction, Game } from '../src/ui/App';
import { Board } from '../src/ui/Board';
import { viewCue } from '../src/ui/camera';
import { actionEffect } from '../src/ui/audioEvents';
import {
  bubbleOpen, canMoveAlisha, canPickUp, initUi, plateRevealed, reduceUi, type UiAction, type UiState,
} from '../src/ui/controller';
import { afterEntranceOpening, ALISHA_LINE, ENTRANCE_OPENING_MS, entranceGuide } from '../src/ui/entranceGuide';
import { HelpButton } from '../src/ui/HelpButton';
import { LevelPicker } from '../src/ui/LevelPicker';
import { helpObjective, objectiveText, roomsHelp } from '../src/ui/messages';
import { ENTRY_PANELS } from '../src/ui/StoryArt';
import { comicBeats } from '../src/ui/Comic';

// Coordinates are (row, column) from 0 on the 20 × 11 map (see src/entrance.ts).
const p = (row: number, col: number): Pos => ({ row, col });
const it_ = (family: Family, tier: Tier): Item => ({ family, tier });
const regions = ENTRANCE_LEVEL.regions!;
const tasks = ENTRANCE_LEVEL.tasks!;
const party = ENTRANCE_LEVEL.party!;
const PLATE = p(1, 5);
const DOOR = p(0, 5);

type Move = [Pos, Pos];
const m = (moves: [number, number, number, number][]): Move[] => moves.map(([a, b, c, d]) => [p(a, b), p(c, d)]);
const OPEN_FORK = m([[18, 5, 17, 4], [17, 4, 16, 7]]);
const OPEN_TERRACES = m([[14, 5, 13, 4], [13, 4, 14, 6], [14, 6, 12, 5]]);
const FINISH_WEST = m([[10, 2, 9, 1], [9, 1, 10, 1], [10, 1, 8, 0], [9, 3, 8, 2], [8, 2, 8, 3]]);
const REVEAL_POCKET = m([[10, 9, 9, 8], [9, 8, 8, 10]]);
const FINISH_EAST = [...REVEAL_POCKET, ...m([[10, 7, 9, 7], [5, 10, 9, 7], [9, 7, 6, 9], [6, 9, 10, 10]])];
const REVEAL_FORECOURT = m([[6, 6, 5, 4], [5, 4, 6, 4], [6, 4, 4, 5]]);
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
/** The loose (movable) items on open cells. */
const items = (ui: UiState) => ui.session.board.flatMap((r, row) => r.flatMap((c, col) =>
  (c && isCellOpen(ui.session, p(row, col)) && !isFixed(ui.session, p(row, col)) ? [p(row, col)] : [])));
const drops = (moves: readonly Move[]): UiAction[] => moves.map(([from, to]) => ({ type: 'drop', from, to }));
const tap = (pos: Pos): UiAction => ({ type: 'tap', pos });
const ALL_MOVES = [...OPEN_FORK, ...OPEN_TERRACES, ...FINISH_WEST, ...FINISH_EAST, ...REVEAL_FORECOURT];
/** The game with the forecourt just revealed: Alisha's bubble showing. */
const revealedUi = () => run(initUi(ENTRANCE_LEVEL), ...drops(ALL_MOVES));
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
const board = (s: UiState) => renderToStaticMarkup(<Board state={s} dispatch={() => {}} scene="entrance" />);
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

  it('gives every room exact plain chains: only 3-merges, and every order of merges ends with exactly its plates\' items', () => {
    // Each room's pieces per family and tier, merged three at a time as far as they go (counts decide everything, since
    // a family never has five alike at one tier, so no 5-merge is ever possible).
    const rooms = [SOUTH, FORK, WEST, EAST, UPPER, FORECOURT];
    for (const room of rooms) {
      const counts = new Map<string, number>();
      regions.forEach((r, i) => {
        if (roomOf(regions, i) !== room) return;
        ENTRANCE_LEVEL.board.forEach((row, rr) => row.forEach((c, cc) => {
          if (c && regionAt(regions, p(rr, cc)) === i) counts.set(`${c.family}${c.tier}`, (counts.get(`${c.family}${c.tier}`) ?? 0) + 1);
        }));
      });
      const final: string[] = [];
      for (const family of ['grove', 'song', 'crystal', 'elk'] as Family[]) {
        let carry = 0;
        for (let t = 0; t <= 4; t++) {
          const n = (counts.get(`${family}${t}`) ?? 0) + carry;
          expect(n, `room ${room} ${family} tier ${t}`).toBeLessThan(5);
          carry = Math.floor(n / 3);
          for (let k = 0; k < n % 3; k++) final.push(`${family}${t}`);
        }
      }
      const plates = tasks.filter((t) => roomOf(regions, t.in) === room).flatMap((t) => t.plates.map((pl) => `${pl.item.family}${pl.item.tier}`));
      expect(final.sort(), `room ${room}`).toEqual(plates.sort());
    }
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
      s = run(s, ...drops(moves));
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

describe('Palace entrance prototype: the reveal and Alisha\'s speech bubble', () => {
  it('reveals the forecourt, the entrance and the plate together on one move, announced, with Alisha beside them', () => {
    const before = run(initUi(ENTRANCE_LEVEL), ...drops(ALL_MOVES.slice(0, -1)));
    expect(plateRevealed(before)).toBe(false);
    const s = run(before, ...drops(ALL_MOVES.slice(-1)));
    expect([plateRevealed(s), bubbleOpen(s), canMoveAlisha(s), s.session.undo]).toEqual([true, true, false, null]);
    expect(partySpots(s.session)).toEqual(party.waiting);
    expect(describeAction(s.lastAction, 'Level', ENTRANCE_LEVEL.goal, regions, tasks)).toBe(
      'Moved an item. The way north is clear: Palace forecourt, with the palace entrance and a pressure plate.');
    expect(viewCue(s)).toEqual({ kind: 'region', region: FORECOURT });
    const html = board(s);
    expect(html).toContain('aria-label="The palace entrance, closed"');
    expect(html).toContain('aria-label="Row 2, column 6, Palace forecourt: Alisha&#x27;s pressure plate"');
    expect(html).toMatch(/<button type="button" class="speech-bubble" data-bubble="true"><span class="sr-only">Alisha says: <\/span><span class="bubble-text">I can stand on that plate\.<\/span><span class="bubble-prompt">Tap to continue<\/span><\/button>/);
    expect(ALISHA_LINE).toBe('I can stand on that plate.');
    // The bubble is anchored on Alisha's spot.
    expect(html).toContain(`class="bubble-anchor" style="grid-row:${party.waiting.alisha.row + 1} / span 1;grid-column:${party.waiting.alisha.col + 1} / span 1"`);
    expect(html).toContain('class="board is-entrance is-paused"');
    expect(entranceGuide(s)).toBe('Alisha has something to say. Tap her speech bubble to continue.');
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
    expect([retried.session, retried.bubbleDismissed, bubbleOpen(retried)]).toEqual([startSession(ENTRANCE_LEVEL), false, false]);
    const again = run(retried, ...drops(ALL_MOVES));
    expect(bubbleOpen(again)).toBe(true);
    const afterDismiss = run(readyUi(), { type: 'retry' });
    expect([afterDismiss.bubbleDismissed, afterDismiss.session]).toEqual([false, startSession(ENTRANCE_LEVEL)]);
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
    for (const s of [initUi(ENTRANCE_LEVEL), run(initUi(ENTRANCE_LEVEL), ...drops(ALL_MOVES.slice(0, -1))), revealedUi()]) {
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
    expect([retried.session, retried.status, retried.bubbleDismissed, retried.alishaSelected])
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

  it('has a short illustrated entry scene (C1-09, then C1-10), its words in the captions, ending back at Levels', () => {
    expect(comicBeats(ENTRY_PANELS)).toHaveLength(3);
    expect(ENTRY_PANELS.flatMap((p) => p.lines.map((l) => `${l.speaker ?? ''}: ${l.text}`))).toEqual([
      ': The plate sinks with a click, and the palace doors swing open.', 'Alisha: We’re in.', 'Fiona: The Crystal Palace.',
    ]);
    const art = ENTRY_PANELS.map((panel) => renderToStaticMarkup(<>{panel.art}</>));
    expect(art[0]).toMatch(/<img src="[^"]*chapter-one-09-palace-entry-v1\.webp" alt=""\/>/);
    expect(art[1]).toMatch(/<img src="[^"]*chapter-one-10-palace-interior-v1\.webp" alt=""\/>/);
    for (const panel of ENTRY_PANELS) {
      expect(panel.description).toMatch(/^Alisha and Fiona /);
      expect(panel.description).not.toMatch(/placeholder/i);
    }
  });

  it('is a separate Levels entry after The Attic, leaving the numbered levels and Home as they were', () => {
    const page = renderToStaticMarkup(<LevelPicker levels={LEVELS} current={0} onPick={() => {}} onAttic={() => {}} onEntrance={() => {}}
      onHome={() => {}} musicControl={null} />);
    const entry = page.indexOf('data-action="entrance"');
    expect(entry).toBeGreaterThan(page.indexOf('data-action="attic"'));
    expect(entry).toBeLessThan(page.indexOf('<ol class="level-list">'));
    expect(page).toMatch(/data-action="entrance"[^>]*>(?:(?!<\/button>).)*<span class="sr-only">Story prototype: <\/span>Palace entrance prototype(?:(?!<\/button>).)*Prototype/);
    expect(page.match(/<li>/g)).toHaveLength(LEVELS.length);
    expect(renderToStaticMarkup(<App />)).not.toContain('entrance');
  });

  it('shows the Help line for Alisha\'s plate once it is revealed', () => {
    const help = renderToStaticMarkup(<HelpButton goal={ENTRANCE_LEVEL.goal} regions={regions} tasks={tasks} party="plate" />);
    expect(help).toContain('Drag Alisha onto her glowing pressure plate, or tap her, then the plate. Items can&#x27;t stand on it');
    expect(help).toContain('Goal: open the rune gates northward and find the palace entrance.');
  });
});

describe('Palace entrance prototype: camera', () => {
  it('opens the Upper approach with the sealed-gate presentation on the second terrace, whichever it is', () => {
    for (const order of ['west-east', 'east-west'] as const) {
      const [a, b] = order === 'west-east' ? [FINISH_WEST, FINISH_EAST] : [FINISH_EAST, FINISH_WEST];
      let s = run(initUi(ENTRANCE_LEVEL), ...drops([...OPEN_FORK, ...OPEN_TERRACES, ...a]));
      expect(viewCue(s)).toBeNull();
      s = run(s, ...drops(b));
      expect(viewCue(s)).toEqual({ kind: 'palace', region: UPPER, gate: p(7, 5) });
    }
  });
});

describe('Palace entrance prototype: random play stays solvable (a sample, not a proof)', () => {
  // A seeded mix of random legal moves and a simple solver's steps, from the start to the win. The count argument above
  // is what rules out stranding; this checks it against the real board rules (rooms, links, fixed plates, swaps).
  const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const cells = ENTRANCE_LEVEL.board.flatMap((r, row) => r.map((_, col) => p(row, col))).filter((q) => regionAt(regions, q) !== -1);
  const roomCells = (s: SessionState, q: Pos) => {
    const room = roomOf(regions, regionAt(regions, q));
    return cells.filter((c) => isCellOpen(s, c) && roomOf(regions, regionAt(regions, c)) === room);
  };
  const items = (s: SessionState) => cells.filter((q) => s.board[q.row][q.col] && isCellOpen(s, q) && !isFixed(s, q));
  const same = (a: Item | null, b: Item | null) => !!a && !!b && a.family === b.family && a.tier === b.tier;

  function solverStep(ui: UiState): UiAction | null {
    if (bubbleOpen(ui)) return { type: 'dismissBubble' };
    if (canMoveAlisha(ui)) return { type: 'placeAlisha', to: PLATE };
    const s = ui.session;
    // Fill a marked tile of an open task with its exact item from the same room.
    for (const t of tasks.keys()) {
      if (s.done.includes(t) || !isOpen(s, tasks[t].in)) continue;
      for (const pl of tasks[t].plates) {
        if (same(s.board[pl.row][pl.col], pl.item)) continue;
        const from = items(s).find((q) => same(s.board[q.row][q.col], pl.item) && roomCells(s, q).some((c) => c.row === pl.row && c.col === pl.col) &&
          !tasks[t].plates.some((o) => o.row === q.row && o.col === q.col));
        if (from) return { type: 'drop', from, to: p(pl.row, pl.col) };
      }
    }
    // Any merge ready now.
    const all = items(s);
    for (const a of all) for (const b of all) if (a !== b && previewDrop(s, a, b).length >= 3) return { type: 'drop', from: a, to: b };
    // Gather three alike: put a second beside the first, then the third merges onto them.
    for (const a of all) {
      const alike = all.filter((b) => b !== a && same(s.board[b.row][b.col], s.board[a.row][a.col]) && roomCells(s, a).includes(b));
      if (alike.length < 2) continue;
      const room = roomCells(s, a);
      const beside = room.find((c) => Math.abs(c.row - a.row) + Math.abs(c.col - a.col) === 1 && !isFixed(s, c) && !(c.row === PLATE.row && c.col === PLATE.col) &&
        !alike.includes(c));
      if (beside) return { type: 'drop', from: alike[0], to: beside };
    }
    return null;
  }

  it('wins 150 seeded games mixing random moves with solver steps, reaching both terrace orders', () => {
    const orders = new Set<string>();
    for (let g = 0; g < 150; g++) {
      const random = rng(g + 1);
      let ui = initUi(ENTRANCE_LEVEL);
      let steps = 0;
      while (ui.status !== 'won' && steps++ < 3000) {
        const pool = items(ui.session);
        let next = ui;
        if (!bubbleOpen(ui) && random() < 0.5 && pool.length > 0) {
          const from = pool[Math.floor(random() * pool.length)];
          const room = roomCells(ui.session, from);
          next = run(ui, { type: 'drop', from, to: room[Math.floor(random() * room.length)] });
        } else {
          const step = solverStep(ui);
          expect(step, `game ${g} stuck after ${steps} steps`).not.toBeNull();
          next = run(ui, step!);
          expect(next, `game ${g}: ${JSON.stringify(step)}`).not.toBe(ui);
        }
        ui = next;
      }
      expect(ui.status, `game ${g}`).toBe('won');
      orders.add(ui.session.done.filter((d) => d === WEST_TASK || d === EAST_TASK).join('-'));
      expect(evaluateStatus(ui.session)).toBe('won');
    }
    expect([...orders].sort()).toEqual([`${WEST_TASK}-${EAST_TASK}`, `${EAST_TASK}-${WEST_TASK}`].sort());
  });
});
