import type { ReactNode } from 'react';
import entryArt from '../assets/art/chapter-one-09-palace-entry-v1.webp';
import interiorArt from '../assets/art/chapter-one-10-palace-interior-v1.webp';
import type { ComicPanel } from './Comic';

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

/**
 * The entry scene after the palace entrance opens, one line at a time as in the Attic: draft illustrations C1-09 and
 * C1-10 (artwork/story/chapter-one/; delivery copies: src/assets/art/README.md). Words stay in the HTML captions.
 */
export const ENTRY_PANELS: readonly ComicPanel[] = [
  {
    id: 'entry-1',
    description: 'Alisha and Fiona walk side by side through the palace’s tall open crystal doors onto its polished floor, a round '
      + 'pressure plate beside the entrance and the forest and mountains behind them.',
    art: <img src={entryArt} alt="" />,
    lines: [
      { text: 'The plate sinks with a click, and the palace doors swing open.' },
      { speaker: 'Alisha', text: 'We’re in.' },
    ],
  },
  {
    id: 'entry-2',
    description: 'Alisha and Fiona inside the palace’s entry hall among lavender crystal columns, gold trim and flowering planters, '
      + 'with a closed crystal doorway at the top of the steps ahead.',
    art: <img src={interiorArt} alt="" />,
    lines: [{ speaker: 'Fiona', text: 'The Crystal Palace.' }],
  },
];
