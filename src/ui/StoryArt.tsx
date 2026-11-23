import approachArt from '../assets/art/chapter-one-08-palace-approach-v2.webp';
import junctionArt from '../assets/art/chapter-one-08a-terrace-junction-v2.webp';
import forecourtArt from '../assets/art/chapter-one-08b-forecourt-revealed-v1.webp';
import entryArt from '../assets/art/chapter-one-09-palace-entry-v1.webp';
import interiorArt from '../assets/art/chapter-one-10-palace-interior-v1.webp';
import { characterPicture, dogPicture } from './BoardArt';
import pressurePlateArt from '../assets/board/palace-pressure-plate-v2.webp';
import doorClosedArt from '../assets/board/palace-door-v1.webp';
import doorOpenArt from '../assets/board/palace-door-open-v1.webp';
import type { ComicPanel, ComicScene } from './Comic';

// Board sprites, kept apart from merge items: Alisha, Fiona (leaves on her antlers) and Beyond the gate's dog use their
// chibi board art (src/ui/BoardArt.tsx); the palace entrance and the plate remain temporary code-native drawings. Their
// names are HTML labels.

/** Beyond the gate's dog as a board sprite (and its goal's picture): its chibi board art, facing left. Decorative (callers name it). */
export function DogArt() {
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">{dogPicture()}</svg>;
}

/** Young Alisha as a board sprite: her chibi board art, standing on the bottom edge. Decorative (callers name her). */
export function AlishaArt() {
  return <svg viewBox="0 0 100 100" overflow="visible" aria-hidden="true" focusable="false">{characterPicture('alisha')}</svg>;
}

/** Fiona as a board sprite: her chibi board art, leaves on her antlers. Decorative (callers name her). */
export function FionaArt() {
  return <svg viewBox="0 0 100 100" overflow="visible" aria-hidden="true" focusable="false">{characterPicture('fiona')}</svg>;
}

/**
 * The palace entrance: a crystal arch in the palace wall, its double doors closed, or swung open on a lit hall.
 * `opening`: just opened, for CSS to swing the doors. Decorative.
 */
export function PalaceDoorArt({ open, opening = false }: { open: boolean; opening?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" data-door={open ? 'open' : 'closed'}
      className={opening ? 'is-opening' : undefined}>
      <image href={open ? doorOpenArt : doorClosedArt} width="100" height="100" preserveAspectRatio="xMidYMax meet" />
      {open && opening && <image href={doorClosedArt} width="100" height="100" preserveAspectRatio="xMidYMax meet" className="door-opening-overlay" />}
    </svg>
  );
}

/**
 * Alisha's pressure plate: a round stone set in the floor with a standing figure on it, so it reads as a place for her,
 * not for an item. `pressed`: sunk, its ring lit gold. Decorative.
 */
export function CharacterPlateArt({ pressed = false }: { pressed?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" data-character-plate={pressed ? 'pressed' : 'up'}>
      <image href={pressurePlateArt} x="-25" y="0" width="150" height="100" preserveAspectRatio="xMidYMid meet" />
      {pressed && <ellipse cx="50" cy="53" rx="43" ry="43" fill="none" stroke="#ffe18a" strokeWidth="4" opacity="0.9" />}
    </svg>
  );
}

// The palace entrance's story scenes (and C1-10, which opens the Crystal Palace), one line at a time as in the Attic, over
// the draft illustrations the storyboard (docs/story/chapter-one-review.html) shows for C1-08 to C1-10 (artwork/story/chapter-one/; delivery copies:
// src/assets/art/README.md). Each panel's id is its storyboard code; its lines are that figure's dialogue, word for word,
// in order. Words stay in the HTML captions.

/** Before play: the approach (C1-08). */
export const APPROACH_PANELS: readonly ComicPanel[] = [
  {
    id: 'C1-08',
    description: 'Alisha and Fiona climb a stone path of steps through a sunlit pine forest toward rocky terraces, with mountains '
      + 'beyond.',
    art: <img src={approachArt} alt="" />,
    lines: [
      { speaker: 'Alisha', text: 'You’ve been here before?' },
      { speaker: 'Fiona', text: 'Yes. There’s a pressure plate outside the entrance. Stand on it, and the doors open.' },
      { speaker: 'Alisha', text: 'Where is it?' },
      { speaker: 'Fiona', text: 'Past these terraces. There used to be a clear path.' },
      { speaker: 'Alisha', text: 'I’ll keep my discs in the bag this time. No more accidents.' },
    ],
  },
];

