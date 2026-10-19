import {
  useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent, type PointerEvent, type ReactNode,
} from 'react';
import type { Item, Pos } from '../board';
import {
  isFixed, isOpen, regionAt, roomOf, routeFrom, routeOf, sealedRegion, type GateSymbol, type PlateUnlock, type Region, type TaskUnlock,
} from '../regions';
import { isCellOpen } from '../session';
import { ItemArt, itemLabel, PrizeArt } from './ItemArt';
import { prizeText, unlockNeed } from './messages';
import { centerScroll, exceedsThreshold, moveFocus, panScroll } from './navigation';
import {
  canDropAt, canPickUp, canUnlock, goalCells, openedRegion, previewCells, treasureShown, type UiAction, type UiState,
} from './controller';

// A click arriving this soon after a drag is the browser's follow-up click, not a tap.
const SUPPRESS_CLICK_MS = 500;

// An item gesture drags a tile; a pan gesture scrolls the viewport. Both start pending and
// only become a drag/pan once the pointer passes the threshold; until then it is a tap.
interface Pending {
  kind: 'item' | 'pan'; origin: Pos | null; x: number; y: number; pointerId: number; dragging: boolean;
  scrollLeft: number; scrollTop: number;
}
interface Drag { origin: Pos; x: number; y: number; size: number; hover: Pos | null }

const SPARKS = [0, 1, 2, 3, 4, 5];
const BURST = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const same = (a: Pos | null, b: Pos | null) => !!a && !!b && a.row === b.row && a.col === b.col;

function cellAt(root: HTMLElement | null, x: number, y: number): Pos | null {
  const el = document.elementFromPoint(x, y)?.closest('[data-cell]') as HTMLElement | null;
  if (!el || !root?.contains(el)) return null;
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);
  return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
}

/** A padlock, closed or open; decorative (callers give the text). */
export function LockIcon({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={open ? 'M8 11V7a4 4 0 0 1 7.6-1.7' : 'M8 11V7a4 4 0 0 1 8 0v4'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

/**
 * Room levels: a rune gate across a passage, drawn for a path running top to bottom (callers rotate it for one running
 * across): two standing stones with runes and, while closed, glowing bars between them. Decorative.
 */
export function RuneGate({ open = false }: { open?: boolean }) {
  const rune = open ? '#f2c14e' : '#8fe3ff';
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect x="4" y="26" width="20" height="48" rx="6" fill="#8d8f86" stroke="#2a2e28" strokeWidth="3" />
      <rect x="76" y="26" width="20" height="48" rx="6" fill="#8d8f86" stroke="#2a2e28" strokeWidth="3" />
      <path d="M14 36 V64 M8 44 L14 50 L8 56" fill="none" stroke={rune} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M86 36 V64 M80 50 L86 44 L92 50" fill="none" stroke={rune} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {!open && (
        <g stroke="#1b3a4a" strokeWidth="2">
          {[36, 48, 60].map((y) => <rect key={y} x="24" y={y} width="52" height="6" rx="3" fill="#8fe3ff" />)}
          <path d="M50 40 L57 51 L50 62 L43 51 Z" fill="#d9f6ff" />
        </g>
      )}
    </svg>
  );
}

