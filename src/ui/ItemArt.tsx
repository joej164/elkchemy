import type { ReactNode } from 'react';
import { MAX_TIER, type Item, type Family } from '../board';
import type { Prize } from '../session';
import { DogArt, PalaceDoorArt } from './StoryArt';
import { itemPicture, pictureBookCover } from './BoardArt';

export const FAMILY_NAMES: Record<Family, string> = {
  grove: 'Grove', song: 'Song', crystal: 'Crystal', elk: 'Elk', photo: 'Photos', book: 'Book', wood: 'Wood', tool: 'Tools',
  planks: 'Planks', hardware: 'Chest hardware',
};

/** Per-tier display names for families that have them (tiers past the list use its last name). */
export const ITEM_NAMES: Partial<Record<Family, readonly string[]>> = {
  photo: ['Loose photos', 'Photo bundle', 'Scrapbook pages'], book: ['Old book', 'Book stack', 'Blank book', 'Picture Book'],
  wood: ['Fallen branches', 'Gathered bundle', 'Trimmed logs', 'Stacked logs'],
  tool: ['Loose tools', 'Bundled tools', 'Sorted tool set', 'Tool chest'],
};

/** An item's name, without its tier. */
export function itemName(item: Item): string {
  const names = ITEM_NAMES[item.family];
  return names ? names[Math.min(item.tier, names.length - 1)] : FAMILY_NAMES[item.family];
}

export function itemLabel(item: Item): string {
  return `${itemName(item)}, tier ${item.tier + 1} of ${MAX_TIER + 1}`;
}

const DARK = '#233a2b';
const S = { stroke: DARK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function note(x: number, y: number, key: number): ReactNode {
  return (
    <g key={key}>
      <path d={`M${x + 5} ${y} V${y - 18} l8 3`} fill="none" {...S} />
      <ellipse cx={x} cy={y} rx="6" ry="4.5" fill="#233a2b" />
    </g>
  );
}

function antler(sign: 1 | -1, tines: number): ReactNode {
  const x = (v: number) => 50 + sign * v;
  const tineY = [30, 22, 14];
  return (
    <g fill="none" stroke="#e6d3a3">
      <path d={`M${x(10)} 40 Q${x(22)} 34 ${x(26)} 8`} strokeWidth={5} />
      {tineY.slice(0, tines).map((y, i) => (
        <path key={i} d={`M${x(20 + i * 2)} ${y + 6} L${x(34 + i * 2)} ${y - 2}`} strokeWidth={4} />
      ))}
    </g>
  );
}

/** A cartoon elk's head (`t` extra tines, 0–3), for the Picture Book's photos of Fiona; the board uses its painted art. */
function elk(t: number): ReactNode {
  const tines = t; // 0..3 extra tines
  const outline = (s: 1 | -1) => (
    <g key={s}>
      <g stroke={DARK} strokeWidth={8} fill="none" strokeLinecap="round">
        <path d={`M${50 + s * 10} 40 Q${50 + s * 22} 34 ${50 + s * 26} 8`} />
        {[30, 22, 14].slice(0, tines).map((y, i) => (
          <path key={i} d={`M${50 + s * (20 + i * 2)} ${y + 6} L${50 + s * (34 + i * 2)} ${y - 2}`} />
        ))}
      </g>
    </g>
  );
  return (
    <>
      {outline(1)}{outline(-1)}
      {antler(1, tines)}{antler(-1, tines)}
      <ellipse cx="34" cy="48" rx="8" ry="5" transform="rotate(-25 34 48)" fill="#8a5a34" {...S} />
      <ellipse cx="66" cy="48" rx="8" ry="5" transform="rotate(25 66 48)" fill="#8a5a34" {...S} />
      <path d="M36 42 Q50 36 64 42 L60 66 Q50 76 40 66 Z" fill="#8a5a34" {...S} />
      <ellipse cx="50" cy="68" rx="9" ry="6" fill="#4a3020" {...S} strokeWidth={1.5} />
      <circle cx="43" cy="52" r="2.5" fill="#4a3020" />
      <circle cx="57" cy="52" r="2.5" fill="#4a3020" />
    </>
  );
}

/** The Picture Book alone, as the board draws it (book-tier-4 of the board art), filling its box. Decorative. */
export function PictureBookCoverArt() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible" aria-hidden="true" focusable="false">
      {pictureBookCover()}
    </svg>
  );
}

