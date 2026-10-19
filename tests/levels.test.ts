import { describe, it, expect } from 'vitest';
import type { Pos } from '../src/board';
import { previewMerge, type Board } from '../src/board';
import {
  CACHE_LEVEL, CRYSTAL_LEVEL, FARAWAY_LEVEL, HOLLOW_LEVEL, INTRO_LEVEL, LEAVE_ONE_LEVEL, LEVELS, PALACE_LEVEL, RUNE_LEVEL, SONG_LEVEL,
  nextLevelIndex,
} from '../src/levels';
import { EIGHT_GROVE_LEVEL } from './fixtures';
import {
  applyDrop, chooseSupplyCell, placeSupply, placeSupplyRandom, retry, startSession, undo, type LevelDefinition, type SessionState,
} from '../src/session';
import { evaluateStatus, hasItem, type GameStatus } from '../src/status';

const p = (row: number, col: number): Pos => ({ row, col });

type Step =
  | { kind: 'drop'; from: Pos; to: Pos }
  | { kind: 'place'; at: Pos };

const WIN: { step: Step; status: GameStatus }[] = [
  { step: { kind: 'place', at: p(1, 0) }, status: 'playing' },               // 4-cluster
  { step: { kind: 'drop', from: p(3, 3), to: p(0, 0) }, status: 'playing' }, // 5 -> 2 grove-1
  { step: { kind: 'place', at: p(2, 2) }, status: 'playing' },
  { step: { kind: 'place', at: p(1, 3) }, status: 'playing' },
  { step: { kind: 'drop', from: p(1, 3), to: p(2, 3) }, status: 'playing' }, // 3 -> 1 grove-1
  { step: { kind: 'drop', from: p(0, 0), to: p(2, 3) }, status: 'won' },     // 3 grove-1 -> grove-2
];

const LOSE: { step: Step; status: GameStatus }[] = [
  { step: { kind: 'drop', from: p(0, 0), to: p(1, 1) }, status: 'playing' }, // early 3-merge
  { step: { kind: 'place', at: p(2, 2) }, status: 'playing' },
  { step: { kind: 'drop', from: p(2, 2), to: p(2, 3) }, status: 'lost' },    // second 3-merge wastes items
];

function run(seq: { step: Step; status: GameStatus }[]): SessionState[] {
  const states = [startSession(EIGHT_GROVE_LEVEL)];
  for (const { step, status } of seq) {
    const prev = states[states.length - 1];
    const next = step.kind === 'drop' ? applyDrop(prev, step.from, step.to) : placeSupply(prev, step.at);
    expect(next).not.toBe(prev);
    expect(evaluateStatus(next)).toBe(status);
    states.push(next);
  }
  return states;
}

const fields = (s: SessionState) => ({
  board: s.board, supplyIndex: s.supplyIndex, rngState: s.rngState, moves: s.moves,
});

describe('EIGHT_GROVE_LEVEL constraints', () => {
  const boardItems = EIGHT_GROVE_LEVEL.board.flat().filter((c) => c !== null);
  const all = [...boardItems, ...EIGHT_GROVE_LEVEL.supply];
  const isG0 = (i: { family: string; tier: number }) => i.family === 'grove' && i.tier === 0;

  it('is 4x4 with goal grove tier 2', () => {
    expect(EIGHT_GROVE_LEVEL.board).toHaveLength(4);
    EIGHT_GROVE_LEVEL.board.forEach((r) => expect(r).toHaveLength(4));
    expect(EIGHT_GROVE_LEVEL.goal).toEqual({ kind: 'item', item: { family: 'grove', tier: 2 } });
  });
  it('has exactly 8 grove-0 (5 board, 3 supply) and no other grove items', () => {
    expect(all.filter(isG0)).toHaveLength(8);
    expect(boardItems.filter(isG0)).toHaveLength(5);
    expect(EIGHT_GROVE_LEVEL.supply.filter(isG0)).toHaveLength(3);
    expect(all.filter((i) => i.family === 'grove')).toHaveLength(8);
  });
  it('has distinct non-grove items, at least one', () => {
    const others = all.filter((i) => i.family !== 'grove').map((i) => `${i.family}${i.tier}`);
    expect(others.length).toBeGreaterThanOrEqual(1);
    expect(new Set(others).size).toBe(others.length);
  });
  it('has fewer than 16 initial items plus supply', () => {
    expect(all.length).toBeLessThan(16);
  });
  it('starts playing and needs the supply', () => {
    expect(evaluateStatus(startSession(EIGHT_GROVE_LEVEL))).toBe('playing');
    expect(evaluateStatus(startSession({ ...EIGHT_GROVE_LEVEL, supply: [] }))).toBe('lost');
  });
});