/** A gate symbol's emblem, drawn around (`x`, `y`) at `size` (of 100): a fern frond, a cut crystal or a musical note. */
function emblem(symbol: GateSymbol, x: number, y: number, size: number, color: string): ReactNode {
  const k = size / 20;
  const at = `translate(${x} ${y}) scale(${k})`;
  if (symbol === 'fern') {
    return (
      <g transform={at} fill="none" stroke={color} strokeWidth={2.2 / k + 0.4} strokeLinecap="round">
        <path d="M0 9 Q1 0 -1 -9" />
        {[-6, -2, 2, 6].map((dy, i) => <path key={dy} d={`M${-0.2 * dy} ${dy} l${6 - i} ${-3} M${-0.2 * dy} ${dy} l${-6 + i} ${-3}`} />)}
      </g>
    );
  }
  if (symbol === 'crystal') {
    return <path transform={at} d="M0 -9 L7 -2 L0 9 L-7 -2 Z M-7 -2 H7" fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />;
  }
  return (
    <g transform={at}>
      <ellipse cx="-3" cy="6" rx="4.6" ry="3.4" fill={color} transform="rotate(-20 -3 6)" />
      <path d="M1 5.5 V-9 Q6 -6 7 -1" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
}

/** A round medallion carrying a symbol's emblem: dark and grey while unlit, gold once lit. */
function medallion(symbol: GateSymbol, x: number, r: number, lit: boolean): ReactNode {
  return (
    <g key={symbol} data-symbol={symbol} data-lit={lit ? 'true' : 'false'}>
      <circle cx={x} cy="50" r={r} fill={lit ? '#f2c14e' : '#2b3a40'} stroke={lit ? '#fff3c4' : '#1b3a4a'} strokeWidth={r / 5} />
      {emblem(symbol, x, 50, r * 1.35, lit ? '#233a2b' : '#7d8b94')}
    </g>
  );
}

/**
 * The symbols of the tasks a sealed gate needs, in a row across it, each unlit until `lit`. Decorative (callers give
 * the text).
 */
export function GateSymbols({ symbols, lit }: { symbols: readonly GateSymbol[]; lit: readonly boolean[] }) {
  const step = 100 / symbols.length;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="gate-symbols">
      {symbols.map((sym, i) => medallion(sym, step * (i + 0.5), Math.min(15, step / 2 - 1.5), lit[i]))}
    </svg>
  );
}

/** One symbol's medallion on its own, unlit or lit, as on its gate. Decorative. */
export function SymbolIcon({ symbol, lit }: { symbol: GateSymbol; lit: boolean }) {
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">{medallion(symbol, 50, 44, lit)}</svg>;
}

/** A crystal palace wall: pale crystal blocks with a spire rising through them. Decorative. */
function PalaceWall() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect width="100" height="100" fill="#b9a6dc" />
      <path d="M0 34 H100 M0 67 H100 M24 0 V34 M76 34 V67 M30 67 V100" stroke="#8f78c0" strokeWidth="3" />
      <path d="M50 6 L65 38 L59 94 H41 L35 38 Z" fill="#e4dbf5" stroke="#7b5ea7" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 6 V94 M35 38 H65" stroke="#5fb3b3" strokeWidth="2.5" opacity="0.8" />
    </svg>
  );
}

const SIDES = [['t', -1, 0], ['r', 0, 1], ['b', 1, 0], ['l', 0, -1]] as const;