type Snap = 'woodland' | 'fiona' | 'keepsake';

/** A print's picture, on 100 × 80: a sunny woodland, Fiona (a small drawn elk) or keepsakes (a disc, music). */
function scene(kind: Snap): ReactNode {
  if (kind === 'woodland') {
    return (
      <>
        <rect width="100" height="80" fill="#bfe0f0" />
        <circle cx="76" cy="20" r="9" fill="#f2c14e" />
        <path d="M0 58 Q30 40 60 54 Q80 44 100 52 V80 H0 Z" fill="#4f8a3c" />
        {[[18, 60], [32, 54], [84, 56]].map(([x, y]) => (
          <path key={x} d={`M${x} ${y - 28} L${x + 10} ${y} H${x - 10} Z`} fill="#2f5e2a" {...S} strokeWidth={1.5} />
        ))}
      </>
    );
  }
  if (kind === 'fiona') {
    return (
      <>
        <rect width="100" height="80" fill="#f3d9a4" />
        <path d="M0 66 Q50 56 100 66 V80 H0 Z" fill="#8bb46a" />
        <g transform="translate(14 0) scale(0.72)">{elk(2)}</g>
      </>
    );
  }
  return (
    <>
      <rect width="100" height="80" fill="#d8ccef" />
      <g transform="translate(-6 -8) scale(1.6)">{disc(30, 38, -18, '#f28c28')}</g>
      {note(64, 56, 0)}
      {note(82, 38, 1)}
    </>
  );
}

/** A white-bordered print with gold photo corners: its picture `w` wide (5:4) centred on x, y, turned by `rot`. */
function print(kind: Snap, x: number, y: number, w: number, rot: number, key: number): ReactNode {
  const h = w * 0.8;
  const [l, t, r, b] = [x - w / 2 - 3, y - h / 2 - 3, x + w / 2 + 3, y + h / 2 + 3];
  return (
    <g key={key} transform={`rotate(${rot} ${x} ${y})`}>
      <rect x={l} y={t} width={r - l} height={b - t} rx="1" fill="#fffaf0" {...S} strokeWidth={1.2} />
      <svg x={x - w / 2} y={y - h / 2} width={w} height={h} viewBox="0 0 100 80" preserveAspectRatio="xMidYMid slice">{scene(kind)}</svg>
      {[[l, t, 1, 1], [r, t, -1, 1], [l, b, 1, -1], [r, b, -1, -1]].map(([cx, cy, dx, dy]) => (
        <path key={`${cx},${cy}`} d={`M${cx} ${cy} h${dx * 7} L${cx} ${cy + dy * 7} Z`} fill="#c9952b" />
      ))}
    </g>
  );
}

// The Picture Book's pages, as its opening turns them (even pages face up, odd ones on their backs; 6 lies under them
// all): each a print or two, and a few lines of writing under one. Pages seen together never repeat a subject.
const PAGES: readonly (readonly [Snap, number, number, number, number])[][] = [
  [['woodland', 50, 40, 56, -4]],
  [['fiona', 50, 40, 56, 3]],
  [['keepsake', 36, 32, 40, -6], ['woodland', 64, 66, 36, 5]],
  [['woodland', 50, 40, 56, 2]],
  [['keepsake', 50, 40, 56, -3]],
  [['fiona', 50, 40, 56, 4]],
  [['keepsake', 36, 34, 40, -5], ['woodland', 66, 66, 34, 6]],
];

/** A page of the Picture Book (`page`, from 0): small cartoon photographs in photo corners. Decorative. */
export function BookPageArt({ page }: { page: number }) {
  const prints = PAGES[page % PAGES.length];
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" data-page={page}>
      {prints.map(([kind, x, y, w, rot], i) => print(kind, x, y, w, rot, i))}
      {prints.length === 1 && <path d="M24 82 H70 M24 89 H56" fill="none" stroke="#c9b48a" strokeWidth={2} strokeLinecap="round" />}
    </svg>
  );
}

