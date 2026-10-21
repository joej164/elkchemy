import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Board, Cell, Family, Item, Pos, Tier } from '../src/board';
import { ATTIC_LEVEL, KEEPSAKE_BOX, SHOEBOX } from '../src/attic';
import {
  canDrop, closedContainerAt, containerShown, craftedItem, goalOpenableAt, nextUint32, openContainer, openGoal, previewDrop, releaseCells,
  startSession, undo, type LevelDefinition,
} from '../src/session';
import { RECIPES } from '../src/recipes';
import { evaluateStatus } from '../src/status';
import { initUi, mergeSources, mergeTargets, reduceUi, type UiAction, type UiState } from '../src/ui/controller';
import { atticGuide } from '../src/ui/atticGuide';
import { actionEffect } from '../src/ui/audioEvents';
import { ContainerPanel, CraftSign, describeAction } from '../src/ui/App';
import { Board as BoardView } from '../src/ui/Board';
import { HelpButton } from '../src/ui/HelpButton';
import { Home } from '../src/ui/Home';
import { afterOpening, BOOK_OPENING_MS, BookOpening } from '../src/ui/BookOpening';
import { App } from '../src/ui/App';

const F: Record<string, Family> = { g: 'grove', s: 'song', c: 'crystal', e: 'elk', p: 'photo', b: 'book' };
const p = (row: number, col: number): Pos => ({ row, col });
const make = (rows: string[]): Board => rows.map((r) => r.trim().split(/\s+/).map((c): Cell =>
  (c === '.' ? null : { family: F[c[0]], tier: Number(c[1]) as Tier })));
const code = (c: Cell) => (c ? `${c.family[0]}${c.tier}` : '.');
const rowsOf = (b: Board) => b.map((r) => r.map(code).join(' '));
const it0 = (s: string): Item => ({ family: F[s[0]], tier: Number(s[1]) as Tier });
const drop = (from: Pos, to: Pos): UiAction => ({ type: 'drop', from, to });
const tap = (pos: Pos): UiAction => ({ type: 'tap', pos });
const play = (s: UiState, ...actions: UiAction[]) => actions.reduce(reduceUi, s);
const level = (rows: string[], containers: LevelDefinition['containers'], goal: Item = it0('b1')): LevelDefinition => ({
  seed: 1, board: make(rows), supply: [], goal: { kind: 'item', item: goal }, containers,
});

describe('placed containers: the rules', () => {
  it('releases a batch of one onto its own cell, removing the container', () => {
    const s = startSession(level(['. g0', '. .'], [{ at: p(0, 0), name: 'tin', art: 'shoebox', contents: [it0('p0')] }]));
    const o = openContainer(s, 0);
    expect(rowsOf(o.board)).toEqual(['p0 g0', '. .']);
    expect([o.unpacked, o.moves, closedContainerAt(o, p(0, 0))]).toEqual([[0], 1, -1]);
  });

  it('places a mixed batch in order: its cell, then the nearest empty cells by distance and reading order', () => {
    const s = startSession(level(['. . . .', '. . x0 .', '. . . .'].map((r) => r.replace('x0', 'g0')), [
      { at: p(1, 1), name: 'crate', art: 'shoebox', contents: [it0('p0'), it0('b0'), it0('p1'), it0('b0'), it0('s0')] },
    ]));
    // Distance 1 from (1,1): (0,1), (1,0), [(1,2) holds an item], (2,1); then distance 2 in reading order: (0,0).
    expect(releaseCells(s, 0)).toEqual([p(1, 1), p(0, 1), p(1, 0), p(2, 1), p(0, 0)]);
    expect(rowsOf(openContainer(s, 0).board)).toEqual(['s0 b0 . .', 'p1 p0 g0 .', '. b0 . .']);
    // Deterministic: the same state always gives the same placement.
    expect(openContainer(s, 0).board).toEqual(openContainer(startSession(s.level), 0).board);
  });

  it('never releases onto another closed container, covered or not', () => {
    const s = startSession(level(['. . .'], [
      { at: p(0, 1), name: 'tin', art: 'shoebox', contents: [it0('p0'), it0('p0')] },
      { at: p(0, 0), name: 'box', art: 'keepsake-box', contents: [it0('b0')], hiddenUntil: it0('p2') },
    ]));
    expect(releaseCells(s, 0)).toEqual([p(0, 1), p(0, 2)]);
  });

  it('releases nothing without room for the whole batch: no partial release, and the tap only ends a selection', () => {
    const def = level(['g0 s0 .', 'e0 c0 g1'], [{ at: p(0, 2), name: 'tin', art: 'shoebox', contents: [it0('p0'), it0('p0')] }]);
    const s = startSession(def);
    expect(releaseCells(s, 0)).toBeNull();
    expect(openContainer(s, 0)).toBe(s);
    const ui = play(initUi(def), tap(p(0, 0)));
    const after = reduceUi(ui, tap(p(0, 2)));
    expect([after.session, after.selected, after.actionSeq]).toEqual([ui.session, null, ui.actionSeq]);
  });

  it('opens once: a second tap on its cell is an ordinary tap, and the batch is never released twice', () => {
    const def = level(['. . .', '. . .'], [{ at: p(0, 0), name: 'tin', art: 'shoebox', contents: [it0('p0')] }]);
    const once = play(initUi(def), tap(p(0, 0)));
    const twice = play(once, tap(p(0, 0)), tap(p(0, 0)));
    expect(twice.session.board.flat().filter(Boolean)).toHaveLength(1);
    expect(twice.session.unpacked).toEqual([0]);
    expect(openContainer(once.session, 0)).toBe(once.session);
  });

  it('is a checkpoint: Undo works up to the opening and not past it; Retry restores the puzzle and containers', () => {
    const def = level(['p0 . .', '. . .'], [{ at: p(1, 2), name: 'tin', art: 'shoebox', contents: [it0('p0'), it0('p0')] }]);
    const moved = play(initUi(def), drop(p(0, 0), p(0, 1)));
    expect(moved.session.undo).not.toBeNull();
    const opened = reduceUi(moved, tap(p(1, 2)));
    expect([opened.lastAction?.kind, opened.session.undo]).toEqual(['unpack', null]);
    expect(reduceUi(opened, { type: 'undo' })).toBe(opened);
    const retried = reduceUi(opened, { type: 'retry' });
    expect([retried.session.board, retried.session.unpacked, closedContainerAt(retried.session, p(1, 2))]).toEqual([def.board, [], 0]);
  });

  it('takes no drops onto a closed container, covered or not, and treats its cell normally once opened', () => {
    const def = level(['p0 . .'], [
      { at: p(0, 1), name: 'tin', art: 'shoebox', contents: [it0('g0')] },
      { at: p(0, 2), name: 'box', art: 'keepsake-box', contents: [it0('b0')], hiddenUntil: it0('p2') },
    ]);
    const s = startSession(def);
    expect([canDrop(s, p(0, 0), p(0, 1)), canDrop(s, p(0, 0), p(0, 2))]).toEqual([false, false]);
    const o = openContainer(s, 0);
    expect(canDrop(o, p(0, 0), p(0, 1))).toBe(true);
  });

  it('keeps a covered container shut until its item is made; Undo of that move covers it again', () => {
    const def = level(['p1 p1 . .', 'p1 . . .'], [
      { at: p(1, 3), name: 'old wooden box', art: 'keepsake-box', contents: [it0('b0'), it0('b0'), it0('b0')], hiddenUntil: it0('p2') },
    ]);
    const start = initUi(def);
    expect([containerShown(start.session, 0), releaseCells(start.session, 0)]).toEqual([false, null]);
    expect(reduceUi(start, tap(p(1, 3)))).toBe(start);
    const made = reduceUi(start, drop(p(1, 0), p(0, 0)));
    expect(made.lastAction).toMatchObject({ kind: 'merge', revealed: 0 });
    expect(containerShown(made.session, 0)).toBe(true);
    const back = reduceUi(made, { type: 'undo' });
    expect([containerShown(back.session, 0), back.lastAction?.kind]).toEqual([false, 'undo']);
  });

  it('rejects unsupported container levels', () => {
    const tin = (at: Pos, contents: Item[] = [it0('p0')]) => ({ at, name: 'tin', art: 'shoebox' as const, contents });
    expect(() => startSession(level(['p0 .'], [tin(p(0, 0))]))).toThrow('Unsupported container level');
    expect(() => startSession(level(['. .'], [tin(p(0, 0)), tin(p(0, 0))]))).toThrow('Unsupported container level');
    expect(() => startSession(level(['. .'], [tin(p(0, 0), [])]))).toThrow('Unsupported container level');
    expect(() => startSession(level(['. .'], [tin(p(0, 5))]))).toThrow('Unsupported container level');
    expect(() => startSession({ ...level(['. .'], [tin(p(0, 0))]), supply: [it0('p0')] })).toThrow('Unsupported container level');
  });
});

