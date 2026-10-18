import type { Pos } from '../board';

export const DRAG_THRESHOLD = 8;

export interface Point { x: number; y: number }

export function exceedsThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > DRAG_THRESHOLD;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
};

/** Next focus position for an arrow key, clamped to the board; null for other keys. */
export function moveFocus(pos: Pos, key: string, rows: number, cols: number): Pos | null {
  const d = ARROWS[key];
  if (!d) return null;
  return {
    row: Math.min(rows - 1, Math.max(0, pos.row + d[0])),
    col: Math.min(cols - 1, Math.max(0, pos.col + d[1])),
  };
}

/** Scroll offset that keeps the content under the finger. The browser clamps the result. */
export function panScroll(startScroll: Point, startPoint: Point, point: Point): Point {
  return { x: startScroll.x - (point.x - startPoint.x), y: startScroll.y - (point.y - startPoint.y) };
}

/** Scroll offset that puts the content's middle at the viewport's middle (never negative). */
export function centerScroll(contentSize: number, viewportSize: number): number {
  return Math.max(0, (contentSize - viewportSize) / 2);
}
