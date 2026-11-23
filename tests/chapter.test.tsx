import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAX_TIER, type Family, type Item, type Pos } from '../src/board';
import {
  ANTE_TASK, ARCHIVE_TASK, BEYOND_GROVE, BEYOND_LEVEL, CLEANUP_DEPOT, CLEANUP_LEVEL, CLEANUP_NORTH, GARDEN_TASK, LOGS_TASK,
  MEET_FIONA_LEVEL, RELEASE_TASK, RESCUE_ANTE, RESCUE_ARCHIVE, RESCUE_CHAMBER, RESCUE_LEVEL, RESCUE_PLATE_ROOM, RESCUE_TALK,
  RESCUE_WORKSHOP, REVEAL_DEPOT_TASK, REVEAL_PLATE_ROOM_TASK, TOOLS_TASK, TRAP_TASK, WORKSHOP_TASK,
} from '../src/chapter';
import { ENTRANCE_LEVEL } from '../src/entrance';
import { LEVELS } from '../src/levels';
import { isFixed, isOpen, regionAt, roomOf, type TaskUnlock } from '../src/regions';
import {
  alishaPlate, applyDrop, collect, contentCells, dogSpot, isCellOpen, openChest, partySpots, standOnPlate, startSession, trapped,
  type LevelDefinition, type SessionState,
} from '../src/session';
import { evaluateStatus, strandedRoom } from '../src/status';
import { announcement, App, describeAction, Game, TaskPanel } from '../src/ui/App';
import { Board } from '../src/ui/Board';
import { actionEffect } from '../src/ui/audioEvents';
import { viewCue } from '../src/ui/camera';
import { CHAPTER_ONE } from '../src/ui/chapterOne';
import { meetFionaGuide } from '../src/ui/chapterGuide';
import {
  BEYOND_CLOSING, BEYOND_OPENING, chapterArt, CLEANUP_CLOSING, CLEANUP_OPENING, CLEANUP_STORY, MEET_FIONA_CLOSING, MEET_FIONA_OPENING,
  RESCUE_STORY,
} from '../src/ui/chapterStory';
import { artDescription, beatAnnouncement, Comic, comicBeats, type ComicPanel } from '../src/ui/Comic';
import {
  bubbleOpen, canMoveAlisha, canPickUp, canUndo, initUi, reduceUi, storyDue, storyHeld, storyPending, talkDue, talkShown, workshopProgress, type UiAction, type UiState,
} from '../src/ui/controller';
import { afterRecipeIdle, RECIPE_HINT_MS } from '../src/ui/entranceGuide';
import { LevelPicker } from '../src/ui/LevelPicker';
import { statusMessage, workshopHint } from '../src/ui/messages';
import { APPROACH_PANELS, ENTRANCE_STORY, ENTRY_PANELS, INSIDE_PANELS } from '../src/ui/StoryArt';
import STORYBOARD from '../docs/story/chapter-one-review.html?raw';

const p = (row: number, col: number): Pos => ({ row, col });
afterEach(() => { vi.useRealTimers(); });
type Step = [number, number, number, number] | ['stand' | 'tap', number, number];

// Winning lines, room by room (also written beside each level in src/chapter.ts and src/entrance.ts).
const LINES = {
  meetFiona: [[0, 3, 0, 1], [3, 3, 3, 1], [0, 1, 2, 1], [3, 3, 3, 1]] as Step[],
  cleanup: {
    south: [[8, 7, 9, 7], [9, 5, 9, 6], [9, 5, 8, 5], [9, 6, 8, 8]] as Step[],
    reveal: [[6, 6, 6, 5], [6, 5, 4, 5]] as Step[],
    logs: [[6, 8, 4, 8], [5, 8, 4, 8], [4, 8, 3, 6], [5, 8, 4, 6], [6, 7, 3, 6]] as Step[],
    tools: [[6, 2, 4, 2], [4, 1, 4, 2], [4, 2, 4, 1], [4, 0, 3, 0], [4, 1, 3, 0], [6, 0, 6, 3]] as Step[],
    finish: [['tap', 0, 6]] as Step[],
  },
  entrance: [
    [18, 5, 17, 4], [17, 4, 16, 7],
    [13, 7, 14, 5], [14, 7, 14, 5], [14, 5, 12, 5], [14, 6, 13, 5], [14, 7, 12, 5],
    [10, 2, 9, 2], [10, 3, 9, 2], [9, 2, 8, 0], [10, 1, 9, 0], [10, 3, 8, 0], [9, 3, 8, 2], [8, 2, 8, 3],
    [10, 9, 9, 8], [9, 8, 8, 10], [6, 9, 9, 9], [8, 7, 6, 9], [10, 7, 6, 9], [9, 9, 10, 10], [6, 9, 10, 9], [10, 7, 10, 10],
    [5, 5, 5, 4], [4, 4, 5, 4], [4, 7, 5, 7], [5, 4, 4, 5], [5, 7, 4, 5],
    ['stand', 1, 5],
  ] as Step[],
  rescue: {
    entry: [[15, 4, 15, 3], [15, 3, 13, 3], [15, 5, 14, 5], [14, 5, 13, 6]] as Step[],
    gallery: [[9, 9, 10, 3], [10, 9, 10, 3], [11, 7, 10, 7], [10, 3, 10, 7], [10, 7, 10, 6], [10, 3, 10, 5], [11, 3, 10, 6]] as Step[],
    trap: [['stand', 14, 9]] as Step[],
    workshop: [[6, 0, 4, 1], [5, 1, 6, 0], [5, 0, 6, 0], [4, 1, 5, 0], [5, 3, 6, 3], [4, 2, 6, 2], [5, 0, 6, 2], ['tap', 6, 2],
      [6, 1, 4, 0], [5, 2, 5, 0], [6, 2, 4, 0]] as Step[],
    archive: [[5, 10, 6, 10], [6, 10, 5, 13], [6, 11, 3, 11], [7, 11, 3, 11], [3, 13, 3, 12], [7, 11, 3, 12], [7, 12, 7, 13],
      [2, 13, 6, 13], [3, 12, 7, 13]] as Step[],
    chamber: [[6, 5, 5, 7], [5, 6, 6, 5], [5, 5, 6, 5], [5, 7, 5, 5], [5, 5, 4, 5], [7, 8, 4, 8], [6, 7, 5, 7], [5, 8, 4, 7], [6, 8, 4, 7]] as Step[],
    ante: [[1, 5, 2, 5], [0, 5, 2, 5], [1, 8, 2, 8], [0, 8, 1, 8], [1, 7, 2, 8], ['tap', 0, 6]] as Step[],
  },
  beyond: [
    [11, 3, 12, 4], [12, 3, 12, 4], [12, 4, 11, 5], [12, 3, 11, 5],
    [9, 3, 9, 4], [8, 1, 7, 2], [9, 1, 7, 2], [9, 4, 7, 4],
    [4, 5, 5, 5], [4, 4, 5, 5], [3, 2, 3, 6], [5, 2, 3, 6], [4, 3, 3, 4], [3, 6, 3, 5], [5, 2, 3, 4],
    ['stand', 0, 5],
  ] as Step[],
};
const { cleanup: C, rescue: R } = LINES;
const WINS: [string, LevelDefinition, Step[]][] = [
  ['Meet Fiona', MEET_FIONA_LEVEL, LINES.meetFiona],
  ['Woodland cleanup, logs first', CLEANUP_LEVEL, [...C.south, ...C.reveal, ...C.logs, ...C.tools, ...C.finish]],
  ['Woodland cleanup, tools first', CLEANUP_LEVEL, [...C.south, ...C.reveal, ...C.tools, ...C.logs, ...C.finish]],
  ['the palace entrance', ENTRANCE_LEVEL, LINES.entrance],
  ['the Crystal Palace, workshop first', RESCUE_LEVEL, [...R.entry, ...R.gallery, ...R.trap, ...R.workshop, ...R.archive, ...R.chamber, ...R.ante]],
  ['the Crystal Palace, archive first', RESCUE_LEVEL, [...R.entry, ...R.gallery, ...R.trap, ...R.archive, ...R.workshop, ...R.chamber, ...R.ante]],
  ['Beyond the gate', BEYOND_LEVEL, LINES.beyond],
];