// The canonical play: the photo chain (bundle, shoebox, bundle, collection: the box is uncovered), the box, the book
// chain (old books into a stack, three stacks into the blank book), then the craft. See ATTIC_LEVEL.
const BUNDLE = [drop(p(2, 0), p(0, 1)), tap(p(3, 3)), drop(p(3, 2), p(2, 3))];
const COLLECTION = [...BUNDLE, drop(p(0, 1), p(2, 2))];
const BOXED = [...COLLECTION, tap(p(0, 3))];
const BLANK = [...BOXED, drop(p(4, 3), p(4, 1)), drop(p(0, 3), p(4, 2))];
const PICTURE_BOOK = [...BLANK, drop(p(2, 2), p(4, 2))];
const count = (s: UiState) => s.session.board.flat().filter(Boolean).length;
// The attic with both ingredients and spare pieces on its floor (the shoebox closed, the box uncovered by the collection).
const SPARES: LevelDefinition = { ...ATTIC_LEVEL, board: make(['p2 b2 p0 .', 'b0 p1 . .', '. . . .', '. . . .', '. . . .']) };

describe('The Attic: the level', () => {
  it('has the documented floor, boxes, recipe and goal', () => {
    expect(rowsOf(ATTIC_LEVEL.board)).toEqual(['p0 p0 . .', '. . . .', 'p0 . p1 .', '. . . .', 'b0 b0 b1 b0']);
    expect(ATTIC_LEVEL.supply).toEqual([]);
    // Player-facing tiers are one more: loose photos and old books are tier 1 of 5, the Picture Book tier 4 of 5.
    expect(ATTIC_LEVEL.goal).toEqual({ kind: 'item', item: it0('b3'), open: true });
    expect(ATTIC_LEVEL.containers!.map((c) => [c.name, c.art, c.at, c.contents.map(code).join(' '), c.hiddenUntil && code(c.hiddenUntil)]))
      .toEqual([
        ['shoebox', 'shoebox', p(3, 3), 'p0 p0 p0', undefined],
        ['old wooden box', 'keepsake-box', p(0, 3), 'b1', 'p2'],
      ]);
    expect(ATTIC_LEVEL.craft).toEqual({ ingredients: [it0('p2'), it0('b2')], result: it0('b3') });
    expect([SHOEBOX, KEEPSAKE_BOX]).toEqual([0, 1]);
    // Both chains, counted: 3 + 3 loose photos and a bundle make three bundles; 3 old books, the floor's stack and the
    // box's make three stacks.
    const all = [...ATTIC_LEVEL.board.flat(), ...ATTIC_LEVEL.containers!.flatMap((c) => c.contents)].filter((c): c is Item => !!c);
    const tally = Object.fromEntries(['p0', 'p1', 'b0', 'b1'].map((k) => [k, all.filter((c) => code(c) === k).length]));
    expect(tally).toEqual({ p0: 6, p1: 1, b0: 3, b1: 2 });
  });

  it('plays through one step at a time: photos, the box, books, the craft, then opening the Picture Book', () => {
    let s = initUi(ATTIC_LEVEL);
    const guides = [atticGuide(s)];
    const step = (a: UiAction) => { s = reduceUi(s, a); guides.push(atticGuide(s)); return s; };
    expect(step(BUNDLE[0]).lastAction).toMatchObject({ kind: 'merge', consumed: 3, result: it0('p1') }); // bundle at (0,1)
    expect(step(BUNDLE[1]).lastAction).toEqual({ kind: 'unpack', container: SHOEBOX, cells: [p(3, 3), p(2, 3), p(3, 2)] });
    expect(s.session.undo).toBeNull();
    // An L of three: dropping an arm onto the other arm (or onto the corner) merges all three; the corner onto an arm would
    // not, as that arm's group, without the dragged corner, is one photo.
    step(BUNDLE[2]); // bundle at (2,3), beside the first one at (2,2)
    expect(rowsOf(s.session.board)).toEqual(['. p1 . .', '. . . .', '. . p1 p1', '. . . .', 'b0 b0 b1 b0']);
    expect(step(COLLECTION[3]).lastAction).toMatchObject({ kind: 'merge', result: it0('p2'), revealed: KEEPSAKE_BOX });
    expect([s.status, containerShown(s.session, KEEPSAKE_BOX)]).toEqual(['playing', true]);
    // The box: exactly one book stack, on its own cell. Opening it is a checkpoint, not the win.
    expect(step(BOXED[4]).lastAction).toEqual({ kind: 'unpack', container: KEEPSAKE_BOX, cells: [p(0, 3)] });
    expect([rowsOf(s.session.board)[0], s.status, s.session.undo]).toEqual(['. . . b1', 'playing', null]);
    expect(step(BLANK[5]).lastAction).toMatchObject({ kind: 'merge', consumed: 3, result: it0('b1') }); // old books: stack at (4,1)
    expect(step(BLANK[6]).lastAction).toMatchObject({ kind: 'merge', consumed: 3, result: it0('b2') }); // three stacks
    expect(rowsOf(s.session.board)).toEqual(['. . . .', '. . . .', '. . p2 .', '. . . .', '. . b2 .']);
    // The craft: the collection onto the blank book makes the Picture Book there. It is not the win: it waits to be opened.
    expect(step(PICTURE_BOOK[7]).lastAction).toEqual({ kind: 'craft', made: it0('b3'), at: p(4, 2) });
    expect([rowsOf(s.session.board)[2], rowsOf(s.session.board)[4], s.status, goalOpenableAt(s.session, p(4, 2)), s.session.undo === null])
      .toEqual(['. . . .', '. . b3 .', 'playing', true, false]);
    expect(step(tap(p(4, 2))).lastAction).toEqual({ kind: 'openGoal' });
    expect([s.status, s.session.collected, s.session.undo]).toEqual(['won', true, null]);
    expect(guides).toEqual([
      'Three loose photos tie into a bundle: 3 → 1. Pick one up, then drop it where the photos light up. Drag it, or tap it and ' +
        'then tap where it goes.',
      'There are more loose photos in the shoebox. Tap it to open it.',
      'Three loose photos tie into a bundle: 3 → 1. Pick one up, then drop it where the photos light up.',
      'Three bundles make a photo collection: 3 → 1. Pick one up, then drop it where the bundles light up.',
      'The photos are collected, and under the dust sheet is an old wooden box. Tap it to open it.',
      'Now the books. Three old books make a book stack: 3 → 1. Pick one up, then drop it where the books light up.',
      'Three book stacks make a blank book: 3 → 1. Pick one up, then drop it where the stacks light up.',
      'Now combine them: drop the photo collection onto the blank book, or the book onto the photos, to make the Picture Book.',
      'You made the Picture Book! Tap it to open it.',
      'The story continues…',
    ]);
  });

  it('asks for gathering when matching items are apart, and a corner dropped onto an arm of its L does nothing', () => {
    const shoebox = play(initUi(ATTIC_LEVEL), drop(p(2, 0), p(0, 0)), tap(p(3, 3)));
    expect(reduceUi(shoebox, drop(p(3, 3), p(3, 2))).session).toBe(shoebox.session);
    const apart = reduceUi(shoebox, drop(p(2, 3), p(3, 3)));
    expect(rowsOf(apart.session.board)).toEqual(['p1 . . .', '. . . .', '. . p1 .', '. . . p1', 'b0 b0 b1 b0']);
    expect(atticGuide(apart)).toBe('Move two photo bundles side by side, then drop the third onto them to make a photo collection.');
    const beside = reduceUi(apart, drop(p(3, 3), p(2, 3)));
    expect(atticGuide(beside)).toBe('Three bundles make a photo collection: 3 → 1. Pick one up, then drop it where the bundles light up.');
    const boxed = play(initUi(ATTIC_LEVEL), ...BOXED);
    expect(atticGuide(play(boxed, drop(p(4, 1), p(1, 1)), drop(p(4, 3), p(1, 3)))))
      .toBe('Now the books. Move two old books side by side, then drop the third onto them: 3 → 1.');
    expect(atticGuide(play(boxed, drop(p(4, 3), p(4, 1)), drop(p(4, 2), p(1, 0)))))
      .toBe('Move two book stacks side by side, then drop the third onto them to make a blank book.');
    const loose = play(initUi(ATTIC_LEVEL), drop(p(0, 0), p(3, 2)));
    expect(atticGuide(loose)).toBe('Move two loose photos side by side, then drop a third onto them: 3 → 1.');
  });

  it('survives opening the shoebox first and a 5-merge: still three bundles, and a spare photo does not matter', () => {
    const s = play(initUi(ATTIC_LEVEL), tap(p(3, 3)), drop(p(2, 0), p(1, 0)), drop(p(3, 3), p(1, 1)), drop(p(2, 3), p(1, 2)));
    expect(rowsOf(s.session.board)).toEqual(['p0 p0 . .', 'p0 p0 p0 .', '. . p1 .', '. . p0 .', 'b0 b0 b1 b0']);
    const five = reduceUi(s, drop(p(3, 2), p(1, 1)));
    expect(five.lastAction).toMatchObject({ kind: 'merge', consumed: 5 });
    expect(five.session.board.flat().filter((c) => c?.family === 'photo' && c.tier === 1)).toHaveLength(3);
    expect(solve(five).status).toBe('won');
  });

  // Count model: what the floor holds, per family and tier, and which boxes are open. Positions don't matter: drops reach
  // any cell, so any three matching items can be gathered and merged (3 → 1), or five (5 → 2) when there are five, and
  // the two ingredients crafted; the floor is big enough for that (checked below). Every reachable state must still
  // reach the Picture Book, which a tap then opens wherever it is (goalOpenableAt).
  it('cannot be stranded: every reachable inventory can still make the Picture Book, with room to spare', () => {
    type State = { counts: Record<string, number>; open: readonly number[] };
    const key = (s: State) => JSON.stringify([Object.entries(s.counts).filter(([, n]) => n > 0).sort(), [...s.open].sort()]);
    const start: State = { counts: {}, open: [] };
    for (const c of ATTIC_LEVEL.board.flat()) if (c) start.counts[code(c)] = (start.counts[code(c)] ?? 0) + 1;
    const containers = ATTIC_LEVEL.containers!;
    const [x, y] = ATTIC_LEVEL.craft!.ingredients.map(code);
    const won = (s: State) => (s.counts.b3 ?? 0) > 0;
    const next = (s: State): State[] => {
      const out: State[] = [];
      for (const [k, n] of Object.entries(s.counts)) {
        const t = Number(k[1]);
        if (t >= 4) continue;
        for (const [use, make] of [[3, 1], [5, 2]] as const) {
          if (n < use) continue;
          const up = `${k[0]}${t + 1}`;
          out.push({ counts: { ...s.counts, [k]: n - use, [up]: (s.counts[up] ?? 0) + make }, open: s.open });
        }
      }
      if ((s.counts[x] ?? 0) > 0 && (s.counts[y] ?? 0) > 0) {
        out.push({ counts: { ...s.counts, [x]: s.counts[x] - 1, [y]: s.counts[y] - 1, b3: (s.counts.b3 ?? 0) + 1 }, open: s.open });
      }
      containers.forEach((c, i) => {
        if (s.open.includes(i) || (c.hiddenUntil && !Object.entries(s.counts).some(([k, n]) =>
          n > 0 && k[0] === c.hiddenUntil!.family[0] && Number(k[1]) >= c.hiddenUntil!.tier))) return;
        const counts = { ...s.counts };
        for (const item of c.contents) counts[code(item)] = (counts[code(item)] ?? 0) + 1;
        out.push({ counts, open: [...s.open, i] });
      });
      return out;
    };
    const seen = new Map<string, State>([[key(start), start]]);
    const edges = new Map<string, string[]>();
    for (const [k, s] of seen) {
      if (won(s)) { edges.set(k, []); continue; }
      const ns = next(s);
      edges.set(k, ns.map(key));
      for (const n of ns) if (!seen.has(key(n))) seen.set(key(n), n);
    }
    // Backwards from the wins: which states can reach one.
    const good = new Set([...seen].filter(([, s]) => won(s)).map(([k]) => k));
    for (let changed = true; changed;) {
      changed = false;
      for (const [k, to] of edges) if (!good.has(k) && to.some((t) => good.has(t))) { good.add(k); changed = true; }
    }
    expect(seen.size).toBe(24);
    expect([...seen.keys()].filter((k) => !good.has(k))).toEqual([]);
    // Room: items plus closed boxes always leave two free cells (so a 3-merge can be gathered on its own), and a box
    // that can open always has room for its whole batch.
    const cells = ATTIC_LEVEL.board.length * ATTIC_LEVEL.board[0].length;
    let most = 0;
    for (const s of seen.values()) {
      const items = Object.values(s.counts).reduce((a, b) => a + b, 0);
      const closed = containers.length - s.open.length;
      most = Math.max(most, items + closed);
      expect(items + closed).toBeLessThanOrEqual(cells - 2);
      containers.forEach((c, i) => {
        if (!s.open.includes(i)) expect(cells - items - closed).toBeGreaterThanOrEqual(c.contents.length - 1);
      });
    }
    expect([cells, most]).toEqual([20, 12]);
  });

  it('can always still win on the real rules after random play, including past both checkpoints', () => {
    let rng = 12345;
    const rand = (n: number) => { const d = nextUint32(rng); rng = d.state; return d.value % n; };
    // Random drops, taps and Undo, mixed with the solver's own steps so that walks also get past both boxes.
    const ends = [0, 0, 0];
    const checkpoints = [0, 0];
    let crafted = 0;
    for (let walk = 0; walk < 400; walk++) {
      let s = initUi(ATTIC_LEVEL);
      const steps = rand(80);
      for (let i = 0; i < steps && s.status === 'playing'; i++) {
        const cell = () => p(rand(5), rand(4));
        const r = rand(10);
        s = r < 4 ? solveStep(s) ?? s : reduceUi(s, r < 7 ? drop(cell(), cell()) : r < 9 ? tap(cell()) : { type: 'undo' });
        // Straight after each checkpoint, too: Undo can no longer help there.
        if (s.lastAction?.kind === 'unpack') {
          checkpoints[s.lastAction.container]++;
          expect(solve(s).status).toBe('won');
        }
        if (s.lastAction?.kind === 'craft') crafted++;
      }
      ends[s.session.unpacked.length]++;
      expect(solve(s).status).toBe('won');
    }
    // Coverage: walks ending with no box, the shoebox only and both open (10, 85 and 305 for this seed), each solved
    // from, as were the 679 shoebox and 624 keepsake-box openings along the way; 571 random or solver crafts.
    expect([ends[0] >= 5, ends[1] > 50, ends[2] > 200, checkpoints[0] > 500, checkpoints[1] > 500, crafted > 300])
      .toEqual([true, true, true, true, true, true]);
  });
});

