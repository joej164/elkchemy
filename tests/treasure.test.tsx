import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Board, Cell, Family, Item, Pos, Tier } from '../src/board';
import {
  canReach, generatePuzzle, GOAL_COUNTS, isSupportedConfig, parsePuzzleId, TARGET_TIERS, TREASURE_TIERS, treasureConfig,
  type GeneratedPuzzle, type PuzzleConfig, type Step,
} from '../src/generator';
import { RECIPES, recipeById, type Recipe } from '../src/recipes';
import { applyDrop, contentCells, openChest, startSession, type LevelDefinition } from '../src/session';
import { describeAction, puzzleLabel, RecipeSign } from '../src/ui/App';
import { actionEffect } from '../src/ui/audioEvents';
import { Board as BoardView } from '../src/ui/Board';
import { initUi, reduceUi, type UiAction, type UiState } from '../src/ui/controller';
import { NO_MERGES_MESSAGE, NO_ROOM_MESSAGE, statusMessage } from '../src/ui/messages';
import { PlaySetup, switchMode } from '../src/ui/PlaySetup';

const WOODLAND = recipeById('woodland')!;
const SEEDS = [0, 1, 0xffffffff, ...Array.from({ length: 12 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0)];
const F: Record<string, Family> = { g: 'grove', s: 'song', c: 'crystal', e: 'elk' };
const p = (row: number, col: number): Pos => ({ row, col });
const make = (rows: string[]): Board => rows.map((r) => r.trim().split(/\s+/).map((c): Cell =>
  (c === '.' ? null : { family: F[c[0]], tier: Number(c[1]) as Tier })));
/** A Merge to treasure board: `goalTier` defaults to the contents' merge (tier 4 of 5). */
const level = (rows: string[], recipe: Recipe = WOODLAND, goalTier: Tier = 3): LevelDefinition => ({
  seed: 1, board: make(rows), supply: [], earlyLoss: false, recipe,
  goal: { kind: 'leaveOne', item: { family: recipe.contents.item.family, tier: goalTier } },
});
const code = (c: Cell) => (c ? `${c.family[0]}${c.tier}` : '.');
const rowsOf = (b: Board) => b.map((r) => r.map(code).join(' '));
const items = (b: Board) => b.flat().filter((c): c is Item => c !== null);
const drop = (from: Pos, to: Pos): UiAction => ({ type: 'drop', from, to });
const toAction = (step: Step, s: UiState): UiAction => ('action' in step ? { type: 'tap', pos: s.session.chest! } : drop(step.from, step.to));

describe('Merge to treasure: the recipe catalog', () => {
  it('is the four owner-chosen recipes: two tier-3 ingredients of different families, three tier-3 contents of a third', () => {
    const table = RECIPES.map((r) => [r.id, r.name, ...r.ingredients.map((i) => `${i.count} ${i.item.family}${i.item.tier}`),
      `${r.contents.count} ${r.contents.item.family}${r.contents.item.tier}`, r.container]);
    expect(table).toEqual([
      ['woodland', 'Woodland chest', '1 grove2', '1 crystal2', '3 elk2', 'chest'],
      ['songbird', 'Songbird chest', '1 grove2', '1 song2', '3 crystal2', 'chest'],
      ['crystal', 'Crystal chest', '1 crystal2', '1 elk2', '3 song2', 'chest'],
      ['grove', 'Grove chest', '1 song2', '1 elk2', '3 grove2', 'chest'],
    ]);
    for (const r of RECIPES) expect(r.ingredients.map((i) => i.item.family)).not.toContain(r.contents.item.family);
  });
});

describe('Merge to treasure: crafting by dropping one ingredient onto the other', () => {
  it('crafts in either drag direction, the chest standing at the destination, consuming only those two', () => {
    const start = startSession(level(['g2 c2 g2', 's1 g0 c0']));
    const a = applyDrop(start, p(0, 0), p(0, 1));
    expect([rowsOf(a.board), a.chest, a.moves]).toEqual([['. . g2', 's1 g0 c0'], p(0, 1), 1]);
    const b = applyDrop(start, p(0, 1), p(0, 0));
    expect([rowsOf(b.board), b.chest]).toEqual([['. . g2', 's1 g0 c0'], p(0, 0)]);
  });

  it('crafts by tap then tap, in either order, as one action with its own announcement and cue', () => {
    for (const [first, second] of [[p(0, 0), p(1, 1)], [p(1, 1), p(0, 0)]]) {
      const s = ([{ type: 'tap', pos: first }, { type: 'tap', pos: second }] as UiAction[]).reduce(reduceUi, initUi(level(['g2 .', 's0 c2'])));
      expect([s.session.chest, s.lastAction, s.actionSeq]).toEqual([second, { kind: 'craft' }, 1]);
      expect(actionEffect(s)).toBe('completion');
      expect(describeAction(s.lastAction, 'Puzzle', s.session.level.goal, undefined, undefined, WOODLAND))
        .toBe('Crafted the Woodland chest. Tap it to open it.');
    }
  });

  it("needs the exact ingredients of this board's recipe; any other drop keeps its ordinary meaning", () => {
    const swap = (rows: string[], from: Pos, to: Pos, recipe = WOODLAND) => {
      const s = applyDrop(startSession(level(rows, recipe)), from, to);
      return [rowsOf(s.board), s.chest];
    };
    expect(swap(['g1 c2'], p(0, 0), p(0, 1))).toEqual([['c2 g1'], null]);          // a tier too low
    expect(swap(['g3 c2'], p(0, 0), p(0, 1))).toEqual([['c2 g3'], null]);          // a tier too high
    expect(swap(['g2 s2'], p(0, 0), p(0, 1))).toEqual([['s2 g2'], null]);          // the Songbird chest's pair
    expect(swap(['g2 s2'], p(0, 0), p(0, 1), recipeById('songbird')!)).toEqual([['. .'], p(0, 1)]);
    expect(swap(['g2 c2 .'], p(0, 0), p(0, 2))).toEqual([['. c2 g2'], null]);       // a move
  });

  it('happens once: the chest takes no drops, and a second pair only swaps', () => {
    const s = applyDrop(startSession(level(['g2 c2', 'g2 c2'])), p(0, 0), p(0, 1));
    expect(applyDrop(s, p(1, 0), p(0, 1))).toBe(s);                                 // onto the chest: refused
    expect(rowsOf(applyDrop(s, p(1, 0), p(1, 1)).board)).toEqual(['. .', 'c2 g2']); // another pair: a swap
  });

  it('is undoable; Retry restores the exact start at every stage', () => {
    const def = level(['g2 c2 .', '. . .', '. . .']);
    const start = initUi(def);
    const crafted = reduceUi(start, drop(p(0, 0), p(0, 1)));
    const undone = reduceUi(crafted, { type: 'undo' });
    expect([undone.session.board, undone.session.chest, actionEffect(undone)]).toEqual([def.board, null, null]);
    const opened = reduceUi(crafted, { type: 'tap', pos: p(0, 1) });
    const merged = reduceUi(opened, drop(p(0, 0), p(0, 1)));
    expect(merged.lastAction?.kind).toBe('merge');
    for (const s of [crafted, opened, merged]) {
      const r = reduceUi(s, { type: 'retry' });
      expect([r.session, actionEffect(r)]).toEqual([startSession(def), null]);
    }
  });
});

describe('Merge to treasure: opening the chest', () => {
  it('fills the chest cell and the nearest empty cells (distance, then reading order), never overwriting a piece', () => {
    const s = applyDrop(startSession(level(['s0 g2 c2 .', '. s0 . .', '. . . .'])), p(0, 1), p(0, 2));
    // The consumed ingredient's cell (0,1) is empty again, and nearest in reading order.
    expect(contentCells(s)).toEqual([p(0, 2), p(0, 1), p(0, 3)]);
    const o = openChest(s);
    expect(rowsOf(o.board)).toEqual(['s0 e2 e2 e2', '. s0 . .', '. . . .']);
    expect([o.chest, o.opened, o.undo]).toEqual([null, true, null]);                 // a checkpoint
    expect(openChest(o)).toBe(o);                                                    // its contents come once
  });

  it('waits for room without losing anything, says why, and reports a dead end only when no merge can make room', () => {
    const roomy = initUi(level(['g2 c2 s0', 's0 s0 s1', 's1 s0 s1']));
    const tight = reduceUi(roomy, drop(p(0, 0), p(0, 1)));                         // one empty cell: not enough
    expect(contentCells(tight.session)).toBeNull();
    expect(reduceUi(tight, { type: 'tap', pos: p(0, 1) })).toBe(tight);             // no change, no sound
    expect([tight.status, statusMessage(tight, false)]).toEqual(['playing', 'The Woodland chest needs 2 empty cells to open. Merge items to make room.']);
    const room = reduceUi(tight, drop(p(1, 0), p(1, 1)));                           // a merge frees cells
    expect(contentCells(room.session)).not.toBeNull();
    const stuck = reduceUi(initUi(level(['g2 c2 s0', 's1 e0 s2', 'g1 s3 c1'])), drop(p(0, 0), p(0, 1)));
    expect([stuck.status, statusMessage(stuck, false)]).toEqual(['lost', NO_ROOM_MESSAGE]);
    expect(reduceUi(stuck, { type: 'undo' }).session.chest).toBeNull();              // Undo un-crafts
  });
});

describe('Merge to treasure: winning and stalling', () => {
  it('wins only with the single goal item left, after the last merge', () => {
    let s = initUi(level(['g2 c2 .', '. . .', '. . .']));
    s = reduceUi(s, drop(p(0, 0), p(0, 1)));
    expect(s.status).toBe('playing');
    s = reduceUi(s, { type: 'tap', pos: p(0, 1) });
    expect([s.status, actionEffect(s)]).toEqual(['playing', 'discovery']);
    s = reduceUi(s, drop(p(0, 0), p(0, 1)));                                        // contents at (0,1), (0,0), (0,2)
    expect([s.status, statusMessage(s, false)]).toEqual(['won', 'Goal complete! You made Elk, tier 4 of 5 with the Woodland chest.']);
    // A leftover piece blocks the win.
    let t = initUi(level(['g2 c2 g0', '. . .', '. . .']));
    t = reduceUi(reduceUi(t, drop(p(0, 0), p(0, 1))), { type: 'tap', pos: p(0, 1) });
    t = reduceUi(t, drop(p(0, 0), p(0, 1)));                                        // contents at (0,1), (0,0), (1,1)
    expect([items(t.session.board).length, t.status]).toEqual([2, 'lost']);
  });

  it('keeps playing while crafting is possible, even with no merges left', () => {
    const ready = initUi(level(['g2 s0 .', '. . c2']));
    expect([ready.status, statusMessage(ready, false)])
      .toEqual(['playing', 'Drop Grove, tier 3 of 5 onto Crystal, tier 3 of 5, or the other way round, to craft the Woodland chest. Only those two are used.']);
    const stuck = initUi(level(['g1 g0 .', '. . c2']));
    expect([stuck.status, statusMessage(stuck, false)]).toEqual(['lost', NO_MERGES_MESSAGE]);
  });
});

describe('Merge to treasure: generated puzzles', () => {
  const configs: PuzzleConfig[] = RECIPES.flatMap((r) => TREASURE_TIERS.map((t) => treasureConfig(r.id, t)));
  const all = configs.flatMap((c) => SEEDS.map((seed) => generatePuzzle(c, seed)));
  const reward = (pz: GeneratedPuzzle) => pz.definition.recipe!.contents.item.family;

  it('are won by their winning line through the controller: merges, one ingredient dropped onto the other, open, merges', () => {
    for (const pz of all) {
      let s = initUi(pz.definition);
      const kinds: string[] = [];
      pz.witness.forEach((step, i) => {
        const next = reduceUi(s, toAction(step, s));
        expect(next).not.toBe(s);
        s = next;
        kinds.push(s.lastAction!.kind);
        expect(s.status, pz.id).toBe(i === pz.witness.length - 1 ? 'won' : 'playing');
      });
      expect(kinds.filter((k) => k === 'craft' || k === 'open')).toEqual(['craft', 'open']);
      expect(items(s.session.board)).toEqual([{ family: reward(pz), tier: pz.config.tier }]);
    }
  });

  it("need the chest: tier 4 starts with no reward pieces; tier 5's supporting pieces can never reach tier 5 alone", () => {
    for (const pz of all) {
      const counts = [0, 0, 0, 0, 0];
      for (const it_ of items(pz.definition.board)) if (it_.family === reward(pz)) counts[it_.tier]++;
      expect(canReach(counts, pz.config.tier), pz.id).toBe(false);
      if (pz.config.tier === 3) expect(counts.every((n) => n === 0)).toBe(true);
      else expect(counts.some((n) => n > 0)).toBe(true);
      expect(pz.definition.board.length).toBeLessThanOrEqual(7);
    }
  });

  it('have IDs naming the version, recipe and goal tier, which reproduce them', () => {
    const pz = generatePuzzle(treasureConfig('songbird', 4), 12345);
    expect(pz.id).toBe('v3-treasure-songbird-t5-9ix');
    expect(parsePuzzleId(pz.id)).toEqual({ config: treasureConfig('songbird', 4), seed: 12345, version: 3 });
    expect(generatePuzzle(treasureConfig('songbird', 4), 12345)).toEqual(pz);
    expect(puzzleLabel(pz.config)).toBe('Merge to treasure · Tier 5 of 5 · Songbird chest');
    for (const id of ['v3-treasure-songbird-9ix', 'v3-treasure-songbird-t3-9ix', 'v3-treasure-songbird-t6-9ix', 'v3-treasure-meadow-t4-9ix',
      'v2-treasure-woodland-t4-9ix', 'v2-treasure-songbird-9ix', 'v1-treasure-woodland-9ix']) expect(parsePuzzleId(id), id).toBeNull();
    expect(isSupportedConfig({ ...treasureConfig('grove', 3), goals: 2 })).toBe(false);
  });

  // Recorded from the version-2 generator before crafting moved to the drop: their boards must not change.
  it.each([
    ['v2-treasure-woodland-1kpj5az', 'c0 c0 . g0 . . / . g0 c0 . . c0 / . . . g0 . . / g0 . c0 . . c0 / c0 . . g0 . . / g0 g0 c0 . . g0'],
    ['v2-treasure-woodland-tksv2k', 'g0 g0 . g0 . / . . . . c0 / . g0 c0 g0 c0 / g0 c0 g0 . g0 / . c1 c0 . .'],
  ])('version 2 ID %s keeps its board (now played with the drop to craft)', (id, board) => {
    const { config, seed, version } = parsePuzzleId(id)!;
    const pz = generatePuzzle(config, seed, version);
    expect([pz.id, pz.definition.board.map((r) => r.map(code).join(' ')).join(' / ')]).toEqual([id, board]);
    expect(pz.config).toEqual(treasureConfig('woodland', 3));
  });

  it('leave Merge to goals and Merge down to one as in version 2', () => {
    const configs2: PuzzleConfig[] = [
      ...TARGET_TIERS.flatMap((tier) => GOAL_COUNTS.map((goals): PuzzleConfig => ({ mode: 'goals', tier, goals }))),
      ...TARGET_TIERS.map((tier): PuzzleConfig => ({ mode: 'one', tier, goals: 1 })),
    ];
    for (const c of configs2) for (const seed of SEEDS.slice(0, 5)) {
      const [v2, v3] = [generatePuzzle(c, seed, 2), generatePuzzle(c, seed, 3)];
      expect(v3.definition).toEqual(v2.definition);
      expect(v3.id).toBe(v2.id.replace(/^v2/, 'v3'));
    }
  });
});

describe('Merge to treasure: the recipe sign, the chest and the Play screen', () => {
  it('shows the one recipe with exact tiers and counts, the chest, its contents and the goal; no Craft button', () => {
    const s = initUi(level(['g1 g1 g1', '. . c2'], WOODLAND, 4));
    const sign = renderToStaticMarkup(<RecipeSign recipe={WOODLAND} state={s} />);
    expect(sign).toContain('aria-label="1 × Grove, tier 3 of 5"');
    expect(sign).toContain('aria-label="1 × Crystal, tier 3 of 5, ready"');
    expect(sign).toContain('aria-label="Woodland chest"');
    expect(sign).toContain('aria-label="3 × Elk, tier 3 of 5 inside"');
    expect(sign).toContain('Goal: make Elk, tier 5 of 5');
    expect(sign).not.toContain('data-action="craft"');
    const crafted = reduceUi(initUi(level(['g2 c2 .'])), drop(p(0, 0), p(0, 1)));
    expect(renderToStaticMarkup(<BoardView state={crafted} dispatch={() => {}} />))
      .toContain('aria-label="Row 1, column 2: Woodland chest, closed, tap to open"');
  });

  it('switching to Merge to treasure from Tier 3 selects Tier 4; supported tiers and the goal count are kept', () => {
    const play = (c: PuzzleConfig) => renderToStaticMarkup(<PlaySetup config={c} onConfig={() => {}} onStart={() => {}}
      onHome={() => {}} musicControl={null} />);
    const selected = (html: string) => [...html.matchAll(/class="choice-option is-on"><input[^>]*name="tier"[^>]*><span>([^<]*)</g)].map((m) => m[1]);
    for (const from of [{ mode: 'goals', tier: 2, goals: 2 }, { mode: 'one', tier: 2, goals: 1 }] as PuzzleConfig[]) {
      const t = switchMode(from, 'treasure');
      expect(t).toEqual({ ...from, mode: 'treasure', tier: 3 });
      expect(selected(play(t))).toEqual(['Tier 4 of 5']);
    }
    for (const tier of [3, 4] as Tier[]) {
      expect(switchMode({ mode: 'goals', tier, goals: 3 }, 'treasure')).toEqual({ mode: 'treasure', tier, goals: 3 });
      expect(switchMode({ mode: 'treasure', tier, goals: 3 }, 'goals')).toEqual({ mode: 'goals', tier, goals: 3 });
      expect(switchMode({ mode: 'treasure', tier, goals: 1 }, 'one')).toEqual({ mode: 'one', tier, goals: 1 });
    }
  });

  it('offers tiers 4 and 5 for Merge to treasure, without a goal count', () => {
    const play = renderToStaticMarkup(<PlaySetup config={treasureConfig('woodland', 4)} onConfig={() => {}} onStart={() => {}}
      onHome={() => {}} musicControl={null} />);
    expect(play).toContain('Tier 4 of 5');
    expect(play).toContain('Tier 5 of 5');
    expect(play).not.toContain('Tier 3 of 5');
    expect(play).not.toContain('>Goals</legend>');
  });
});
