import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent, type PointerEvent } from 'react';
import type { Pos } from '../board';
import { ItemArt, itemLabel } from './ItemArt';
import { centerScroll, exceedsThreshold, moveFocus, panScroll } from './navigation';
import { goalCells, previewCells, type UiAction, type UiState } from './controller';

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

export function Board({ state, dispatch }: { state: UiState; dispatch: Dispatch<UiAction> }) {
  const board = state.session.board;
  const rows = board.length;
  const cols = board[0].length;
  const over = state.status !== 'playing';
  const [drag, setDrag] = useState<Drag | null>(null);
  const [mouseHover, setMouseHover] = useState<Pos | null>(null);
  const [focused, setFocused] = useState<Pos>({ row: 0, col: 0 });
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
  const measure = () => {
    const v = viewportRef.current;
    if (v) setOverflowing(v.scrollWidth > v.clientWidth + 1 || v.scrollHeight > v.clientHeight + 1);
  };
  useLayoutEffect(() => {
    const v = viewportRef.current;
    if (v && (v.scrollWidth > v.clientWidth + 1 || v.scrollHeight > v.clientHeight + 1)) centerBoard();
    measure();
    if (typeof ResizeObserver === 'undefined' || !v) return;
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, []);

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
    const pos = cell ? { row: Number(cell.dataset.row), col: Number(cell.dataset.col) } : null;
    const item = !over && pos && board[pos.row]?.[pos.col];
    const v = e.currentTarget;
    pending.current = {
      kind: item ? 'item' : 'pan', origin: item ? pos : null, x: e.clientX, y: e.clientY,
      pointerId: e.pointerId, dragging: false, scrollLeft: v.scrollLeft, scrollTop: v.scrollTop,
    };
    // Capture on the element pressed: capturing the viewport would retarget a cell's click.
    try { (cell ?? v).setPointerCapture(e.pointerId); } catch { /* ignore */ }
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
    const next = moveFocus(pos, e.key, rows, cols);
    if (!next) return;
    e.preventDefault();
    const el = cellRefs.current[next.row * cols + next.col];
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const goals = state.status === 'won' ? goalCells(state) : [];
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
            if (item) cls.push('has-item');
            if (same(state.selected, pos)) cls.push('is-selected');
            if (preview.some((q) => q.row === r && q.col === c)) cls.push('is-merge-preview');
            if (drag && drag.hover && same(drag.hover, pos) && !same(drag.hover, drag.origin)) cls.push('is-drop-target');
            if (same(origin, pos)) cls.push('is-drag-origin');
            const isGoal = has(goals, pos);
            if (isGoal) cls.push('is-goal-item');
            const isOutput = !!merge && has(merge.outputs, pos);
            const isConsumed = !!merge && !isOutput && has(merge.cells, pos);
            const label = item ? itemLabel(item) : 'empty';
            return (
              <button
                key={`${r}-${c}`}
                ref={(el) => { cellRefs.current[r * rowCells.length + c] = el; }}
                type="button"
                className={cls.join(' ')}
                data-cell
                data-row={r}
                data-col={c}
                aria-label={`Row ${r + 1}, column ${c + 1}: ${label}`}
                aria-pressed={same(state.selected, pos)}
                aria-disabled={over ? true : undefined}
                tabIndex={same(focused, pos) ? 0 : -1}
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
                {item && <span className="cell-art"><ItemArt item={item} /></span>}
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
                {isGoal && same(goals[0], pos) && (
                  <span key={`celebrate-${seq}`} data-fx="celebrate" aria-hidden="true">
                    {BURST.map((i) => <i key={i} className="fx-spark" />)}
                  </span>
                )}
              </button>
            );
          }),
        )}
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