describe('The Attic: other orders and moved pieces', () => {
  it('works with the old books merged first and the starting stack moved, before any photo; the box stays covered till the collection', () => {
    let s = play(initUi(ATTIC_LEVEL), drop(p(4, 3), p(4, 1)), drop(p(4, 2), p(1, 1)));
    expect(rowsOf(s.session.board)).toEqual(['p0 p0 . .', '. b1 . .', 'p0 . p1 .', '. . . .', '. b1 . .']);
    expect([containerShown(s.session, KEEPSAKE_BOX), reduceUi(s, tap(p(0, 3)))]).toEqual([false, s]);
    s = play(s, tap(p(3, 3)), drop(p(2, 0), p(0, 1)), drop(p(3, 2), p(2, 3)), drop(p(0, 1), p(2, 2)), tap(p(0, 3)));
    expect(s.session.unpacked).toEqual([SHOEBOX, KEEPSAKE_BOX]);
    expect(atticGuide(s)).toBe('Move two book stacks side by side, then drop the third onto them to make a blank book.');
    expect(solve(s).status).toBe('won');
  });

  it('can always be finished whichever starting piece is moved first, to any free cell', () => {
    const start = initUi(ATTIC_LEVEL);
    const cells = ATTIC_LEVEL.board.flatMap((r, row) => r.map((_, col) => p(row, col)));
    const pieces = cells.filter((q) => ATTIC_LEVEL.board[q.row][q.col]);
    const free = cells.filter((q) => !ATTIC_LEVEL.board[q.row][q.col] && closedContainerAt(start.session, q) === -1);
    expect([pieces.length, free.length]).toEqual([8, 10]);
    for (const from of pieces) {
      for (const to of free) {
        const s = reduceUi(start, drop(from, to));
        expect(s.lastAction?.kind).toBe('move');
        expect(solve(s).status).toBe('won');
      }
    }
  });
});