/** `onOverflowChange` reports whether the board overflows its viewport (so it needs panning), whenever that changes. */
export function Board({ state, dispatch, onOverflowChange }: {
  state: UiState; dispatch: Dispatch<UiAction>; onOverflowChange?: (overflowing: boolean) => void;
}) {
  const board = state.session.board;
  const { regions, tasks } = state.session.level;
  const roomLevel = state.session.level.goal.kind === 'treasure';
  const rows = board.length;
  const cols = board[0].length;
  const over = state.status !== 'playing';
  const [drag, setDrag] = useState<Drag | null>(null);
  const [mouseHover, setMouseHover] = useState<Pos | null>(null);
  // Room levels: terrain is not a cell, and neither is a hidden region until it opens.
  const isCell = (p: Pos) => {
    if (!regions) return true;
    const i = regionAt(regions, p);
    return i !== -1 && !(regions[i].hidden && !isOpen(state.session, i));
  };
  // Room levels start on the first open cell, so a locked room (the palace in a corner) never takes the first tab stop.
  const firstCell = (): Pos => {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) if (isCell({ row, col }) && (!roomLevel || isCellOpen(state.session, { row, col }))) return { row, col };
    }
    return { row: 0, col: 0 };
  };
  // The roving tab stop starts on the first cell, and returns there if Retry hides (or, in room levels, locks) the cell
  // it was on.
  const [focused, setFocused] = useState<Pos>(firstCell);
  const tabStop = isCell(focused) ? focused : firstCell();
  const [kbFocus, setKbFocus] = useState<Pos | null>(null);
  const pending = useRef<Pending | null>(null);
  const suppressClickUntil = useRef(0);
  const [overflowing, setOverflowing] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const cancel = () => {
    pending.current = null;
    setDrag(null);
  };
  const suppressClick = () => { suppressClickUntil.current = performance.now() + SUPPRESS_CLICK_MS; };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pending.current) {
        if (pending.current.dragging) suppressClick();
        cancel();
      }
      dispatch({ type: 'clearSelection' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  // A session change from another input (undo, retry, supply, or the game ending) cancels the
  // gesture. That pointer's release would still click a cell of the changed board, so its one
  // follow-up click is suppressed; the next primary pointerdown clears this.
  const interrupted = useRef<number | null>(null);
  useEffect(() => {
    if (pending.current) interrupted.current = pending.current.pointerId;
    cancel();
  }, [state.session]);

  const centerBoard = () => {
    const v = viewportRef.current;
    if (!v) return;
    v.scrollLeft = centerScroll(v.scrollWidth, v.clientWidth);
    v.scrollTop = centerScroll(v.scrollHeight, v.clientHeight);
  };
  // Region levels: scroll a region's middle to the viewport's middle (the browser clamps it).
  const showRegion = (r: Region) => {
    const v = viewportRef.current;
    const first = cellRefs.current[r.row * cols + r.col];
    const last = cellRefs.current[(r.row + r.rows - 1) * cols + r.col + r.cols - 1];
    if (!v || !first || !last) return;
    const box = v.getBoundingClientRect();
    const a = first.getBoundingClientRect();
    const b = last.getBoundingClientRect();
    v.scrollLeft += (a.left + b.right) / 2 - (box.left + v.clientLeft + v.clientWidth / 2);
    v.scrollTop += (a.top + b.bottom) / 2 - (box.top + v.clientTop + v.clientHeight / 2);
  };
  const measure = () => {
    const v = viewportRef.current;
    if (v) setOverflowing(v.scrollWidth > v.clientWidth + 1 || v.scrollHeight > v.clientHeight + 1);
  };
  useLayoutEffect(() => {
    const v = viewportRef.current;
    // A region level starts on its first region (the clearing); other boards start centred.
    if (v && (v.scrollWidth > v.clientWidth + 1 || v.scrollHeight > v.clientHeight + 1)) {
      if (regions) showRegion(regions[0]); else centerBoard();
    }
    measure();
    if (typeof ResizeObserver === 'undefined' || !v) return;
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => { onOverflowChange?.(overflowing); }, [overflowing, onOverflowChange]);
  // Unlocking (or, in room levels, a drop opening a gate) brings the newly opened region into view, and Retry returns
  // to the first region as on entry (instantly, so input is never delayed). Undo leaves the view where it is.
  const unlocked = openedRegion(state.lastAction);
  const shown = state.lastAction?.kind === 'retry' ? 0 : unlocked;
  // Regions glowing as they open: all those a task opened together, or the one opened.
  const progress = state.lastAction && 'progress' in state.lastAction ? state.lastAction.progress : undefined;
  const glowing = new Set(progress ? progress.regions : unlocked !== null ? [unlocked] : []);
  // A gate that had focus disappears when its region opens; focus then moves to that region's first cell.
  const focusOpened = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (shown !== null && regions && overflowing) showRegion(regions[shown]);
    if (state.lastAction?.kind === 'retry' && roomLevel && !isCellOpen(state.session, focused)) setFocused(firstCell());
    if (unlocked !== null && regions && focusOpened.current === unlocked) {
      const { row, col } = regions[unlocked];
      const cell = cellRefs.current[row * cols + col];
      cell?.focus({ preventScroll: true });
      // A keyboard unlock shows the focus ring, so bring that cell into view; a pointer unlock keeps the centred view.
      if (cell?.matches(':focus-visible')) cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    focusOpened.current = null;
  }, [state.actionSeq]);

  const preview = useMemo(() => {
    if (drag) {
      return drag.hover && !same(drag.hover, drag.origin) ? previewCells(state, drag.origin, drag.hover) : [];
    }
    const target = mouseHover ?? kbFocus;
    if (state.selected && target) {
      const { row, col } = state.selected;
      if (board[row]?.[col]) return previewCells(state, state.selected, target);
    }
    return [];
  }, [state, drag, mouseHover, kbFocus, board]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    suppressClickUntil.current = 0;
    if (!e.isPrimary || e.button !== 0) return;
    interrupted.current = null;
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    const gate = (e.target as HTMLElement).closest<HTMLElement>('[data-gate]');
    const pos = cell ? { row: Number(cell.dataset.row), col: Number(cell.dataset.col) } : null;
    // Locked cells, gates and empty ground pan; only items that can be picked up drag.
    const item = !!pos && canPickUp(state, pos);
    const v = e.currentTarget;
    pending.current = {
      kind: item ? 'item' : 'pan', origin: item ? pos : null, x: e.clientX, y: e.clientY,
      pointerId: e.pointerId, dragging: false, scrollLeft: v.scrollLeft, scrollTop: v.scrollTop,
    };
    // Capture on the element pressed: capturing the viewport would retarget a cell's or gate's click.
    try { (cell ?? gate ?? v).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = pending.current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (!p.dragging && !exceedsThreshold(e.clientX - p.x, e.clientY - p.y)) return;
    p.dragging = true;
    if (p.kind === 'pan') {
      const v = viewportRef.current;
      if (!v) return;
      const next = panScroll({ x: p.scrollLeft, y: p.scrollTop }, p, { x: e.clientX, y: e.clientY });
      v.scrollLeft = next.x;
      v.scrollTop = next.y;
      return;
    }
    const origin = p.origin!;
    const hover = cellAt(boardRef.current, e.clientX, e.clientY);
    const size = cellRefs.current[origin.row * cols + origin.col]?.getBoundingClientRect().width ?? 80;
    setDrag({ origin, x: e.clientX, y: e.clientY, size, hover });
  };

  const onPointerUp = (e: PointerEvent) => {
    if (interrupted.current === e.pointerId) {
      interrupted.current = null;
      suppressClick();
      return;
    }
    const p = pending.current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (p.dragging) {
      suppressClick();
      if (p.kind === 'item') {
        const to = cellAt(boardRef.current, e.clientX, e.clientY);
        if (to && !same(to, p.origin)) dispatch({ type: 'drop', from: p.origin!, to });
      }
    }
    cancel();
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (interrupted.current === e.pointerId) interrupted.current = null;
    const p = pending.current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (p.dragging) suppressClick();
    cancel();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, pos: Pos) => {
    suppressClickUntil.current = 0;
    let next = moveFocus(pos, e.key, rows, cols);
    if (!next) return;
    e.preventDefault();
    // Room levels: terrain is not a cell, so keep going the same way to the next cell, if there is one.
    while (!cellRefs.current[next.row * cols + next.col]) {
      const further: Pos = moveFocus(next, e.key, rows, cols)!;
      if (same(further, next)) return;
      next = further;
    }
    const el = cellRefs.current[next.row * cols + next.col];
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const goals = state.status === 'won' ? goalCells(state) : [];
  // Room levels: each gate's (or task's) marked tiles, and each route's cells: its passage (the gate) and path.
  const plates = useMemo(() => {
    const map = new Map<string, { item: Item; kind: PlateUnlock['kind'] }>();
    regions?.forEach((r) => {
      if (r.unlock && 'plates' in r.unlock) for (const pl of r.unlock.plates) map.set(`${pl.row},${pl.col}`, { item: pl.item, kind: r.unlock.kind });
    });
    tasks?.forEach((t) => { for (const pl of t.plates) map.set(`${pl.row},${pl.col}`, { item: pl.item, kind: 'pressure' }); });
    return map;
  }, [regions, tasks]);
  const routes = useMemo(() => {
    const map = new Map<string, { region: number; gate: boolean }>();
    regions?.forEach((r, i) => routeOf(r).forEach((q, k) => map.set(`${q.row},${q.col}`, { region: i, gate: k === 0 })));
    return map;
  }, [regions]);
  // The sides of a route cell the path runs out of: to the next route cell, or into the rooms at either end.
  const routeSides = (pos: Pos, i: number) => SIDES.filter(([, dr, dc]) => {
    const n = { row: pos.row + dr, col: pos.col + dc };
    const j = regionAt(regions!, n);
    return routes.get(`${n.row},${n.col}`)?.region === i || j === i || (j !== -1 && j === routeFrom(regions![i]));
  }).map(([side]) => side);
  const sealed = regions && tasks ? sealedRegion(regions) : -1;
  // Room levels: a building's exterior fills the terrain around it (the lodge's roof along its top).
  const walls = useMemo(() => {
    const map = new Map<string, string>();
    regions?.forEach((r) => {
      if (!r.building) return;
      for (let row = r.row - 1; row <= r.row + r.rows; row++) {
        for (let col = r.col - 1; col <= r.col + r.cols; col++) {
          if (row < 0 || col < 0 || row >= rows || col >= cols || regionAt(regions, { row, col }) !== -1 || routes.has(`${row},${col}`)) continue;
          map.set(`${row},${col}`, r.building === 'lodge' && row === r.row - 1 ? 'is-lodge is-roof' : `is-${r.building}`);
        }
      }
    });
    return map;
  }, [regions, routes, rows, cols]);
  // Room levels: a room with a joined part is outlined edge by edge around its open cells, so it reads as one shape;
  // other regions keep their rectangular outline. A notch fills the gap corner inside a bend, where two edges meet.
  const shaped = (i: number) => !!regions && regions.some((r, j) => r.joins !== undefined && roomOf(regions, j) === roomOf(regions, i));
  const opened = regions?.map((_, i) => (isOpen(state.session, i) ? 'o' : '-')).join('');
  const edges = useMemo(() => {
    const out: { row: number; col: number; sides: string[]; notches: string[] }[] = [];
    if (!regions) return out;
    const roomAt = (row: number, col: number) => {
      const i = regionAt(regions, { row, col });
      return i !== -1 && opened![i] === 'o' ? roomOf(regions, i) : -1;
    };
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const room = roomAt(row, col);
        if (room === -1 || !shaped(room)) continue;
        const inside = (dr: number, dc: number) => roomAt(row + dr, col + dc) === room;
        const sides = ([['t', -1, 0], ['r', 0, 1], ['b', 1, 0], ['l', 0, -1]] as const)
          .filter(([, dr, dc]) => !inside(dr, dc)).map(([side]) => side);
        const notches = ([['tl', -1, -1], ['tr', -1, 1], ['br', 1, 1], ['bl', 1, -1]] as const)
          .filter(([, dr, dc]) => inside(dr, 0) && inside(0, dc) && !inside(dr, dc)).map(([corner]) => corner);
        if (sides.length + notches.length > 0) out.push({ row, col, sides, notches });
      }
    }
    return out;
  }, [regions, opened, rows, cols]);
  const { goal } = state.session.level;
  const prize = prizeText(goal);
  const merge = state.lastAction?.kind === 'merge' ? state.lastAction : null;
  const seq = state.actionSeq;
  const has = (list: readonly Pos[], p: Pos) => list.some((q) => same(q, p));
  const origin = drag?.origin ?? null;
  const ghostItem = drag ? board[drag.origin.row][drag.origin.col] : null;

  return (
    <div className="board-area">
      <div
        ref={viewportRef}
        className="board-viewport"
        data-board-viewport
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
      >
      <div
        ref={boardRef}
        className={`board${over ? ' is-over' : ''}${drag ? ' is-dragging' : ''}`}
        role="group"
        aria-label={`Board, ${cols} columns by ${rows} rows`}
        data-board
        style={{ '--rows': rows, '--cols': cols } as CSSProperties}
      >
        {board.map((rowCells, r) =>
          rowCells.map((item, c) => {
            const pos = { row: r, col: c };
            const cls = ['cell'];
            const ri = regions ? regionAt(regions, pos) : -1;
            const region = regions?.[ri];
            // A hidden region's cells, its link included, are plain forest until it opens: no tile, item, label or focus.
            // The link's foliage differs faintly, the only clue.
            if (region && !isCell(pos)) {
              // A hidden building is sealed instead: blank floor under its locked shade, with nothing on it.
              if (region.building) return <div key={`${r}-${c}`} className="sealed" aria-hidden="true" />;
              const clue = !!region.link && same(region.link, pos);
              return <div key={`${r}-${c}`} className={`terrain${clue ? ' is-clue' : ''}`} aria-hidden="true" />;
            }
            if (regions && !region) {
              // Room levels: terrain (or a building's wall), a path, or a passage with its rune gate. Never a cell, never focused.
              const route = routes.get(`${r},${c}`);
              const wall = walls.get(`${r},${c}`);
              if (!route) {
                return (
                  <div key={`${r}-${c}`} className={`terrain${wall ? ` ${wall}` : ''}`} aria-hidden="true">
                    {wall === 'is-palace' && <PalaceWall />}
                  </div>
                );
              }
              const gate = route.region;
              const sides = routeSides(pos, gate);
              if (!route.gate) {
                return (
                  <div key={`${r}-${c}`} className="path" aria-hidden="true">
                    {sides.map((side) => <i key={side} className={`path-${side}`} />)}
                  </div>
                );
              }
              const open = isOpen(state.session, gate);
              const across = sides.includes('l') || sides.includes('r');
              // The sealed gate carries the symbols of the tasks it needs, each lit once done.
              const needs = gate === sealed ? (regions[gate].unlock as TaskUnlock).tasks : [];
              const lit = needs.map((t) => state.session.done.includes(t));
              const symbols = needs.length > 0 ? `, ${lit.filter(Boolean).length} of ${needs.length} symbols lit` : '';
              return (
                <div key={`${r}-${c}`} className={`passage${across ? ' is-across' : ''}${open ? ' is-open' : ''}${needs.length ? ' is-sealed' : ''}`}
                  data-passage={gate} role="img" aria-label={`Rune gate to ${regions[gate].name}, ${open ? 'open' : 'closed'}${symbols}`}>
                  <RuneGate open={open} />
                  {needs.length > 0 && <GateSymbols symbols={needs.map((t) => tasks![t].symbol!)} lit={lit} />}
                </div>
              );
            }
            const locked = !isCellOpen(state.session, pos);
            const plate = plates.get(`${r},${c}`);
            const fixed = !!plate && isFixed(state.session, pos);
            const treasure = goal.kind === 'treasure' && same(goal.at, pos) && treasureShown(state);
            if (item || treasure) cls.push('has-item');
            if (locked) cls.push('is-locked');
            if (plate) {
              cls.push('is-plate', `is-${plate.kind}`);
              if (item && item.family === plate.item.family && item.tier === plate.item.tier) cls.push('is-plate-met');
              if (fixed) cls.push('is-fixed');
            }
            if (treasure) cls.push('has-treasure');
            if (same(state.selected, pos)) cls.push('is-selected');
            if (preview.some((q) => q.row === r && q.col === c)) cls.push('is-merge-preview');
            if (drag && drag.hover && same(drag.hover, pos) && !same(drag.hover, drag.origin)) {
              cls.push(canDropAt(state, drag.origin, pos) ? 'is-drop-target' : 'is-drop-blocked');
            }
            if (same(origin, pos)) cls.push('is-drag-origin');
            const isGoal = has(goals, pos);
            if (isGoal) cls.push('is-goal-item');
            const isOutput = !!merge && has(merge.outputs, pos);
            const isConsumed = !!merge && !isOutput && has(merge.cells, pos);
            const label = treasure
              ? `${prize.name}, ${state.session.collected ? prize.opened : `closed, tap to ${prize.verb}`}`
              : item ? itemLabel(item) : 'empty';
            const mark = plate ? `, ${plate.kind === 'stone' ? 'stone' : 'pressure plate'} for ${itemLabel(plate.item)}${fixed ? ', fixed' : ''}` : '';
            // Cells are named after their room, so a joined part reads as the room it belongs to.
            const place = region ? `, ${regions![roomOf(regions!, ri)].name}${locked ? ', locked' : ''}${mark}` : '';
            return (
              <button
                key={`${r}-${c}`}
                ref={(el) => { cellRefs.current[r * rowCells.length + c] = el; }}
                type="button"
                className={cls.join(' ')}
                data-cell
                data-row={r}
                data-col={c}
                aria-label={`Row ${r + 1}, column ${c + 1}${place}: ${label}`}
                aria-pressed={same(state.selected, pos)}
                aria-disabled={over || locked || fixed ? true : undefined}
                tabIndex={same(tabStop, pos) ? 0 : -1}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setMouseHover(pos); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setMouseHover((h) => (same(h, pos) ? null : h)); }}
                onFocus={() => { setFocused(pos); setKbFocus(pos); }}
                onBlur={() => setKbFocus((k) => (same(k, pos) ? null : k))}
                onKeyDown={(e) => onKeyDown(e, pos)}
                onClick={() => {
                  if (performance.now() < suppressClickUntil.current) { suppressClickUntil.current = 0; return; }
                  dispatch({ type: 'tap', pos });
                }}
              >
                {plate && (
                  fixed
                    ? <span className="fixed-lock" aria-hidden="true"><LockIcon /></span>
                    : <span className="plate-mark" aria-hidden="true"><ItemArt item={plate.item} /></span>
                )}
                {item && <span className="cell-art"><ItemArt item={item} /></span>}
                {treasure && goal.kind === 'treasure' && (
                  <span className="cell-art"><PrizeArt prize={goal.prize} open={state.session.collected} /></span>
                )}
                {merge && isConsumed && (
                  <span key={`consumed-${seq}`} data-fx="consumed" aria-hidden="true"><ItemArt item={merge.input} /></span>
                )}
                {merge && isOutput && (
                  <span key={`output-${seq}`} data-fx="output" aria-hidden="true">
                    {SPARKS.map((i) => <i key={i} className="fx-spark" />)}
                  </span>
                )}
                {merge && same(merge.outputs[0], pos) && (
                  <span key={`badge-${seq}`} data-fx="badge" aria-hidden="true">
                    <span>{merge.consumed === 3 ? '3 → 1' : '5 → 2'}</span>
                  </span>
                )}
                {glowing.has(ri) && shaped(ri) && <span key={`unlock-${seq}`} data-fx="unlock" aria-hidden="true" />}
                {isGoal && same(goals[0], pos) && (
                  <span key={`celebrate-${seq}`} data-fx="celebrate" aria-hidden="true">
                    {BURST.map((i) => <i key={i} className="fx-spark" />)}
                  </span>
                )}
              </button>
            );
          }),
        )}
        {/* Region outlines over the gaps (never taking input). A locked region is shaded, with a wooden gate carrying
            its sign: tapping or pressing the gate asks the session to unlock that region, which it does only when it
            is next and its item is made. A drag across a gate pans like locked ground and never unlocks. */}
        {edges.map(({ row, col, sides, notches }) => (
          <div key={`edge-${row}-${col}`} className={['room-edge', ...sides.map((side) => `edge-${side}`)].join(' ')}
            aria-hidden="true" style={{ gridRow: `${row + 1} / span 1`, gridColumn: `${col + 1} / span 1` }}>
            {notches.map((corner) => <i key={corner} className={`notch-${corner}`} />)}
          </div>
        ))}
        {regions?.map((r, i) => {
          const locked = !isOpen(state.session, i);
          // Once open, a room with a joined part is outlined edge by edge above instead (until then it is a locked room
          // like any other); a hidden region shows nothing at all until it opens, except a hidden building, kept sealed.
          if ((shaped(i) && !locked) || (locked && r.hidden && !r.building)) return null;
          const ready = locked && canUnlock(state, i);
          // Room levels have no wooden gate: a locked room is only darkened, and its rune gate stands in its passage.
          const key = r.unlock && 'item' in r.unlock ? r.unlock : null;
          const need = key ? unlockNeed(regions, i) : '';
          return (
            <div key={r.name} className={`region${locked ? ' is-locked' : ''}${roomLevel ? ' is-room' : ''}`} data-region={i}
              style={{ gridRow: `${r.row + 1} / span ${r.rows}`, gridColumn: `${r.col + 1} / span ${r.cols}` }}>
              {locked && key && (
                <button type="button" className={`gate${ready ? ' is-ready' : ''}`} data-gate={i}
                  aria-disabled={ready ? undefined : true}
                  aria-label={ready ? `${r.name} gate. Needs ${need}. Ready: tap to open.` : `${r.name} gate, locked. Needs ${need}.`}
                  onKeyDown={() => { suppressClickUntil.current = 0; }}
                  onClick={(e) => {
                    if (performance.now() < suppressClickUntil.current) { suppressClickUntil.current = 0; return; }
                    if (ready && document.activeElement === e.currentTarget) focusOpened.current = i;
                    dispatch({ type: 'unlock', region: i });
                  }}>
                  <span className="region-sign">
                    <span className="region-name"><LockIcon open={ready} /> {r.name}</span>
                    <span className="region-need">
                      <span className="region-need-art" aria-hidden="true"><ItemArt item={key.item} /></span>
                      Needs {need}
                    </span>
                    {ready && <span className="gate-ready">Tap to open</span>}
                  </span>
                </button>
              )}
              {glowing.has(i) && <span key={`unlock-${seq}`} data-fx="unlock" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
      </div>
      {overflowing && (
        <button type="button" className="center-board" data-action="center-board" onClick={centerBoard}>
          Center board
        </button>
      )}
      {drag && ghostItem && (
        <div
          className="drag-ghost"
          data-drag-ghost
          style={{ left: drag.x, top: drag.y, width: drag.size, height: drag.size }}
        >
          <ItemArt item={ghostItem} />
        </div>
      )}
    </div>
  );
}
