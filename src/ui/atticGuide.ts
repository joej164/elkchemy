import type { Family, Item, Tier } from '../board';
import { KEEPSAKE_BOX, SHOEBOX } from '../attic';
import { containerShown, goalOpenableAt, previewDrop } from '../session';
import { mergeSources, mergeTargets, previewCells, type UiState } from './controller';

type Kind = { family: Family; tier: Tier };

const cellsOf = (state: UiState, { family, tier }: Kind) =>
  state.session.board.flatMap((r, row) => r.flatMap((c, col) => (c && c.family === family && c.tier === tier ? [{ row, col }] : [])));

/** Whether some drop of one such item onto another would merge now (they already stand side by side). */
function ready(state: UiState, kind: Kind): boolean {
  const cells = cellsOf(state, kind);
  return cells.some((a) => cells.some((b) => a !== b && previewDrop(state.session, a, b).length > 0));
}

/** One attic item, as the banner names it. */
function noun(item: Item): string {
  if (item.family === 'book') return item.tier < 3 ? 'old book' : 'Big Memory Book';
  return ['loose photo', 'photo bundle', 'photo album'][Math.min(item.tier, 2)];
}

/**
 * With an item picked up (tapped; a drag shows the same highlights on the board): where it merges, which the board
 * highlights, or, if it merges nowhere from where it stands, that it won't, and the highlighted items that would.
 * Empty when neither helps (no merge is ready anywhere), so the step-by-step guidance shows instead.
 */
function selectionGuide(state: UiState): string {
  const at = state.selected;
  const item = at && state.session.board[at.row][at.col];
  if (!at || !item) return '';
  const targets = mergeTargets(state, at);
  if (targets.length > 0) {
    const n = previewCells(state, at, targets[0]).length;
    return `Drop it on a highlighted ${noun(item)}${n === 5 ? ' to merge five' : ''}: ${n} → ${n === 3 ? 1 : 2}.`;
  }
  if (mergeSources(state).length === 0) return '';
  return `From there this ${noun(item)} won't merge. Tap it again to put it down, then pick up a highlighted one.`;
}

/**
 * The attic's banner: one short next step at a time, from the loose photos to opening the Big Memory Book. Where items
 * are ready to merge, it says to pick one up: not every matching drop merges (the corner of an L of three, dropped onto
 * one of its arms, doesn't), so picking up highlights where it does, or which items to pick up instead (selectionGuide).
 */
export function atticGuide(state: UiState): string {
  const { session } = state;
  if (state.status === 'won') return 'The story continues…';
  if (session.board.some((r, row) => r.some((_, col) => goalOpenableAt(session, { row, col })))) {
    return 'You made the Big Memory Book! Tap it to open it.';
  }
  const picked = selectionGuide(state);
  if (picked) return picked;
  if (session.unpacked.includes(KEEPSAKE_BOX)) {
    return ready(state, { family: 'book', tier: 2 })
      ? 'Two more old books! Pick one up, then drop it where the books light up, to make the Big Memory Book.'
      : 'Move two old books side by side, then drop the third onto them to make the Big Memory Book.';
  }
  if (containerShown(session, KEEPSAKE_BOX)) return 'The photos are tidy, and under the dust sheet is an old wooden box. Tap it to open it.';
  if (cellsOf(state, { family: 'photo', tier: 1 }).length >= 3) {
    return ready(state, { family: 'photo', tier: 1 })
      ? 'Three bundles make a photo album: 3 → 1. Pick one up, then drop it where the bundles light up.'
      : 'Move two photo bundles side by side, then drop the third onto them to make a photo album.';
  }
  if (cellsOf(state, { family: 'photo', tier: 0 }).length >= 3) {
    if (!ready(state, { family: 'photo', tier: 0 })) return 'Move two loose photos side by side, then drop a third onto them: 3 → 1.';
    const how = session.moves === 0 ? ' Drag it, or tap it and then tap where it goes.' : '';
    return `Three loose photos tie into a bundle: 3 → 1. Pick one up, then drop it where the photos light up.${how}`;
  }
  if (!session.unpacked.includes(SHOEBOX)) return 'There are more loose photos in the shoebox. Tap it to open it.';
  return 'Merge the photos into a photo album to finish tidying.';
}