describe('EIGHT_GROVE_LEVEL winning sequence', () => {
  it('reaches won with a grove-2 on the board', () => {
    const states = run(WIN);
    const last = states[states.length - 1];
    expect(last.board.flat().some((c) => c?.family === 'grove' && c.tier === 2)).toBe(true);
  });
});

describe('EIGHT_GROVE_LEVEL losing sequence', () => {
  it('is lost with supply remaining', () => {
    const states = run(LOSE);
    const last = states[states.length - 1];
    expect(last.supplyIndex).toBeLessThan(last.level.supply.length);
  });
  it('undo restores the pre-move state and playing', () => {
    const states = run(LOSE);
    const restored = undo(states[3]);
    expect(fields(restored)).toEqual(fields(states[2]));
    expect(evaluateStatus(restored)).toBe('playing');
  });
  it('retry returns to the start', () => {
    const states = run(LOSE);
    const again = retry(states[3]);
    expect(again).toEqual(startSession(EIGHT_GROVE_LEVEL));
    expect(evaluateStatus(again)).toBe('playing');
  });
});

describe('INTRO_LEVEL constraints', () => {
  const boardItems = INTRO_LEVEL.board.flat().filter((c) => c !== null);
  const all = [...boardItems, ...INTRO_LEVEL.supply];
  const isG0 = (i: { family: string; tier: number }) => i.family === 'grove' && i.tier === 0;

  it('is 4x4 with goal grove tier 2', () => {
    expect(INTRO_LEVEL.board).toHaveLength(4);
    INTRO_LEVEL.board.forEach((r) => expect(r).toHaveLength(4));
    expect(INTRO_LEVEL.goal).toEqual({ kind: 'item', item: { family: 'grove', tier: 2 } });
    expect(Number.isInteger(INTRO_LEVEL.seed)).toBe(true);
  });
  it('has exactly 9 grove-0 (6 board, 3 supply) and no other grove items', () => {
    expect(all.filter(isG0)).toHaveLength(9);
    expect(boardItems.filter(isG0)).toHaveLength(6);
    expect(INTRO_LEVEL.supply.filter(isG0)).toHaveLength(3);
    expect(all.filter((i) => i.family === 'grove')).toHaveLength(9);
  });
  it('has distinct non-grove items, at least one', () => {
    const others = all.filter((i) => i.family !== 'grove').map((i) => `${i.family}${i.tier}`);
    expect(others.length).toBeGreaterThanOrEqual(1);
    expect(new Set(others).size).toBe(others.length);
  });
  it('has fewer than 16 initial items plus supply', () => {
    expect(all.length).toBeLessThan(16);
  });
  it('starts playing; the board alone would be lost, so supply matters', () => {
    expect(evaluateStatus(startSession(INTRO_LEVEL))).toBe('playing');
    expect(evaluateStatus(startSession({ ...INTRO_LEVEL, supply: [] }))).toBe('lost');
  });
  it('has an immediate 3-merge', () => {
    expect(previewMerge(INTRO_LEVEL.board, p(2, 1), p(0, 0))).toHaveLength(3);
  });
});

const firstEmpty = (board: Board): Pos => {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) if (board[row][col] === null) return p(row, col);
  }
  throw new Error('full');
};

// Random placements ({ place: at }) land where INTRO_LEVEL's seed sends them.
type RandomStep = { place: Pos } | { from: Pos; to: Pos };
const RANDOM_WIN: RandomStep[] = [
  { place: p(1, 2) },
  { place: p(1, 1) },
  { from: p(0, 0), to: p(2, 3) },           // 3 -> grove-1
  { from: p(1, 1), to: p(2, 1) },           // 3 -> grove-1
  { place: p(2, 2) },
  { from: p(0, 1), to: p(2, 2) },           // 3 -> grove-1
  { from: p(2, 1), to: p(2, 2) },           // 3 grove-1 -> goal
];

