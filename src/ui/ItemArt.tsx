import type { ReactNode } from 'react';
import type { Item, Family } from '../board';

export const FAMILY_NAMES: Record<Family, string> = { grove: 'Grove', song: 'Song', crystal: 'Crystal', elk: 'Elk' };

export function itemLabel(item: Item): string {
  return `${FAMILY_NAMES[item.family]}, tier ${item.tier + 1} of 4`;
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

export function ItemArt({ item, className }: { item: Item; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" className={className}>
      {ART[item.family](item.tier)}
      {Array.from({ length: item.tier + 1 }, (_, i) => (
        <circle key={i} data-pip="" cx={50 + (i - item.tier / 2) * 13} cy="90" r="4.5" fill="#e8b84a" stroke={DARK} strokeWidth="2" />
      ))}
    </svg>
  );
}
