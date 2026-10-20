import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Board, Cell, Family, Item, Pos, Tier } from '../src/board';
import { generatePuzzle, isSupportedConfig, parsePuzzleId, treasureConfig, type Step } from '../src/generator';
import { finalItem, RECIPES, type Recipe } from '../src/recipes';
import { applyDrop, contentCells, craft, craftReady, openChest, retry, startSession, undo, type LevelDefinition, type SessionState } from '../src/session';
import { evaluateStatus } from '../src/status';
import { describeAction, puzzleLabel, RecipeSign } from '../src/ui/App';
import { actionEffect } from '../src/ui/audioEvents';
import { Board as BoardView } from '../src/ui/Board';
import { canCraft, initUi, reduceUi, type UiAction, type UiState } from '../src/ui/controller';
import { NO_MERGES_MESSAGE, statusMessage } from '../src/ui/messages';
import { PlaySetup } from '../src/ui/PlaySetup';

const RECIPE = RECIPES[0];
const CONFIG = treasureConfig(RECIPE.id);
const SEEDS = [0, 1, 0xffffffff, ...Array.from({ length: 40 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0)];
const F: Record<string, Family> = { g: 'grove', s: 'song', c: 'crystal', e: 'elk' };
const p = (row: number, col: number): Pos => ({ row, col });
const make = (rows: string[]): Board => rows.map((r) => r.trim().split(/\s+/).map((c): Cell =>
  (c === '.' ? null : { family: F[c[0]], tier: Number(c[1]) as Tier })));
const level = (rows: string[], recipe: Recipe = RECIPE): LevelDefinition => ({
  seed: 1, board: make(rows), supply: [], goal: { kind: 'leaveOne', item: finalItem(recipe) }, earlyLoss: false, recipe,
});
const code = (c: Cell) => (c ? `${c.family[0]}${c.tier}` : '.');
const rowsOf = (b: Board) => b.map((r) => r.map(code).join(' '));
const items = (b: Board) => b.flat().filter((c): c is Item => c !== null);
const toAction = (step: Step, s: UiState): UiAction =>
  !('action' in step) ? { type: 'drop', from: step.from, to: step.to }
    : step.action === 'craft' ? { type: 'craft' } : { type: 'tap', pos: s.session.chest! };

describe('Merge to treasure: the recipe', () => {
  it('ships one recipe: two distinct ingredient families, a chest, and three identical contents of another family', () => {
    expect(RECIPES).toHaveLength(1);
    expect(RECIPE).toMatchObject({ id: 'woodland', name: 'Woodland chest', container: 'chest' });
    expect(RECIPE.id).toMatch(/^[a-z]+$/);
    const families = RECIPE.ingredients.map((i) => i.item.family);
    expect(new Set(families).size).toBe(2);
    expect(RECIPE.contents).toEqual({ item: { family: 'elk', tier: 2 }, count: 3 });
    expect(families).not.toContain(RECIPE.contents.item.family);
    expect(finalItem(RECIPE)).toEqual({ family: 'elk', tier: 3 });
  });
});

describe('Merge to treasure: crafting', () => {
  it('is ready only with every ingredient at its exact family and tier', () => {
    expect(craftReady(startSession(level(['g2 . .', '. . c2'])))).toBe(true);
    expect(craftReady(startSession(level(['g2 . .', '. . .'])))).toBe(false);          // an ingredient missing
    expect(craftReady(startSession(level(['g1 . .', '. . c2'])))).toBe(false);         // tier too low
    expect(craftReady(startSession(level(['g3 . .', '. . c2'])))).toBe(false);         // tier too high
    expect(craftReady(startSession(level(['s2 . .', '. . c2'])))).toBe(false);         // another family
    const missing = startSession(level(['g2 g0 .', '. . .']));
    expect(craft(missing)).toBe(missing);
  });

  it('consumes every piece of the ingredient families, spares too, and stands the chest where the first ingredient was', () => {
    const s0 = startSession(level(['g0 c2 s1', '. g2 c0', 'g2 . .']));
    const s1 = craft(s0);
    expect(rowsOf(s1.board)).toEqual(['. . s1', '. . .', '. . .']);     // other families stay
    expect(s1.chest).toEqual(p(1, 1));                                     // the first Grove, tier 3 in reading order
    expect([s1.opened, s1.moves]).toEqual([false, 1]);
    // The chest's cell takes no drop, and Craft cannot repeat.
    expect(applyDrop(s1, p(0, 2), p(1, 1))).toBe(s1);
    expect(craft(s1)).toBe(s1);
  });

  it('is undoable; Retry restores the original puzzle', () => {
    const s0 = startSession(level(['g2 . .', '. . c2']));
    const s1 = craft(s0);
    expect(s1.undo).not.toBeNull();
    const back = undo(s1);
    expect([rowsOf(back.board), back.chest, back.opened]).toEqual([rowsOf(s0.board), null, false]);
    expect(retry(openChest(s1))).toEqual(s0);
  });
});

describe('Merge to treasure: opening the chest', () => {
  it('puts the contents on the chest cell and the nearest empty cells, by distance then reading order, once', () => {
    const s1 = craft(startSession(level(['. . . .', '. g2 . .', '. . . c2', '. . . .'])));
    expect(s1.chest).toEqual(p(1, 1));
    expect(contentCells(s1)).toEqual([p(1, 1), p(0, 1), p(1, 0)]);
    const s2 = openChest(s1);
    expect(rowsOf(s2.board)).toEqual(['. e2 . .', 'e2 e2 . .', '. . . .', '. . . .']);
    expect([s2.chest, s2.opened, s2.undo]).toEqual([null, true, null]);     // a checkpoint: Undo is cleared
    expect(openChest(s2)).toBe(s2);                                          // never again, so never duplicated
    expect(items(s2.board)).toHaveLength(3);
  });

  it('never opens without room for every item, and loses nothing', () => {
    // Only possible with other items on the board; generated puzzles have none, so their chest always has room.
    const full = craft(startSession(level(['g2 s0', 's1 c2'])));
    const crowded: SessionState = { ...full, board: make(['. s0', 's1 s2']) };
    expect(contentCells(crowded)).toBeNull();
    expect(openChest(crowded)).toBe(crowded);
    expect(evaluateStatus(crowded)).toBe('playing');
  });
});

describe('Merge to treasure: status by stage', () => {
  it('wins only on the final merge; crafting and opening keep the game going', () => {
    let s = initUi(level(['g2 . .', '. . c2', '. . .']));
    s = reduceUi(s, { type: 'craft' });
    expect([s.status, s.lastAction?.kind]).toEqual(['playing', 'craft']);
    s = reduceUi(s, { type: 'tap', pos: s.session.chest! });
    expect([s.status, s.lastAction?.kind]).toEqual(['playing', 'open']);
    s = reduceUi(s, { type: 'drop', from: p(0, 1), to: p(0, 0) });
    expect(s.status).toBe('won');
    expect(statusMessage(s, false)).toBe('Goal complete! You made Elk, tier 4 of 5 from the Woodland chest.');
  });

  it('is not stuck while the recipe can be crafted or a closed chest waits, and is once nothing can happen', () => {
    const ready = initUi(level(['g2 s0 .', '. . c2']));            // no merge left, but Craft is ready
    expect([ready.status, canCraft(ready)]).toEqual(['playing', true]);
    const crafted = reduceUi(ready, { type: 'craft' });             // nothing on the board but the chest and s0
    expect(crafted.status).toBe('playing');
    const stuck = initUi(level(['g1 g0 .', '. . c2']));
    expect([stuck.status, statusMessage(stuck, false)]).toEqual(['lost', NO_MERGES_MESSAGE]);
    // Undo after a fatal move, as in the other modes.
    expect(initUi(level(['g1 g1 g1', '. . c2'])).status).toBe('playing');
  });

  it('tells the player each stage in the banner', () => {
    let s = initUi(level(['g1 g1 g1', '. . c2', '. . .']));
    expect(statusMessage(s, false)).toBe('Merge pieces into Grove, tier 3 of 5 and Crystal, tier 3 of 5, then craft the Woodland chest.');
    s = reduceUi(s, { type: 'drop', from: p(0, 0), to: p(0, 1) });
    expect(statusMessage(s, false)).toBe('Ready: press Craft chest. It uses up every Grove and Crystal piece.');
    s = reduceUi(s, { type: 'craft' });
    expect(statusMessage(s, false)).toBe('Tap the Woodland chest to open it.');
    s = reduceUi(s, { type: 'tap', pos: s.session.chest! });
    expect(statusMessage(s, false)).toBe('Merge the three Elk, tier 3 of 5 into Elk, tier 4 of 5.');
  });
});

describe('Merge to treasure: generated puzzles', () => {
  const puzzles = SEEDS.map((seed) => generatePuzzle(CONFIG, seed));

  it('use only the ingredient families, below their tiers, on boards with room', () => {
    for (const pz of puzzles) {
      const { board, supply, earlyLoss, recipe } = pz.definition;
      expect([supply, earlyLoss, recipe]).toEqual([[], false, RECIPE]);
      expect(board.length).toBeGreaterThanOrEqual(4);
      expect(board.length).toBeLessThanOrEqual(6);
      for (const it_ of items(board)) {
        const ing = RECIPE.ingredients.find((i) => i.item.family === it_.family)!;
        expect(it_.tier).toBeLessThan(ing.item.tier);
      }
    }
  });

  it('are won by their winning line through the controller: merges to exactly the ingredients, craft, open, final merge', () => {
    for (const pz of puzzles) {
      let s = initUi(pz.definition);
      pz.witness.forEach((step, i) => {
        if ('action' in step && step.action === 'craft') {
          // Exactly the ingredients are left: crafting consumes only them.
          expect(items(s.session.board).map(code).sort()).toEqual(RECIPE.ingredients.map((r) => code(r.item)).sort());
        }
        const next = reduceUi(s, toAction(step, s));
        expect(next).not.toBe(s);
        s = next;
        expect(s.status).toBe(i === pz.witness.length - 1 ? 'won' : 'playing');
      });
      expect(items(s.session.board)).toEqual([finalItem(RECIPE)]);
      expect(pz.witness.filter((st) => 'action' in st)).toEqual([{ action: 'craft' }, { action: 'open' }]);
    }
  });

  it('Undo after crafting un-crafts; Retry at any stage restores the original puzzle', () => {
    const pz = puzzles[0];
    const start = initUi(pz.definition);
    let s = start;
    const at = pz.witness.findIndex((st) => 'action' in st);
    for (const step of pz.witness.slice(0, at)) s = reduceUi(s, toAction(step, s));
    const crafted = reduceUi(s, { type: 'craft' });
    expect(reduceUi(crafted, { type: 'undo' }).session.board).toEqual(s.session.board);
    const opened = reduceUi(crafted, { type: 'tap', pos: crafted.session.chest! });
    expect(reduceUi(opened, { type: 'undo' })).toBe(opened);          // nothing to undo after the checkpoint
    for (const state of [crafted, opened]) expect(reduceUi(state, { type: 'retry' }).session).toEqual(start.session);
  });

  it('are deterministic, with IDs naming the recipe', () => {
    const pz = puzzles[3];
    expect(pz.id).toBe(`v2-treasure-woodland-${pz.seed.toString(36)}`);
    expect(generatePuzzle(CONFIG, pz.seed)).toEqual(pz);
    expect(parsePuzzleId(pz.id)).toEqual({ config: CONFIG, seed: pz.seed, version: 2 });
    expect(parsePuzzleId(' V2-TREASURE-WOODLAND-ABC ')).toEqual({ config: CONFIG, seed: parseInt('abc', 36), version: 2 });
    for (const id of ['v1-treasure-woodland-abc', 'v2-treasure-meadow-abc', 'v2-treasure-abc', 'v2-treasure-woodland-g1-abc']) {
      expect(parsePuzzleId(id), id).toBeNull();
    }
    expect(isSupportedConfig({ ...CONFIG, tier: 2 })).toBe(false);
    expect(isSupportedConfig({ mode: 'goals', tier: 2, goals: 1, recipe: 'woodland' })).toBe(false);
    expect(puzzleLabel(CONFIG)).toBe('Merge to treasure · Woodland chest');
  });
});

describe('Merge to treasure: sounds, announcements and drawing', () => {
  it('plays one cue per step, never the victory cue, and none on Undo or Retry', () => {
    let s = initUi(level(['g1 g1 g1', '. . c2', '. . .']));
    s = reduceUi(s, { type: 'drop', from: p(0, 0), to: p(0, 1) });
    expect(actionEffect(s)).toBe('merge-three');
    s = reduceUi(s, { type: 'craft' });
    expect(actionEffect(s)).toBe('completion');
    expect(actionEffect(reduceUi(s, { type: 'undo' }))).toBeNull();
    s = reduceUi(s, { type: 'tap', pos: s.session.chest! });
    expect(actionEffect(s)).toBe('discovery');
    expect(actionEffect(reduceUi(s, { type: 'retry' }))).toBeNull();
    const say = (st: UiState) => describeAction(st.lastAction, 'Puzzle', st.session.level.goal, undefined, undefined, RECIPE);
    expect(say(s)).toBe('Opened the Woodland chest: three Elk, tier 3 of 5.');
  });

  it('shows the recipe sign with counts, the chest and its contents, and Craft only when ready', () => {
    const sign = (st: UiState) => renderToStaticMarkup(<RecipeSign recipe={RECIPE} state={st} onCraft={() => {}} />);
    const early = sign(initUi(level(['g1 g1 g1', '. . c2'])));
    expect(early).toContain('aria-label="1 × Grove, tier 3 of 5"');
    expect(early).toContain('aria-label="1 × Crystal, tier 3 of 5, ready"');
    expect(early).toContain('aria-label="Woodland chest"');
    expect(early).toContain('aria-label="3 × Elk, tier 3 of 5 inside"');
    expect(early).toContain('Goal: make Elk, tier 4 of 5');
    expect(early).toMatch(/<button[^>]*data-action="craft"[^>]*disabled=""/);
    const ready = sign(initUi(level(['g2 . .', '. . c2'])));
    expect(ready).not.toMatch(/<button[^>]*data-action="craft"[^>]*disabled/);
    const chest = reduceUi(initUi(level(['g2 . .', '. . c2'])), { type: 'craft' });
    const board = renderToStaticMarkup(<BoardView state={chest} dispatch={() => {}} />);
    expect(board).toContain('aria-label="Row 1, column 1: Woodland chest, closed, tap to open"');
    expect(board).toContain('data-chest');
  });

  it('offers the mode on the Play screen without a tier or goal choice', () => {
    const play = renderToStaticMarkup(<PlaySetup config={CONFIG} onConfig={() => {}} onStart={() => {}} onHome={() => {}} musicControl={null} />);
    expect(play).toContain('Merge to treasure');
    expect(play).not.toContain('Target tier');
    expect(play).not.toContain('>Goals</legend>');
  });
});