function runRandom(seq: RandomStep[], stopBefore = seq.length): SessionState {
  let s = startSession(INTRO_LEVEL);
  seq.slice(0, stopBefore).forEach((step, i) => {
    let next: SessionState;
    if ('place' in step) {
      next = placeSupplyRandom(s);
      expect(next.board[step.place.row][step.place.col]).toEqual(INTRO_LEVEL.supply[s.supplyIndex]);
      expect(s.board[step.place.row][step.place.col]).toBeNull();
    } else {
      expect(previewMerge(s.board, step.from, step.to)).toHaveLength(3);
      next = applyDrop(s, step.from, step.to);
    }
    expect(next).not.toBe(s);
    expect(evaluateStatus(next)).toBe(i === seq.length - 1 ? 'won' : 'playing');
    s = next;
  });
  return s;
}

describe('INTRO_LEVEL winning sequence', () => {
  it('wins with only 3-merges and seeded random placement', () => {
    const won = runRandom(RANDOM_WIN);
    expect(evaluateStatus(won)).toBe('won');
    expect(won.board.flat().some((c) => c?.family === 'grove' && c.tier === 2)).toBe(true);
    expect(won.supplyIndex).toBe(3);
  });
  it('is still playing one step before the end', () => {
    expect(evaluateStatus(runRandom(RANDOM_WIN, RANDOM_WIN.length - 1))).toBe('playing');
  });
});

describe('INTRO_LEVEL forgiveness', () => {
  it('stays playing after several wasteful early 3-merges', () => {
    let s = startSession(INTRO_LEVEL);
    s = applyDrop(s, p(3, 1), p(0, 0)); // first merge, straight away
    expect(evaluateStatus(s)).toBe('playing');
    s = applyDrop(s, p(2, 1), p(2, 3)); // second merge before any supply
    expect(evaluateStatus(s)).toBe('playing');
    s = placeSupply(s, firstEmpty(s.board));
    s = placeSupply(s, firstEmpty(s.board));
    expect(evaluateStatus(s)).toBe('playing');
  });
});

// ---- New levels ----

type LevelStep = { place: Pos } | { from: Pos; to: Pos; merge?: 3 | 5 };

/** Runs the steps on a fresh session, checking landings, merge sizes and status after every step. */
function runLevel(level: LevelDefinition, seq: LevelStep[], stopBefore = seq.length): SessionState {
  let s = startSession(level);
  seq.slice(0, stopBefore).forEach((step, i) => {
    let next: SessionState;
    if ('place' in step) {
      expect(s.board[step.place.row][step.place.col]).toBeNull();
      next = placeSupplyRandom(s);
      expect(next.board[step.place.row][step.place.col]).toEqual(level.supply[s.supplyIndex]);
      expect(next.supplyIndex).toBe(s.supplyIndex + 1);
    } else {
      if (step.merge) expect(previewMerge(s.board, step.from, step.to)).toHaveLength(step.merge);
      else expect(previewMerge(s.board, step.from, step.to)).toHaveLength(0);
      next = applyDrop(s, step.from, step.to);
    }
    expect(next).not.toBe(s);
    expect(evaluateStatus(next)).toBe(i === seq.length - 1 ? 'won' : 'playing');
    s = next;
  });
  return s;
}

const mergeSizes = (seq: LevelStep[]) =>
  seq.flatMap((st) => ('merge' in st && st.merge ? [st.merge] : []));
const flat = (level: LevelDefinition) => level.board.flat().filter((c) => c !== null);
const count = (items: readonly { family: string; tier: number }[], family: string, tier: number) =>
  items.filter((i) => i.family === family && i.tier === tier).length;
const is4x4 = (level: LevelDefinition) => {
  expect(level.board).toHaveLength(4);
  level.board.forEach((r) => expect(r).toHaveLength(4));
};
const distinctOthers = (all: readonly { family: string; tier: number }[], family: string) => {
  const others = all.filter((i) => i.family !== family).map((i) => `${i.family}${i.tier}`);
  expect(others.length).toBeGreaterThanOrEqual(1);
  expect(new Set(others).size).toBe(others.length);
};

