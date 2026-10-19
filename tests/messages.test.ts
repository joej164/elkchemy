import { describe, expect, it } from 'vitest';
import type { Item } from '../src/board';
import { LEVELS } from '../src/levels';
import type { LevelDefinition } from '../src/session';
import { initUi, type UiState } from '../src/ui/controller';
import { helpObjective, itemCount, objectiveText, playingMessage, statusMessage } from '../src/ui/messages';

const GROVE = LEVELS[0].definition;
const LEAVE = LEVELS[2].definition;
const CRYSTAL = LEVELS[3].definition;
const FARAWAY = LEVELS[4].definition;

const withStatus = (level: LevelDefinition, status: UiState['status']): UiState => ({ ...initUi(level), status });

describe('objective text', () => {
  it('describes item and leaveOne goals', () => {
    expect(objectiveText(GROVE.goal)).toBe('Goal: make Grove, tier 3 of 4');
    expect(helpObjective(GROVE.goal)).toBe('Goal: make Grove, tier 3 of 4.');
    expect(objectiveText(LEAVE.goal)).toBe('Goal: use all supply and leave exactly one item');
    expect(helpObjective(LEAVE.goal)).toBe('Goal: use all supply and finish with exactly one item on the board.');
  });

  it('describes items goals', () => {
    expect(objectiveText(FARAWAY.goal)).toBe('Goal: make all four');
    expect(helpObjective(FARAWAY.goal)).toBe('Goal: have all four goal items on the board at once.');
  });

  it('counts items on the board', () => {
    expect(itemCount(initUi(LEAVE))).toBe(8);
  });
});

describe('status messages', () => {
  it('playing', () => {
    expect(statusMessage(initUi(CRYSTAL))).toBe(
      'Merge items to make Crystal, tier 4 of 4. Add supply when you need more.');
    expect(playingMessage(LEAVE.goal)).toBe('Merge everything down to one item. All supply must be placed.');
    expect(statusMessage(initUi(LEAVE))).toBe(playingMessage(LEAVE.goal));
  });

  it('won', () => {
    expect(statusMessage(withStatus(GROVE, 'won'))).toBe('Goal complete! You made Grove, tier 3 of 4.');
    const last: Item = { family: 'elk', tier: 3 };
    const state = withStatus(LEAVE, 'won');
    const board = state.session.board.map((r) => r.map(() => null));
    board[1][1] = last as never;
    expect(statusMessage({ ...state, session: { ...state.session, board } })).toBe(
      'Goal complete! Only Elk, tier 4 of 4 remains.');
  });

  it('lost', () => {
    expect(statusMessage(withStatus(CRYSTAL, 'lost'))).toBe(
      'The goal is out of reach with the Crystal items left. Undo or retry.');
    expect(statusMessage(withStatus(LEAVE, 'lost'))).toBe(
      'You can no longer finish with exactly one item. Undo or retry.');
  });

  it('items goal: large-board banner, won and lost', () => {
    expect(statusMessage(initUi(FARAWAY))).toBe(
      'Drag empty ground to pan. For far moves, tap an item, pan, then tap where it goes.');
    expect(playingMessage(FARAWAY.goal)).toBe('Merge items to make all four. Add supply when you need more.');
    expect(statusMessage(withStatus(FARAWAY, 'won'))).toBe('Goal complete! You made all four.');
    expect(statusMessage(withStatus(FARAWAY, 'lost'))).toBe('A goal item can no longer be made. Undo or retry.');
  });

  it('small boards keep the objective banner', () => {
    expect(statusMessage(initUi(GROVE))).not.toMatch(/pan/);
  });

  it('never hardcodes Grove for other families', () => {
    for (const status of ['playing', 'won', 'lost'] as const) {
      expect(statusMessage(withStatus(LEVELS[1].definition, status))).not.toMatch(/grove/i);
      expect(statusMessage(withStatus(CRYSTAL, status))).not.toMatch(/grove/i);
    }
  });
});

describe('generated puzzle messages', () => {
  const target: Item = { family: 'crystal', tier: 3 };
  const c2: Item = { family: 'crystal', tier: 2 };
  const one: LevelDefinition = { seed: 1, board: [[c2, c2, c2, null]], supply: [], goal: { kind: 'leaveOne', item: target }, earlyLoss: false };
  const two: LevelDefinition = {
    ...one, goal: { kind: 'items', items: [target, { family: 'song', tier: 3 }] },
  };

  it('merge down to one names its target', () => {
    expect(objectiveText(one.goal)).toBe('Goal: merge down to one Crystal, tier 4 of 4');
    expect(helpObjective(one.goal)).toBe('Goal: merge everything down to exactly one item: Crystal, tier 4 of 4.');
    expect(playingMessage(one.goal, false)).toBe('Merge everything down to one Crystal, tier 4 of 4.');
    expect(statusMessage(withStatus({ ...one, board: [[target, null]] }, 'won'))).toBe('Goal complete! Only Crystal, tier 4 of 4 remains.');
  });

  it('never mention supply when there is none', () => {
    expect(statusMessage(initUi({ ...one, goal: { kind: 'item', item: target } }))).toBe('Merge items to make Crystal, tier 4 of 4.');
    expect(statusMessage(initUi(two))).toBe('Merge items to make both.');
  });

  it('say both for two goals', () => {
    expect(objectiveText(two.goal)).toBe('Goal: make both');
    expect(helpObjective(two.goal)).toBe('Goal: have both goal items on the board at once.');
    expect(statusMessage(withStatus(two, 'won'))).toBe('Goal complete! You made both.');
  });

  it('show the pan hint whenever the board is measured as overflowing', () => {
    const big = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (__, c) => (r === 0 && c < 3 ? c2 : null)));
    expect(statusMessage(initUi({ ...two, board: big }))).not.toMatch(/pan/); // unmeasured guess
    expect(statusMessage(initUi({ ...two, board: big }), true)).toBe(
      'Drag empty ground to pan. For far moves, tap an item, pan, then tap where it goes.');
    expect(statusMessage(initUi(FARAWAY), false)).toBe(playingMessage(FARAWAY.goal));
    expect(statusMessage(withStatus({ ...two, board: big }, 'won'), true)).toBe('Goal complete! You made both.');
  });

  it('say no merges are left, in the owner-approved words, when a generated puzzle is stuck', () => {
    const stuck = initUi({ ...two, board: [[c2, c2, null, null]] });
    expect(stuck.status).toBe('lost');
    expect(statusMessage(stuck)).toBe('No merges left\u2014Undo, Retry, or New Puzzle.');
    expect(statusMessage(stuck, true)).toBe('No merges left\u2014Undo, Retry, or New Puzzle.');
    // Handcrafted levels keep their own loss messages.
    expect(statusMessage(withStatus(CRYSTAL, 'lost'))).not.toMatch(/No merges left/);
  });
});
