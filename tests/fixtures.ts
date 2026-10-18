import type { LevelDefinition } from '../src/session';

// The original (harder) intro puzzle, kept as a fixture so loss/undo/5-merge coverage stays meaningful.
// Eight grove-0s exist in total (5 board + 3 supply), so the goal (grove-2 = three grove-1s)
// needs one 5->2 merge plus one 3->1 merge. Two early 3-merges make the goal unreachable.
export const EIGHT_GROVE_LEVEL: LevelDefinition = {
  seed: 1,
  board: [
    [{ family: 'grove', tier: 0 }, { family: 'grove', tier: 0 }, null, { family: 'song', tier: 0 }],
    [null, { family: 'grove', tier: 0 }, null, null],
    [{ family: 'elk', tier: 0 }, null, null, { family: 'grove', tier: 0 }],
    [{ family: 'crystal', tier: 0 }, null, null, { family: 'grove', tier: 0 }],
  ],
  supply: [
    { family: 'grove', tier: 0 },
    { family: 'grove', tier: 0 },
    { family: 'grove', tier: 0 },
  ],
  goal: { kind: 'item', item: { family: 'grove', tier: 2 } },
};
