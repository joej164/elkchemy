import { describe, expect, it } from 'vitest';
import { CACHE_LEVEL, PALACE_LEVEL, LEVELS } from '../src/levels';
import { actionEffect, palaceOpeningPending } from '../src/ui/audioEvents';
import { canPickUp, initUi, reduceUi, type LastAction, type UiState } from '../src/ui/controller';

const withAction = (lastAction: LastAction, level = PALACE_LEVEL): UiState => ({ ...initUi(level), lastAction, actionSeq: 1 });
const merge: LastAction = { kind: 'merge', consumed: 3, input: { family: 'grove', tier: 0 },
  result: { family: 'grove', tier: 1 }, cells: [], outputs: [] };

describe('successful action effects', () => {
  it('uses the explicit victory > discovery > completion > merge priority', () => {
    expect(actionEffect(withAction(merge))).toBe('merge-three');
    expect(actionEffect(withAction({ ...merge, consumed: 5 }))).toBe('merge-five');
    expect(actionEffect(withAction({ ...merge, progress: { tasks: [0], regions: [1] } }))).toBe('completion');
    expect(actionEffect(withAction({ ...merge, progress: { tasks: [2], regions: [5] } }))).toBe('discovery');
    expect(actionEffect(withAction({ kind: 'collect' }))).toBe('case-victory');
  });
  it('handles older unlocks and discovery, branch tasks, simultaneous gates and case reveal once', () => {
    expect(actionEffect(withAction({ kind: 'unlock', region: 1 }, LEVELS[5].definition))).toBe('completion');
    expect(actionEffect(withAction({ kind: 'move', opened: 1 }, CACHE_LEVEL))).toBe('discovery');
    for (const progress of [{ tasks: [1], regions: [2, 3, 4] }, { tasks: [3], regions: [] },
      { tasks: [5], regions: [6] }, { tasks: [6], regions: [] }]) {
      expect(actionEffect(withAction({ kind: 'move', progress }))).toBe('completion');
    }
    expect(palaceOpeningPending(withAction({ kind: 'move', progress: { tasks: [5], regions: [6] } }))).toBe(true);
    expect(palaceOpeningPending(withAction({ kind: 'move', progress: { tasks: [3], regions: [] } }))).toBe(false);
  });
  it('startup, selection, failed drops, Undo and Retry produce no fresh event', () => {
    const start = initUi(PALACE_LEVEL);
    expect(actionEffect(start)).toBeNull();
    const selected = reduceUi(start, { type: 'tap', pos: { row: 7, col: 1 } });
    expect(selected.actionSeq).toBe(start.actionSeq);
    expect(actionEffect(selected)).toBeNull();
    const failed = reduceUi(selected, { type: 'drop', from: { row: 7, col: 1 }, to: { row: 0, col: 0 } });
    expect(failed.actionSeq).toBe(start.actionSeq);
    expect(actionEffect(failed)).toBeNull();
    expect(actionEffect(withAction({ kind: 'undo' }))).toBeNull();
    expect(actionEffect(reduceUi(start, { type: 'retry' }))).toBeNull();
    expect(actionEffect(withAction({ kind: 'move' }))).toBeNull();
  });
});

describe('room interaction music area', () => {
  const palaceItem = { row: 1, col: 2 };
  const woodlandItem = { row: 8, col: 3 };
  const ready = (): UiState => {
    const start = initUi(PALACE_LEVEL);
    return { ...start, session: { ...start.session, done: [0, 1, 2, 3, 4, 5] } };
  };
  it('starts in woodland and ignores the sealed palace', () => {
    const start = initUi(PALACE_LEVEL);
    expect(start.musicArea).toBe('woodland');
    expect(reduceUi(start, { type: 'tap', pos: palaceItem }).musicArea).toBe('woodland');
  });
  it('switches on playable selection and returns on woodland selection; clearing and Undo retain the room', () => {
    const selected = reduceUi(ready(), { type: 'tap', pos: palaceItem });
    expect(selected.musicArea).toBe('palace');
    const cleared = reduceUi(selected, { type: 'clearSelection' });
    expect(cleared.musicArea).toBe('palace');
    expect(reduceUi(cleared, { type: 'undo' }).musicArea).toBe('palace');
    expect(reduceUi(cleared, { type: 'tap', pos: woodlandItem }).musicArea).toBe('woodland');
    expect(reduceUi(cleared, { type: 'retry' }).musicArea).toBe('woodland');
  });
  it('lets a fixed woodland plate item choose its room without changing gameplay or replaying its last cue', () => {
    const base = ready();
    const board = base.session.board.map((row) => [...row]);
    const plate = PALACE_LEVEL.tasks![0].plates[0];
    board[plate.row][plate.col] = plate.item;
    board[7][2] = null;
    const inPalace: UiState = { ...base, musicArea: 'palace', selected: palaceItem,
      actionSeq: 17, lastAction: { kind: 'move', progress: { tasks: [5], regions: [6] } },
      session: { ...base.session, board } };
    expect(canPickUp(inPalace, plate)).toBe(false);
    const returned = reduceUi(inPalace, { type: 'tap', pos: plate });
    expect(returned.musicArea).toBe('woodland');
    expect(returned.selected).toBeNull();
    expect(returned.session).toBe(inPalace.session);
    expect(returned.actionSeq).toBe(inPalace.actionSeq);
    expect(returned.lastAction).toBe(inPalace.lastAction);
    const emptyTap = reduceUi({ ...inPalace, selected: null }, { type: 'tap', pos: { row: 7, col: 2 } });
    expect(emptyTap.musicArea).toBe('palace');
    expect(emptyTap.selected).toBeNull();
  });
  it('switches on accepted drag/drop without selection, and ignores failed drops', () => {
    const start = ready();
    const dropped = reduceUi(start, { type: 'drop', from: palaceItem, to: { row: 0, col: 1 } });
    expect(dropped.actionSeq).toBe(1);
    expect(dropped.musicArea).toBe('palace');
    const failed = reduceUi(dropped, { type: 'drop', from: woodlandItem, to: { row: 0, col: 0 } });
    expect(failed).toBe(dropped);
    const returned = reduceUi(dropped, { type: 'drop', from: woodlandItem, to: { row: 7, col: 2 } });
    expect(returned.musicArea).toBe('woodland');
  });
});