const isDrop = (st: Step): st is [number, number, number, number] => typeof st[0] === 'number';

/** One step of a line through the real session rules. */
function step(s: SessionState, st: Step): SessionState {
  if (isDrop(st)) return applyDrop(s, p(st[0], st[1]), p(st[2], st[3]));
  if (st[0] === 'stand') return standOnPlate(s, p(st[1], st[2]));
  return s.chest && s.chest.row === st[1] && s.chest.col === st[2] ? openChest(s) : collect(s);
}

/** The same step as a player's action. */
function toAction(st: Step): UiAction {
  if (isDrop(st)) return { type: 'drop', from: p(st[0], st[1]), to: p(st[2], st[3]) };
  return st[0] === 'stand' ? { type: 'placeAlisha', to: p(st[1], st[2]) } : { type: 'tap', pos: p(st[1], st[2]) };
}
/** Every state along `steps` (the whole line, which wins, or with `part`, the start of one). */
function replay(level: LevelDefinition, steps: readonly Step[], part = false): SessionState[] {
  const states = [startSession(level)];
  for (const [i, st] of steps.entries()) {
    const before = states[states.length - 1];
    const next = step(before, st);
    expect(next, `step ${i} ${JSON.stringify(st)}`).not.toBe(before);
    expect(evaluateStatus(next), `step ${i} ${JSON.stringify(st)}`).toBe(i === steps.length - 1 && !part ? 'won' : 'playing');
    states.push(next);
  }
  return states;
}

/**
 * The UI's state after a line, reading every scene and talk due on the way (as a player taps through them). `each`: called
 * with the state before each step, once its scenes and talk are read, and with the last.
 */
function through(level: LevelDefinition, steps: readonly Step[], each?: (ui: UiState) => void): UiState {
  let ui = initUi(level);
  const settle = (u: UiState) => {
    for (let n = 0; n < 50 && (storyDue(u) !== null || bubbleOpen(u)); n++) {
      u = reduceUi(u, storyDue(u) !== null ? { type: 'finishStory' } : { type: 'dismissBubble' });
    }
    return u;
  };
  for (const st of steps) {
    ui = settle(ui);
    each?.(ui);
    const action = toAction(st);
    const next = reduceUi(ui, action);
    expect(next, JSON.stringify(st)).not.toBe(ui);
    ui = next;
  }
  each?.(ui);
  return ui;
}

// An exact check of one room, by search over counts (any merge assumed arrangeable, as strandedRoom assumes): whether
// its remaining tasks can all be done, its concealed parts' items joining once the task revealing them is done, and a
// workshop's chest crafted and opened along the way. strandedRoom is a quicker count rule; the two must agree.
function roomSolvable(s: SessionState, room: number): boolean {
  const { level } = s;
  const regions = level.regions!;
  const tasks = level.tasks!;
  const inRoom = (i: number) => roomOf(regions, i) === room;
  const fams: Family[] = ['grove', 'song', 'crystal', 'elk', 'wood', 'tool', 'planks', 'hardware'];
  const zero = () => Object.fromEntries(fams.map((f) => [f, Array(MAX_TIER + 1).fill(0)])) as Record<Family, number[]>;
  const add = (c: Record<Family, number[]>, item: Item, n = 1) => { c[item.family][item.tier] += n; };
  const base = zero();
  const pockets: { by: readonly number[]; items: Item[] }[] = [];
  regions.forEach((r, i) => {
    if (!inRoom(i)) return;
    const cells: Pos[] = [];
    for (let row = r.row; row < r.row + r.rows; row++) for (let col = r.col; col < r.col + r.cols; col++) cells.push(p(row, col));
    if (r.link) cells.push(r.link);
    const items = cells.flatMap((q) => { const c = s.board[q.row][q.col]; return c && !isFixed(s, q) ? [c] : []; });
    if (r.hidden && r.joins !== undefined && !isOpen(s, i)) pockets.push({ by: (r.unlock as TaskUnlock).tasks, items });
    else for (const item of items) add(base, item);
  });
  const pending = tasks.flatMap((t, i) => (!s.done.includes(i) && !t.alisha && inRoom(t.in) ? [i] : []));
  const recipe = level.recipe && level.workshop !== undefined && inRoom(level.workshop) && !s.opened ? level.recipe : null;
  const memo = new Map<string, boolean>();
  const solve = (c: Record<Family, number[]>, left: readonly number[], stage: number): boolean => {
    if (left.length === 0) return true;
    const key = JSON.stringify([c, left, stage]);
    if (memo.has(key)) return memo.get(key)!;
    memo.set(key, false);
    let ok = false;
    for (const t of left) {
      const next = structuredClone(c);
      for (const pl of tasks[t].plates) add(next, pl.item, -1);
      if (fams.some((f) => next[f].some((n) => n < 0))) continue;
      const done = [...pending.filter((x) => !left.includes(x)), t];
      for (const pocket of pockets) if (pocket.by.includes(t) && pocket.by.every((b) => done.includes(b) || s.done.includes(b))) for (const item of pocket.items) add(next, item);
      if (solve(next, left.filter((x) => x !== t), stage)) { ok = true; break; }
    }
    if (!ok && recipe && stage === 0 && recipe.ingredients.every(({ item }) => c[item.family][item.tier] > 0)) {
      const next = structuredClone(c);
      for (const { item } of recipe.ingredients) add(next, item, -1);
      ok = solve(next, left, 1);
    }
    if (!ok && recipe && stage === 1) {
      const next = structuredClone(c);
      add(next, recipe.contents.item, recipe.contents.count);
      ok = solve(next, left, 2);
    }
    for (const f of fams) for (let t = 0; t < MAX_TIER && !ok; t++) {
      for (const k of [3, 5]) {
        if (ok || c[f][t] < k) continue;
        const next = structuredClone(c);
        next[f][t] -= k;
        next[f][t + 1] += k === 3 ? 1 : 2;
        ok = solve(next, left, stage);
      }
    }
    memo.set(key, ok);
    return ok;
  };
  return solve(base, pending, s.chest ? 1 : 0);
}

describe('Chapter 1 levels: definitions', () => {
  it('lists the five levels in story order, each valid, the rooms strandable, outside the original nine', () => {
    expect(CHAPTER_ONE.map((c) => c.name)).toEqual(['Meet Fiona', 'Woodland cleanup', 'The palace entrance', 'The Crystal Palace', 'Beyond the gate']);
    expect(CHAPTER_ONE.map((c) => c.definition)).toEqual([MEET_FIONA_LEVEL, CLEANUP_LEVEL, ENTRANCE_LEVEL, RESCUE_LEVEL, BEYOND_LEVEL]);
    for (const c of CHAPTER_ONE) {
      expect(() => startSession(c.definition), c.name).not.toThrow();
      expect(LEVELS.some((l) => l.definition === c.definition)).toBe(false);
      if (c.definition.regions) expect([c.definition.strandable, strandedRoom(startSession(c.definition))], c.name).toEqual([true, -1]);
    }
    expect(LEVELS.map((l) => l.name)).toEqual(['Sprouting Grove', 'Songbird Chorus', 'Lone Elk', 'Crystal Fives', 'The Faraway Grove',
      'The Hidden Hollow', 'The Rune Gates', 'The Hidden Cache', 'The Crystal Palace']);
    expect(LEVELS.some((l) => l.definition.strandable || l.definition.party)).toBe(false);
  });

  it('keeps every character spot and the dog on scenery, and refuses a trap without its release', () => {
    for (const c of CHAPTER_ONE.filter((x) => x.definition.party)) {
      const { party, regions } = c.definition;
      const spots = [party!.start, party!.waiting, party!.trap?.free].flatMap((q) => (q ? [q.alisha, q.fiona] : []));
      for (const q of [...spots, ...(party!.dog ?? []).map((d) => d.at), ...(party!.trap ? [party!.trap.fiona] : [])]) {
        expect(regionAt(regions!, q), `${c.name} ${JSON.stringify(q)}`).toBe(-1);
        expect(c.definition.board[q.row][q.col]).toBeNull();
      }
    }
    const party = RESCUE_LEVEL.party!;
    expect(() => startSession({ ...RESCUE_LEVEL, party: { ...party, trap: { ...party.trap!, release: TRAP_TASK } } })).toThrow(/Unsupported party level/);
    expect(() => startSession({ ...RESCUE_LEVEL, party: { ...party, trap: undefined } })).toThrow(/Unsupported party level/);
    expect(() => startSession({ ...RESCUE_LEVEL, workshop: undefined, recipe: undefined, party })).not.toThrow();
    expect(() => startSession({ ...RESCUE_LEVEL, workshop: 99 })).toThrow(/Unsupported workshop level/);
  });
});

