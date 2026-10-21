import type { Item } from './board';
import type { LevelDefinition } from './session';

// Player-facing tiers are one more than these: loose photos and old books are tier 1 of 5, the Picture Book tier 4.
const photo0: Item = { family: 'photo', tier: 0 };
const photo1: Item = { family: 'photo', tier: 1 };
const photo2: Item = { family: 'photo', tier: 2 };
const book0: Item = { family: 'book', tier: 0 };
const book1: Item = { family: 'book', tier: 1 };
const book2: Item = { family: 'book', tier: 2 };
const book3: Item = { family: 'book', tier: 3 };

/** The attic's containers, by index (see ATTIC_LEVEL). */
export const SHOEBOX = 0;
export const KEEPSAKE_BOX = 1;

// The Attic, the opening-story tutorial (a prototype, outside the numbered levels). Two chains, then a combination:
// - Photos: three loose photos (L) tie into a bundle (B), and three bundles make the photo collection. Making it uncovers
//   the keepsake box (K) under its dust sheet. S is the shoebox of stored belongings, holding three more loose photos.
// - Books: three old books (O) make a book stack (T), and three stacks make a blank book. The box holds the third stack.
// - The photo collection and the blank book, either dropped onto the other, craft the Picture Book; tapping it open wins.
//   L  L  .  K
//   .  .  .  .
//   L  .  B  .
//   .  .  .  S
//   O  O  T  O
// The collection needs three bundles: the one here, one from these three photos and one from the shoebox's. A 5-merge
// is only possible with all six photos out together, and still leaves three bundles (and a spare photo), so it is
// never needed and never strands the level. The blank book needs the box's stack, so the photos come first. The
// shoebox's batch comes out in an L on its cell and the nearest empty cells, so it can merge at once. The floor never
// holds more than 11 items and a box (of 20 cells), so there is always room. tests/attic.test.tsx checks every
// reachable inventory.
export const ATTIC_LEVEL: LevelDefinition = {
  seed: 1,
  board: [
    [photo0, photo0, null, null],
    [null, null, null, null],
    [photo0, null, photo1, null],
    [null, null, null, null],
    [book0, book0, book1, book0],
  ],
  supply: [],
  goal: { kind: 'item', item: book3, open: true },
  containers: [
    { at: { row: 3, col: 3 }, name: 'shoebox', art: 'shoebox', contents: [photo0, photo0, photo0] },
    { at: { row: 0, col: 3 }, name: 'old wooden box', art: 'keepsake-box', contents: [book1], hiddenUntil: photo2 },
  ],
  craft: { ingredients: [photo2, book2], result: book3 },
};