/**
 * During play (see ENTRANCE_LEVEL's party.story): the terrace junction (C1-08A), once both terraces open, and the
 * forecourt (C1-08B), once it is revealed, before Alisha's speech bubble.
 */
export const ENTRANCE_STORY: Readonly<Record<string, ComicScene>> = {
  'C1-08A': {
    label: 'Terrace junction',
    panels: [{
      id: 'C1-08A',
      description: 'Alisha and Fiona on a paved landing where three stone stairways meet: Alisha points up the middle stairs to a '
        + 'closed gate, between stairs climbing left and right past crystal-marked pillars, the right one also marked with a '
        + 'musical note.',
      art: <img src={junctionArt} alt="" />,
      lines: [
        { speaker: 'Alisha', text: 'Which way?' },
        { speaker: 'Fiona', text: 'The entrance is above us, through that gate.' },
        { speaker: 'Alisha', text: 'And it’s locked.' },
        { speaker: 'Fiona', text: 'See the symbols? There’s one here, and another across the terrace.' },
        { speaker: 'Alisha', text: 'So we need to sort out both sides.' },
        { speaker: 'Fiona', text: 'Then we can reach the entrance.' },
      ],
    }],
  },
  'C1-08B': {
    label: 'Forecourt',
    panels: [{
      id: 'C1-08B',
      description: 'Alisha and Fiona step onto the palace’s polished forecourt, a round gold-rimmed pressure plate set in the floor '
        + 'before the steps up to its tall closed crystal doors.',
      art: <img src={forecourtArt} alt="" />,
      lines: [
        { speaker: 'Fiona', text: 'There. Just ahead of the doors.' },
        { speaker: 'Alisha', text: 'That little plate opens all of this?' },
        { speaker: 'Fiona', text: 'It did last time.' },
        { speaker: 'Alisha', text: 'How long ago was that?' },
        { speaker: 'Fiona', text: 'Long enough for the path to disappear, apparently.' },
        { speaker: 'Alisha', text: 'Well, we’ve found it now.' },
      ],
    }],
  },
};

/** After the win (Enter the palace): the entrance opens (C1-09). */
export const ENTRY_PANELS: readonly ComicPanel[] = [
  {
    id: 'C1-09',
    description: 'Alisha and Fiona walk side by side through the palace’s tall open crystal doors onto its polished floor, a round '
      + 'pressure plate beside the entrance and the forest and mountains behind them.',
    art: <img src={entryArt} alt="" />,
    lines: [
      { speaker: 'Alisha', text: 'Do I need to stay on the plate?' },
      { speaker: 'Fiona', text: 'No. The doors will stay open.' },
      { speaker: 'Alisha', text: 'That was actually kind of fun.' },
      { speaker: 'Fiona', text: 'Opening a door?' },
      { speaker: 'Alisha', text: 'You have to admit, it’s a fun way to open one.' },
      { speaker: 'Fiona', text: 'Come on. Wait until you see inside.' },
    ],
  },
];

/** The Crystal Palace rescue, before play: the first view inside (C1-10), which opens the storyboard's level 4. */
export const INSIDE_PANELS: readonly ComicPanel[] = [
  {
    id: 'C1-10',
    description: 'Alisha and Fiona inside the palace’s entry hall among lavender crystal columns, gold trim and flowering planters, '
      + 'with a closed crystal doorway at the top of the steps ahead.',
    art: <img src={interiorArt} alt="" />,
    lines: [
      { speaker: 'Fiona', text: 'What do you think?' },
      { speaker: 'Alisha', text: 'It’s amazing.' },
      { speaker: 'Fiona', text: 'Worth the walk?' },
      { speaker: 'Alisha', text: 'Even with the cleanup.' },
      { speaker: 'Alisha', text: 'All right. Where do we deliver your message?' },
    ],
  },
];