describe('The Attic: crafting the Picture Book', () => {
  const ready = play(initUi(ATTIC_LEVEL), ...BLANK); // the collection at (2,2), the blank book at (4,2)
  const at = (s: UiState, q: Pos) => s.session.board[q.row][q.col];

  it('crafts either way round, at the destination, consuming only those two', () => {
    const onto = reduceUi(ready, drop(p(2, 2), p(4, 2)));
    const back = reduceUi(ready, drop(p(4, 2), p(2, 2)));
    expect([at(onto, p(4, 2)), at(onto, p(2, 2)), at(back, p(2, 2)), at(back, p(4, 2))]).toEqual([it0('b3'), null, it0('b3'), null]);
    expect([onto.lastAction, back.lastAction]).toEqual([{ kind: 'craft', made: it0('b3'), at: p(4, 2) }, { kind: 'craft', made: it0('b3'), at: p(2, 2) }]);
    // Two pieces in, one out; the spare pieces beside them stay as they were, and no chest is involved.
    const spare = initUi(SPARES);
    const crafted = reduceUi(spare, drop(p(0, 0), p(0, 1)));
    expect(rowsOf(crafted.session.board)).toEqual(['. b3 p0 .', 'b0 p1 . .', '. . . .', '. . . .', '. . . .']);
    expect([count(crafted), count(spare), crafted.session.chest, crafted.session.moves]).toEqual([4, 5, null, 1]);
  });

  it('crafts by tap then tap, in either order', () => {
    expect(play(ready, tap(p(2, 2)), tap(p(4, 2))).lastAction).toEqual({ kind: 'craft', made: it0('b3'), at: p(4, 2) });
    expect(play(ready, tap(p(4, 2)), tap(p(2, 2))).lastAction).toEqual({ kind: 'craft', made: it0('b3'), at: p(2, 2) });
  });

  it('needs exactly the photo collection and the blank book; anything else keeps its ordinary meaning', () => {
    const boxed = play(initUi(ATTIC_LEVEL), ...BOXED); // the collection at (2,2), a book stack at (0,3)
    expect(craftedItem(boxed.session, p(2, 2), p(0, 3))).toBeNull();
    expect(reduceUi(boxed, drop(p(2, 2), p(0, 3))).lastAction).toEqual({ kind: 'swap' });
    const bundles = play(initUi(ATTIC_LEVEL), ...BUNDLE);
    expect(reduceUi(bundles, drop(p(2, 2), p(4, 2))).lastAction).toEqual({ kind: 'swap' }); // a bundle onto a stack
    expect(reduceUi(ready, drop(p(2, 2), p(1, 1))).lastAction).toEqual({ kind: 'move' });
    expect(craftedItem(ready.session, p(2, 2), p(2, 2))).toBeNull();
    // Generated recipes are untouched: a recipe level still crafts its chest, and the item recipe needs `craft`.
    const recipe = RECIPES[0];
    const [g, c] = recipe.ingredients.map((i) => code(i.item));
    const chest = reduceUi(initUi({ seed: 1, board: make([`${g} ${c} .`]), supply: [], goal: { kind: 'leaveOne', item: it0('e3') }, earlyLoss: false, recipe }),
      drop(p(0, 0), p(0, 1)));
    expect([chest.lastAction, chest.session.chest, rowsOf(chest.session.board)]).toEqual([{ kind: 'craft' }, p(0, 1), ['. . .']]);
    expect(craftedItem(startSession({ ...ATTIC_LEVEL, craft: undefined }), p(2, 0), p(4, 2))).toBeNull();
  });

  it('is undoable, back to both pieces; the box stays uncovered once the collection is used', () => {
    const made = reduceUi(ready, drop(p(2, 2), p(4, 2)));
    const undone = reduceUi(made, { type: 'undo' });
    expect([undone.session.board, undone.lastAction]).toEqual([ready.session.board, { kind: 'undo' }]);
    // No photo collection is left, but the opened box is still the box: on the board, in the checklist and its label.
    expect([containerShown(made.session, KEEPSAKE_BOX), closedContainerAt(made.session, p(0, 3))]).toEqual([true, -1]);
    const panel = renderToStaticMarkup(<ContainerPanel session={made.session} />);
    expect(panel).toContain('Old wooden box');
    expect(panel).not.toContain('Dust sheet');
    expect(renderToStaticMarkup(<BoardView state={made} dispatch={() => {}} scene="attic" />)).not.toContain('data-container="dust-sheet"');
  });

  it('shows a compact recipe reminder, ticking each part as it is ready, then made', () => {
    const sign = (s: UiState) => renderToStaticMarkup(<CraftSign craft={ATTIC_LEVEL.craft!} state={s} />);
    const start = sign(initUi(ATTIC_LEVEL));
    expect(start).toContain('class="panel goal recipe" aria-label="Recipe" data-craft');
    expect(start.match(/aria-label="[^"]*, tier [0-9] of 5[^"]*"/g)).toEqual([
      'aria-label="Photo collection, tier 3 of 5"', 'aria-label="Blank book, tier 3 of 5"', 'aria-label="Picture Book, tier 4 of 5"',
    ]);
    expect(start).toContain('Goal: make Picture Book, tier 4 of 5, then open it');
    expect(sign(play(initUi(ATTIC_LEVEL), ...COLLECTION))).toContain('aria-label="Photo collection, tier 3 of 5, ready"');
    expect(sign(ready).match(/, ready"/g)).toHaveLength(2);
    expect(sign(reduceUi(ready, drop(p(2, 2), p(4, 2))))).toContain('aria-label="Picture Book, tier 4 of 5, made"');
  });
});

describe('The Attic: opening the Picture Book', () => {
  afterEach(() => { vi.useRealTimers(); });
  const before = play(initUi(ATTIC_LEVEL), ...BLANK);
  const made = play(initUi(ATTIC_LEVEL), ...PICTURE_BOOK); // at (4,2)
  const opened = reduceUi(made, tap(p(4, 2)));
  const html = (s: UiState) => renderToStaticMarkup(<BoardView state={s} dispatch={() => {}} scene="attic" />);

  it('making it is not the win: it waits on the board, marked and labelled to be tapped open, and can still be undone', () => {
    expect([made.status, made.lastAction?.kind, afterOpening(made, () => {})]).toEqual(['playing', 'craft', undefined]);
    expect(html(made)).toMatch(/class="[^"]*\bis-openable\b[^"]*"[^>]*data-row="4" data-col="2"/);
    expect(html(made)).toContain('aria-label="Row 5, column 3: Picture Book, tier 4 of 5, tap to open"');
    expect(html(before)).not.toContain('is-openable');
    expect(reduceUi(made, { type: 'undo' }).session.board).toEqual(before.session.board);
  });

  it('tapping it opens it, whatever is selected, and that wins; a second tap, drops and Undo then do nothing', () => {
    expect([opened.status, opened.lastAction, opened.session.undo, goalOpenableAt(opened.session, p(4, 2))])
      .toEqual(['won', { kind: 'openGoal' }, null, false]);
    const spare = reduceUi(initUi(SPARES), drop(p(0, 0), p(0, 1))); // the Picture Book at (0,1), a loose photo at (0,2)
    expect(play(spare, tap(p(0, 2)), tap(p(0, 1))).lastAction).toEqual({ kind: 'openGoal' });
    expect(reduceUi(opened, tap(p(4, 2)))).toBe(opened);
    expect(reduceUi(opened, drop(p(4, 2), p(1, 1)))).toBe(opened);
    expect(reduceUi(opened, { type: 'undo' })).toBe(opened);
    expect(openGoal(opened.session, p(4, 2))).toBe(opened.session);
    // Only the made book opens: no other item, and nothing in a level without an `open` goal.
    expect(goalOpenableAt(before.session, p(4, 2))).toBe(false);
    expect(goalOpenableAt(startSession(level(['b3 .'], [{ at: p(0, 1), name: 'tin', art: 'shoebox', contents: [it0('p0')] }], it0('b3'))), p(0, 0)))
      .toBe(false);
    // Once open, the board takes no input and the book is no longer marked.
    expect(html(opened)).not.toContain('is-openable');
    expect(html(opened)).toContain('aria-label="Row 5, column 3: Picture Book, tier 4 of 5" aria-pressed="false" aria-disabled="true"');
  });

  it('moves on once its opening has played, on a timer, once; Retry or leaving cancels it first', () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const cancel = afterOpening(opened, done)!;
    vi.advanceTimersByTime(BOOK_OPENING_MS - 1);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(BOOK_OPENING_MS * 3);
    expect(done).toHaveBeenCalledTimes(1);
    cancel();
    // Game reruns it only for a new action (actionSeq); a duplicate tap is none.
    expect(reduceUi(opened, tap(p(4, 2))).actionSeq).toBe(opened.actionSeq);
    // Retry: the next action cancels the pending one, and schedules nothing itself. Leaving (unmounting) cancels too.
    const later = vi.fn();
    const pending = afterOpening(opened, later)!;
    vi.advanceTimersByTime(BOOK_OPENING_MS - 100);
    pending();
    const retried = reduceUi(opened, { type: 'retry' });
    expect(afterOpening(retried, later)).toBeUndefined();
    vi.advanceTimersByTime(BOOK_OPENING_MS * 3);
    expect(later).not.toHaveBeenCalled();
  });

  it('Retry, even during the opening, restores the whole attic: both chains, both boxes closed, nothing crafted or opened', () => {
    for (const s of [opened, made, before]) {
      const retried = reduceUi(s, { type: 'retry' });
      expect([retried.status, retried.session.board, retried.session.unpacked, retried.session.collected, retried.session.undo])
        .toEqual(['playing', ATTIC_LEVEL.board, [], false, null]);
      expect([closedContainerAt(retried.session, p(3, 3)), closedContainerAt(retried.session, p(0, 3))]).toEqual([SHOEBOX, KEEPSAKE_BOX]);
      expect(containerShown(retried.session, KEEPSAKE_BOX)).toBe(false);
    }
  });

  it('draws the opening from the book’s own cover and pages of small photographs, hidden from assistive technology', () => {
    const m = renderToStaticMarkup(<BookOpening />);
    expect(m).toContain('class="book-opening" aria-hidden="true" data-book-opening');
    expect(m.match(/class="book-opening-leaf"/g)).toHaveLength(3);
    // Two faces per page, the back turned, and a page under them all: seven pages of prints, in photo corners.
    expect(m.match(/class="book-opening-page"/g)).toHaveLength(3);
    expect(m.match(/class="book-opening-page is-back"/g)).toHaveLength(3);
    expect([...m.matchAll(/data-page="(\d)"/g)].map((x) => Number(x[1])).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(m).toContain('viewBox="16 14 62 62"');
    expect(m).not.toMatch(/<img|<text|<image|href=/);
    // The leaves come before the cover, which lies over them (in depth too: CSS --z).
    expect(m.indexOf('book-opening-leaf')).toBeLessThan(m.indexOf('book-opening-cover'));
  });
});

describe('The Attic: guidance toward a merge or craft that works', () => {
  const sorted = (cells: readonly Pos[]) => cells.map((q) => `${q.row},${q.col}`).sort();
  // The shoebox's three photos land in an L around its cell: corner (3,3), arms (2,3) and (3,2). The old books start as a
  // pair, (4,0) and (4,1), and (4,3) beyond the stack.
  const shoebox = play(initUi(ATTIC_LEVEL), ...BUNDLE.slice(0, 2));
  const boxed = play(initUi(ATTIC_LEVEL), ...BOXED);
  const ready = play(initUi(ATTIC_LEVEL), ...BLANK); // the collection at (2,2), the blank book at (4,2)
  const html = (s: UiState) => renderToStaticMarkup(<BoardView state={s} dispatch={() => {}} scene="attic" />);
  const marked = (s: UiState, cls: string) => [...html(s).matchAll(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*data-row="(\\d)" data-col="(\\d)"`, 'g'))]
    .map((m) => `${m[1]},${m[2]}`).sort();

  it('finds where a picked-up item merges or crafts with the real rules, and which items do at all', () => {
    const start = initUi(ATTIC_LEVEL);
    expect(sorted(mergeSources(start))).toEqual(['2,0', '4,3']);
    expect(sorted(mergeTargets(start, p(2, 0)))).toEqual(['0,0', '0,1']);
    expect(sorted(mergeTargets(start, p(4, 3)))).toEqual(['4,0', '4,1']);
    expect([mergeTargets(start, p(0, 0)), mergeTargets(start, p(4, 0))]).toEqual([[], []]);
    // The L: either arm merges onto the corner or the other arm; the corner merges onto neither arm.
    expect(sorted(mergeSources(shoebox))).toEqual(['2,3', '3,2', '4,3']);
    expect(sorted(mergeTargets(shoebox, p(2, 3)))).toEqual(['3,2', '3,3']);
    expect(mergeTargets(shoebox, p(3, 3))).toEqual([]);
    expect(sorted(mergeSources(boxed))).toEqual(['4,3']);
    // The two ingredients target each other.
    expect([mergeTargets(ready, p(2, 2)), mergeTargets(ready, p(4, 2)), sorted(mergeSources(ready))])
      .toEqual([[p(4, 2)], [p(2, 2)], ['2,2', '4,2']]);
  });

  it('says where a picked-up photo, bundle, book, stack or ingredient goes, or that it will not, and which to pick instead', () => {
    expect(atticGuide(reduceUi(shoebox, tap(p(2, 3))))).toBe('Drop it on a highlighted loose photo: 3 → 1.');
    expect(atticGuide(reduceUi(shoebox, tap(p(3, 3)))))
      .toBe("From there this loose photo won't merge. Tap it again to put it down, then pick up a highlighted one.");
    const bundles = play(shoebox, BUNDLE[2]);
    expect(atticGuide(reduceUi(bundles, tap(p(0, 1))))).toBe('Drop it on a highlighted photo bundle: 3 → 1.');
    expect(atticGuide(reduceUi(bundles, tap(p(2, 2)))))
      .toBe("From there this photo bundle won't merge. Tap it again to put it down, then pick up a highlighted one.");
    expect(atticGuide(reduceUi(boxed, tap(p(4, 3))))).toBe('Drop it on a highlighted old book: 3 → 1.');
    expect(atticGuide(reduceUi(boxed, tap(p(4, 0)))))
      .toBe("From there this old book won't merge. Tap it again to put it down, then pick up a highlighted one.");
    const stacks = play(boxed, BLANK[5]); // stacks at (0,3), (4,1) and (4,2)
    expect(atticGuide(reduceUi(stacks, tap(p(0, 3))))).toBe('Drop it on a highlighted book stack: 3 → 1.');
    expect(atticGuide(reduceUi(ready, tap(p(2, 2))))).toBe('Drop it on the highlighted blank book to make the Picture Book.');
    expect(atticGuide(reduceUi(ready, tap(p(4, 2))))).toBe('Drop it on the highlighted photo collection to make the Picture Book.');
    // Five together: the count is the merge the drop would make.
    const five = play(initUi(ATTIC_LEVEL), tap(p(3, 3)), drop(p(2, 0), p(1, 0)), drop(p(3, 3), p(1, 1)), drop(p(2, 3), p(1, 2)), tap(p(0, 0)));
    expect(atticGuide(five)).toBe('Drop it on a highlighted loose photo to merge five: 5 → 2.');
    // With nothing ready to merge anywhere, a picked-up item changes nothing: the step-by-step guidance stays.
    const none = play(initUi(ATTIC_LEVEL), drop(p(4, 3), p(4, 1)), BUNDLE[0]);
    expect(atticGuide(reduceUi(none, tap(p(0, 1))))).toBe(atticGuide(none));
  });

  it('highlights on the attic board while an item is picked up, labelled for screen readers, and nowhere else', () => {
    expect(marked(shoebox, 'is-merge-target')).toEqual([]);
    expect(marked(shoebox, 'is-merge-source')).toEqual([]);
    const arm = reduceUi(shoebox, tap(p(2, 3)));
    expect(marked(arm, 'is-merge-target')).toEqual(['3,2', '3,3']);
    expect(html(arm)).toContain('aria-label="Row 4, column 4: Loose photos, tier 1 of 5, merges here"');
    const corner = reduceUi(shoebox, tap(p(3, 3)));
    expect(marked(corner, 'is-merge-target')).toEqual([]);
    expect(marked(corner, 'is-merge-source')).toEqual(['2,3', '3,2', '4,3']);
    expect(html(corner)).toContain('aria-label="Row 3, column 4: Loose photos, tier 1 of 5, can merge"');
    expect(marked(reduceUi(boxed, tap(p(4, 3))), 'is-merge-target')).toEqual(['4,0', '4,1']);
    const ingredient = reduceUi(ready, tap(p(2, 2)));
    expect(marked(ingredient, 'is-merge-target')).toEqual(['4,2']);
    expect(html(ingredient)).toContain('aria-label="Row 5, column 3: Blank book, tier 3 of 5, combines here"');
    expect(renderToStaticMarkup(<BoardView state={arm} dispatch={() => {}} />)).not.toContain('is-merge-target');
  });

  it('clears with the selection: after a move, Undo and Retry the guidance follows the new board', () => {
    const corner = reduceUi(shoebox, tap(p(3, 3)));
    // The corner moved away from its L: the remaining two photos plus it are no longer an L; nothing is picked up.
    const moved = reduceUi(corner, tap(p(1, 1)));
    expect([moved.selected, marked(moved, 'is-merge-source')]).toEqual([null, []]);
    expect(atticGuide(moved)).toBe('Move two loose photos side by side, then drop a third onto them: 3 → 1.');
    const undone = reduceUi(moved, { type: 'undo' });
    expect(sorted(mergeSources(undone))).toEqual(['2,3', '3,2', '4,3']);
    expect(atticGuide(reduceUi(undone, tap(p(3, 3))))).toContain("won't merge");
    const retried = reduceUi(reduceUi(undone, tap(p(3, 3))), { type: 'retry' });
    expect([retried.selected, sorted(mergeSources(retried))]).toEqual([null, ['2,0', '4,3']]);
  });
});

/**
 * A plain solver on the real rules: open the Picture Book once made, open any box that can open, make any merge that is
 * ready, else craft, else move a matching item beside another of its kind.
 */
function solve(start: UiState): UiState {
  let s = start;
  for (let i = 0; i < 120 && s.status === 'playing'; i++) {
    const next = solveStep(s);
    if (!next) break;
    s = next;
  }
  return s;
}

/** One solver step, or null if it sees nothing to do. */
function solveStep(s: UiState): UiState | null {
  const { session } = s;
  if (s.status !== 'playing') return null;
  const book = session.board.flatMap((r, row) => r.flatMap((_, col) => (goalOpenableAt(session, p(row, col)) ? [p(row, col)] : [])));
  if (book.length > 0) return reduceUi(s, tap(book[0]));
  const box = session.level.containers!.findIndex((_, j) => releaseCells(session, j));
  if (box !== -1) return reduceUi(s, tap(session.level.containers![box].at));
  const filled: Pos[] = session.board.flatMap((r, row) => r.flatMap((c, col) => (c ? [p(row, col)] : [])));
  const pairs = filled.flatMap((a) => filled.map((b) => [a, b] as const));
  const ready = pairs.find(([a, b]) => previewDrop(session, a, b).length > 0) ?? pairs.find(([a, b]) => craftedItem(session, a, b));
  if (ready) return reduceUi(s, drop(ready[0], ready[1]));
  const at = (q: Pos) => session.board[q.row][q.col]!;
  const kind = filled.find((a) => filled.filter((b) => at(b).family === at(a).family && at(b).tier === at(a).tier).length >= 3);
  if (!kind) return null;
  const same = filled.filter((b) => at(b).family === at(kind).family && at(b).tier === at(kind).tier && b !== kind);
  const spot = [p(kind.row - 1, kind.col), p(kind.row + 1, kind.col), p(kind.row, kind.col - 1), p(kind.row, kind.col + 1)]
    .find((q) => canDrop(session, same[0], q) && session.board[q.row][q.col] === null);
  const next = spot ? reduceUi(s, drop(same[0], spot)) : s;
  return next === s ? null : next;
}

describe('The Attic: presentation, text and sound', () => {
  const opened = play(initUi(ATTIC_LEVEL), ...BUNDLE.slice(0, 2));
  const uncovered = play(initUi(ATTIC_LEVEL), ...COLLECTION);
  const c = ATTIC_LEVEL.containers;
  const said = (s: UiState) => describeAction(s.lastAction, 'Level', ATTIC_LEVEL.goal, undefined, undefined, undefined, c);

  it('announces openings, the uncovering, the craft and the opening, naming what is inside or made', () => {
    expect(said(opened)).toBe('Opened the shoebox: 3 × Loose photos, tier 1 of 5.');
    expect(said(uncovered)).toBe('Merged 3 into 1 item: Photo collection, tier 3 of 5. Under the dust sheet: an old wooden box, holding ' +
      '1 × Book stack, tier 2 of 5. Tap it to open it.');
    expect(said(play(initUi(ATTIC_LEVEL), ...BOXED))).toBe('Opened the old wooden box: 1 × Book stack, tier 2 of 5.');
    expect(said(play(initUi(ATTIC_LEVEL), ...BLANK))).toBe('Merged 3 into 1 item: Blank book, tier 3 of 5.');
    const made = play(initUi(ATTIC_LEVEL), ...PICTURE_BOOK);
    expect(said(made)).toBe('Made Picture Book, tier 4 of 5. Tap it to open it.');
    expect(said(reduceUi(made, tap(p(4, 2))))).toBe('Opened the Picture Book.');
  });

  it('plays a discovery for openings and the uncovering, a completion for the craft and the treasure victory for opening it', () => {
    expect(actionEffect(opened)).toBe('discovery');
    expect(actionEffect(uncovered)).toBe('discovery');
    expect(actionEffect(play(initUi(ATTIC_LEVEL), ...BOXED))).toBe('discovery');
    expect(actionEffect(play(initUi(ATTIC_LEVEL), ...BLANK))).toBe('merge-three');
    const made = play(initUi(ATTIC_LEVEL), ...PICTURE_BOOK);
    expect(actionEffect(made)).toBe('completion');
    expect(actionEffect(reduceUi(made, tap(p(4, 2))))).toBe('case-victory');
    expect(actionEffect(play(initUi(ATTIC_LEVEL), BUNDLE[0]))).toBe('merge-three');
  });

  it('draws the attic floor with labelled boxes, contents shown, the craft sparkling, and its room as decoration only', () => {
    const html = renderToStaticMarkup(<BoardView state={initUi(ATTIC_LEVEL)} dispatch={() => {}} scene="attic" />);
    expect(html).toContain('board-viewport is-attic');
    expect(html).toContain('class="board is-attic"');
    expect(html).toContain('aria-label="Row 1, column 4: something under a dust sheet"');
    expect(html).toContain('aria-label="Row 4, column 4: shoebox, closed, holds 3 × Loose photos, tier 1 of 5, tap to open"');
    expect(html).toContain('aria-label="Row 5, column 3: Book stack, tier 2 of 5"');
    expect(html).toContain('data-container="dust-sheet"');
    expect(html).toContain('class="container-badge" aria-hidden="true"');
    expect(html).toContain('class="attic-decor" aria-hidden="true"');
    expect(html.match(/data-cell=/g)).toHaveLength(20);
    const made = renderToStaticMarkup(<BoardView state={play(initUi(ATTIC_LEVEL), ...PICTURE_BOOK)} dispatch={() => {}} scene="attic" />);
    expect(made).toMatch(/data-row="4" data-col="2"(?:(?!<\/button>).)*data-fx="output"/);
    // Other boards are unchanged.
    expect(renderToStaticMarkup(<BoardView state={initUi(ATTIC_LEVEL)} dispatch={() => {}} />)).not.toContain('is-attic');
  });

  it('lists the boxes: what uncovers the covered one, what each holds, ticks once opened', () => {
    const start = renderToStaticMarkup(<ContainerPanel session={initUi(ATTIC_LEVEL).session} />);
    expect(start).toContain(': holds 3 × Loose photos, tier 1 of 5');
    expect(start).toContain(': make Photo collection, tier 3 of 5 to finish tidying');
    const later = renderToStaticMarkup(<ContainerPanel session={uncovered.session} />);
    expect(later).toContain(': opened');
    expect(later).toContain('Old wooden box');
    expect(later).toContain(': holds 1 × Book stack, tier 2 of 5');
  });

  it('is offered from Levels, not Home, and explains both chains, the craft and the boxes in Help', () => {
    const home = renderToStaticMarkup(<Home onPlay={() => {}} onLevels={() => {}} onScores={() => {}}
      onReleaseNotes={() => {}} musicControl={null} />);
    expect(home).not.toMatch(/data-action="attic"|The Attic/);
    expect(home.match(/<button type="button" class="btn[^"]*" data-action="[^"]+"/g)!.map((b) => b.match(/data-action="([^"]+)"/)![1]))
      .toEqual(['play', 'play-levels', 'scores']);
    expect(renderToStaticMarkup(<App />)).not.toContain('data-action="attic"');
    const help = renderToStaticMarkup(<HelpButton goal={ATTIC_LEVEL.goal} containers craft={ATTIC_LEVEL.craft} />);
    expect(help).toContain('Goal: make Picture Book, tier 4 of 5, then tap it to open it.');
    expect(help).toContain('Drop Photo collection, tier 3 of 5 onto Blank book, tier 3 of 5, or the other way round (or tap one, then the ' +
      'other), to make Picture Book, tier 4 of 5: only those two are used, and Undo takes it back.');
    expect(help).not.toContain('Winning unlocks the next level');
    expect(help).toContain('everything inside comes out at once');
    expect(help).toContain('Opening a box can&#x27;t be undone.');
    expect(help).not.toContain('Add supply');
    expect(renderToStaticMarkup(<HelpButton goal={ATTIC_LEVEL.goal} containers />)).not.toContain('or the other way round');
  });

  it('never reports a loss', () => {
    expect(evaluateStatus(undo(startSession(ATTIC_LEVEL)))).toBe('playing');
  });
});