describe('Chapter 1 levels: winning lines through the real rules', () => {
  for (const [name, level, line] of WINS) {
    it(`wins ${name}`, () => {
      const states = replay(level, line);
      const won = states[states.length - 1];
      if (level.tasks) expect([...won.done].sort((a, b) => a - b)).toEqual(level.tasks.map((_, i) => i));
      // The same line through the UI, reading each scene and talk on the way, also wins; the goal panel, board and banner
      // render at every step (Beyond the gate, with no sealed region, once crashed the goal panel).
      const { guide } = CHAPTER_ONE.find((c) => c.definition === level)!;
      const screen = (ui: UiState) => {
        renderToStaticMarkup(<><TaskPanel session={ui.session} /><Board state={ui} dispatch={() => {}} /></>);
        guide(ui);
      };
      expect(through(level, line, level.tasks ? screen : undefined).status).toBe('won');
    });
  }

  it('draws each level\'s own goal in its goal panel, never the room levels\' backpack', () => {
    for (const { name, definition } of CHAPTER_ONE) {
      const game = renderToStaticMarkup(<Game definition={definition} label={name} musicControl={null} onHome={() => {}} />);
      expect(game, name).not.toContain('data-backpack');
    }
  });

  it('opens the north trail in Woodland cleanup only once both cleanups are done, the depot revealed by the fallen wood', () => {
    const states = replay(CLEANUP_LEVEL, [...C.south, ...C.reveal, ...C.logs, ...C.tools, ...C.finish]);
    const at = (n: number) => states[n];
    expect(isOpen(at(C.south.length + 1), CLEANUP_DEPOT)).toBe(false);
    expect(isOpen(at(C.south.length + C.reveal.length), CLEANUP_DEPOT)).toBe(true);
    const logsDone = at(C.south.length + C.reveal.length + C.logs.length);
    expect([logsDone.done.includes(LOGS_TASK), isOpen(logsDone, CLEANUP_NORTH)]).toEqual([true, false]);
    const both = at(states.length - 2);
    expect([both.done.includes(TOOLS_TASK), isOpen(both, CLEANUP_NORTH)]).toEqual([true, true]);
  });
});

describe('Chapter 1 levels: choices that strand a room are reported at once, and Undo takes them back', () => {
  const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const read = (u: UiState) => {
    for (let n = 0; n < 50 && (storyDue(u) !== null || bubbleOpen(u)); n++) u = reduceUi(u, storyDue(u) !== null ? { type: 'finishStory' } : { type: 'dismissBubble' });
    return u;
  };
  const rooms = (level: LevelDefinition) => [...new Set(level.regions!.map((_, i) => roomOf(level.regions!, i)))];

  // From every point of each winning line, short random walks of real drops (any loose item to any cell of its room).
  // Every state agrees with the exact search; a stranded one is 'lost' with Undo available, and Undo makes it playable.
  for (const [name, level, line] of WINS.filter(([, l]) => l.regions)) {
    it(`agrees with an exact search and never strands a checkpoint in ${name}`, () => {
      const random = rng(name.length * 7919);
      let ui = initUi(level);
      let lost = 0;
      for (const st of line) {
        ui = read(ui);
        for (let walk = 0; walk < 2; walk++) {
          let u = ui;
          for (let n = 0; n < 12; n++) {
            u = read(u);
            if (u.status !== 'playing') break;
            const s = u.session;
            const loose = s.board.flatMap((r, row) => r.flatMap((c, col) => (c && canPickUp(u, p(row, col)) ? [p(row, col)] : [])));
            if (loose.length === 0) break;
            const from = loose[Math.floor(random() * loose.length)];
            const room = roomOf(level.regions!, regionAt(level.regions!, from));
            const cells = s.board.flatMap((r, row) => r.flatMap((_, col) => {
              const i = regionAt(level.regions!, p(row, col));
              return i !== -1 && roomOf(level.regions!, i) === room && isCellOpen(s, p(row, col)) ? [p(row, col)] : [];
            }));
            u = reduceUi(u, { type: 'drop', from, to: cells[Math.floor(random() * cells.length)] });
            const stranded = strandedRoom(u.session);
            const exact = rooms(level).find((r) => !roomSolvable(u.session, r)) ?? -1;
            expect(stranded === -1, `${name}: ${JSON.stringify(u.session.board)}`).toBe(exact === -1);
            expect(u.status).toBe(stranded === -1 ? (u.status === 'won' ? 'won' : 'playing') : 'lost');
            if (u.status === 'lost') {
              lost++;
              expect(canUndo(u), `${name}: a checkpoint stranded a room`).toBe(true);
              const back = reduceUi(u, { type: 'undo' });
              expect(back.status).toBe('playing');
              expect(strandedRoom(back.session)).toBe(-1);
              u = back;
            }
          }
        }
        const action = toAction(st);
        ui = reduceUi(ui, action);
      }
      expect(ui.status).toBe('won');
      // The walks do make real mistakes, not just harmless moves.
      expect(lost, name).toBeGreaterThan(0);
    });
  }

  it('reports the strand in words naming the room', () => {
    // The Forked path's five Song tier 1 merged three at a time leave too few for its Song tier 3.
    let s = replay(ENTRANCE_LEVEL, LINES.entrance.slice(0, 2), true).slice(-1)[0];
    s = applyDrop(s, p(13, 7), p(14, 7));                     // a plain move, then a three-merge onto the trio
    s = applyDrop(s, p(14, 7), p(13, 4));
    expect([evaluateStatus(s), strandedRoom(s), s.undo !== null]).toEqual(['lost', 1, true]);
    const ui = { ...initUi(ENTRANCE_LEVEL), session: s, status: evaluateStatus(s) };
    expect(statusMessage(ui)).toBe('Forked path can no longer be finished: too few pieces are left for its marked tiles. Undo, or Retry.');
  });
});