const SONG_WIN: LevelStep[] = [
  { from: p(3, 3), to: p(0, 0), merge: 3 },   // s0 x3 -> s1
  { place: p(2, 1) },
  { place: p(1, 0) },
  { from: p(1, 0), to: p(2, 1), merge: 3 },   // s0 x3 -> s1
  { from: p(0, 0), to: p(2, 0), merge: 3 },   // 3 song-1 -> song-2
];

const LEAVE_WIN: LevelStep[] = [
  { place: p(2, 1) },
  { from: p(3, 3), to: p(2, 1), merge: 3 },   // elk-0 -> elk-1
  { from: p(2, 2), to: p(3, 1), merge: 3 },   // elk-1 -> elk-2
  { place: p(0, 3) },
  { place: p(1, 2) },
  { from: p(0, 3), to: p(1, 2), merge: 3 },   // elk-0 -> elk-1
  { from: p(0, 0), to: p(1, 2), merge: 3 },   // elk-1 -> elk-2
  { from: p(3, 1), to: p(1, 2), merge: 3 },   // elk-2 -> elk-3
];

const CRYSTAL_WIN: LevelStep[] = [
  { place: p(2, 2) },
  { place: p(0, 2) },
  { from: p(1, 1), to: p(2, 1) },             // swap: crystal-0 now touches the row above
  { from: p(2, 2), to: p(0, 0), merge: 5 },   // five crystal-0 -> 2 crystal-1
  { from: p(3, 0), to: p(3, 1) },             // move: crystal-1 joins the group
  { from: p(0, 0), to: p(2, 2), merge: 5 },   // five crystal-1 -> 2 crystal-2
  { from: p(0, 0), to: p(2, 2), merge: 3 },   // three crystal-2 -> crystal-3
];

describe('SONG_LEVEL', () => {
  const all = [...flat(SONG_LEVEL), ...SONG_LEVEL.supply];
  it('matches its documented constraints', () => {
    is4x4(SONG_LEVEL);
    expect(SONG_LEVEL.goal).toEqual({ kind: 'item', item: { family: 'song', tier: 2 } });
    expect(count(flat(SONG_LEVEL), 'song', 0)).toBe(4);
    expect(count(SONG_LEVEL.supply, 'song', 0)).toBe(2);
    expect(count(all, 'song', 1)).toBe(1);
    expect(all.filter((i) => i.family === 'song')).toHaveLength(7);
    distinctOthers(all, 'song');
    expect(all.length).toBeLessThanOrEqual(16);
    expect(evaluateStatus(startSession(SONG_LEVEL))).toBe('playing');
  });
  it('wins with only 3-merges and seeded random placement', () => {
    expect(mergeSizes(SONG_WIN)).toEqual([3, 3, 3]);
    const won = runLevel(SONG_LEVEL, SONG_WIN);
    expect(won.board.flat().some((c) => c?.family === 'song' && c.tier === 2)).toBe(true);
    expect(won.supplyIndex).toBe(2);
  });
});

