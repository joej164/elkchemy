import type { ReactNode } from 'react';
import approachArt from '../assets/art/chapter-one-08-palace-approach-v2.webp';
import junctionArt from '../assets/art/chapter-one-08a-terrace-junction-v2.webp';
import forecourtArt from '../assets/art/chapter-one-08b-forecourt-revealed-v1.webp';
import entryArt from '../assets/art/chapter-one-09-palace-entry-v1.webp';
import interiorArt from '../assets/art/chapter-one-10-palace-interior-v1.webp';
import type { ComicPanel, ComicScene } from './Comic';

// The palace entrance prototype's board stand-ins: temporary, code-native drawings, not final artwork. Alisha and Fiona are
// board sprites, kept apart from merge items (and unlike the elk item's front-on head): young Alisha upright, with her
// glasses, curly hair, elk ears and leafy antlers; Fiona a golden elk seen side-on. Their names are HTML labels.

const DARK = '#233a2b';
const S = { stroke: DARK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Young Alisha, on 100 × 100. */
function alisha(): ReactNode {
  return (
    <g data-sprite="alisha">
      {/* Leafy antlers: two branching stems, each with leaves. */}
      {[1, -1].map((s) => (
        <g key={s}>
          <path d={`M${50 + s * 8} 26 Q${50 + s * 14} 14 ${50 + s * 24} 6 M${50 + s * 13} 16 L${50 + s * 6} 6`} fill="none" stroke="#6b4a2f"
            strokeWidth={3.5} strokeLinecap="round" />
          <ellipse cx={50 + s * 26} cy="7" rx="6" ry="3.2" transform={`rotate(${s * -30} ${50 + s * 26} 7)`} fill="#5d9a3f" {...S} strokeWidth={1.5} />
          <ellipse cx={50 + s * 5} cy="5" rx="5" ry="2.8" transform={`rotate(${s * 60} ${50 + s * 5} 5)`} fill="#7bb555" {...S} strokeWidth={1.5} />
          <ellipse cx={50 + s * 19} cy="14" rx="4.5" ry="2.5" transform={`rotate(${s * 20} ${50 + s * 19} 14)`} fill="#7bb555" {...S} strokeWidth={1.5} />
        </g>
      ))}
      {/* Elk ears, leaf-shaped, standing out from the hair. */}
      <ellipse cx="27" cy="34" rx="9" ry="4.5" transform="rotate(-28 27 34)" fill="#b8834f" {...S} />
      <ellipse cx="73" cy="34" rx="9" ry="4.5" transform="rotate(28 73 34)" fill="#b8834f" {...S} />
      {/* Body: a green tunic with a disc-golf bag strap. */}
      <path d="M32 96 Q32 68 50 64 Q68 68 68 96 Z" fill="#3f7f6a" {...S} />
      <path d="M40 67 L62 94" stroke="#a5463b" strokeWidth={4} strokeLinecap="round" />
      {/* Curly hair behind and around the face. */}
      {[[34, 30], [40, 23], [50, 20], [60, 23], [66, 30], [68, 40], [32, 40], [34, 50], [66, 50]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r="7.5" fill="#5a3420" {...S} strokeWidth={1.5} />
      ))}
      <circle cx="50" cy="42" r="15" fill="#f1c9a5" {...S} />
      {[[42, 29], [50, 27], [58, 29]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="5" fill="#5a3420" />)}
      {/* Glasses and a smile. */}
      <g fill="#fff8" stroke={DARK} strokeWidth={2}>
        <circle cx="44" cy="42" r="5.2" />
        <circle cx="56" cy="42" r="5.2" />
      </g>
      <path d="M49.2 42 H50.8" stroke={DARK} strokeWidth={2} />
      <circle cx="44" cy="42.5" r="1.6" fill={DARK} />
      <circle cx="56" cy="42.5" r="1.6" fill={DARK} />
      <path d="M45 50 Q50 54 55 50" fill="none" stroke={DARK} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

/** Fiona, a golden elk side-on, facing left, on 100 × 100. */
function fiona(): ReactNode {
  return (
    <g data-sprite="fiona">
      {/* Antlers, wide and pale. */}
      <g fill="none" stroke="#e6d3a3" strokeWidth={4} strokeLinecap="round">
        <path d="M30 26 Q34 12 46 4 M37 15 L32 4 M42 8 L52 6" />
        <path d="M24 26 Q18 12 8 8 M18 15 L10 18" />
      </g>
      <g fill="none" stroke={DARK} strokeWidth={1.5} strokeLinecap="round" opacity="0.6">
        <path d="M30 26 Q34 12 46 4" />
        <path d="M24 26 Q18 12 8 8" />
      </g>
      {/* Legs, body, tail. */}
      {[40, 48, 70, 78].map((x) => <rect key={x} x={x} y="62" width="6" height="32" rx="3" fill="#8a5a34" {...S} strokeWidth={1.5} />)}
      <ellipse cx="60" cy="60" rx="28" ry="15" fill="#c99a5b" {...S} />
      <path d="M86 52 Q94 50 92 60" fill="#8a5a34" {...S} strokeWidth={1.5} />
      {/* Neck and head, with a dark muzzle, an ear and an eye. */}
      <path d="M44 56 Q34 44 30 30 L42 26 Q46 40 54 50 Z" fill="#c99a5b" {...S} />
      <ellipse cx="24" cy="32" rx="13" ry="8" transform="rotate(-12 24 32)" fill="#c99a5b" {...S} />
      <ellipse cx="13" cy="35" rx="5" ry="4" fill="#4a3020" />
      <ellipse cx="34" cy="24" rx="6" ry="3" transform="rotate(-35 34 24)" fill="#8a5a34" {...S} strokeWidth={1.5} />
      <circle cx="23" cy="29" r="2" fill={DARK} />
      <path d="M48 62 Q60 70 74 62" fill="none" stroke="#f4ecd8" strokeWidth={2} opacity="0.5" />
    </g>
  );
}

/** Beyond the gate's dog, a placeholder: a scruffy brown dog side-on, facing left, on 100 × 100. */
function dog(): ReactNode {
  return (
    <g data-sprite="dog">
      {[34, 42, 66, 74].map((x) => <rect key={x} x={x} y="64" width="7" height="24" rx="3" fill="#7a4e2c" {...S} strokeWidth={1.5} />)}
      <ellipse cx="56" cy="62" rx="26" ry="14" fill="#a0693d" {...S} />
      <path d="M80 56 Q94 44 90 36" fill="none" stroke="#7a4e2c" strokeWidth={6} strokeLinecap="round" />
      <ellipse cx="30" cy="48" rx="15" ry="12" fill="#a0693d" {...S} />
      <ellipse cx="18" cy="54" rx="8" ry="6" fill="#d9b48a" {...S} strokeWidth={1.5} />
      <ellipse cx="13" cy="51" rx="3.2" ry="2.6" fill={DARK} />
      <path d="M34 38 Q44 36 42 56 Q36 54 34 38 Z" fill="#5a3420" {...S} strokeWidth={1.5} />
      <circle cx="26" cy="44" r="2.2" fill={DARK} />
    </g>
  );
}

/** Beyond the gate's dog as a board sprite. Decorative (callers name it). */
export function DogArt() {
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">{dog()}</svg>;
}

/** Young Alisha as a board sprite. Decorative (callers name her). */
export function AlishaArt() {
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">{alisha()}</svg>;
}

/** Fiona as a board sprite. Decorative (callers name her). */
export function FionaArt() {
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">{fiona()}</svg>;
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