describe('Meet Fiona: the five-merge lesson', () => {
  const ui0 = initUi(MEET_FIONA_LEVEL);
  const drop = (u: UiState, a: [number, number, number, number]) => reduceUi(u, { type: 'drop', from: p(a[0], a[1]), to: p(a[2], a[3]) });

  it('teaches the three-merge, then five make two, step by step, with no supply', () => {
    expect(meetFionaGuide(ui0)).toBe('Drop a Grove, tier 1 of 5 onto two that touch: three make one Grove, tier 2 of 5.');
    const three = drop(ui0, [0, 3, 0, 1]);
    expect(meetFionaGuide(three)).toBe('Now try five: gather four Grove, tier 1 of 5 together, then drop the fifth onto them. Five make two!');
    const five = drop(three, [3, 3, 3, 1]);
    expect(five.lastAction).toMatchObject({ kind: 'merge', consumed: 5 });
    expect(meetFionaGuide(five)).toBe('Now merge the three Grove, tier 2 of 5 into Grove, tier 3 of 5.');
    const fiveFirst = drop(ui0, [3, 3, 3, 1]);
    expect(meetFionaGuide(fiveFirst)).toBe('Five made two! Merge the last three Grove, tier 1 of 5 for one more.');
    const html = renderToStaticMarkup(<Game definition={MEET_FIONA_LEVEL} label="Meet Fiona" musicControl={null} onHome={() => {}} guide={meetFionaGuide} />);
    expect(html).not.toMatch(/data-action="supply"|Next supply|supply-hint/);
    expect(html).toContain('Goal: make Grove, tier 3 of 5');
  });

  it('reports a second three-merge at once, explains it, and Undo takes it back', () => {
    const three = drop(ui0, [0, 3, 0, 1]);
    const wrong = drop(three, [2, 0, 2, 1]);                    // inside the block: three, not five
    expect(wrong.lastAction).toMatchObject({ kind: 'merge', consumed: 3 });
    expect([wrong.status, canUndo(wrong)]).toEqual(['lost', true]);
    expect(meetFionaGuide(wrong)).toBe('Three made just one, so too few are left. Undo, then gather four Grove, tier 1 of 5 together and drop the fifth '
      + 'onto them: five make two!');
    const back = reduceUi(wrong, { type: 'undo' });
    expect([back.status, back.session.board]).toEqual(['playing', three.session.board]);
  });
});

