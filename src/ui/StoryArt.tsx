import approachArt from '../assets/art/chapter-one-08-palace-approach-v2.webp';
import junctionArt from '../assets/art/chapter-one-08a-terrace-junction-v2.webp';
import forecourtArt from '../assets/art/chapter-one-08b-forecourt-revealed-v1.webp';
import entryArt from '../assets/art/chapter-one-09-palace-entry-v1.webp';
import interiorArt from '../assets/art/chapter-one-10-palace-interior-v1.webp';
import { characterPicture, dogPicture } from './BoardArt';
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
      <rect width="100" height="100" fill="#b9a6dc" />
      <path d="M0 34 H14 M86 34 H100 M0 67 H14 M86 67 H100" stroke="#8f78c0" strokeWidth="3" />
      <path d="M16 100 V42 Q16 10 50 8 Q84 10 84 42 V100 Z" fill="#e4dbf5" stroke="#7b5ea7" strokeWidth="4" />
      <path d="M24 100 V44 Q24 18 50 16 Q76 18 76 44 V100 Z" fill={open ? '#fff3c4' : '#5c4a86'} stroke="#7b5ea7" strokeWidth="2" />
      {open && <path d="M50 30 L60 52 L50 92 L40 52 Z" fill="#f2c14e" opacity="0.55" />}
      <g className="door-leaf is-left">
        <path d={open ? 'M24 100 V44 Q24 26 30 22 V100 Z' : 'M24 100 V44 Q24 18 50 16 V100 Z'} fill="#9fd6e0" stroke="#3d6f7a" strokeWidth="2" />
      </g>
      <g className="door-leaf is-right">
        <path d={open ? 'M76 100 V44 Q76 26 70 22 V100 Z' : 'M76 100 V44 Q76 18 50 16 V100 Z'} fill="#9fd6e0" stroke="#3d6f7a" strokeWidth="2" />
      </g>
      {!open && <circle cx="45" cy="64" r="2.5" fill="#3d6f7a" />}
      {!open && <circle cx="55" cy="64" r="2.5" fill="#3d6f7a" />}
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
      <ellipse cx="50" cy="56" rx="42" ry="34" fill={pressed ? '#7d7466' : '#a59a86'} stroke={pressed ? '#f2c14e' : '#5c5446'} strokeWidth={pressed ? 6 : 4} />
      <ellipse cx="50" cy={pressed ? 58 : 52} rx="32" ry="25" fill={pressed ? '#8f8573' : '#c6bca6'} stroke="#6d6454" strokeWidth="2" />
      <g opacity={pressed ? 0.35 : 0.75} fill="#4a3220">
        <circle cx="50" cy="36" r="6" />
        <path d="M40 66 Q40 46 50 45 Q60 46 60 66 Z" />
      </g>
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
