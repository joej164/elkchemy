import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Board, Cell, Family, Item, Pos, Tier } from '../src/board';
import { ATTIC_LEVEL, KEEPSAKE_BOX, SHOEBOX } from '../src/attic';
import {
  canDrop, closedContainerAt, containerShown, nextUint32, openContainer, previewDrop, releaseCells, startSession, undo,
  type LevelDefinition,
} from '../src/session';
import { evaluateStatus } from '../src/status';
import { initUi, mergeSources, mergeTargets, reduceUi, type UiAction, type UiState } from '../src/ui/controller';
import { atticGuide } from '../src/ui/atticGuide';
import { actionEffect } from '../src/ui/audioEvents';
import { ContainerPanel, describeAction } from '../src/ui/App';
import { Board as BoardView } from '../src/ui/Board';
import { HelpButton } from '../src/ui/HelpButton';
import { Home } from '../src/ui/Home';

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

describe('The Attic: the level', () => {
  it('has the documented floor, boxes and goal', () => {
    expect(rowsOf(ATTIC_LEVEL.board)).toEqual(['p0 p0 . .', '. . . .', 'p0 . p1 .', '. . . .']);
    expect(ATTIC_LEVEL.supply).toEqual([]);
    expect(ATTIC_LEVEL.goal).toEqual({ kind: 'item', item: it0('b1') });
    expect(ATTIC_LEVEL.containers!.map((c) => [c.name, c.art, c.at, c.contents.map(code).join(' '), c.hiddenUntil && code(c.hiddenUntil)]))
      .toEqual([
        ['shoebox', 'shoebox', p(3, 3), 'p0 p0 p0', undefined],
        ['old wooden box', 'keepsake-box', p(0, 3), 'b0 b0 b0', 'p2'],
      ]);
    expect([SHOEBOX, KEEPSAKE_BOX]).toEqual([0, 1]);
  });

  it('plays through one step at a time: merge, open the shoebox, merge, gather, uncover, open the box, merge the books', () => {
    let s = initUi(ATTIC_LEVEL);
    const guides = [atticGuide(s)];
    const step = (a: UiAction) => { s = reduceUi(s, a); guides.push(atticGuide(s)); return s; };
    expect(step(drop(p(2, 0), p(0, 1))).lastAction).toMatchObject({ kind: 'merge', consumed: 3 }); // bundle at (0,1)
    expect(step(tap(p(3, 3))).lastAction).toEqual({ kind: 'unpack', container: SHOEBOX, cells: [p(3, 3), p(2, 3), p(3, 2)] });
    expect(s.session.undo).toBeNull();
    // An L of three: dropping an arm onto the other arm (or onto the corner) merges all three; the corner onto an arm would
    // not, as that arm's group, without the dragged corner, is one photo.
    step(drop(p(3, 2), p(2, 3))); // bundle at (2,3), beside the first one at (2,2)
    expect(rowsOf(s.session.board)).toEqual(['. p1 . .', '. . . .', '. . p1 p1', '. . . .']);
    expect(step(drop(p(0, 1), p(2, 2))).lastAction).toMatchObject({ kind: 'merge', revealed: KEEPSAKE_BOX });
    expect([s.status, containerShown(s.session, KEEPSAKE_BOX)]).toEqual(['playing', true]);
    expect(step(tap(p(0, 3))).lastAction).toEqual({ kind: 'unpack', container: KEEPSAKE_BOX, cells: [p(0, 3), p(0, 2), p(1, 3)] });
    // Exactly three books, and opening the box is not the win.
    expect(s.session.board.flat().filter((c) => c?.family === 'book')).toHaveLength(3);
    expect([s.status, s.session.undo]).toEqual(['playing', null]);
    expect(step(drop(p(0, 2), p(0, 3))).lastAction).toMatchObject({ kind: 'merge', consumed: 3, result: it0('b1') });
    expect(s.status).toBe('won');
    expect(guides).toEqual([
      'Three loose photos tie into a bundle: 3 → 1. Pick one up, then drop it where the photos light up. Drag it, or tap it and ' +
        'then tap where it goes.',
      'There are more loose photos in the shoebox. Tap it to open it.',
      'Three loose photos tie into a bundle: 3 → 1. Pick one up, then drop it where the photos light up.',
      'Three bundles make a photo album: 3 → 1. Pick one up, then drop it where the bundles light up.',
      'The photos are tidy, and under the dust sheet is an old wooden box. Tap it to open it.',
      'Three old books! Pick one up, then drop it where the books light up, to make the memory book.',
      'You made the memory book! Tap Continue the story.',
    ]);
  });

  it('asks for gathering when matching items are apart, and a corner dropped onto an arm of its L does nothing', () => {
    const shoebox = play(initUi(ATTIC_LEVEL), drop(p(2, 0), p(0, 0)), tap(p(3, 3)));
    expect(reduceUi(shoebox, drop(p(3, 3), p(3, 2))).session).toBe(shoebox.session);
    const apart = reduceUi(shoebox, drop(p(2, 3), p(3, 3)));
    expect(rowsOf(apart.session.board)).toEqual(['p1 . . .', '. . . .', '. . p1 .', '. . . p1']);
    expect(atticGuide(apart)).toBe('Move two photo bundles side by side, then drop the third onto them to make a photo album.');
    const beside = reduceUi(apart, drop(p(3, 3), p(2, 3)));
    expect(atticGuide(beside)).toBe('Three bundles make a photo album: 3 → 1. Pick one up, then drop it where the bundles light up.');
    const books = play(initUi(ATTIC_LEVEL), drop(p(2, 0), p(0, 1)), tap(p(3, 3)), drop(p(3, 2), p(2, 3)), drop(p(0, 1), p(2, 2)),
      tap(p(0, 3)), drop(p(1, 3), p(3, 0)), drop(p(0, 2), p(1, 0)));
    expect(atticGuide(books)).toBe('Move two books side by side, then drop the third onto them to make the memory book.');
    const loose = play(initUi(ATTIC_LEVEL), drop(p(0, 0), p(3, 2)));
    expect(atticGuide(loose)).toBe('Move two loose photos side by side, then drop a third onto them: 3 → 1.');
  });

  it('survives opening the shoebox first and a 5-merge: still three bundles, and a spare photo does not matter', () => {
    const s = play(initUi(ATTIC_LEVEL), tap(p(3, 3)), drop(p(2, 0), p(1, 0)), drop(p(3, 3), p(1, 1)), drop(p(2, 3), p(1, 2)));
    expect(rowsOf(s.session.board)).toEqual(['p0 p0 . .', 'p0 p0 p0 .', '. . p1 .', '. . p0 .']);
    const five = reduceUi(s, drop(p(3, 2), p(1, 1)));
    expect(five.lastAction).toMatchObject({ kind: 'merge', consumed: 5 });
    expect(five.session.board.flat().filter((c) => c?.family === 'photo' && c.tier === 1)).toHaveLength(3);
    expect(solve(five).status).toBe('won');
  });

  // Count model: what the floor holds, per family and tier, and which boxes are open. Positions don't matter: drops reach
  // any cell, so any three matching items can be gathered and merged (3 → 1), or five (5 → 2) when there are five; the
  // floor is big enough for that (checked below). Every reachable state must still reach the memory book.
  it('cannot be stranded: every reachable inventory can still make the memory book, with room to spare', () => {
    type State = { counts: Record<string, number>; open: readonly number[] };
    const key = (s: State) => JSON.stringify([Object.entries(s.counts).filter(([, n]) => n > 0).sort(), [...s.open].sort()]);
    const start: State = { counts: {}, open: [] };
    for (const c of ATTIC_LEVEL.board.flat()) if (c) start.counts[code(c)] = (start.counts[code(c)] ?? 0) + 1;
    const containers = ATTIC_LEVEL.containers!;
    const won = (s: State) => (s.counts.b1 ?? 0) > 0;
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
    expect(seen.size).toBeGreaterThan(10);
    expect([...seen.keys()].filter((k) => !good.has(k))).toEqual([]);
    // Room: items plus closed boxes always leave two free cells (so a 3-merge can be gathered on its own), and a box
    // that can open always has room for its whole batch.
    const cells = ATTIC_LEVEL.board.length * ATTIC_LEVEL.board[0].length;
    for (const s of seen.values()) {
      const items = Object.values(s.counts).reduce((a, b) => a + b, 0);
      const closed = containers.length - s.open.length;
      expect(items + closed).toBeLessThanOrEqual(cells - 2);
      containers.forEach((c, i) => {
        if (!s.open.includes(i)) expect(cells - items - closed).toBeGreaterThanOrEqual(c.contents.length - 1);
      });
    }
  });

  it('can always still win on the real rules after random play, including past both checkpoints', () => {
    let rng = 12345;
    const rand = (n: number) => { const d = nextUint32(rng); rng = d.state; return d.value % n; };
    // Random drops, taps and Undo, mixed with the solver's own steps so that walks also get past both boxes.
    const ends = [0, 0, 0];
    const checkpoints = [0, 0];
    let openUnwon = 0;
    for (let walk = 0; walk < 400; walk++) {
      let s = initUi(ATTIC_LEVEL);
      const steps = rand(60);
      for (let i = 0; i < steps && s.status === 'playing'; i++) {
        const cell = () => p(rand(4), rand(4));
        const r = rand(10);
        s = r < 4 ? solveStep(s) ?? s : reduceUi(s, r < 7 ? drop(cell(), cell()) : r < 9 ? tap(cell()) : { type: 'undo' });
        // Straight after each checkpoint, too: Undo can no longer help there.
        if (s.lastAction?.kind === 'unpack') {
          checkpoints[s.lastAction.container]++;
          expect(solve(s).status).toBe('won');
        }
      }
      ends[s.session.unpacked.length]++;
      if (s.session.unpacked.length === 2 && s.status === 'playing') openUnwon++;
      expect(solve(s).status).toBe('won');
    }
    // Coverage: walks ending with no box, the shoebox only and both open (22, 84 and 294 for this seed), and 715 shoebox
    // and 554 keepsake-box openings, each solved from.
    expect([ends[0] > 10, ends[1] > 50, ends[2] > 100, checkpoints[0] > 300, checkpoints[1] > 300, openUnwon > 5])
      .toEqual([true, true, true, true, true, true]);
  });
});