describe('LEAVE_ONE_LEVEL', () => {
  const all = [...flat(LEAVE_ONE_LEVEL), ...LEAVE_ONE_LEVEL.supply];
  it('matches its documented constraints', () => {
    is4x4(LEAVE_ONE_LEVEL);
    expect(LEAVE_ONE_LEVEL.goal).toEqual({ kind: 'leaveOne' });
    expect(all.every((i) => i.family === 'elk')).toBe(true);
    expect(count(flat(LEAVE_ONE_LEVEL), 'elk', 0)).toBe(3);
    expect(count(LEAVE_ONE_LEVEL.supply, 'elk', 0)).toBe(3);
    expect(count(all, 'elk', 1)).toBe(4);
    expect(count(all, 'elk', 2)).toBe(1);
    expect(count(all, 'elk', 3)).toBe(0);
    expect(flat(LEAVE_ONE_LEVEL).length + LEAVE_ONE_LEVEL.supply.length).toBeLessThanOrEqual(14);
    expect(evaluateStatus(startSession(LEAVE_ONE_LEVEL))).toBe('playing');
  });
  it('wins with 3-merges, ending on a single elk-3 with all supply placed', () => {
    expect(mergeSizes(LEAVE_WIN)).toEqual([3, 3, 3, 3, 3]);
    const won = runLevel(LEAVE_ONE_LEVEL, LEAVE_WIN);
    expect(won.supplyIndex).toBe(LEAVE_ONE_LEVEL.supply.length);
    expect(won.board.flat().filter((c) => c !== null)).toEqual([{ family: 'elk', tier: 3 }]);
    expect(evaluateStatus(won)).toBe('won');
  });
  it('is not won before the final step', () => {
    for (let n = 0; n < LEAVE_WIN.length; n++) {
      // runLevel asserts 'playing' for every non-final step; the prefix must also never be 'won'.
      const prefix = LEAVE_WIN.slice(0, n);
      let s = startSession(LEAVE_ONE_LEVEL);
      for (const st of prefix) s = 'place' in st ? placeSupplyRandom(s) : applyDrop(s, st.from, st.to);
      expect(evaluateStatus(s)).not.toBe('won');
    }
  });
});

describe('CRYSTAL_LEVEL', () => {
  const all = [...flat(CRYSTAL_LEVEL), ...CRYSTAL_LEVEL.supply];
  it('matches its documented constraints', () => {
    is4x4(CRYSTAL_LEVEL);
    expect(CRYSTAL_LEVEL.goal).toEqual({ kind: 'item', item: { family: 'crystal', tier: 3 } });
    expect(count(flat(CRYSTAL_LEVEL), 'crystal', 0)).toBe(3);
    expect(count(CRYSTAL_LEVEL.supply, 'crystal', 0)).toBe(2);
    expect(count(all, 'crystal', 1)).toBe(3);
    expect(count(all, 'crystal', 2)).toBe(1);
    expect(all.filter((i) => i.family === 'crystal')).toHaveLength(9);
    distinctOthers(all, 'crystal');
    expect(all.length).toBeLessThanOrEqual(16);
    expect(evaluateStatus(startSession(CRYSTAL_LEVEL))).toBe('playing');
  });
  it('wins with two 5-merges then a 3-merge to crystal-3', () => {
    expect(mergeSizes(CRYSTAL_WIN)).toEqual([5, 5, 3]);
    const won = runLevel(CRYSTAL_LEVEL, CRYSTAL_WIN);
    expect(won.board.flat().some((c) => c?.family === 'crystal' && c.tier === 3)).toBe(true);
    expect(won.supplyIndex).toBe(2);
  });

  const fields = (s: SessionState) => ({
    board: s.board, supplyIndex: s.supplyIndex, rngState: s.rngState, moves: s.moves,
  });
  const traps: [string, Pos, Pos][] = [
    ['crystal-0 3-merge', p(2, 1), p(0, 0)],
    ['crystal-1 3-merge', p(3, 0), p(1, 1)],
  ];
  for (const [name, from, to] of traps) {
    describe(`trap: ${name}`, () => {
      const start = startSession(CRYSTAL_LEVEL);
      const lost = applyDrop(start, from, to);
      it('is a 3-merge that loses immediately with supply remaining', () => {
        expect(previewMerge(start.board, from, to)).toHaveLength(3);
        expect(evaluateStatus(lost)).toBe('lost');
        expect(lost.supplyIndex).toBeLessThan(CRYSTAL_LEVEL.supply.length);
      });
      it('undo restores the pre-move state and playing', () => {
        const back = undo(lost);
        expect(evaluateStatus(back)).toBe('playing');
        expect(fields(back)).toEqual(fields(start));
      });
      it('retry from the lost state equals a fresh start', () => {
        expect(retry(lost)).toEqual(startSession(CRYSTAL_LEVEL));
      });
      it('after undoing the trap the winning sequence still wins', () => {
        const back = undo(lost);
        expect(evaluateStatus(back)).toBe('playing');
        expect(evaluateStatus(runLevel(CRYSTAL_LEVEL, CRYSTAL_WIN))).toBe('won');
        let s = back;
        for (const st of CRYSTAL_WIN) s = 'place' in st ? placeSupplyRandom(s) : applyDrop(s, st.from, st.to);
        expect(evaluateStatus(s)).toBe('won');
      });
    });
  }
});

