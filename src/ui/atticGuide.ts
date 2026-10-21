import type { Family, Item, Tier } from '../board';
import { KEEPSAKE_BOX, SHOEBOX } from '../attic';
import { containerShown, craftedItem, goalOpenableAt, previewDrop } from '../session';
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
  if (item.family === 'book') return ['old book', 'book stack', 'blank book', 'Picture Book'][Math.min(item.tier, 3)];
  return ['loose photo', 'photo bundle', 'scrapbook pages'][Math.min(item.tier, 2)];
}

const PHOTO_COLLECTION: Kind = { family: 'photo', tier: 2 };
const BLANK_BOOK: Kind = { family: 'book', tier: 2 };

/**
 * With an item picked up (tapped; a drag shows the same highlights on the board): where it merges or crafts, which the
 * board highlights, or, if it does neither from where it stands, that it won't, and the highlighted items that would.
 * Empty when neither helps (no merge is ready anywhere), so the step-by-step guidance shows instead.
 */
function selectionGuide(state: UiState): string {
  const at = state.selected;
  const item = at && state.session.board[at.row][at.col];
  if (!at || !item) return '';
  const targets = mergeTargets(state, at);
  if (targets.length > 0) {
    const made = craftedItem(state.session, at, targets[0]);
    const onto = state.session.board[targets[0].row][targets[0].col]!;
    if (made) return `Drop it on the highlighted ${noun(onto)} to make the ${noun(made)}.`;
    const n = previewCells(state, at, targets[0]).length;
    return `Drop it on a highlighted ${noun(item)}${n === 5 ? ' to merge five' : ''}: ${n} → ${n === 3 ? 1 : 2}.`;
  }
  if (mergeSources(state).length === 0) return '';
  const name = noun(item);
  return `From there ${name.endsWith('pages') ? 'these' : 'this'} ${name} won't merge. Tap it again to put it down, then pick up a ` +
    'highlighted one.';
}

/** The book chain, once the box's book stack is out: old books into a stack, then three stacks into the blank book. */
function bookStep(state: UiState): string {
  if (cellsOf(state, { family: 'book', tier: 0 }).length >= 3) {
    return ready(state, { family: 'book', tier: 0 })
      ? 'Now the books. Three old books make a book stack: 3 → 1. Pick one up, then drop it where the books light up.'
      : 'Now the books. Move two old books side by side, then drop the third onto them: 3 → 1.';
  }
  return ready(state, { family: 'book', tier: 1 })
    ? 'Three book stacks make a blank book: 3 → 1. Pick one up, then drop it where the stacks light up.'
    : 'Move two book stacks side by side, then drop the third onto them to make a blank book.';
}

/**
 * The attic's banner: one short next step at a time: the photos into scrapbook pages (which uncover the box), the
 * books into a blank book, the two combined into the Picture Book, then opening it. Where items are ready to merge, it
 * says to pick one up: not every matching drop merges (the corner of an L of three, dropped onto one of its arms,
 * doesn't), so picking up highlights where it does, or which items to pick up instead (selectionGuide).
 */
export function atticGuide(state: UiState): string {
  const { session } = state;
  if (state.status === 'won') return 'The story continues…';
  if (session.board.some((r, row) => r.some((_, col) => goalOpenableAt(session, { row, col })))) {
    return 'You made the Picture Book! Tap it to open it.';
  }
  const picked = selectionGuide(state);
  if (picked) return picked;
  if (cellsOf(state, PHOTO_COLLECTION).length > 0 && cellsOf(state, BLANK_BOOK).length > 0) {
    return 'Now combine them: drop the scrapbook pages onto the blank book, or the book onto the pages, to make the Picture Book.';
  }
  if (session.unpacked.includes(KEEPSAKE_BOX)) return bookStep(state);
  if (containerShown(session, KEEPSAKE_BOX)) {
    return 'The photos are collected, and under the dust sheet is an old wooden box. Tap it to open it.';
  }
  if (cellsOf(state, { family: 'photo', tier: 1 }).length >= 3) {
    return ready(state, { family: 'photo', tier: 1 })
      ? 'Three bundles make scrapbook pages: 3 → 1. Pick one up, then drop it where the bundles light up.'
      : 'Move two photo bundles side by side, then drop the third onto them to make scrapbook pages.';
  }
  if (cellsOf(state, { family: 'photo', tier: 0 }).length >= 3) {
    if (!ready(state, { family: 'photo', tier: 0 })) return 'Move two loose photos side by side, then drop a third onto them: 3 → 1.';
    const how = session.moves === 0 ? ' Drag it, or tap it and then tap where it goes.' : '';
    return `Three loose photos tie into a bundle: 3 → 1. Pick one up, then drop it where the photos light up.${how}`;
  }
  if (!session.unpacked.includes(SHOEBOX)) return 'There are more loose photos in the shoebox. Tap it to open it.';
  return 'Merge the photos into scrapbook pages to finish tidying.';
}
