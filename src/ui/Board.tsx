import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent, type PointerEvent } from 'react';
import type { Pos } from '../board';
import { regionAt, type Region } from '../regions';
import { isCellOpen } from '../session';
import { ItemArt, itemLabel } from './ItemArt';
import { unlockNeed } from './messages';
import { centerScroll, exceedsThreshold, moveFocus, panScroll } from './navigation';
import { canDropAt, canPickUp, canUnlock, goalCells, previewCells, type UiAction, type UiState } from './controller';

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

/** `onOverflowChange` reports whether the board overflows its viewport (so it needs panning), whenever that changes. */
export function Board({ state, dispatch, onOverflowChange }: {
  state: UiState; dispatch: Dispatch<UiAction>; onOverflowChange?: (overflowing: boolean) => void;
}) {
  const board = state.session.board;
  const regions = state.session.level.regions;
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
  // Unlocking brings the newly opened region into view, and Retry returns to the first region as on entry
  // (instantly, so input is never delayed). Undo leaves the view where it is.
  const unlocked = state.lastAction?.kind === 'unlock' ? state.lastAction.region : null;
  const shown = state.lastAction?.kind === 'retry' ? 0 : unlocked;
  // A gate that had focus disappears when its region opens; focus then moves to that region's first cell.
  const focusOpened = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (shown !== null && regions && overflowing) showRegion(regions[shown]);
    if (unlocked !== null && regions && focusOpened.current === unlocked) {
      const { row, col } = regions[unlocked];
      cellRefs.current[row * cols + col]?.focus({ preventScroll: true });
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
            const region = regions?.[regionAt(regions, pos)];
            const locked = !isCellOpen(state.session, pos);
            if (item) cls.push('has-item');
            if (locked) cls.push('is-locked');
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
            const label = item ? itemLabel(item) : 'empty';
            const place = region ? `, ${region.name}${locked ? ', locked' : ''}` : '';
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
                aria-disabled={over || locked ? true : undefined}
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
        {/* Region outlines over the gaps (never taking input). A locked region is shaded, with a wooden gate carrying
            its sign: tapping or pressing the gate asks the session to unlock that region, which it does only when it
            is next and its item is made. A drag across a gate pans like locked ground and never unlocks. */}
        {regions?.map((r, i) => {
          const locked = i > state.session.unlocked;
          const ready = locked && canUnlock(state, i);
          const need = r.unlock ? unlockNeed(regions, i) : '';
          return (
            <div key={r.name} className={`region${locked ? ' is-locked' : ''}`} data-region={i}
              style={{ gridRow: `${r.row + 1} / span ${r.rows}`, gridColumn: `${r.col + 1} / span ${r.cols}` }}>
              {locked && r.unlock && (
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
                      <span className="region-need-art" aria-hidden="true"><ItemArt item={r.unlock.item} /></span>
                      Needs {need}
                    </span>
                    {ready && <span className="gate-ready">Tap to open</span>}
                  </span>
                </button>
              )}
              {unlocked === i && <span key={`unlock-${seq}`} data-fx="unlock" aria-hidden="true" />}
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
