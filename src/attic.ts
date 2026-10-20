import type { Item } from './board';
import type { LevelDefinition } from './session';

const photo0: Item = { family: 'photo', tier: 0 };
const photo1: Item = { family: 'photo', tier: 1 };
const photo2: Item = { family: 'photo', tier: 2 };
const book0: Item = { family: 'book', tier: 0 };
const book1: Item = { family: 'book', tier: 1 };

/** The attic's containers, by index (see ATTIC_LEVEL). */
export const SHOEBOX = 0;
export const KEEPSAKE_BOX = 1;

// The Attic, the opening-story tutorial (a prototype, outside the Levels sequence). Cleaning up is sorting photos:
// three loose photos (L) tie into a bundle (B), three bundles make the photo album, and making the album uncovers the
// keepsake box (K) under its dust sheet. Its three old books merge into the memory book, the goal. S is the shoebox of
// stored belongings, holding three more loose photos.
//   L  L  .  K
//   .  .  .  .
//   L  .  B  .
//   .  .  .  S
// The album needs three bundles: the one here, one from these three photos and one from the shoebox's. A 5-merge is
// only possible with all six photos out together, and still leaves three bundles (and a spare photo), so it is never
// needed and never strands the level. Each batch comes out on its box's cell and the nearest empty cells, an L shape
// on an empty floor, so it can merge at once. The floor never holds more than 7 items and 2 boxes, so there is always
// room. tests/attic.test.ts checks every reachable inventory.
export const ATTIC_LEVEL: LevelDefinition = {
  seed: 1,
  board: [
    [photo0, photo0, null, null],
    [null, null, null, null],
    [photo0, null, photo1, null],
    [null, null, null, null],
  ],
  supply: [],
  goal: { kind: 'item', item: book1 },
  containers: [
    { at: { row: 3, col: 3 }, name: 'shoebox', art: 'shoebox', contents: [photo0, photo0, photo0] },
    { at: { row: 0, col: 3 }, name: 'old wooden box', art: 'keepsake-box', contents: [book0, book0, book0], hiddenUntil: photo2 },
  ],
};