describe('LEVELS', () => {
  it('lists the levels in order with distinct non-empty names', () => {
    expect(LEVELS.map((l) => l.definition)).toEqual([
      INTRO_LEVEL, SONG_LEVEL, LEAVE_ONE_LEVEL, CRYSTAL_LEVEL, FARAWAY_LEVEL, HOLLOW_LEVEL, RUNE_LEVEL, CACHE_LEVEL, PALACE_LEVEL,
    ]);
    LEVELS.forEach((l) => expect(l.name.trim()).not.toBe(''));
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
  });
  it('nextLevelIndex cycles 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 0', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => nextLevelIndex(i))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect(nextLevelIndex(0, 1)).toBe(0); // a one-level list (the sandbox) replays itself
  });
});

describe('FARAWAY_LEVEL', () => {
  const targets = FARAWAY_LEVEL.goal.kind === 'items' ? FARAWAY_LEVEL.goal.items : [];
  const t = (i: number) => targets[i];
  const p = (row: number, col: number): Pos => ({ row, col });
  const MERGES: Pos[][][] = [
    [[p(13, 9), p(1, 1)], [p(1, 1), p(14, 2)], [p(14, 2), p(7, 10)]], // grove
    [[p(12, 1), p(2, 9)], [p(2, 9), p(9, 6)], [p(9, 6), p(0, 5)]], // song
    [[p(4, 3), p(14, 5)], [p(14, 5), p(3, 11)], [p(3, 11), p(11, 4)]], // elk
    [[p(5, 0), p(10, 10)], [p(10, 10), p(6, 2)], [p(6, 2), p(15, 9)]], // crystal
  ];
  const merge = (s: SessionState, [from, to]: Pos[]) => {
    expect(previewMerge(s.board, from, to)).toHaveLength(3);
    return applyDrop(s, from, to);
  };

  it('is 16 rows x 12 columns with four distinct-family tier-3 targets', () => {
    expect(FARAWAY_LEVEL.board).toHaveLength(16);
    FARAWAY_LEVEL.board.forEach((r) => expect(r).toHaveLength(12));
    expect(targets).toHaveLength(4);
    expect(new Set(targets.map((x) => x.family)).size).toBe(4);
    targets.forEach((x) => expect(x.tier).toBe(3));
    expect(evaluateStatus(startSession(FARAWAY_LEVEL))).toBe('playing');
  });

  it('wins only after the last merge, with a supply placement mid-way', () => {
    let s = startSession(FARAWAY_LEVEL);
    const all = MERGES.flat();
    all.forEach((step, i) => {
      s = merge(s, step);
      if (i === 5) {
        const pick = chooseSupplyCell(s)!;
        expect(s.board[pick.at.row][pick.at.col]).toBeNull();
        s = placeSupplyRandom(s);
        expect(evaluateStatus(s)).toBe('playing');
      }
      expect(evaluateStatus(s)).toBe(i === all.length - 1 ? 'won' : 'playing');
    });
  });

  it('tracks partial completion', () => {
    let s = startSession(FARAWAY_LEVEL);
    MERGES[0].forEach((step) => { s = merge(s, step); });
    expect(hasItem(s.board, t(0))).toBe(true);
    [1, 2, 3].forEach((i) => expect(hasItem(s.board, t(i))).toBe(false));
    expect(evaluateStatus(s)).toBe('playing');
  });

  it('undo reverts target completion and the win', () => {
    let s = startSession(FARAWAY_LEVEL);
    MERGES[0].forEach((step) => { s = merge(s, step); });
    expect(hasItem(s.board, t(0))).toBe(true);
    s = undo(s);
    expect(hasItem(s.board, t(0))).toBe(false);
    expect(evaluateStatus(s)).toBe('playing');

    s = startSession(FARAWAY_LEVEL);
    MERGES.flat().forEach((step) => { s = merge(s, step); });
    expect(evaluateStatus(s)).toBe('won');
    s = undo(s);
    expect(evaluateStatus(s)).toBe('playing');
    expect(targets.filter((x) => hasItem(s.board, x))).toHaveLength(3);
  });
});
