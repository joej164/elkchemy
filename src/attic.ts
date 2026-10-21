import type { Item } from './board';
import type { LevelDefinition } from './session';

const photo0: Item = { family: 'photo', tier: 0 };
const photo1: Item = { family: 'photo', tier: 1 };
const photo2: Item = { family: 'photo', tier: 2 };
// Books start at tier 3 of 5 (internal tier 2): an old book merges straight into the Big Memory Book (tier 4 of 5).
const book2: Item = { family: 'book', tier: 2 };
const book3: Item = { family: 'book', tier: 3 };

/** The attic's containers, by index (see ATTIC_LEVEL). */
export const SHOEBOX = 0;
export const KEEPSAKE_BOX = 1;

// The Attic, the opening-story tutorial (a prototype, outside the numbered levels). Cleaning up is sorting photos:
// three loose photos (L) tie into a bundle (B), three bundles make the photo album, and making the album uncovers the
// keepsake box (K) under its dust sheet. One old book (O) lies on the floor from the start; the box holds two more, and
// the three merge into the Big Memory Book, which is then tapped to open it: the goal. S is the shoebox of stored
// belongings, holding three more loose photos.
//   L  L  .  K
//   .  .  .  O
//   L  .  B  .
//   .  .  .  S
// The album needs three bundles: the one here, one from these three photos and one from the shoebox's. A 5-merge is
// only possible with all six photos out together, and still leaves three bundles (and a spare photo), so it is never
// needed and never strands the level. Each batch comes out on its box's cell and the nearest empty cells: the shoebox's
// in an L on an empty floor, and the box's two books, with the old book left where it started, in an L of three, so
// each can merge at once. The floor never holds more than 8 items and 2 boxes, so there is always room, wherever the
// old book has been moved. tests/attic.test.tsx checks every reachable inventory.
export const ATTIC_LEVEL: LevelDefinition = {
  seed: 1,
  board: [
    [photo0, photo0, null, null],
    [null, null, null, book2],
    [photo0, null, photo1, null],
    [null, null, null, null],
  ],
  supply: [],
  goal: { kind: 'item', item: book3, open: true },
  containers: [
    { at: { row: 3, col: 3 }, name: 'shoebox', art: 'shoebox', contents: [photo0, photo0, photo0] },
    { at: { row: 0, col: 3 }, name: 'old wooden box', art: 'keepsake-box', contents: [book2, book2], hiddenUntil: photo2 },
  ],
};