/** A flying disc seen at an angle: its rim and flight plate. */
function disc(cx: number, cy: number, tilt: number, fill: string): ReactNode {
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`}>
      <ellipse cx={cx} cy={cy} rx="12" ry="7" fill={fill} {...S} />
      <ellipse cx={cx} cy={cy - 1} rx="7" ry="3.5" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth={1.5} />
    </g>
  );
}

/**
 * Room levels' treasure: a disc-golf backpack. Closed (until collected): zipped shut under its lid, handle up, no discs
 * showing. Open (once collected): the lid folded back, three discs standing inside and two more beside it.
 * Decorative (callers give the text).
 */
export function BackpackArt({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" data-backpack={open ? 'open' : 'closed'}>
      {open ? (
        <>
          <path d="M33 38 L27 14 Q50 5 73 14 L67 38 Z" fill="#24576f" {...S} />
          <path d="M30 39 Q50 29 70 39 Q50 48 30 39 Z" fill="#102a36" {...S} />
          <ellipse cx="40" cy="40" rx="8" ry="14" fill="#f28c28" {...S} />
          <ellipse cx="60" cy="40" rx="8" ry="14" fill="#e45a84" {...S} />
          <ellipse cx="50" cy="38" rx="8" ry="16" fill="#e8d34a" {...S} />
          <path d="M30 39 Q50 48 70 39 L70 82 Q70 90 62 90 L38 90 Q30 90 30 82 Z" fill="#2f6f8f" {...S} />
          <rect x="37" y="58" width="26" height="24" rx="7" fill="#24576f" {...S} />
          <path d="M41 64 H59" {...S} stroke="#f2c14e" strokeWidth={3} />
          {disc(15, 80, -28, '#8ccf3f')}
          {disc(85, 80, 28, '#6cc3e8')}
        </>
      ) : (
        <>
          <path d="M42 24 Q50 9 58 24" fill="none" {...S} strokeWidth={4} />
          <rect x="27" y="22" width="46" height="68" rx="14" fill="#2f6f8f" {...S} />
          <path d="M27 40 Q27 22 41 22 H59 Q73 22 73 40 Q50 49 27 40 Z" fill="#24576f" {...S} />
          <path d="M31 42 Q50 49 69 42" fill="none" stroke="#f2c14e" strokeWidth={3} strokeLinecap="round" />
          <rect x="63" y="41" width="6" height="10" rx="2" fill="#f2c14e" {...S} strokeWidth={1.5} />
          <rect x="36" y="58" width="28" height="24" rx="7" fill="#24576f" {...S} />
          <path d="M40 64 H60" {...S} stroke="#f2c14e" strokeWidth={3} />
        </>
      )}
    </svg>
  );
}

/**
 * The Hidden Cache's treasure: a clarinet case. Closed (until opened): latched shut, handle up, a gold note on the lid.
 * Open: the lid raised on its blue lining, and a whole, assembled clarinet (mouthpiece, barrel, two joints with keys,
 * bell) resting across it. Decorative (callers give the text).
 */
export function ClarinetCaseArt({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" data-clarinet={open ? 'open' : 'closed'}>
      {open ? (
        <>
          <path d="M10 48 L15 16 Q16 12 20 12 H80 Q84 12 85 16 L90 48 Z" fill="#4a2f24" {...S} />
          <path d="M16 46 L20 18 H80 L84 46 Z" fill="#3f63b8" />
          <rect x="7" y="46" width="86" height="40" rx="8" fill="#4a2f24" {...S} />
          <rect x="12" y="50" width="76" height="31" rx="5" fill="#2c4a96" />
          <g transform="rotate(-26 50 54)">
            <path d="M5 51.5 L17 49.5 V58.5 L5 56.5 Z" fill="#1e1e24" {...S} strokeWidth={1.5} />
            <path d="M4.5 51.8 L4.5 56.2" stroke="#e6d3a3" strokeWidth={2} />
            <rect x="11" y="49" width="3" height="10" rx="1" fill="#d9dde3" {...S} strokeWidth={1} />
            <rect x="17" y="47.5" width="11" height="13" rx="3" fill="#1e1e24" {...S} strokeWidth={1.5} />
            <rect x="28" y="49" width="58" height="10" fill="#1e1e24" {...S} strokeWidth={1.5} />
            <path d="M86 49 L93 44 Q97 43 97 46 V62 Q97 65 93 64 L86 59 Z" fill="#1e1e24" {...S} strokeWidth={1.5} />
            {[17, 28, 56, 86].map((x) => <rect key={x} x={x - 1} y="48.2" width="2.4" height="11.6" fill="#d9dde3" />)}
            <path d="M31 50.8 H53 M59 50.8 H83" stroke="#d9dde3" strokeWidth={1.4} />
            {[34, 40, 46, 62, 68, 74, 80].map((x) => (
              <circle key={x} cx={x} cy="54.6" r="2" fill="#d9dde3" stroke={DARK} strokeWidth={0.8} />
            ))}
          </g>
        </>
      ) : (
        <>
          <path d="M40 38 V31 Q40 26 45 26 H55 Q60 26 60 31 V38" fill="none" stroke={DARK} strokeWidth={4} strokeLinecap="round" />
          <rect x="7" y="36" width="86" height="40" rx="10" fill="#4a2f24" {...S} />
          <rect x="12" y="39" width="76" height="8" rx="4" fill="#6b4636" />
          <path d="M8 52 H92" stroke="#2a1a14" strokeWidth={2} />
          {[22, 70].map((x) => <rect key={x} x={x} y="47" width="8" height="10" rx="2" fill="#f2c14e" {...S} strokeWidth={1.5} />)}
          <ellipse cx="48" cy="67" rx="4.5" ry="3.2" fill="#f2c14e" />
          <path d="M52 67 V57 L58 59.5" fill="none" stroke="#f2c14e" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

// A ukulele case's outline seen from above: the lower bout (centre 27,56, r 21) and upper bout (50,56, r 15), meeting
// at x 43.2, then the neck section (y 49-63) to a rounded head end.
const UKULELE_CASE = 'M43.2 42.6 A21 21 0 1 0 43.2 69.4 A15 15 0 0 0 63.3 63 L92 63 Q97 63 97 56 Q97 49 92 49 L63.3 49 ' +
  'A15 15 0 0 0 43.2 42.6 Z';

/**
 * The Crystal Palace's treasure: a ukulele case. Closed (until opened): a hard case in a ukulele's shape, with a handle
 * and two gold latches. Open: its lid raised behind, and a whole ukulele on the lining: body with sound hole and
 * bridge, four strings, a fretted neck and a headstock with four tuning pegs. Decorative (callers give the text).
 */
export function UkuleleCaseArt({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" data-ukulele={open ? 'open' : 'closed'}>
      {open ? (
        <>
          <path d={UKULELE_CASE} transform="translate(0 -14)" fill="#1f4650" {...S} />
          <path d={UKULELE_CASE} transform="translate(0 -14) translate(5 6.7) scale(0.88)" fill="#7d2636" />
          <path d={UKULELE_CASE} fill="#1f4650" {...S} />
          <path d={UKULELE_CASE} transform="translate(5 6.7) scale(0.88)" fill="#a8364a" />
          <rect x="56" y="52.5" width="29" height="7" fill="#a8743f" {...S} strokeWidth={1.5} />
          {[60, 64, 68, 72, 76, 80].map((x) => <path key={x} d={`M${x} 52.8 V59.2`} stroke="#d9dde3" strokeWidth={1.2} />)}
          <path d="M84 50 L95 48.5 Q97 56 95 63.5 L84 62 Z" fill="#7a4f2a" {...S} strokeWidth={1.5} />
          {[[87, 47], [92.5, 46], [87, 65], [92.5, 66]].map(([x, y]) => (
            <circle key={`${x},${y}`} cx={x} cy={y} r="2.2" fill="#d9dde3" stroke={DARK} strokeWidth={1} />
          ))}
          <circle cx="27" cy="56" r="16" fill="#e3b778" {...S} />
          <circle cx="46" cy="56" r="11.5" fill="#e3b778" {...S} />
          <circle cx="27" cy="56" r="16" fill="#e3b778" />
          <circle cx="45" cy="56" r="4.2" fill="#3b2412" />
          <rect x="19" y="50" width="5" height="12" rx="1.5" fill="#5a3820" />
          {[53.6, 55.2, 56.8, 58.4].map((y) => <path key={y} d={`M22 ${y} H88`} stroke="#f4ecd8" strokeWidth={0.8} />)}
        </>
      ) : (
        <>
          <path d="M20 37 Q27 22 36 36" fill="none" stroke={DARK} strokeWidth={4} strokeLinecap="round" />
          <path d={UKULELE_CASE} fill="#2c5f6e" {...S} />
          <path d={UKULELE_CASE} transform="translate(5 6.7) scale(0.88)" fill="none" stroke="#7fb3bd" strokeWidth={1.5} opacity="0.7" />
          {[[14, 70], [36, 72]].map(([x, y]) => <rect key={x} x={x} y={y} width="7" height="6" rx="1.5" fill="#f2c14e" {...S} strokeWidth={1.2} />)}
          <rect x="86" y="53" width="6" height="6" rx="1.5" fill="#f2c14e" {...S} strokeWidth={1.2} />
        </>
      )}
    </svg>
  );
}

/** Merge to treasure: the crafted chest, closed (opening replaces it with its contents). Decorative. */
export function ChestArt() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" data-chest="">
      <path d="M14 46 Q14 22 50 22 Q86 22 86 46 Z" fill="#8b5a2b" stroke={DARK} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="14" y="46" width="72" height="36" rx="4" fill="#a86b33" stroke={DARK} strokeWidth="2.5" />
      {[28, 64].map((x) => (
        <g key={x} fill="#e8b84a" stroke={DARK} strokeWidth="1.5">
          <rect x={x} y="29" width="8" height="17" />
          <rect x={x} y="46" width="8" height="36" />
        </g>
      ))}
      <rect x="43" y="40" width="14" height="17" rx="2" fill="#f2c14e" stroke={DARK} strokeWidth="2" />
      <circle cx="50" cy="47" r="2.4" fill={DARK} />
      <path d="M50 49 V53" stroke={DARK} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Attic: a closed cardboard shoebox of stored belongings, lid on, string-tied label. Decorative. */
export function ShoeboxArt() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" data-container="shoebox">
      <rect x="14" y="44" width="72" height="38" rx="3" fill="#c79a62" {...S} />
      <rect x="10" y="34" width="80" height="16" rx="3" fill="#d9ae76" {...S} />
      <path d="M14 56 H86" stroke="#a97c48" strokeWidth={1.5} fill="none" />
      <path d="M38 34 V50 M62 34 V50" stroke="#b78a55" strokeWidth={1.5} fill="none" />
      <path d="M50 50 Q44 60 40 66" fill="none" stroke="#f3e6c8" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M50 50 Q56 62 60 64" fill="none" stroke="#f3e6c8" strokeWidth={2.5} strokeLinecap="round" />
      <rect x="28" y="62" width="26" height="14" rx="2" fill="#fffaf0" {...S} strokeWidth={1.5} />
      <path d="M32 67 H50 M32 71 H44" fill="none" stroke="#a97c48" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx="31" cy="64.5" r="1.4" fill={DARK} />
    </svg>
  );
}

/** Attic: an old, precious wooden keepsake box with brass corners, clasp and a carved leaf, faintly glimmering. Decorative. */
export function KeepsakeBoxArt() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" data-container="keepsake-box">
      <circle cx="50" cy="52" r="42" fill="#f2c14e" opacity="0.25" />
      <path d="M14 46 L22 28 H78 L86 46 Z" fill="#5a3320" {...S} strokeWidth={2.5} />
      <rect x="14" y="46" width="72" height="34" rx="3" fill="#4a2a1a" {...S} strokeWidth={2.5} />
      <path d="M50 44 Q38 38 50 30 Q62 38 50 44 Z" fill="#8a5a34" stroke="#e8b84a" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M50 44 V31" stroke="#e8b84a" strokeWidth={1.2} fill="none" />
      <path d="M36 40 Q30 38 29 33 M64 40 Q70 38 71 33" fill="none" stroke="#e8b84a" strokeWidth={1.5} strokeLinecap="round" />
      {[[14, 46, 1], [86, 46, -1]].map(([x, y, d]) => (
        <path key={x} d={`M${x} ${y - 14} L${x + d * 8} ${y - 14} L${x} ${y} L${x} ${y + 34} L${x + d * 8} ${y + 34}`} fill="none" stroke="#e8b84a" strokeWidth={4} strokeLinejoin="round" />
      ))}
      <path d="M14 46 H86" stroke="#e8b84a" strokeWidth={3} />
      <rect x="43" y="42" width="14" height="16" rx="2" fill="#f2c14e" {...S} />
      <circle cx="50" cy="49" r="2.2" fill={DARK} />
      <path d="M50 51 V54" stroke={DARK} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M80 18 V30 M74 24 H86" stroke="#fff0c2" strokeWidth={2} strokeLinecap="round" />
      <path d="M18 14 V22 M14 18 H22" stroke="#fff0c2" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

/** Attic: a pale dusty sheet draped over a box-shaped lump, hem on the floor. Decorative. */
export function DustSheetArt() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" data-container="dust-sheet">
      <ellipse cx="50" cy="82" rx="42" ry="5" fill="#233a2b" opacity="0.15" />
      <path d="M22 80 Q18 50 28 38 Q34 28 50 27 Q66 28 72 38 Q82 50 78 80 Q72 84 66 80 Q60 85 54 80 Q48 85 42 80 Q36 84 30 80 Q26 84 22 80 Z" fill="#ece6d6" {...S} strokeWidth={2.5} />
      <path d="M30 40 Q50 46 70 40" fill="none" stroke="#cfc6ae" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M36 48 Q34 64 36 78 M50 50 Q52 64 50 79 M64 48 Q67 64 64 78" fill="none" stroke="#cfc6ae" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx="38" cy="34" r="1.4" fill="#cfc6ae" />
      <circle cx="62" cy="31" r="1" fill="#cfc6ae" />
      <circle cx="56" cy="38" r="1.2" fill="#cfc6ae" />
    </svg>
  );
}

/** The woodland cleanup's goal: a signpost to the trail north; once followed, the trail past it lit gold. Decorative. */
export function TrailSignArt({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" data-trail={open ? 'followed' : 'waiting'}>
      {open && <path d="M50 96 Q38 70 52 50 Q66 30 50 6" fill="none" stroke="#f2c14e" strokeWidth={10} strokeLinecap="round" opacity={0.6} />}
      <ellipse cx="50" cy="93" rx="20" ry="5" fill="#5f8f3a" {...S} strokeWidth={1.5} />
      <rect x="46" y="18" width="8" height="76" rx="2" fill="#8a5a32" {...S} />
      <path d="M20 22 H70 L81 32 L70 42 H20 Z" fill="#c8955a" {...S} />
      <path d="M80 50 H30 L19 60 L30 70 H80 Z" fill="#b07d48" {...S} />
      <path d="M32 32 H64 M36 60 H68" stroke={DARK} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

/** A room level's treasure, closed until `open`. */
export function PrizeArt({ prize = 'backpack', open }: { prize?: Prize; open: boolean }) {
  if (prize === 'entrance' || prize === 'door') return <PalaceDoorArt open={open} />;
  if (prize === 'trail') return <TrailSignArt open={open} />;
  if (prize === 'dog') return <DogArt />;
  if (prize === 'ukulele') return <UkuleleCaseArt open={open} />;
  return prize === 'clarinet' ? <ClarinetCaseArt open={open} /> : <BackpackArt open={open} />;
}

// The top tier (five pips): the family's tier-4 picture on a gold radiance, enlarged around its centre so its rays and
// glow still show around the painted pictures, which fill more of the tile than the old drawings did.
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);
function radiance(): ReactNode {
  return (
    <g data-radiance="" transform="translate(50 44) scale(1.3) translate(-50 -44)">
      {RAYS.map((a) => (
        <path key={a} d="M50 2 L55 14 L45 14 Z" fill="#f2c14e" stroke="#c9952b" strokeWidth="1" transform={`rotate(${a} 50 44)`} />
      ))}
      <circle cx="50" cy="44" r="34" fill="#f2c14e" opacity="0.45" stroke="#e8b84a" strokeWidth="3" />
    </g>
  );
}

export function ItemArt({ item, className }: { item: Item; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible" aria-hidden="true" focusable="false" className={className}>
      {item.tier === MAX_TIER && radiance()}
      {itemPicture(item.family, item.tier)}
      {Array.from({ length: item.tier + 1 }, (_, i) => (
        <circle key={i} data-pip="" cx={50 + (i - item.tier / 2) * 13} cy="90" r="4.5" fill="#e8b84a" stroke={DARK} strokeWidth="2" />
      ))}
    </svg>
  );
}