describe('The Attic: guidance toward a merge that works', () => {
  const sorted = (cells: readonly Pos[]) => cells.map((q) => `${q.row},${q.col}`).sort();
  // The shoebox's three photos land in an L around its cell: corner (3,3), arms (2,3) and (3,2).
  const shoebox = play(initUi(ATTIC_LEVEL), drop(p(2, 0), p(0, 1)), tap(p(3, 3)));
  // The box's three books land in an L too: corner (0,3), arms (0,2) and (1,3).
  const books = play(shoebox, drop(p(3, 2), p(2, 3)), drop(p(0, 1), p(2, 2)), tap(p(0, 3)));
  const html = (s: UiState) => renderToStaticMarkup(<BoardView state={s} dispatch={() => {}} scene="attic" />);
  const marked = (s: UiState, cls: string) => [...html(s).matchAll(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*data-row="(\\d)" data-col="(\\d)"`, 'g'))]
    .map((m) => `${m[1]},${m[2]}`).sort();

  it('finds where a picked-up item merges with the real merge rules, and which items merge at all', () => {
    const start = initUi(ATTIC_LEVEL);
    expect(sorted(mergeSources(start))).toEqual(['2,0']);
    expect(sorted(mergeTargets(start, p(2, 0)))).toEqual(['0,0', '0,1']);
    expect(mergeTargets(start, p(0, 0))).toEqual([]);
    // The L: either arm merges onto the corner or the other arm; the corner merges onto neither arm.
    expect(sorted(mergeSources(shoebox))).toEqual(['2,3', '3,2']);
    expect(sorted(mergeTargets(shoebox, p(2, 3)))).toEqual(['3,2', '3,3']);
    expect(mergeTargets(shoebox, p(3, 3))).toEqual([]);
    expect(sorted(mergeSources(books))).toEqual(['0,2', '1,3']);
    expect(mergeTargets(books, p(0, 3))).toEqual([]);
  });

  it('says where a picked-up photo, bundle or book merges, or that it will not, and which to pick instead', () => {
    expect(atticGuide(reduceUi(shoebox, tap(p(2, 3))))).toBe('Drop it on a highlighted loose photo: 3 → 1.');
    expect(atticGuide(reduceUi(shoebox, tap(p(3, 3)))))
      .toBe("From there this loose photo won't merge. Tap it again to put it down, then pick up a highlighted one.");
    const bundles = play(shoebox, drop(p(3, 2), p(2, 3)));
    expect(atticGuide(reduceUi(bundles, tap(p(0, 1))))).toBe('Drop it on a highlighted photo bundle: 3 → 1.');
    expect(atticGuide(reduceUi(bundles, tap(p(2, 2)))))
      .toBe("From there this photo bundle won't merge. Tap it again to put it down, then pick up a highlighted one.");
    expect(atticGuide(reduceUi(books, tap(p(1, 3))))).toBe('Drop it on a highlighted book: 3 → 1.');
    expect(atticGuide(reduceUi(books, tap(p(0, 3)))))
      .toBe("From there this book won't merge. Tap it again to put it down, then pick up a highlighted one.");
    // Five together: the count is the merge the drop would make.
    const five = play(initUi(ATTIC_LEVEL), tap(p(3, 3)), drop(p(2, 0), p(1, 0)), drop(p(3, 3), p(1, 1)), drop(p(2, 3), p(1, 2)), tap(p(0, 0)));
    expect(atticGuide(five)).toBe('Drop it on a highlighted loose photo to merge five: 5 → 2.');
    // With nothing ready to merge anywhere, a picked-up item changes nothing: the step-by-step guidance stays.
    const none = play(initUi(ATTIC_LEVEL), drop(p(2, 0), p(0, 1)));
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
    expect(marked(corner, 'is-merge-source')).toEqual(['2,3', '3,2']);
    expect(html(corner)).toContain('aria-label="Row 3, column 4: Loose photos, tier 1 of 5, can merge"');
    expect(marked(reduceUi(books, tap(p(0, 2))), 'is-merge-target')).toEqual(['0,3', '1,3']);
    expect(renderToStaticMarkup(<BoardView state={arm} dispatch={() => {}} />)).not.toContain('is-merge-target');
  });

  it('clears with the selection: after a move, Undo and Retry the guidance follows the new board', () => {
    const corner = reduceUi(shoebox, tap(p(3, 3)));
    // The corner moved away from its L: the remaining two photos plus it are no longer an L; nothing is picked up.
    const moved = reduceUi(corner, tap(p(1, 1)));
    expect([moved.selected, marked(moved, 'is-merge-source')]).toEqual([null, []]);
    expect(atticGuide(moved)).toBe('Move two loose photos side by side, then drop a third onto them: 3 → 1.');
    const undone = reduceUi(moved, { type: 'undo' });
    expect(sorted(mergeSources(undone))).toEqual(['2,3', '3,2']);
    expect(atticGuide(reduceUi(undone, tap(p(3, 3))))).toContain("won't merge");
    const retried = reduceUi(reduceUi(undone, tap(p(3, 3))), { type: 'retry' });
    expect([retried.selected, sorted(mergeSources(retried))]).toEqual([null, ['2,0']]);
  });
});

/**
 * A plain solver on the real rules: open any box that can open, make any merge that is ready, else move a matching item
 * beside another of its kind.
 */
function solve(start: UiState): UiState {
  let s = start;
  for (let i = 0; i < 80 && s.status === 'playing'; i++) {
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
  const box = session.level.containers!.findIndex((_, j) => releaseCells(session, j));
  if (box !== -1) return reduceUi(s, tap(session.level.containers![box].at));
  const filled: Pos[] = session.board.flatMap((r, row) => r.flatMap((c, col) => (c ? [p(row, col)] : [])));
  const ready = filled.flatMap((a) => filled.map((b) => [a, b] as const)).find(([a, b]) => previewDrop(session, a, b).length > 0);
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
  const opened = play(initUi(ATTIC_LEVEL), drop(p(2, 0), p(0, 1)), tap(p(3, 3)));
  const uncovered = play(opened, drop(p(3, 2), p(2, 3)), drop(p(0, 1), p(2, 2)));

  it('announces openings and the uncovering, naming what is inside', () => {
    const c = ATTIC_LEVEL.containers;
    expect(describeAction(opened.lastAction, 'Level', ATTIC_LEVEL.goal, undefined, undefined, undefined, c))
      .toBe('Opened the shoebox: 3 × Loose photos, tier 1 of 5.');
    expect(describeAction(uncovered.lastAction, 'Level', ATTIC_LEVEL.goal, undefined, undefined, undefined, c))
      .toBe('Merged 3 into 1 item: Photo album, tier 3 of 5. Under the dust sheet: an old wooden box, holding 3 × Old book, tier 1 of 5. ' +
        'Tap it to open it.');
  });

  it('plays a discovery for openings and the uncovering, and the treasure victory for the memory book', () => {
    expect(actionEffect(opened)).toBe('discovery');
    expect(actionEffect(uncovered)).toBe('discovery');
    const books = reduceUi(uncovered, tap(p(0, 3)));
    expect(actionEffect(books)).toBe('discovery');
    expect(actionEffect(reduceUi(books, drop(p(0, 2), p(0, 3))))).toBe('case-victory');
    expect(actionEffect(play(initUi(ATTIC_LEVEL), drop(p(2, 0), p(0, 1))))).toBe('merge-three');
  });

  it('draws the attic floor with labelled boxes, contents shown, and its room as decoration only', () => {
    const html = renderToStaticMarkup(<BoardView state={initUi(ATTIC_LEVEL)} dispatch={() => {}} scene="attic" />);
    expect(html).toContain('board-viewport is-attic');
    expect(html).toContain('class="board is-attic"');
    expect(html).toContain('aria-label="Row 1, column 4: something under a dust sheet"');
    expect(html).toContain('aria-label="Row 4, column 4: shoebox, closed, holds 3 × Loose photos, tier 1 of 5, tap to open"');
    expect(html).toContain('data-container="dust-sheet"');
    expect(html).toContain('class="container-badge" aria-hidden="true"');
    expect(html).toContain('class="attic-decor" aria-hidden="true"');
    expect(html.match(/data-cell=/g)).toHaveLength(16);
    // Other boards are unchanged.
    expect(renderToStaticMarkup(<BoardView state={initUi(ATTIC_LEVEL)} dispatch={() => {}} />)).not.toContain('is-attic');
  });

  it('lists the boxes: what uncovers the covered one, what each holds, ticks once opened', () => {
    const start = renderToStaticMarkup(<ContainerPanel session={initUi(ATTIC_LEVEL).session} />);
    expect(start).toContain(': holds 3 × Loose photos, tier 1 of 5');
    expect(start).toContain(': make Photo album, tier 3 of 5 to finish tidying');
    const later = renderToStaticMarkup(<ContainerPanel session={uncovered.session} />);
    expect(later).toContain(': opened');
    expect(later).toContain('Old wooden box');
    expect(later).toContain(': holds 3 × Old book, tier 1 of 5');
  });

  it('offers the prototype on Home and explains boxes in Help', () => {
    const home = renderToStaticMarkup(<Home onPlay={() => {}} onLevels={() => {}} onAttic={() => {}} onScores={() => {}}
      onReleaseNotes={() => {}} musicControl={null} />);
    expect(home).toContain('data-action="attic"');
    expect(home).toContain('Story prototype:<br/>The Attic');
    const help = renderToStaticMarkup(<HelpButton goal={ATTIC_LEVEL.goal} containers />);
    expect(help).toContain('Goal: make Memory book, tier 2 of 5.');
    expect(help).not.toContain('Winning unlocks the next level');
    expect(help).toContain('everything inside comes out at once');
    expect(help).toContain('Opening a box can&#x27;t be undone.');
    expect(help).not.toContain('Add supply');
  });

  it('never reports a loss', () => {
    expect(evaluateStatus(undo(startSession(ATTIC_LEVEL)))).toBe('playing');
  });
});