describe('The Crystal Palace: on-board talk, the trap and the rescue', () => {
  const lines = (talk: typeof RESCUE_TALK[number]) => talk.lines.map((l) => ({ speaker: l.who === 'alisha' ? 'Alisha' : 'Fiona', text: l.text }));
  const dismiss = (u: UiState, n: number) => Array.from({ length: n }).reduce<UiState>((x) => reduceUi(x, { type: 'dismissBubble' }), u);
  const party = { ...RESCUE_LEVEL.party!, waiting: RESCUE_LEVEL.party!.waiting! };
  const plate = p(14, 9);
  /** Up to the gallery's reveal, the visitor route heard. */
  const revealed = () => through(RESCUE_LEVEL, [...R.entry, ...R.gallery]);

  it('says the storyboard\'s visitor route, C1-10A and C1-10B lines, word for word', () => {
    const block = STORYBOARD.match(/<div class="bubble"><strong>Visitor route · on-board dialogue<\/strong>([\s\S]*?)<small>/)![1];
    const visitor = [...block.matchAll(/<p>(Alisha|Fiona): “([^”]*)”<\/p>/g)].map(([, speaker, text]) => ({ speaker, text }));
    expect(lines(RESCUE_TALK[0])).toEqual(visitor);
    for (const [talk, code] of [[RESCUE_TALK[1], 'C1-10A'], [RESCUE_TALK[2], 'C1-10B']] as const) {
      const fig = STORYBOARD.match(new RegExp(`<figure class="shot" id="${code}">([\\s\\S]*?)</figure>`))![1];
      expect(lines(talk)).toEqual([...fig.matchAll(/<p><strong>(Alisha|Fiona):<\/strong> “([^”]*)”<\/p>/g)].map(([, speaker, text]) => ({ speaker, text })));
    }
    const reunion = STORYBOARD.match(/<figure class="shot" id="C1-11">([\s\S]*?)<\/figure>/)![1];
    const onBoard = [...reunion.matchAll(/<p class="note on-board">(Alisha|Fiona): “([^”]*)”<\/p>/g)].map(([, speaker, text]) => ({ speaker, text }));
    expect(onBoard).toEqual([{ speaker: 'Fiona', text: 'I think I found the door release. Is it opening?' }]);
    expect(lines(RESCUE_TALK[3])).toEqual(onBoard);
    expect(RESCUE_TALK.map((t) => [t.id, t.after])).toEqual([
      ['visitor-route', undefined], ['C1-10A', REVEAL_PLATE_ROOM_TASK], ['C1-10B', TRAP_TASK], ['release', RELEASE_TASK]]);
  });

  it('opens with the visitor route, one line at a time beside its speaker, pausing the board; Retry doesn\'t repeat it', () => {
    let ui = initUi(RESCUE_LEVEL);
    expect([bubbleOpen(ui), talkShown(ui)]).toEqual([true, { who: 'alisha', text: 'Which way?' }]);
    expect(reduceUi(ui, { type: 'drop', from: p(15, 4), to: p(15, 3) })).toBe(ui);
    expect(canPickUp(ui, p(15, 4))).toBe(false);
    ui = reduceUi(ui, { type: 'dismissBubble' });
    expect(talkShown(ui)).toEqual({ who: 'fiona', text: 'Through the gallery. The room we want is beyond it.' });
    const html = renderToStaticMarkup(<Board state={ui} dispatch={() => {}} scene="palace" />);
    expect(html).toContain(`class="bubble-anchor is-fiona" style="grid-row:${party.start.fiona.row + 1} / span 1;grid-column:${party.start.fiona.col + 1} / span 1"`);
    expect(html).toMatch(/data-speaker="fiona"><span class="sr-only">Fiona says: <\/span><span class="bubble-text">Through the gallery\./);
    ui = dismiss(ui, 5);
    expect([bubbleOpen(ui), ui.talkHeard]).toEqual([false, ['visitor-route']]);
    const moved = reduceUi(ui, { type: 'drop', from: p(15, 4), to: p(15, 3) });
    expect(moved).not.toBe(ui);
    expect(bubbleOpen(reduceUi(moved, { type: 'retry' }))).toBe(false);
  });

  it('reveals the plate room from the gallery, says C1-10A, then lets Alisha onto the plate, and nowhere else', () => {
    const ui = revealed();
    const before = through(RESCUE_LEVEL, [...R.entry, ...R.gallery.slice(0, -1)]);
    expect(isOpen(before.session, RESCUE_PLATE_ROOM)).toBe(false);
    expect(renderToStaticMarkup(<Board state={before} dispatch={() => {}} scene="palace" />)).not.toMatch(/character-plate|Plate room/);
    expect(isOpen(ui.session, RESCUE_PLATE_ROOM)).toBe(true);
    expect([talkDue(ui)?.id, talkShown(ui)?.who, canMoveAlisha(ui)]).toEqual(['C1-10A', 'fiona', false]);
    expect(partySpots(ui.session)).toEqual(party.waiting);
    const ready = dismiss(ui, 4);
    expect([bubbleOpen(ready), canMoveAlisha(ready), alishaPlate(ready.session)]).toEqual([false, true, plate]);
    for (const to of [p(13, 8), p(10, 6), party.waiting.fiona, p(16, 4)]) {
      const s = reduceUi(ready, { type: 'placeAlisha', to });
      expect([s.session, s.actionSeq]).toEqual([ready.session, ready.actionSeq]);
    }
    // No item can reach her plate, and its room holds none.
    expect(applyDrop(ready.session, p(10, 6), plate)).toBe(ready.session);
  });

  it('traps her: the rooms across the gallery open, the partition closes, Undo is cleared and she can\'t be moved; C1-10B follows', () => {
    const ready = dismiss(revealed(), 4);
    const shut = reduceUi(ready, { type: 'placeAlisha', to: plate });
    const s = shut.session;
    expect([s.done.includes(TRAP_TASK), trapped(s), s.undo, shut.status]).toEqual([true, true, null, 'playing']);
    expect([RESCUE_WORKSHOP, RESCUE_ARCHIVE].map((i) => isOpen(s, i))).toEqual([true, true]);
    expect(isOpen(s, RESCUE_CHAMBER)).toBe(false);
    expect(partySpots(s)).toEqual({ alisha: plate, fiona: party.trap!.fiona });
    expect([alishaPlate(s), canMoveAlisha(shut)]).toEqual([null, false]);
    expect(shut.lastAction).toEqual({ kind: 'stand', progress: { tasks: [TRAP_TASK], regions: [RESCUE_WORKSHOP, RESCUE_ARCHIVE] } });
    expect(describeAction(shut.lastAction, 'Level', RESCUE_LEVEL.goal, RESCUE_LEVEL.regions, RESCUE_LEVEL.tasks)).toBe(
      'Alisha stood on the plate. The rune gates to West workshop and East archive opened. A crystal partition closed behind her.');
    expect(viewCue(shut)).toEqual({ kind: 'entrance', plate, door: null });
    expect([talkDue(shut)?.id, talkShown(shut)]).toEqual(['C1-10B', { who: 'alisha', text: 'Whoa! What happened?' }]);
    const html = renderToStaticMarkup(<Board state={dismiss(shut, 5)} dispatch={() => {}} scene="palace" />);
    expect(html).toContain('aria-label="A crystal partition, closed, with Alisha behind it"');
    expect(html).toContain('Plate room: Alisha&#x27;s pressure plate: Alisha is standing on it, behind a crystal partition"');
    expect(reduceUi(dismiss(shut, 5), { type: 'undo' }).session).toBe(s);
  });

  it('builds the Bird chest from Planks and Chest hardware, only in the workshop, its birds staying there, off the marked tile', () => {
    // The bird room's recipe: chest-building materials, each exactly tier 3 of 5, for three Song 3 that make its Song 4.
    expect(RESCUE_LEVEL.recipe).toEqual({
      id: 'bird', name: 'Bird chest', container: 'chest',
      ingredients: [{ item: { family: 'planks', tier: 2 }, count: 1 }, { item: { family: 'hardware', tier: 2 }, count: 1 }],
      contents: { item: { family: 'song', tier: 2 }, count: 3 },
    });
    expect(RESCUE_LEVEL.tasks![WORKSHOP_TASK].plates).toEqual([{ row: 4, col: 0, item: { family: 'song', tier: 3 } }]);
    // The workshop starts with five Planks 1 and one Planks 2 (one five-merge makes the Planks 3), and three Chest
    // hardware 1 and two Chest hardware 2; no crystal or elk there any more.
    const workshop = RESCUE_LEVEL.regions![RESCUE_WORKSHOP];
    const pieces = RESCUE_LEVEL.board.slice(workshop.row, workshop.row + workshop.rows)
      .flatMap((r) => r.slice(workshop.col, workshop.col + workshop.cols)).filter(Boolean).map((c) => `${c!.family}${c!.tier}`).sort();
    expect(pieces).toEqual(['hardware0', 'hardware0', 'hardware0', 'hardware1', 'hardware1', 'planks0', 'planks0', 'planks0', 'planks0', 'planks0', 'planks1']);
    const states = replay(RESCUE_LEVEL, [...R.entry, ...R.gallery, ...R.trap, ...R.workshop.slice(0, 7)], true);
    const crafted = states[states.length - 1];
    expect(crafted.chest).toEqual(p(6, 2));
    const cells = contentCells(crafted)!;
    expect(cells).toHaveLength(3);
    for (const q of cells) expect(regionAt(RESCUE_LEVEL.regions!, q)).toBe(RESCUE_WORKSHOP);
    expect(cells.some((q) => q.row === 4 && q.col === 0)).toBe(false);
    // In the East archive, open beside the workshop before any chest is built, the same two only swap.
    const before = replay(RESCUE_LEVEL, [...R.entry, ...R.gallery, ...R.trap], true).slice(-1)[0];
    const archive = before.board.map((r) => [...r]);
    archive[5][11] = { family: 'planks', tier: 2 };
    archive[5][12] = { family: 'hardware', tier: 2 };
    const swapped = applyDrop({ ...before, board: archive }, p(5, 11), p(5, 12));
    expect([swapped.chest, swapped.board[5][11], swapped.board[5][12]]).toEqual(
      [null, { family: 'hardware', tier: 2 }, { family: 'planks', tier: 2 }]);
  });

  it('offers the bird room\'s hint after a while without progress on its recipe, by stage, never while paused or done', () => {
    vi.useFakeTimers();
    const upTo = (n: number) => through(RESCUE_LEVEL, [...R.entry, ...R.gallery, ...R.trap, ...R.workshop.slice(0, n)]);
    const trap = upTo(0);
    // Not before the workshop opens, nor while C1-10B's talk pauses the board.
    expect([workshopHint(revealed()), workshopHint(trap), afterRecipeIdle(trap, () => {})]).toEqual([null, null, undefined]);
    const open = dismiss(trap, 5);
    expect(workshopHint(open)).toBe('Hint: merge Planks and Chest hardware to tier 3. Five make two. Then combine them.');
    // The wait: RECIPE_HINT_MS, then once; cancelled by progress, Retry, a pause or leaving.
    const shown = vi.fn();
    const cancel = afterRecipeIdle(open, shown)!;
    vi.advanceTimersByTime(RECIPE_HINT_MS - 1);
    expect(shown).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(RECIPE_HINT_MS * 2);
    expect(shown).toHaveBeenCalledTimes(1);
    cancel();
    // Progress is the materials merging (and the chest built, then opened); moving a piece is not.
    const moved = reduceUi(open, { type: 'drop', from: p(5, 3), to: p(4, 3) });
    expect([moved.lastAction?.kind, workshopProgress(moved)]).toEqual(['move', workshopProgress(open)]);
    const keys = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => workshopProgress(n === 0 ? open : upTo(n)));
    expect(new Set(keys).size).toBeGreaterThan(4);                                         // merges, the build, the opening
    expect(workshopProgress(upTo(6))).not.toBe(workshopProgress(upTo(7)));               // the build
    // By stage: both materials made, the chest built, then opened (no hint).
    expect(workshopHint(upTo(6))).toBe('Hint: combine Planks and Chest hardware to build the Bird chest.');
    expect(workshopHint(upTo(7))).toBe('Hint: tap the Bird chest to open it.');
    expect([workshopHint(upTo(8)), afterRecipeIdle(upTo(8), () => {})]).toEqual([null, undefined]);
    // Retry: the workshop shut again, no hint, and progress back where it started.
    const retried = reduceUi(upTo(7), { type: 'retry' });
    expect([workshopHint(retried), workshopProgress(retried)]).toEqual([null, workshopProgress(initUi(RESCUE_LEVEL))]);
    // Other levels have no such hint.
    expect([workshopHint(initUi(BEYOND_LEVEL)), workshopProgress(initUi(BEYOND_LEVEL))]).toEqual([null, '']);
  });

  it('frees her when the crystal chamber is done: the partition opens, they meet (C1-11), the antechamber opens, the door wins', () => {
    const states = replay(RESCUE_LEVEL, [...R.entry, ...R.gallery, ...R.trap, ...R.workshop, ...R.archive, ...R.chamber], true);
    const freed = states[states.length - 1];
    expect([trapped(freed), isOpen(freed, RESCUE_ANTE), partySpots(freed)]).toEqual([false, true, party.trap!.free]);
    const ui = through(RESCUE_LEVEL, [...R.entry, ...R.gallery, ...R.trap, ...R.workshop, ...R.archive, ...R.chamber]);
    const board = (u: UiState, sceneShowing = false) => renderToStaticMarkup(<Board state={u} dispatch={() => {}} scene="palace" sceneShowing={sceneShowing} />);
    const guide = CHAPTER_ONE[3].guide;
    const fogged = (u: UiState, sceneShowing = false) => board(u, sceneShowing).includes(`<div class="region is-fog" data-fog="${RESCUE_ANTE}" aria-hidden="true"`);
    // The antechamber's cells as drawn: [all of them, those shown locked].
    const ante = (u: UiState, sceneShowing = false) => [/Message antechamber/, /Message antechamber, locked/]
      .map((re) => (board(u, sceneShowing).match(/aria-label="Row \d+, column \d+, [^"]*"/g) ?? []).filter((l) => re.test(l)).length);
    const lockedBefore = ante(through(RESCUE_LEVEL, [...R.entry, ...R.gallery, ...R.trap, ...R.workshop, ...R.archive, ...R.chamber.slice(0, -1)]));
    expect(lockedBefore).toEqual([12, 12]);
    // 1. The releasing move: Fiona asks whether it is opening while the board still shows Alisha shut in on her plate. The
    // antechamber it opened looks as it did before the move (locked, its gate labelled shut); the move is announced
    // without either, with the discovery cue. C1-11 is still to come, after her question.
    expect([storyDue(ui), storyPending(ui), talkShown(ui), actionEffect(ui)]).toEqual(
      [null, 'C1-11', { who: 'fiona', text: 'I think I found the door release. Is it opening?' }, 'discovery']);
    expect(board(ui)).toContain('data-partition="shut" role="img" aria-label="A crystal partition, closed, with Alisha behind it"');
    expect(board(ui)).toContain('Plate room: Alisha&#x27;s pressure plate: Alisha is standing on it, behind a crystal partition"');
    expect(board(ui)).not.toContain('data-spot="alisha"');
    expect([fogged(ui), ante(ui), board(ui).includes('aria-label="Rune gate to Message antechamber, closed"')]).toEqual([false, lockedBefore, true]);
    expect([guide(ui), announcement(ui, 'Level')]).toEqual([
      'Fiona has something to say. Tap her speech bubble to continue.', 'Merged 3 into 1 item: Song, tier 3 of 5.']);
    // 2. Her question heard: the partition opens and Alisha steps out beside Fiona, said as the board shows it; then, after
    // the pause, C1-11 ("I’m free!"). Through the pause the antechamber still looks as before; once C1-11 is showing over
    // the board it is under fog, nothing in it.
    const out = reduceUi(ui, { type: 'dismissBubble' });
    expect([storyDue(out), bubbleOpen(out), canPickUp(out, p(1, 5))]).toEqual(['C1-11', false, false]);
    expect(board(out)).toContain('data-partition="opening" role="img" aria-label="A crystal partition, open: Alisha has stepped out"');
    expect(board(out)).toContain('data-spot="alisha"><span class="character is-alisha is-stepping"');
    expect(board(out)).toContain('Plate room: Alisha&#x27;s pressure plate, pressed down"');
    expect([fogged(out), ante(out), fogged(out, true), ante(out, true)]).toEqual([false, lockedBefore, true, [0, 0]]);
    expect([guide(out), announcement(out, 'Level')]).toEqual(['The crystal partition opened: Alisha is free.', 'The crystal partition opened: Alisha is free.']);
    // 3. C1-11 read: the partition gone, the pair beside the antechamber, whose fog lifts, announced then.
    const read = reduceUi(out, { type: 'finishStory' });
    const html = board(read);
    expect(html).not.toContain('data-partition');
    expect(html).not.toContain('is-stepping');
    expect(html).toContain('Plate room: Alisha&#x27;s pressure plate, pressed down"');
    expect(html).toContain(`<div class="region is-fog is-lifting" data-fog-lifting="${RESCUE_ANTE}" aria-hidden="true"`);
    expect(html).toContain('aria-label="Rune gate to Message antechamber, open"');
    expect([guide(read), announcement(read, 'Level')]).toEqual([
      'Message antechamber is open: put Song, tier 2 of 5 and Crystal, tier 2 of 5 on its marked tiles.', 'The rune gate to Message antechamber opened.']);
    const game = renderToStaticMarkup(<Game definition={RESCUE_LEVEL} label="x" musicControl={null} onHome={() => {}} />);
    expect(game).toContain('Goal: reach the message room');
    expect(RESCUE_LEVEL.goal).toEqual({ kind: 'treasure', at: p(0, 6), prize: 'door', task: ANTE_TASK });
    expect(RESCUE_LEVEL.party!.story).toEqual([{ id: 'C1-11', task: RELEASE_TASK, talk: 'release' }]);
    expect([WORKSHOP_TASK, ARCHIVE_TASK].every((t) => RESCUE_LEVEL.tasks![t].symbol)).toBe(true);
  });

  it('shows the message room door to tap once the antechamber is done', () => {
    const board = (steps: Step[]) => renderToStaticMarkup(<Board state={through(RESCUE_LEVEL, steps)} dispatch={() => {}} scene="palace" />);
    const all = [...R.entry, ...R.gallery, ...R.trap, ...R.workshop, ...R.archive, ...R.chamber, ...R.ante];
    const ready = board(all.slice(0, -1));
    expect(ready).toContain('Message antechamber: message room door, closed, tap to open"');
    expect(ready).toContain('data-door="closed"');
    expect(board(all)).toContain('Message antechamber: message room door, open"');
  });

  it('restores everything on Retry, from inside the trap', () => {
    const shut = dismiss(reduceUi(dismiss(revealed(), 4), { type: 'placeAlisha', to: plate }), 5);
    const again = reduceUi(shut, { type: 'retry' });
    expect([again.session, trapped(again.session), again.talkHeard, again.storySeen]).toEqual([startSession(RESCUE_LEVEL), false, ['visitor-route'], []]);
    expect(partySpots(again.session)).toEqual(party.start);
  });
});

describe('Woodland cleanup and Beyond the gate: scenes, the dog and Alisha\'s spot', () => {
  it('never names the depot before it is found: checklist, banner and Help', () => {
    const guide = CHAPTER_ONE[1].guide;
    const html = (ui: UiState) => renderToStaticMarkup(<><TaskPanel session={ui.session} /><Board state={ui} dispatch={() => {}} scene="entrance" /></>);
    const open = through(CLEANUP_LEVEL, C.south);
    expect(html(open)).not.toContain('Hidden depot');
    expect(html(open)).toContain('<span class="check-name">Not found yet</span>');
    expect(guide(open)).toBe('Put Gathered bundle, tier 2 of 5 on the pressure plate in Fallen wood to clear the fallen branches.');
    const game = renderToStaticMarkup(<Game definition={CLEANUP_LEVEL} label="x" musicControl={null} onHome={() => {}} guide={guide} />);
    expect(game).not.toContain('Hidden depot');
    expect(game).toContain('Goal: clear the way to the trail north');
    const found = reduceUi(through(CLEANUP_LEVEL, [...C.south, ...C.reveal]), { type: 'finishStory' });
    expect(guide(found)).toBe('Complete the two branches in either order to open North trail exit.');
    expect(html(found)).toContain('<span class="check-name">Hidden depot</span>');
    const clear = through(CLEANUP_LEVEL, [...C.south, ...C.reveal, ...C.logs, ...C.tools]);
    expect(html(clear)).toContain('North trail exit: trail signpost, tap to follow the trail"');
    expect(html(clear)).toContain('data-trail="waiting"');
    expect(guide(clear)).toBe('The trail signpost is in North trail exit. Tap it to follow it.');
    expect(html(through(CLEANUP_LEVEL, WINS[1][2]))).toContain('data-trail="followed"');
  });

  it('shows C1-06B on the move that reveals the depot, which looks as before through the pause and is under fog while it shows', () => {
    const before = through(CLEANUP_LEVEL, [...C.south, ...C.reveal.slice(0, -1)]);
    expect(storyDue(before)).toBeNull();
    const ui = reduceUi(before, { type: 'drop', from: p(6, 5), to: p(4, 5) });
    expect([storyDue(ui), ui.session.done.includes(REVEAL_DEPOT_TASK), isOpen(ui.session, CLEANUP_DEPOT)]).toEqual(['C1-06B', true, true]);
    // While the scene is due: the move's result shows (its bundle fixed on the tile); the depot is unnamed in the checklist,
    // board and announcement, its gate concealed, nothing glowing; the move's cue is the short discovery cue heralding the
    // scene. During the pause before it, the depot looks as it did before the move: plain forest, no fog.
    const html = (u: UiState, sceneShowing = false) => renderToStaticMarkup(
      <><TaskPanel session={u.session} held={storyHeld(u)} /><Board state={u} dispatch={() => {}} scene="entrance" sceneShowing={sceneShowing} /></>);
    const forest = (h: string) => h.match(/class="terrain"/g)?.length;
    expect(storyHeld(ui)).toEqual([CLEANUP_DEPOT]);
    expect(html(ui)).toContain('Fallen wood, pressure plate for Gathered bundle, tier 2 of 5, fixed');
    expect(forest(html(ui))).toBe(forest(html(before)));
    expect([html(ui).includes('data-fog='), html(ui).includes('class="fogged"')]).toEqual([false, false]);
    expect(html(ui)).not.toContain('Hidden depot');
    // Once the scene is showing over the board, the depot is under fog (its shape, with nothing in it), still unnamed, so
    // that the fog lifts off it once the scene has been read.
    expect(html(ui, true)).toContain(`<div class="region is-fog" data-fog="${CLEANUP_DEPOT}" aria-hidden="true"`);
    expect(html(ui, true).match(/class="fogged"/g)).toHaveLength(16);
    expect(html(ui, true)).not.toContain('Hidden depot');
    expect(html(ui)).toContain('<span class="check-name">Not found yet</span>');
    expect(html(ui)).not.toContain('data-fx="unlock"');
    expect(announcement(ui, 'Level')).toBe('Moved an item.');
    expect(actionEffect(ui)).toBe('discovery');
    // Read: the fog lifts off the depot, which appears, named, glowing open, its gate open, and is announced then.
    const read = reduceUi(ui, { type: 'finishStory' });
    expect(storyHeld(read)).toEqual([]);
    expect(html(read)).not.toContain('data-fog=');
    expect(html(read)).toContain(`<div class="region is-fog is-lifting" data-fog-lifting="${CLEANUP_DEPOT}" aria-hidden="true"`);
    expect(html(read)).toContain('<span class="check-name">Hidden depot</span>');
    expect(html(read)).toContain('Row 4, column 1, Hidden depot');
    expect(html(read)).toContain('aria-label="Rune gate to Hidden depot, open"');
    expect(html(read)).toMatch(/data-region="2"[^>]*><span data-fx="unlock"/);
    expect(announcement(read, 'Level')).toBe('The rune gate to Hidden depot opened.');
    // The next move: the fog is gone for good, and the move is announced as usual.
    const next = reduceUi(read, { type: 'drop', from: p(6, 8), to: p(4, 8) });
    expect([html(next).includes('data-fog-lifting'), announcement(next, 'Level')]).toEqual([false, 'Moved an item.']);
  });

  it('shows the dog ahead, then in the grove, where Alisha catching up wins', () => {
    const dogs = (ui: UiState) => renderToStaticMarkup(<Board state={ui} dispatch={() => {}} scene="palace" />).match(/data-spot="dog"/g)?.length ?? 0;
    const start = initUi(BEYOND_LEVEL);
    expect([dogSpot(start.session), dogs(start)]).toEqual([p(9, 6), 1]);
    const garden = through(BEYOND_LEVEL, LINES.beyond.slice(0, 8));
    expect([dogSpot(garden.session), dogs(garden)]).toEqual([p(5, 7), 1]);
    const grove = through(BEYOND_LEVEL, LINES.beyond.slice(0, -1));
    expect([isOpen(grove.session, BEYOND_GROVE), canMoveAlisha(grove), alishaPlate(grove.session)]).toEqual([true, true, p(0, 5)]);
    expect([dogSpot(grove.session), dogs(grove)]).toEqual([p(0, 6), 1]);
    expect(grove.session.done).toContain(GARDEN_TASK);
    const won = reduceUi(grove, { type: 'placeAlisha', to: p(0, 5) });
    expect([won.status, viewCue(won)]).toEqual(['won', { kind: 'entrance', plate: p(0, 5), door: null }]);
  });

  it('ends like every Chapter 1 level, with Continue: Alisha catching up wins with the victory cue, leading into no scene', () => {
    expect(CHAPTER_ONE.map((c) => c.winLabel)).toEqual(['Continue', 'Continue', 'Continue', 'Continue', 'Continue']);
    const grove = through(BEYOND_LEVEL, LINES.beyond.slice(0, -1));
    const won = reduceUi(grove, { type: 'placeAlisha', to: p(0, 5) });
    expect([won.status, storyDue(won), storyPending(won), actionEffect(won)]).toEqual(['won', null, null, 'case-victory']);
  });
});

describe('Chapter 1 story scenes: the storyboard\'s pictures and words', () => {
  const figure = (code: string) => {
    const fig = STORYBOARD.match(new RegExp(`<figure class="shot" id="${code}">([\\s\\S]*?)</figure>`))?.[1] ?? '';
    const title = fig.match(/<\/a><strong>\s*([^<]*)<\/strong>/)?.[1]?.trim();
    // Dialogue paragraphs (not notes): quoted lines, one or more to a paragraph, or one unquoted after a bold name.
    const lines = [...fig.matchAll(/<p( class="narration")?>([\s\S]*?)<\/p>/g)].flatMap(([, narrated, html]) => {
      const text = html.replace(/<[^>]+>/g, '');
      if (narrated) return [{ text }];
      const quoted = [...text.matchAll(/(Alisha|Fiona): “([^”]*)”/g)].map(([, speaker, line]) => ({ speaker, text: line }));
      const plain = /^(Alisha|Fiona): (.*)$/.exec(text);
      return quoted.length > 0 ? quoted : plain ? [{ speaker: plain[1], text: plain[2] }] : [];
    });
    // A figure whose picture is still to be made names it (data-art, the draft's name to come) instead of an image.
    return { title, lines, source: fig.match(/<img src="[^"]*\/([^"/]+)\.png"/)?.[1], needed: fig.match(/<div class="art-needed" data-art="([^"]+)"/)?.[1] };
  };
  const PANELS: [string, readonly ComicPanel[]][] = [
    ['Meet Fiona opening', MEET_FIONA_OPENING], ['Meet Fiona closing', MEET_FIONA_CLOSING], ['cleanup opening', CLEANUP_OPENING],
    ['C1-06B', CLEANUP_STORY['C1-06B'].panels], ['cleanup closing', CLEANUP_CLOSING], ['C1-11', RESCUE_STORY['C1-11'].panels],
    ['Beyond opening', BEYOND_OPENING], ['Beyond closing', BEYOND_CLOSING],
  ];

  it('follows the storyboard\'s scene order, every figure once, C1-10A and C1-10B on the board instead', () => {
    const order = [...STORYBOARD.matchAll(/<figure class="shot" id="(C1-[0-9A-Z]+)">/g)].map((m) => m[1]);
    const chapter = CHAPTER_ONE.flatMap((c) => [...c.opening, ...Object.values(c.story ?? {}).flatMap((s) => s.panels), ...(c.closing ?? [])]);
    expect(chapter.map((pn) => pn.id)).toEqual(order.filter((code) => code !== 'C1-10A' && code !== 'C1-10B'));
    expect(CHAPTER_ONE.map((c) => c.opening)).toEqual([MEET_FIONA_OPENING, CLEANUP_OPENING, APPROACH_PANELS, INSIDE_PANELS, BEYOND_OPENING]);
    expect(CHAPTER_ONE[2].closing).toBe(ENTRY_PANELS);
    expect(CHAPTER_ONE[2].story).toBe(ENTRANCE_STORY);
  });

  it('has a picture for every figure now: none still to be made', () => {
    const needed = [...STORYBOARD.matchAll(/<figure class="shot" id="(C1-[0-9A-Z]+)"><div class="art-needed"/g)].map((m) => m[1]);
    expect(needed).toEqual([]);
  });

  it('reveals C1-12A\'s three moments one per tap, top to bottom, each with Alisha\'s waiting line, before the dog sighting', () => {
    const at = BEYOND_OPENING.findIndex((pn) => pn.id === 'C1-12A');
    const waiting = BEYOND_OPENING[at];
    expect(BEYOND_OPENING[at + 1].id).toBe('C1-13');
    expect(waiting.moments!.map((m) => m.end)).toEqual([229.5 / 720, 467.5 / 720, 1]);   // the picture's panel gutters
    expect(waiting.lines).toEqual(['Fiona shouldn’t be much longer…', 'Any minute now.', 'Okay, maybe more than a minute.']
      .map((text) => ({ speaker: 'Alisha', text })));
    const beats = comicBeats(BEYOND_OPENING).filter((b) => b.panel === at);
    expect(beats).toEqual([0, 1, 2].map((moment) => ({ panel: at, line: moment, moment })));
    // Each tap announces the moment it reveals and its line; the picture is described with every moment revealed so far.
    expect(beatAnnouncement(BEYOND_OPENING, beats[1], true, '')).toBe(
      `Picture 2 of 4, part 2 of 3. ${waiting.moments![1].description} Alisha: Any minute now.`);
    expect(artDescription(waiting, 2)).toBe(`${waiting.description} ${waiting.moments!.map((m) => m.description).join(' ')}`);
    // On the page: the first moment showing, the cover over the other two, and its line as Alisha's.
    const page = renderToStaticMarkup(<Comic title="t" label="l" panels={[waiting]} finish={{ prompt: 'p', name: 'n' }} onFinish={() => {}}
      onHome={() => {}} musicControl={null} />);
    expect(page).toContain(`<span class="comic-cover" data-moment="0" style="top:${(229.5 / 720) * 100}%" aria-hidden="true"></span>`);
    expect(page).toContain(`aria-label="${artDescription(waiting, 0)}"`);
    expect(page).toMatch(/<figcaption[^>]*><p><strong>Alisha(<!-- -->)?:<\/strong> (<!-- -->)?Fiona shouldn’t be much longer…<\/p>/);
    expect(page).not.toMatch(/Narrator/i);
  });

  it('ends with the disc still rolling: from the stumble to the course ahead, every tap a line, none a title, no disc in hand', () => {
    const from = BEYOND_CLOSING.findIndex((pn) => pn.id === 'C1-19A');
    const to = BEYOND_CLOSING.findIndex((pn) => pn.id === 'C1-21');
    const beats = comicBeats(BEYOND_CLOSING).filter((b) => b.panel >= from && b.panel <= to)
      .map((b) => { const l = BEYOND_CLOSING[b.panel].lines[b.line]; return `${BEYOND_CLOSING[b.panel].id} ${l.speaker ?? '-'}: ${l.text}`; });
    expect(beats).toEqual([
      'C1-19A -: Alisha catches her foot on the disc, knocking it loose as she stumbles.',
      'C1-19 Alisha: Please stop rolling before you get us into more trouble!',
      'C1-20 -: Fiona glances back and notices the gate slowly closing behind them.',
      'C1-20 Fiona: Oh no… the gate’s almost closed. We’re stuck on this side now!',
      'C1-21 -: The gate closed behind them, leaving the palace on the other side.',
      'C1-21 -: Ahead, the unfamiliar path stretched through the trees. Somewhere along it, Alisha’s disc was still rolling.',
      'C1-21 Alisha: Well, looks like this is the way to the first basket!',
      'C1-21 Fiona: Let’s find your disc before it finds any more trouble.',
    ]);
  });

  for (const [name, panels] of PANELS) {
    it(`uses each figure's dialogue word for word, or its title, in ${name}`, () => {
      for (const panel of panels) {
        const { title, lines, source, needed } = figure(panel.id);
        const expected = lines.length > 0 ? lines : panel.id === 'C1-13' ? [{ speaker: 'Alisha', text: 'Cookie?' }] : [{ text: title }];
        expect(panel.lines, panel.id).toEqual(expected);
        expect(comicBeats([panel]).length).toBe(Math.max(expected.length, panel.moments?.length ?? 0));
        expect(source ?? needed, panel.id).toBeDefined();
        const name_ = (source ?? needed)!.replace('-draft-', '-');
        if (needed) {
          // A picture still to be made: a labelled placeholder in its place, and no delivery copy yet.
          expect(renderToStaticMarkup(<>{panel.art}</>), panel.id).toContain(`data-missing-art="${name_}"`);
          expect(chapterArt(name_), panel.id).toBeUndefined();
          continue;
        }
        // The delivery copy of the storyboard's own image (src/assets/art/README.md).
        expect(renderToStaticMarkup(<>{panel.art}</>), panel.id).toMatch(new RegExp(`chapter-one-${name_}\\.webp|data-missing-art="${name_}"`));
        expect(chapterArt(name_), `${panel.id}: delivery copy chapter-one-${name_}.webp`).toBeDefined();
      }
    });
  }
});

describe('Levels: Chapter 1 in the development preview, the original nine kept apart', () => {
  const names = CHAPTER_ONE.map((c) => c.name);
  it('offers Story (the prologue first), Puzzles (generated puzzles) and Levels from Home', () => {
    const nav = [...renderToStaticMarkup(<App />).matchAll(/<button type="button" class="btn[^"]*" data-action="([^"]+)">([^<]+)<\/button>/g)]
      .map((m) => [m[1], m[2]]);
    expect(nav).toEqual([['story', 'Story'], ['play', 'Puzzles'], ['play-levels', 'Levels'], ['scores', 'Music / Scores']]);
  });

  it('lists the Attic as prologue, the five levels with their own progress, then Previous levels, folded', () => {
    const page = renderToStaticMarkup(<LevelPicker levels={LEVELS} current={4} onPick={() => {}} onAttic={() => {}} onHome={() => {}}
      musicControl={null} chapter={{ names, next: 1, onPick: () => {} }} />);
    const chapter = page.indexOf('data-chapter');
    expect(page.indexOf('<h2 id="chapter-one-heading" class="level-section-title">Chapter 1</h2>')).toBeGreaterThan(chapter);
    expect(page.indexOf('data-action="attic"')).toBeGreaterThan(chapter);
    expect(page).toMatch(/data-action="attic"[^>]*>(?:(?!<\/button>).)*<span class="sr-only">Prologue: <\/span>The Attic/);
    expect((page.match(/data-action="chapter-level"/g) ?? []).length).toBe(5);
    expect(page).toMatch(/data-chapter-level="2" aria-current="step"[^>]*>(?:(?!<\/button>).)*Woodland cleanup(?:(?!<\/button>).)*Up next/);
    const previous = page.indexOf('<details class="level-section previous-levels" data-previous-levels="true"><summary class="level-section-title">Previous levels</summary>');
    expect(previous).toBeGreaterThan(page.indexOf('data-chapter-level="5"'));
    expect((page.slice(previous).match(/data-action="pick-level"/g) ?? []).length).toBe(9);
    expect(page.slice(previous)).toMatch(/data-level="5" aria-current="step"[^>]*>(?:(?!<\/button>).)*The Faraway Grove/);
    expect(page).not.toContain('<details class="level-section previous-levels" open');
  });

  it('keeps the published layout without Chapter 1: the Attic, then the nine', () => {
    const page = renderToStaticMarkup(<LevelPicker levels={LEVELS} current={0} onPick={() => {}} onAttic={() => {}} onHome={() => {}} musicControl={null} />);
    expect(page).not.toMatch(/Chapter 1|chapter-level|Previous levels|Meet Fiona/);
    expect(page.indexOf('data-action="attic"')).toBeLessThan(page.indexOf('<ol class="level-list">'));
    expect((page.match(/data-action="pick-level"/g) ?? []).length).toBe(9);
  });
});
