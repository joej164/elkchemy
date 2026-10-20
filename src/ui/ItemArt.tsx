import type { ReactNode } from 'react';
import { MAX_TIER, type Item, type Family } from '../board';
import type { Prize } from '../session';

export const FAMILY_NAMES: Record<Family, string> = { grove: 'Grove', song: 'Song', crystal: 'Crystal', elk: 'Elk' };

export function itemLabel(item: Item): string {
  return `${FAMILY_NAMES[item.family]}, tier ${item.tier + 1} of ${MAX_TIER + 1}`;
}

const DARK = '#233a2b';
const S = { stroke: DARK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function grove(t: number): ReactNode {
  if (t === 0) {
    return (
      <>
        <path d="M50 74 V50" {...S} stroke="#6b4a2f" strokeWidth={4} fill="none" />
        <ellipse cx="38" cy="46" rx="14" ry="8" transform="rotate(-30 38 46)" fill="#4f8a3c" {...S} />
        <ellipse cx="62" cy="38" rx="14" ry="8" transform="rotate(30 62 38)" fill="#2f5e2a" {...S} />
      </>
    );
  }
  const r = [0, 22, 27, 29][t];
  return (
    <>
      {t === 3 && <circle cx="50" cy="40" r="38" fill="#f4ecd8" opacity="0.7" />}
      <rect x="44" y="50" width="12" height="26" fill="#6b4a2f" {...S} />
      <circle cx="50" cy="40" r={r} fill="#4f8a3c" {...S} />
      {t >= 2 && <circle cx="34" cy="48" r="15" fill="#2f5e2a" {...S} />}
      {t >= 2 && <circle cx="66" cy="48" r="15" fill="#2f5e2a" {...S} />}
      {t >= 2 && <circle cx="50" cy="34" r="18" fill="#4f8a3c" />}
      {t === 3 && [[40, 30], [60, 36], [48, 48], [32, 46], [66, 50]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="4" fill="#f2c6d0" {...S} strokeWidth={1.5} />
      ))}
    </>
  );
}

function note(x: number, y: number, key: number): ReactNode {
  return (
    <g key={key}>
      <path d={`M${x + 5} ${y} V${y - 18} l8 3`} fill="none" {...S} />
      <ellipse cx={x} cy={y} rx="6" ry="4.5" fill="#233a2b" />
    </g>
  );
}

function song(t: number): ReactNode {
  const notes = [[78, 40], [86, 26], [72, 22]].slice(0, t);
  return (
    <>
      {t === 3 && <path d="M28 30 l-4 -10 l8 4 l2 -10 l4 10" fill="#d9744a" {...S} />}
      <path d="M20 56 L6 48 L8 62 Z" fill="#2f5e2a" {...S} />
      <ellipse cx="38" cy="54" rx="22" ry="16" fill="#4a7fa8" {...S} />
      <path d="M26 58 Q38 74 54 56 Q42 66 26 58Z" fill="#d9744a" {...S} strokeWidth={1.5} />
      <circle cx="54" cy="38" r="11" fill="#4a7fa8" {...S} />
      <path d="M64 36 L74 40 L64 43 Z" fill="#e6d3a3" {...S} strokeWidth={1.5} />
      <circle cx="56" cy="36" r="2" fill={DARK} />
      <path d="M26 50 Q38 40 48 54 Q36 60 26 50Z" fill="#2f5e2a" opacity="0.6" />
      {notes.map(([x, y], i) => note(x, y, i))}
    </>
  );
}

function gem(cx: number, base: number, w: number, h: number, key: number, fill = '#7b5ea7'): ReactNode {
  const top = base - h, mid = base - h * 0.62, l = cx - w / 2, r = cx + w / 2;
  return (
    <g key={key}>
      <path d={`M${cx} ${top} L${r} ${mid} L${cx + w * 0.35} ${base} L${cx - w * 0.35} ${base} L${l} ${mid} Z`} fill={fill} {...S} />
      <path d={`M${cx} ${top} L${cx - w * 0.18} ${mid} L${l} ${mid} Z`} fill="#d8ccef" />
      <path d={`M${cx} ${top} L${cx + w * 0.18} ${mid} L${cx} ${base} L${cx - w * 0.18} ${mid} Z`} fill="#5fb3b3" opacity="0.8" />
    </g>
  );
}

function crystal(t: number): ReactNode {
  if (t === 0) {
    return (
      <path d="M50 22 L68 40 L50 72 L32 40 Z" fill="#7b5ea7" {...S} />
    );
  }
  const spark = (x: number, y: number) => (
    <path key={`${x}${y}`} d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`} fill="#f4ecd8" {...S} strokeWidth={1.5} />
  );
  return (
    <>
      {t === 1 && gem(50, 74, 36, 52, 0)}
      {t >= 2 && gem(28, 74, 24, 34, 1, '#5fb3b3')}
      {t >= 2 && gem(72, 74, 24, 38, 2, '#5fb3b3')}
      {t >= 2 && gem(50, 74, 34, 58, 3)}
      {t === 3 && gem(38, 74, 18, 40, 4, '#7b5ea7')}
      {t === 3 && gem(62, 74, 18, 44, 5, '#7b5ea7')}
      {t === 3 && spark(82, 22)}
      {t === 3 && spark(16, 30)}
    </>
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

const ART: Record<Family, (t: number) => ReactNode> = { grove, song, crystal, elk };

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

/** A room level's treasure, closed until `open`. */
export function PrizeArt({ prize = 'backpack', open }: { prize?: Prize; open: boolean }) {
  if (prize === 'ukulele') return <UkuleleCaseArt open={open} />;
  return prize === 'clarinet' ? <ClarinetCaseArt open={open} /> : <BackpackArt open={open} />;
}

// The top tier (five pips): the family's four-pip drawing on a gold radiance.
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);
function radiance(): ReactNode {
  return (
    <g data-radiance="">
      {RAYS.map((a) => (
        <path key={a} d="M50 2 L55 14 L45 14 Z" fill="#f2c14e" stroke="#c9952b" strokeWidth="1" transform={`rotate(${a} 50 44)`} />
      ))}
      <circle cx="50" cy="44" r="34" fill="#f2c14e" opacity="0.45" stroke="#e8b84a" strokeWidth="3" />
    </g>
  );
}

export function ItemArt({ item, className }: { item: Item; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" className={className}>
      {item.tier === MAX_TIER && radiance()}
      {ART[item.family](Math.min(item.tier, 3))}
      {Array.from({ length: item.tier + 1 }, (_, i) => (
        <circle key={i} data-pip="" cx={50 + (i - item.tier / 2) * 13} cy="90" r="4.5" fill="#e8b84a" stroke={DARK} strokeWidth="2" />
      ))}
    </svg>
  );
}
