import windowArt from '../assets/board/attic-window-v1.webp';
import lampArt from '../assets/board/attic-lamp-v1.webp';
import boxesArt from '../assets/board/attic-boxes-v1.webp';
import shelfArt from '../assets/board/attic-shelf-v1.webp';

// Decorative attic scenery placed around the edges of the play area.

type Props = { className?: string };

/** A small round attic window: wooden frame, cross bars, soft rain-blue glass. */
export function AtticWindowArt({ className }: Props) {
  return <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" className={className}>
    <image href={windowArt} width="100" height="100" preserveAspectRatio="xMidYMid meet" />
  </svg>;
}

/** A bare bulb hanging on a cord from the top edge, with a warm glow. */
export function AtticLampArt({ className }: Props) {
  return <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" className={className}>
    <image href={lampArt} width="100" height="100" preserveAspectRatio="xMidYMid meet" />
  </svg>;
}

/** Two or three stacked cardboard storage boxes, slightly askew, resting on the bottom edge. */
export function StackedBoxesArt({ className }: Props) {
  return <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" className={className}>
    <image href={boxesArt} width="100" height="100" preserveAspectRatio="xMidYMid meet" />
  </svg>;
}

/** A tall narrow wooden shelf unit (jars, book spines, a small framed picture, a teapot); its top reads well when cropped. */
export function ShelfArt({ className }: Props) {
  const ys = [48, 94, 140, 186];
  return <svg viewBox="0 0 40 200" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" focusable="false" className={className}>
    <image href={shelfArt} width="40" height="200" preserveAspectRatio="none" />
  </svg>;
}
