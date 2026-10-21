// The attic story prototype adds keepsakes: photos (loose → bundle → collection) and books (old book → book stack →
// blank book), which combine into the Picture Book. Generated puzzles and handcrafted levels use only the four woodland
// families.
export type Family = 'grove' | 'song' | 'crystal' | 'elk' | 'photo' | 'book';
// Five tiers, shown as 1–5 of 5 (pips under the art). Handcrafted levels use the first four; generated puzzles may
// target the fifth. The top tier never merges.
export type Tier = 0 | 1 | 2 | 3 | 4;
export const MAX_TIER = 4;
export interface Item { readonly family: Family; readonly tier: Tier }
export type Cell = Item | null;
export type Board = readonly (readonly Cell[])[];
export interface Pos { readonly row: number; readonly col: number }
export type DropKind = 'move' | 'swap' | 'merge' | 'none';
export interface DropResult { readonly board: Board; readonly kind: DropKind; readonly consumed: readonly Pos[] }

function inBounds(board: Board, p: Pos): boolean {
  return (
    Number.isInteger(p.row) && Number.isInteger(p.col) &&
    p.row >= 0 && p.row < board.length && p.col >= 0 && p.col < board[p.row].length
  );
}

function validate(board: Board, from: Pos, to: Pos): void {
  if (!inBounds(board, from) || !inBounds(board, to)) throw new Error('Position out of bounds');
  if (board[from.row][from.col] === null) throw new Error('Source cell is empty');
}

const same = (a: Pos, b: Pos) => a.row === b.row && a.col === b.col;

/**
 * The cells a drop from `from` onto `to` would merge, or [] if it would not merge.
 * `connects` (region levels): the matching group only grows through cells it accepts, so it never crosses a region border.
 */
export function previewMerge(board: Board, from: Pos, to: Pos, connects?: (p: Pos) => boolean): Pos[] {
  validate(board, from, to);
  if (same(from, to)) return [];
  const src = board[from.row][from.col]!;
  const tgt = board[to.row][to.col];
  if (!tgt || tgt.family !== src.family || tgt.tier !== src.tier || src.tier === MAX_TIER) return [];

  const key = (p: Pos) => `${p.row},${p.col}`;
  const visited = new Set([key(to), key(from)]);
  const queue: Pos[] = [{ row: to.row, col: to.col }];
  const group: Pos[] = [];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    group.push(cur);
    const neighbors: Pos[] = [
      { row: cur.row - 1, col: cur.col },
      { row: cur.row, col: cur.col + 1 },
      { row: cur.row + 1, col: cur.col },
      { row: cur.row, col: cur.col - 1 },
    ];
    for (const n of neighbors) {
      if (!inBounds(board, n) || visited.has(key(n)) || (connects && !connects(n))) continue;
      const item = board[n.row][n.col];
      if (item && item.family === src.family && item.tier === src.tier) {
        visited.add(key(n));
        queue.push(n);
      }
    }
  }

  const available = group.length + 1;
  const count = available >= 5 ? 4 : available >= 3 ? 2 : 0;
  if (count === 0) return [];
  return [from, ...group.slice(0, count)];
}

export function drop(board: Board, from: Pos, to: Pos, connects?: (p: Pos) => boolean): DropResult {
  validate(board, from, to);
  if (same(from, to)) return { board, kind: 'none', consumed: [] };

  const rows: Cell[][] = board.map((r) => [...r]);
  const src = board[from.row][from.col]!;
  const tgt = board[to.row][to.col];

  if (!tgt) {
    rows[to.row][to.col] = src;
    rows[from.row][from.col] = null;
    return { board: rows, kind: 'move', consumed: [] };
  }

  const consumed = previewMerge(board, from, to, connects);
  if (consumed.length > 0) {
    for (const p of consumed) rows[p.row][p.col] = null;
    const upgraded: Item = { family: src.family, tier: (src.tier + 1) as Tier };
    rows[to.row][to.col] = upgraded;
    if (consumed.length === 5) rows[from.row][from.col] = { ...upgraded };
    return { board: rows, kind: 'merge', consumed };
  }

  rows[to.row][to.col] = src;
  rows[from.row][from.col] = tgt;
  return { board: rows, kind: 'swap', consumed: [] };
}
