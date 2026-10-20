// Decorative attic scenery placed around the edges of the play area.
const DARK = '#233a2b';
const S = { stroke: DARK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

type Props = { className?: string };

/** A small round attic window: wooden frame, cross bars, soft rain-blue glass. */
export function AtticWindowArt({ className }: Props) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" className={className}>
      <circle cx="50" cy="50" r="44" fill="#8a5a34" {...S} strokeWidth={2.5} />
      <circle cx="50" cy="50" r="36" fill="#bcd8e6" {...S} />
      <path d="M22 66 Q40 52 60 62 Q74 52 82 60 A36 36 0 0 1 22 66 Z" fill="#dcecf3" />
      <path d="M30 28 Q40 22 52 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity="0.7" />
      <path d="M14 50 H86 M50 14 V86" stroke="#6b4a2f" strokeWidth={5} />
      <path d="M14 50 H86 M50 14 V86" stroke={DARK} strokeWidth={1} fill="none" />
      <circle cx="50" cy="50" r="36" fill="none" {...S} />
      <path d="M34 36 L31 44 M66 60 L63 68 M60 30 L57 38" stroke="#7fa6bd" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/** A bare bulb hanging on a cord from the top edge, with a warm glow. */
export function AtticLampArt({ className }: Props) {
  return (
    <svg viewBox="0 0 60 100" width="100%" height="100%" aria-hidden="true" focusable="false" className={className}>
      <circle cx="30" cy="62" r="26" fill="#f2c14e" opacity="0.22" />
      <circle cx="30" cy="62" r="18" fill="#f2c14e" opacity="0.28" />
      <path d="M30 0 V40" stroke={DARK} strokeWidth={2.5} fill="none" />
      <rect x="24" y="38" width="12" height="10" rx="2" fill="#6b4a2f" {...S} />
      <path d="M25 48 H35 Q44 54 44 63 A14 14 0 0 1 16 63 Q16 54 25 48 Z" fill="#fff0c2" {...S} />
      <path d="M25 66 Q30 58 35 66 M30 62 V66" fill="none" stroke="#e8b84a" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/** Two or three stacked cardboard storage boxes, slightly askew, resting on the bottom edge. */
export function StackedBoxesArt({ className }: Props) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" className={className}>
      <rect x="6" y="64" width="62" height="34" rx="2" fill="#c79a62" {...S} />
      <path d="M6 72 H68" stroke="#a97c48" strokeWidth={1.5} />
      <rect x="22" y="80" width="30" height="8" rx="2" fill="#fffaf0" {...S} strokeWidth={1.5} />
      <rect x="64" y="72" width="32" height="26" rx="2" fill="#b78a55" {...S} />
      <path d="M64 79 H96" stroke="#8f6a3c" strokeWidth={1.5} />
      <g transform="rotate(-5 36 52)">
        <rect x="12" y="34" width="48" height="30" rx="2" fill="#d9ae76" {...S} />
        <path d="M12 42 H60 M36 34 V42" stroke="#b78a55" strokeWidth={1.5} fill="none" />
        <path d="M24 52 Q36 58 48 52" fill="none" stroke="#f3e6c8" strokeWidth={2.5} strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** A tall narrow wooden shelf unit (jars, book spines, a small framed picture, a teapot); its top reads well when cropped. */
export function ShelfArt({ className }: Props) {
  const ys = [48, 94, 140, 186];
  return (
    <svg viewBox="0 0 40 200" width="100%" height="100%" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false"
      className={className}>
      <rect x="2" y="2" width="36" height="198" fill="#6b4a2f" {...S} />
      <rect x="5" y="5" width="30" height="195" fill="#4a3020" />
      {/* shelf 1: framed picture and a jar */}
      <rect x="8" y="14" width="14" height="18" rx="1" fill="#c79a62" {...S} strokeWidth={1.5} />
      <rect x="10.5" y="16.5" width="9" height="13" fill="#bcd8e6" />
      <path d="M10.5 29.5 L14 23 L17 27 L19.5 24 V29.5 Z" fill="#4f8a3c" />
      <rect x="26" y="30" width="8" height="18" rx="2" fill="#dcecf3" {...S} strokeWidth={1.5} />
      <rect x="26" y="26" width="8" height="5" rx="1" fill="#8a5a34" {...S} strokeWidth={1.5} />
      {/* shelf 2: book spines */}
      {[['#7a2338', 22], ['#4a7a8a', 28], ['#e8b84a', 20], ['#4f8a3c', 26], ['#b8324a', 24]].map(([c, h], i) => (
        <rect key={c as string} x={7 + i * 5.4} y={94 - (h as number)} width="5" height={h as number} fill={c as string} {...S} strokeWidth={1.2} />
      ))}
      {/* shelf 3: teapot */}
      <ellipse cx="18" cy="130" rx="9" ry="8" fill="#d9ae76" {...S} strokeWidth={1.5} />
      <rect x="14" y="120" width="8" height="3" rx="1.5" fill="#8a5a34" {...S} strokeWidth={1.2} />
      <path d="M26 128 L33 123 L31 131 Z" fill="#d9ae76" {...S} strokeWidth={1.2} />
      <path d="M9 126 Q4 130 10 135" fill="none" {...S} strokeWidth={1.5} />
      {/* shelf 4: jars */}
      <rect x="8" y="164" width="9" height="22" rx="2" fill="#e8b84a" opacity="0.9" {...S} strokeWidth={1.5} />
      <rect x="21" y="168" width="11" height="18" rx="2" fill="#dcecf3" {...S} strokeWidth={1.5} />
      {ys.map((y) => (
        <rect key={y} x="2" y={y} width="36" height="6" fill="#8a5a34" {...S} />
      ))}
    </svg>
  );
}
