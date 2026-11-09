import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generatePuzzle, parsePuzzleId, type GeneratedPuzzle } from '../src/generator';
import { applyDrop, openChest, startSession } from '../src/session';
import { evaluateStatus } from '../src/status';
import { Game } from '../src/ui/App';
import { initUi } from '../src/ui/controller';
import { statusMessage } from '../src/ui/messages';
import { loadPuzzle, PlaySetup } from '../src/ui/PlaySetup';

const loaded = (code: string): GeneratedPuzzle => {
  const r = loadPuzzle(code);
  if (!('puzzle' in r)) throw new Error(r.error);
  return r.puzzle;
};

/** The puzzle's own winning line, played through the real rules. */
function playWitness(p: GeneratedPuzzle) {
  let s = startSession(p.definition);
  for (const step of p.witness) s = 'action' in step ? openChest(s) : applyDrop(s, step.from, step.to);
  return s;
}

describe('Load puzzle code', () => {
  afterEach(() => { vi.doUnmock('../src/generator'); vi.resetModules(); });

  it('reopens the exact starting puzzle of current and older codes, by the version each names', () => {
    for (const code of [
      'v4-goals-t5-g2-1nk1q8e', 'v4-one-t4-9ix', 'v4-treasure-songbird-t5-9ix', 'v3-treasure-crystal-t4-3k1',
      'v2-treasure-woodland-3k1', 'v2-goals-t3-g3-abc', 'v1-one-t3-5f2a0', 'v1-goals-t4-g1-z7hukc',
    ]) {
      const { config, seed, version } = parsePuzzleId(code)!;
      const p = loaded(code);
      expect(p.id).toBe(code);
      expect(p.definition).toEqual(generatePuzzle(config, seed, version).definition);
      // A start: no move has been made.
      expect(startSession(p.definition).moves).toBe(0);
      expect(evaluateStatus(playWitness(p))).toBe('won');
    }
  });

  it('ignores surrounding whitespace and letter case', () => {
    expect(loaded('  V4-Goals-T5-G2-1NK1Q8E \n').id).toBe('v4-goals-t5-g2-1nk1q8e');
    expect(loaded('\tv1-one-t3-5f2a0 ').definition).toEqual(loaded('v1-one-t3-5f2a0').definition);
  });

  it('explains empty, malformed and unsupported codes', () => {
    expect(loadPuzzle('   ')).toEqual({ error: 'Type or paste a puzzle code first.' });
    const bad = "That isn't a puzzle code this game can load. Check it and try again.";
    for (const code of ['hello', 'v4-goals-t5-1nk1q8e', 'v4-one-t5-g2-abc', 'v1-goals-t5-g1-abc', 'v1-treasure-woodland-abc',
      'v3-treasure-woodland-abc', 'v4-treasure-nope-t4-abc', 'v4-goals-t9-g1-abc', 'v4-goals-t3-g4-abc', 'v4 goals t3 g1 abc']) {
      expect(loadPuzzle(code), code).toEqual({ error: bad });
    }
    expect(loadPuzzle('v9-goals-t3-g1-abc')).toEqual({
      error: "That code is from a version of the puzzle maker this game can't load (v9).",
    });
  });

  it('reports a generation failure instead of a puzzle', async () => {
    vi.resetModules();
    vi.doMock('../src/generator', async (original) => ({
      ...(await original<typeof import('../src/generator')>()),
      generatePuzzle: () => { throw new Error('No verified puzzle found'); },
    }));
    const { loadPuzzle: load } = await import('../src/ui/PlaySetup');
    expect(load('v4-goals-t3-g1-abc')).toEqual({ error: "Couldn't rebuild that puzzle. Check the code and try again." });
  });

  it('offers a labelled field and Load on the Play menu, with any error announced beside it', () => {
    const props = { config: { mode: 'goals', tier: 3, goals: 1 } as const, onConfig: () => {}, onStart: () => {}, onHome: () => {}, musicControl: null };
    const without = renderToStaticMarkup(<PlaySetup {...props} />);
    expect(without).not.toContain('data-load-code');
    const html = renderToStaticMarkup(<PlaySetup {...props} onLoad={() => {}} />);
    const id = /<label for="([^"]+)">Puzzle code<\/label>/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain('data-action="load-puzzle"');
    expect(html).not.toContain('aria-invalid');
    expect(html).not.toContain('role="alert"');
    const failed = renderToStaticMarkup(<PlaySetup {...props} onLoad={() => {}} loadError="That isn't a puzzle code this game can load." />);
    expect(failed).toContain('aria-invalid="true"');
    expect(failed).toMatch(/<p id="[^"]+-error" class="menu-error" role="alert">That isn&#x27;t a puzzle code this game can load\.<\/p>/);
  });
});

// Owner report (October 28, 2026): winning seemed to need two Elk and one Crystal at tier 5 of 5, with Elk pieces for only
// one. The code's puzzle asks for one of each; these checks pin what the game shows and accepts for it.
describe('reported puzzle v4-goals-t5-g2-1nk1q8e', () => {
  const p = loaded('v4-goals-t5-g2-1nk1q8e');

  it('has two goals, one Crystal and one Elk at tier 5 of 5, and Elk pieces for exactly one', () => {
    expect(p.config).toEqual({ mode: 'goals', tier: 4, goals: 2 });
    expect(p.definition.goal).toEqual({ kind: 'items', items: [{ family: 'crystal', tier: 4 }, { family: 'elk', tier: 4 }] });
    const counts = (family: string) => [0, 1, 2, 3, 4].map((t) => p.definition.board.flat().filter((c) => c?.family === family && c.tier === t).length);
    expect(counts('elk')).toEqual([9, 1, 8, 0, 0]);
    expect(counts('crystal')).toEqual([0, 8, 2, 1, 0]);
    expect(p.definition.board.flat().every((c) => !c || c.family === 'elk' || c.family === 'crystal')).toBe(true);
  });

  it('shows those two goals, and its ID, in the game', () => {
    const html = renderToStaticMarkup(<Game definition={p.definition} label="Merge to goals" musicControl={null} onHome={() => {}}
      puzzleId={p.id} onNewPuzzle={() => {}} />);
    const targets = [...html.matchAll(/class="art target[^"]*" role="img" aria-label="([^"]+)"/g)].map((m) => m[1]);
    expect(targets).toEqual(['Crystal, tier 5 of 5: not yet', 'Elk, tier 5 of 5: not yet']);
    expect(html).toContain('Goal: make both');
    expect(html).toContain(`value="${p.id}"`);
  });

  it('wins once one Crystal and one Elk at tier 5 are on the board', () => {
    const won = playWitness(p);
    expect(evaluateStatus(won)).toBe('won');
    const top = won.board.flat().filter((c) => c?.tier === 4);
    expect(top.map((c) => c!.family).sort()).toEqual(['crystal', 'elk']);
    expect(statusMessage({ ...initUi(p.definition), session: won, status: 'won' })).toBe('Goal complete! You made both.');
  });
});
