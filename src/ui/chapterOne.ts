import {
  BEYOND_LEVEL, CLEANUP_LEVEL, GARDEN_TASK, MEET_FIONA_LEVEL, RELEASE_TASK, RESCUE_LEVEL, REVEAL_DEPOT_TASK, REVEAL_GREENERY_TASK,
  REVEAL_PLATE_ROOM_TASK,
} from '../chapter';
import { ENTRANCE_LEVEL } from '../entrance';
import type { LevelDefinition } from '../session';
import type { ComicPanel, ComicScene } from './Comic';
import type { UiState } from './controller';
import { chapterGuide, meetFionaGuide } from './chapterGuide';
import {
  BEYOND_CLOSING, BEYOND_OPENING, CLEANUP_CLOSING, CLEANUP_OPENING, CLEANUP_STORY, MEET_FIONA_CLOSING, MEET_FIONA_OPENING, RESCUE_STORY,
} from './chapterStory';
import { entranceGuide } from './entranceGuide';
import { APPROACH_PANELS, ENTRANCE_STORY, ENTRY_PANELS, INSIDE_PANELS } from './StoryArt';

/**
 * A Chapter 1 level (development preview only), in story order after the Attic: its opening comic, the puzzle (with its
 * own scenes during play, its banner and board look) and its closing comic, if any. `winLabel`: the button once won,
 * which leads to the closing comic, or straight on: Continue for every level, offered in the same place once the level's
 * final action on the board has been made. `palace`: the Crystal Palace music, inside the palace.
 */
export interface ChapterLevel {
  readonly name: string;
  readonly definition: LevelDefinition;
  readonly opening: readonly ComicPanel[];
  readonly story?: Readonly<Record<string, ComicScene>>;
  readonly closing?: readonly ComicPanel[];
  readonly guide: (state: UiState) => string;
  readonly scene: 'entrance' | 'palace';
  readonly winLabel: string;
  readonly palace?: boolean;
}

export const CHAPTER_ONE: readonly ChapterLevel[] = [
  {
    name: 'Meet Fiona', definition: MEET_FIONA_LEVEL, opening: MEET_FIONA_OPENING, closing: MEET_FIONA_CLOSING, guide: meetFionaGuide,
    scene: 'entrance', winLabel: 'Continue',
  },
  {
    name: 'Woodland cleanup', definition: CLEANUP_LEVEL, opening: CLEANUP_OPENING, story: CLEANUP_STORY, closing: CLEANUP_CLOSING,
    guide: chapterGuide({ [REVEAL_DEPOT_TASK]: 'to clear the fallen branches' }), scene: 'entrance', winLabel: 'Continue',
  },
  {
    name: 'The palace entrance', definition: ENTRANCE_LEVEL, opening: APPROACH_PANELS, story: ENTRANCE_STORY, closing: ENTRY_PANELS,
    guide: entranceGuide, scene: 'entrance', winLabel: 'Continue',
  },
  {
    name: 'The Crystal Palace', definition: RESCUE_LEVEL, opening: INSIDE_PANELS, story: RESCUE_STORY,
    guide: chapterGuide({ [REVEAL_PLATE_ROOM_TASK]: 'to find a way on', [RELEASE_TASK]: 'to release Alisha' }), scene: 'palace',
    winLabel: 'Continue', palace: true,
  },
  {
    name: 'Beyond the gate', definition: BEYOND_LEVEL, opening: BEYOND_OPENING, closing: BEYOND_CLOSING,
    guide: chapterGuide({ [REVEAL_GREENERY_TASK]: 'to find the way through the greenery', [GARDEN_TASK]: 'to follow the dog' }),
    scene: 'palace', winLabel: 'Continue', palace: true,
  },
];
