import {
  useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent, type MouseEvent, type PointerEvent,
  type ReactNode,
} from 'react';
import type { Item, Pos } from '../board';
import {
  isFixed, isOpen, regionAt, roomOf, routeFrom, routeOf, sealedRegion, type GateSymbol, type PlateUnlock, type Region, type TaskUnlock,
} from '../regions';
import {
  alishaPlate, closedContainerAt, containerShown, craftedItem, dogSpot, goalOpenableAt, isCellOpen, partySpots, plateGoal,
  type Container,
} from '../session';
import { ChestArt, DustSheetArt, ItemArt, itemLabel, KeepsakeBoxArt, PrizeArt, ShoeboxArt } from './ItemArt';
import { AtticLampArt, AtticWindowArt, ShelfArt, StackedBoxesArt } from './AtticArt';
import { AlishaArt, CharacterPlateArt, DogArt, FionaArt, PalaceDoorArt } from './StoryArt';
import partitionArt from '../assets/board/crystal-partition-v1.webp';
import runeGateClosedArt from '../assets/board/rune-gate-v1.webp';
import runeGateOpenArt from '../assets/board/rune-gate-open-v1.webp';
import { direct, palaceShots, viewCue, type Camera, type Frames, type Phase, type Shot, type View } from './camera';
import { batchGroups, batchText, prizeText, unlockNeed } from './messages';
import { centerScroll, centreSpan, exceedsThreshold, moveFocus, panScroll, revealSpan, type Point } from './navigation';
import {
  bubbleOpen, canDropAt, canMoveAlisha, canPickUp, canUnlock, goalCells, mergeSources, mergeTargets, openedRegion,
  partitionShown, plateRevealed, previewCells, storyDue, storyHeld, storyLifted, storyPending, talkShown, treasureShown, type UiAction, type UiState,
} from './controller';

// A click arriving this soon after a drag is the browser's follow-up click, not a tap.
const SUPPRESS_CLICK_MS = 500;

// An item gesture drags a tile; a pan gesture scrolls the viewport; an `alisha` gesture (party levels) drags Alisha from
// her spot. All start pending and only become a drag/pan once the pointer passes the threshold; until then it is a tap.
interface Pending {
  kind: 'item' | 'pan' | 'alisha'; origin: Pos | null; x: number; y: number; pointerId: number; dragging: boolean;
  scrollLeft: number; scrollTop: number;
}
/** `alisha`: Alisha is dragged (from her spot, `origin`), not an item. */
interface Drag { origin: Pos; x: number; y: number; size: number; hover: Pos | null; alisha?: boolean }

const SPARKS = [0, 1, 2, 3, 4, 5];
const BURST = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const same = (a: Pos | null, b: Pos | null) => !!a && !!b && a.row === b.row && a.col === b.col;

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const frames: Frames = {
  request: (cb) => requestAnimationFrame(cb), cancel: (id) => cancelAnimationFrame(id), now: () => performance.now(),
};
// How far inside the viewport's edges an automatic camera move brings a room it reveals (when it fits).
const MARGIN = 8;
interface Box { left: number; top: number; right: number; bottom: number }

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
 * across): two standing stones with runes and, while closed, glowing bars between them. `opening`: an open gate still
 * drawing its bars, for CSS to fade them out. Decorative.
 */
export function RuneGate({ open = false, opening = false }: { open?: boolean; opening?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <image href={open ? runeGateOpenArt : runeGateClosedArt} width="100" height="100" preserveAspectRatio="xMidYMid meet" />
      {open && opening && <image href={runeGateClosedArt} width="100" height="100" preserveAspectRatio="xMidYMid meet" className="gate-bars" />}
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
  if (symbol === 'wood') {
    // A log's cut end, with its rings.
    return (
      <g transform={at} fill="none" stroke={color} strokeWidth={2.2}>
        <circle r="8" /><circle r="4.5" /><circle r="1.2" fill={color} />
      </g>
    );
  }
  if (symbol === 'tool') {
    // A hammer.
    return (
      <g transform={at} fill={color}>
        <rect x="-1.6" y="-4" width="3.2" height="13" rx="1.2" />
        <rect x="-7" y="-9" width="14" height="6" rx="1.5" />
      </g>
    );
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

/** The palace rescue's crystal partition, shut across a passage: tall pale crystal panes. Decorative. */
function PartitionArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <image href={partitionArt} x="0" y="0" width="100" height="100" preserveAspectRatio="none" />
    </svg>
  );
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

/** Container levels: a closed container as drawn: stored belongings (a shoebox) or the keepsake box. Decorative. */
export function ContainerArt({ art }: { art: Container['art'] }) {
  return art === 'shoebox' ? <ShoeboxArt /> : <KeepsakeBoxArt />;
}

/**
 * The attic's room around its floor: rafters with a window, a lamp and stored boxes along the back wall, and shelves at
 * the sides. It fills only the board's frame (its padding), never a cell, and takes no input. Decorative.
 */
function AtticDecor() {
  return (
    <div className="attic-decor" aria-hidden="true">
      <div className="attic-wall">
        <span className="attic-boxes is-left"><StackedBoxesArt /></span>
        <span className="attic-window"><AtticWindowArt /></span>
        <span className="attic-lamp"><AtticLampArt /></span>
        <span className="attic-boxes is-right"><StackedBoxesArt /></span>
      </div>
      <div className="attic-shelf is-left"><ShelfArt /></div>
      <div className="attic-shelf is-right"><ShelfArt /></div>
    </div>
  );
}

const NAMES = { alisha: 'Alisha', fiona: 'Fiona', dog: 'Dog' } as const;

/**
 * A party level's character on her spot: Alisha as a button while she can be moved (tap to pick her up, or drag her),
 * otherwise, like Fiona (and Beyond the gate's dog), a labelled picture. Never a cell: no item ever goes here. `stepping`:
 * Alisha stepping out of the palace rescue's plate room as its partition opens.
 */
function Character({ who, movable = false, selected = false, ready = false, lifted = false, stepping = false, buttonRef, onClick, onKeyDown }: {
  who: 'alisha' | 'fiona' | 'dog'; movable?: boolean; selected?: boolean; ready?: boolean; lifted?: boolean; stepping?: boolean;
  buttonRef?: (el: HTMLButtonElement | null) => void; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; onKeyDown?: () => void;
}) {
  const name = NAMES[who];
  const body = (
    <>
      <span className="character-art">{who === 'alisha' ? <AlishaArt /> : who === 'fiona' ? <FionaArt /> : <DogArt />}</span>
      <span className="character-name" aria-hidden="true">{name}</span>
    </>
  );
  const cls = `character is-${who}${ready ? ' is-ready' : ''}${lifted ? ' is-lifted' : ''}${stepping ? ' is-stepping' : ''}`;
  const label = who === 'fiona' ? 'Fiona, an elk' : who === 'dog' ? 'A dog, a little way off' : name;
  if (!movable) return <span className={cls} role="img" aria-label={label}>{body}</span>;
  return (
    <button ref={buttonRef} type="button" className={cls} data-alisha aria-pressed={selected} onClick={onClick} onKeyDown={onKeyDown}
      aria-label={selected ? 'Alisha, picked up: now choose her plate' : 'Alisha: drag her onto the glowing plate, or tap to pick her up'}>
      {body}
    </button>
  );
}

/**
 * `onOverflowChange` reports whether the board overflows its viewport (so it needs panning), whenever that changes.
 * `scene` 'attic': the same grid drawn as a room, its tiles hidden on a wooden floor (outlined faintly while an item is
 * picked up), with the room framing it. 'entrance' (the palace entrance prototype): the woodland rooms with their tiles'
 * edges hidden until something is picked up (an item or Alisha), when they are outlined faintly.
 * Party levels: Alisha and Fiona stand on their spots, their speech bubbles show (pausing the board) as their talk comes
 * due, Alisha's plates glow once she can stand on them, and the palace entrance opens when she stands on its plate; the
 * palace rescue's partition closes behind her while she is trapped.
 * `sceneShowing`: the story scene due is being shown over the board (see storyHeld for what that changes).
 */
export function Board({ state, dispatch, onOverflowChange, onPalaceOpening, onPresentationCancel, scene, sceneShowing = false }: {
  state: UiState; dispatch: Dispatch<UiAction>; onOverflowChange?: (overflowing: boolean) => void;
  onPalaceOpening?: (seq: number) => void;
  onPresentationCancel?: () => void;
  scene?: 'attic' | 'entrance' | 'palace';
  sceneShowing?: boolean;
}) {
  const palaceOpeningRef = useRef(onPalaceOpening);
  palaceOpeningRef.current = onPalaceOpening;
  const presentationCancelRef = useRef(onPresentationCancel);
  presentationCancelRef.current = onPresentationCancel;
  const board = state.session.board;
  const { regions, tasks } = state.session.level;
  const roomLevel = state.session.level.goal.kind === 'treasure';
  const rows = board.length;
  const cols = board[0].length;
  const over = state.status !== 'playing';
  // Party levels: where Alisha and Fiona stand, her plates (a goal plate, or a task's: shown once their room is open,
  // pressed once she has stood there), her destination now, and the palace entrance beside the last room.
  const { party, goal } = state.session.level;
  // A story scene due holds back the regions its move opened (see storyHeld). During the pause before it they look as they
  // did before that move (still closed, or still hidden); once it is showing over the board (`sceneShowing`) they go under
  // fog, their shape showing but nothing in them, so that once it has been read the fog lifts off them (`lifted`). Held
  // with the palace entrance's forecourt: its wall, entrance and plate, and Alisha and Fiona's move up beside it.
  const heldBack = storyHeld(state);
  const fogged = sceneShowing ? heldBack : [];
  const lifted = storyLifted(state);
  const plateHeld = plateGoal(state.session.level) && goal.kind === 'treasure' && heldBack.includes(regionAt(regions!, goal.at));
  // The palace rescue's partition as shown (see partitionShown): shut while she is trapped and while Fiona asks whether it is
  // opening, Alisha still on her plate behind it; then opening, as she steps out beside Fiona, until the reunion scene.
  const trap = party?.trap;
  const release = partitionShown(state);
  const spots = plateHeld ? party!.start
    : release === 'shut' && trap ? { alisha: tasks![trap.task].alisha!, fiona: trap.fiona }
    : release === 'opening' && party?.waiting ? party.waiting
    : partySpots(state.session);
  const destination = alishaPlate(state.session);
  const plateShown = plateRevealed(state) && !plateHeld;
  const alishaPlates = !party ? [] : [
    ...(plateGoal(state.session.level) && goal.kind === 'treasure' ? [{ at: goal.at, shown: plateShown, pressed: state.session.collected }] : []),
    ...(tasks ?? []).flatMap((t, i) => (t.alisha
      ? [{ at: t.alisha, shown: isOpen(state.session, t.in) && !heldBack.includes(t.in), pressed: state.session.done.includes(i) }] : [])),
  ];
  const line = talkShown(state);
  const speaking = bubbleOpen(state);
  const shut = release === 'shut';
  // The palace rescue's partition: the passage of the room Alisha is shut in.
  const partition = release && trap ? (regions![tasks![trap.task].in].unlock as TaskUnlock).passage : undefined;
  const dog = dogSpot(state.session);
  const movable = canMoveAlisha(state);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const alishaRef = useRef<HTMLButtonElement | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [mouseHover, setMouseHover] = useState<Pos | null>(null);
  // Level 9: the palace opening's stage while it plays, for the action that opened it. Only the drawing follows it (the
  // session, labels and announcements have the palace open at once); without it the board draws the session as it is.
  const [show, setShow] = useState<{ seq: number; phase: Phase } | null>(null);
  const sealed = regions && tasks ? sealedRegion(regions) : -1;
  const phase = show?.seq === state.actionSeq ? show.phase : null;
  const held = phase === 'travel' || phase === 'glow';
  // Drawn open: an open region, except the palace while the view travels to its gate and its symbols glow, and a region
  // held back for the story scene due.
  const shownOpen = (i: number) => isOpen(state.session, i) && !(held && i === sealed) && !heldBack.includes(i);
  // Room levels: terrain is not a cell, and neither is a hidden region until it opens, nor a region under fog.
  const isCell = (p: Pos) => {
    if (!regions) return true;
    const i = regionAt(regions, p);
    return i !== -1 && !(regions[i].hidden && !shownOpen(i)) && !fogged.includes(i);
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
  // The automatic camera move playing, if any. A user gesture on the board (a press, the wheel, a key), Center board or
  // a resize ends it where the view is, and an unfinished palace opening settles on the open palace; a new action
  // (Retry included) or leaving the level cancels it. Nothing it was going to do happens later.
  const camera = useRef<Camera | null>(null);
  const settle = () => {
    const c = camera.current;
    if (!c?.playing()) return;
    c.stop();
    presentationCancelRef.current?.();
    setShow(null);
  };
  useEffect(() => () => camera.current?.stop(), []);
  // Party levels: the speech bubble takes focus when it appears (so Enter or Space dismisses it); once it is tapped away,
  // focus goes to Alisha, now highlighted. Neither scrolls: the camera frames them.
  // A story scene due first (the forecourt's, C1-08B) covers it: it takes focus once that has been read.
  const storyPaused = storyDue(state) !== null;
  useEffect(() => { if (speaking && !storyPaused) bubbleRef.current?.focus({ preventScroll: true }); }, [speaking, storyPaused]);
  const wasSpeaking = useRef(false);
  useEffect(() => {
    if (wasSpeaking.current && !speaking && movable) alishaRef.current?.focus({ preventScroll: true });
    wasSpeaking.current = speaking;
  }, [speaking, movable]);

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
  const view: View = {
    read: () => ({ x: viewportRef.current?.scrollLeft ?? 0, y: viewportRef.current?.scrollTop ?? 0 }),
    write: (to) => {
      const v = viewportRef.current;
      if (!v) return to;
      v.scrollLeft = to.x;
      v.scrollTop = to.y;
      return { x: v.scrollLeft, y: v.scrollTop };
    },
  };
  // The box, in the viewport's scroll coordinates, spanning the board's grid cells (tiles, terrain or paths alike) from
  // `a` to `b`; null before layout.
  const boxOf = (a: Pos, b: Pos): Box | null => {
    const v = viewportRef.current;
    const cells = boardRef.current?.children;
    const first = cells?.[a.row * cols + a.col];
    const last = cells?.[b.row * cols + b.col];
    if (!v || !first || !last) return null;
    const box = v.getBoundingClientRect();
    const x = box.left + v.clientLeft - v.scrollLeft;
    const y = box.top + v.clientTop - v.scrollTop;
    const f = first.getBoundingClientRect();
    const l = last.getBoundingClientRect();
    return { left: f.left - x, top: f.top - y, right: l.right - x, bottom: l.bottom - y };
  };
  const regionBox = (r: Region) => boxOf({ row: r.row, col: r.col }, { row: r.row + r.rows - 1, col: r.col + r.cols - 1 });
  // The box spanning a region and some cells (party levels: its characters' spots, or the palace entrance).
  const withCells = (r: Region, cells: readonly Pos[]) => {
    const all = [{ row: r.row, col: r.col }, { row: r.row + r.rows - 1, col: r.col + r.cols - 1 }, ...cells];
    return boxOf({ row: Math.min(...all.map((p) => p.row)), col: Math.min(...all.map((p) => p.col)) },
      { row: Math.max(...all.map((p) => p.row)), col: Math.max(...all.map((p) => p.col)) });
  };
  // An element's box in the viewport's scroll coordinates (Alisha's speech bubble), or null.
  const elementBox = (el: Element | null): Box | null => {
    const v = viewportRef.current;
    if (!v || !el) return null;
    const box = v.getBoundingClientRect();
    const x = box.left + v.clientLeft - v.scrollLeft;
    const y = box.top + v.clientTop - v.scrollTop;
    const e = el.getBoundingClientRect();
    return { left: e.left - x, top: e.top - y, right: e.right - x, bottom: e.bottom - y };
  };
  // Where a region level starts (and Retry returns): its first region, with a party's start spots.
  const startBox = (): Box | null => {
    if (!regions) return null;
    return party ? withCells(regions[0], [party.start.alisha, party.start.fiona]) : regionBox(regions[0]);
  };
  // The scroll offset that centres a box, and the one nearest `from` that shows it whole.
  const centre = (b: Box): Point => {
    const v = viewportRef.current!;
    return {
      x: centreSpan(b.left, b.right, v.clientWidth, v.scrollWidth - v.clientWidth),
      y: centreSpan(b.top, b.bottom, v.clientHeight, v.scrollHeight - v.clientHeight),
    };
  };
  const reveal = (from: Point, b: Box): Point => {
    const v = viewportRef.current!;
    return {
      x: revealSpan(from.x, b.left, b.right, v.clientWidth, v.scrollWidth - v.clientWidth, MARGIN),
      y: revealSpan(from.y, b.top, b.bottom, v.clientHeight, v.scrollHeight - v.clientHeight, MARGIN),
    };
  };
  const fits = (b: Box) => {
    const v = viewportRef.current!;
    return b.right - b.left + 2 * MARGIN <= v.clientWidth && b.bottom - b.top + 2 * MARGIN <= v.clientHeight;
  };
  const viewSize = useRef('');
  const measure = () => {
    const v = viewportRef.current;
    if (!v) return;
    setOverflowing(v.scrollWidth > v.clientWidth + 1 || v.scrollHeight > v.clientHeight + 1);
    // A resized viewport (a rotation, a new window size) leaves an automatic camera move's target stale: stop it.
    const size = `${v.clientWidth}x${v.clientHeight}`;
    if (viewSize.current && size !== viewSize.current) settle();
    viewSize.current = size;
  };
  useLayoutEffect(() => {
    const v = viewportRef.current;
    // A region level starts on its first region (the clearing); other boards start centred.
    if (v && (v.scrollWidth > v.clientWidth + 1 || v.scrollHeight > v.clientHeight + 1)) {
      const b = startBox();
      if (b) view.write(centre(b)); else centerBoard();
    }
    measure();
    if (typeof ResizeObserver === 'undefined' || !v) return;
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => { onOverflowChange?.(overflowing); }, [overflowing, onOverflowChange]);
  // Unlocking (or, in room levels, a drop opening a gate) pans the newly opened region into view, and Retry returns to
  // the first region as on entry (instantly, so input is never delayed). Undo leaves the view where it is. Level 9's
  // palace opening pans to its gate, shows it open, then pans on to the palace (see viewCue). Pans ease over a moment;
  // under reduced motion they jump.
  const unlocked = openedRegion(state.lastAction);
  // A story scene still to come for the last move (see storyPending): the view waits for it.
  const sceneToCome = storyPending(state) !== null;
  // The speech bubble showing, brought fully into view with its speaker (on a small screen, its room may not fit around it).
  const bubbleShot = (): Shot => ({
    pan: () => {
      const b = elementBox(bubbleRef.current);
      const who = line && spots ? spots[line.who] : spots?.alisha;
      const a = who && boxOf(who, who);
      return b && a ? reveal(view.read(), {
        left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom),
      }) : null;
    },
  });
  // Regions glowing as they open: all those a task opened together, or the one opened (the palace once its gate opens).
  const progress = state.lastAction && 'progress' in state.lastAction ? state.lastAction.progress : undefined;
  const glowing = new Set((progress ? progress.regions : unlocked !== null ? [unlocked] : [])
    .filter((i) => !(held && i === sealed) && !heldBack.includes(i)));
  // A gate that had focus disappears when its region opens; focus then moves to that region's first cell.
  const focusOpened = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (camera.current?.playing()) presentationCancelRef.current?.();
    camera.current?.stop();
    camera.current = null;
    setShow(null);
    if (state.lastAction?.kind === 'retry' && roomLevel && !isCellOpen(state.session, focused)) setFocused(firstCell());
    // A keyboard unlock shows the focus ring, so the pan keeps that cell in view (no second scroll); a pointer unlock
    // keeps the centred view.
    let keep: Pos | null = null;
    if (unlocked !== null && regions && focusOpened.current === unlocked) {
      const { row, col } = regions[unlocked];
      const cell = cellRefs.current[row * cols + col];
      cell?.focus({ preventScroll: true });
      if (cell?.matches(':focus-visible')) keep = { row, col };
    }
    focusOpened.current = null;
    // The palace rescue's release: Fiona asks whether the partition is opening, so the view takes in Alisha's room, its
    // partition and Fiona, then her bubble.
    if (sceneToCome && shut && trap && regions && spots) {
      const room = regions[tasks![trap.task].in];
      const frame: Shot = { pan: () => { const b = withCells(room, [trap.fiona, partition!]); return b && (fits(b) ? centre(b) : reveal(view.read(), b)); } };
      camera.current = direct([frame, bubbleShot()], view, frames, prefersReducedMotion(), () => { presentationCancelRef.current?.(); });
      return;
    }
    // A story scene still to come keeps the view on the move that made it due; once it has been read, the view does what
    // that move's opening would have done (the regions it held back come into view).
    const cue = sceneToCome ? null : viewCue(state);
    if (!cue || !regions) return;
    const instant = cue.kind === 'start' || prefersReducedMotion();
    const seq = state.actionSeq;
    let shots: Shot[];
    if (cue.kind === 'palace') {
      const r = regions[cue.region];
      const g = cue.gate;
      // The gate with the palace if both fit, else the gate alone: either way the gate and its symbols are in view.
      const toGate = () => {
        const both = boxOf({ row: Math.min(r.row, g.row), col: Math.min(r.col, g.col) },
          { row: Math.max(r.row + r.rows - 1, g.row), col: Math.max(r.col + r.cols - 1, g.col) });
        const gate = boxOf(g, g);
        return both && fits(both) ? centre(both) : gate && centre(gate);
      };
      const inside = () => {
        const b = regionBox(r);
        return b && reveal(view.read(), b);
      };
      shots = palaceShots(instant, toGate, inside, (p) => setShow(p && { seq, phase: p }),
        () => palaceOpeningRef.current?.(seq));
    } else if (cue.kind === 'entrance') {
      // Alisha on her plate: keep it (and the palace entrance beside it, as it opens) in view.
      shots = [{ pan: () => { const b = boxOf(cue.door ?? cue.plate, cue.plate); return b && reveal(view.read(), b); } }];
    } else if (cue.kind === 'start') {
      shots = [{ pan: () => { const b = startBox(); return b && centre(b); } }];
    } else {
      const r = regions[cue.region];
      // Party levels: the room of Alisha's plate comes into view with Alisha and Fiona beside it (and the palace entrance),
      // then the speech bubble due is brought fully into view with its speaker (on a small screen, the room may not fit
      // around it).
      const meeting = party && spots && destination && regionAt(regions, destination) === cue.region;
      shots = [{
        pan: () => {
          const b = meeting ? withCells(r, [spots.alisha, spots.fiona, ...(party.door ? [party.door] : [])]) : regionBox(r);
          const cell = keep && boxOf(keep, keep);
          return b && (cell ? reveal(centre(b), cell) : centre(b));
        },
      }];
      if (meeting) shots.push(bubbleShot());
    }
    camera.current = direct(shots, view, frames, instant, () => { presentationCancelRef.current?.(); setShow(null); });
  }, [state.actionSeq, storyPaused, sceneToCome]);

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

  // The attic (a tutorial): while an item is picked up (selected or dragged), the cells where it would merge light up; if
  // it merges nowhere from where it stands, the items that would merge light up instead. Other boards show only the
  // hovered drop's merge preview.
  const picked = drag?.origin ?? (state.selected && board[state.selected.row]?.[state.selected.col] ? state.selected : null);
  const guide = useMemo(() => {
    if (scene !== 'attic' || !picked) return { targets: [], sources: [] };
    const targets = mergeTargets(state, picked);
    return { targets, sources: targets.length > 0 ? [] : mergeSources(state) };
  }, [scene, picked?.row, picked?.col, state]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    settle();
    suppressClickUntil.current = 0;
    if (!e.isPrimary || e.button !== 0) return;
    interrupted.current = null;
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    const gate = (e.target as HTMLElement).closest<HTMLElement>('[data-gate]');
    const alisha = movable && spots ? (e.target as HTMLElement).closest<HTMLElement>('[data-alisha]') : null;
    const pos = cell ? { row: Number(cell.dataset.row), col: Number(cell.dataset.col) } : null;
    // Locked cells, gates and empty ground pan; only items that can be picked up drag, and Alisha once she can move.
    const item = !!pos && canPickUp(state, pos);
    const v = e.currentTarget;
    pending.current = {
      kind: alisha ? 'alisha' : item ? 'item' : 'pan', origin: alisha ? spots!.alisha : item ? pos : null, x: e.clientX, y: e.clientY,
      pointerId: e.pointerId, dragging: false, scrollLeft: v.scrollLeft, scrollTop: v.scrollTop,
    };
    // Capture on the element pressed: capturing the viewport would retarget a cell's, gate's or Alisha's click.
    try { (alisha ?? cell ?? gate ?? v).setPointerCapture(e.pointerId); } catch { /* ignore */ }
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
    // Alisha's spot is scenery, not a cell: her ghost takes the size of any cell.
    const sized = cellRefs.current[origin.row * cols + origin.col] ?? cellRefs.current.find(Boolean);
    const size = sized?.getBoundingClientRect().width ?? 80;
    setDrag({ origin, x: e.clientX, y: e.clientY, size, hover, alisha: p.kind === 'alisha' });
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
      const to = cellAt(boardRef.current, e.clientX, e.clientY);
      if (p.kind === 'item' && to && !same(to, p.origin)) dispatch({ type: 'drop', from: p.origin!, to });
      // Alisha: only her plate takes her; dropped anywhere else she stays where she was.
      if (p.kind === 'alisha' && to) dispatch({ type: 'placeAlisha', to });
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
  const opened = regions?.map((_, i) => (isOpen(state.session, i) && !heldBack.includes(i) ? 'o' : '-')).join('');
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
  // Party levels: the palace wall along the top of the last room, the entrance in it, drawn once the room is revealed.
  const palace = useMemo(() => {
    const map = new Map<string, 'is-door' | 'is-wall'>();
    const door = party?.door;
    if (!door || !plateShown || !regions) return map;
    const r = regions[regions.length - 1];
    const row = door.row;
    for (let col = r.col - 1; col <= r.col + r.cols; col++) {
      if (col < 0 || col >= cols || regionAt(regions, { row, col }) !== -1 || routes.has(`${row},${col}`)) continue;
      map.set(`${row},${col}`, col === door.col ? 'is-door' : 'is-wall');
    }
    return map;
  }, [party, plateShown, regions, routes, cols]);
  // Chapter 1's room boards: one backdrop around their rooms (see .forest and .halls). The woodland (rooms in the forest): its
  // regions, or none on other boards.
  const surround = !!regions && (scene === 'entrance' || scene === 'palace');
  const woodland = scene === 'entrance' ? regions : undefined;
  // Where Alisha and Fiona stand beside the rooms (not on a plate): each a clearing, joined on the sides where it meets a
  // room's ground (a cell with its floor) or the other's clearing, so the two stand on ground that runs on from the room.
  const standing = woodland && spots ? [spots.alisha, spots.fiona].filter((q) => regionAt(woodland, q) === -1) : [];
  const clearings = standing.map((at) => ({
    at,
    sides: SIDES.filter(([, dr, dc]) => {
      const n = { row: at.row + dr, col: at.col + dc };
      const inside = n.row >= 0 && n.col >= 0 && n.row < rows && n.col < cols;
      return inside && ((regionAt(woodland!, n) !== -1 && isCell(n)) || standing.some((q) => same(q, n)));
    }).map(([side]) => side),
  }));
  const prize = prizeText(goal);
  const merge = state.lastAction?.kind === 'merge' ? state.lastAction : null;
  // Container levels: the container the last action uncovered, and the cells an opening filled (or an item recipe's
  // craft: its result's cell), which sparkle.
  const revealed = state.lastAction && 'revealed' in state.lastAction ? state.lastAction.revealed : undefined;
  const unpacked = state.lastAction?.kind === 'unpack' ? state.lastAction.cells
    : state.lastAction?.kind === 'craft' && state.lastAction.at ? [state.lastAction.at] : [];
  const seq = state.actionSeq;
  const has = (list: readonly Pos[], p: Pos) => list.some((q) => same(q, p));
  const origin = drag?.origin ?? null;
  const ghostItem = drag && !drag.alisha ? board[drag.origin.row][drag.origin.col] : null;
  // Party levels: Alisha picked up (tapped) or dragged, so her plate is the target.
  const aiming = state.alishaSelected || !!drag?.alisha;
  const pickAlisha = (e: MouseEvent<HTMLButtonElement>) => {
    if (performance.now() < suppressClickUntil.current) { suppressClickUntil.current = 0; return; }
    const picking = !state.alishaSelected;
    dispatch({ type: 'selectAlisha' });
    // From the keyboard, picking her up moves focus to her plate, her one destination: Enter or Space there stands her on it.
    if (picking && e.detail === 0 && destination) {
      const el = cellRefs.current[destination.row * cols + destination.col];
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  return (
    <div className="board-area">
      <div
        ref={viewportRef}
        className={`board-viewport${scene ? ` is-${scene}` : ''}`}
        data-board-viewport
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onWheel={settle}
        onKeyDownCapture={settle}
      >
      <div
        ref={boardRef}
        className={`board${over ? ' is-over' : ''}${drag ? ' is-dragging' : ''}${scene ? ` is-${scene}` : ''}${surround ? ' has-surround' : ''}${
          scene && (drag || state.selected || state.alishaSelected) ? ' is-placing' : ''}${speaking || storyPaused ? ' is-paused' : ''}`}
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
              // A region under fog (see fogged): blank ground under the fog, nothing on it.
              if (fogged.includes(ri)) return <div key={`${r}-${c}`} className="fogged" aria-hidden="true" />;
              // A hidden building is sealed instead: blank floor under its locked shade, with nothing on it.
              if (region.building) return <div key={`${r}-${c}`} className="sealed" aria-hidden="true" />;
              const clue = !!region.link && same(region.link, pos);
              return <div key={`${r}-${c}`} className={`terrain${clue ? ' is-clue' : ''}`} aria-hidden="true" />;
            }
            if (regions && !region) {
              // Room levels: terrain (or a building's wall), a path, or a passage with its rune gate. Never a cell, never focused.
              const route = routes.get(`${r},${c}`);
              const wall = walls.get(`${r},${c}`);
              const front = palace.get(`${r},${c}`);
              // Party levels: the palace entrance, closed until Alisha stands on her plate, and Alisha and Fiona's spots.
              if (front === 'is-door') {
                const open = state.session.collected;
                return (
                  <div key={`${r}-${c}`} className={`terrain is-palace is-door${open ? ' is-open' : ''}`} data-door
                    role="img" aria-label={`The palace entrance, ${open ? 'open' : 'closed'}`}>
                    <PalaceDoorArt open={open} opening={open && state.lastAction?.kind === 'stand'} />
                  </div>
                );
              }
              const who = spots && same(spots.alisha, pos) ? 'alisha' : spots && same(spots.fiona, pos) ? 'fiona' : dog && same(dog, pos) ? 'dog' : null;
              if (who) {
                return (
                  <div key={`${r}-${c}`} className="terrain has-character" data-spot={who}>
                    <Character who={who} movable={who === 'alisha' && movable} selected={state.alishaSelected} stepping={who === 'alisha' && release === 'opening'}
                      ready={who === 'alisha' && movable && !aiming} lifted={who === 'alisha' && !!drag?.alisha}
                      buttonRef={(el) => { alishaRef.current = el; }} onClick={pickAlisha}
                      onKeyDown={() => { suppressClickUntil.current = 0; }} />
                  </div>
                );
              }
              if (front === 'is-wall') return <div key={`${r}-${c}`} className="terrain is-palace" aria-hidden="true"><PalaceWall /></div>;
              // A hidden room's rune gate (and path) are forest too until it opens, so nothing gives it away.
              const concealed = !!route && regions[route.region].hidden && !regions[route.region].building && !shownOpen(route.region);
              if (!route || concealed) {
                return (
                  <div key={`${r}-${c}`} className={`terrain${wall ? ` ${wall}` : ''}`} aria-hidden="true">
                    {wall === 'is-palace' && <PalaceWall />}
                  </div>
                );
              }
              const gate = route.region;
              const sides = routeSides(pos, gate);
              // The palace rescue: while Alisha is trapped, a crystal partition stands across her room's passage; once Fiona has
              // asked about the release it opens (lifting away) as Alisha steps out, until the reunion scene.
              if (partition && same(partition, pos)) {
                return (
                  <div key={`${r}-${c}`} className={`passage is-partition${sides.includes('l') || sides.includes('r') ? ' is-across' : ''}${
                    shut ? '' : ' is-opening'}`}
                    data-partition={shut ? 'shut' : 'opening'} role="img"
                    aria-label={shut ? 'A crystal partition, closed, with Alisha behind it' : 'A crystal partition, open: Alisha has stepped out'}>
                    <PartitionArt />
                  </div>
                );
              }
              if (!route.gate) {
                return (
                  <div key={`${r}-${c}`} className="path" aria-hidden="true">
                    {sides.map((side) => <i key={side} className={`path-${side}`} />)}
                  </div>
                );
              }
              // Labelled as drawn: closed while the palace opening has yet to reach it, or while its region is under fog.
              const drawnOpen = shownOpen(gate);
              const stage = gate === sealed ? phase : null;
              const across = sides.includes('l') || sides.includes('r');
              // The sealed gate carries the symbols of the tasks it needs, each lit once done.
              const needs = gate === sealed ? (regions[gate].unlock as TaskUnlock).tasks : [];
              const lit = needs.map((t) => state.session.done.includes(t));
              const symbols = needs.length > 0 ? `, ${lit.filter(Boolean).length} of ${needs.length} symbols lit` : '';
              return (
                <div key={`${r}-${c}`}
                  className={`passage${across ? ' is-across' : ''}${drawnOpen ? ' is-open' : ''}${needs.length ? ' is-sealed' : ''}${
                    stage === 'glow' ? ' is-glowing' : stage === 'opening' ? ' is-opening' : ''}`}
                  data-passage={gate} role="img" aria-label={`Rune gate to ${regions[gate].name}, ${drawnOpen ? 'open' : 'closed'}${symbols}`}>
                  <RuneGate open={drawnOpen} opening={stage === 'opening'} />
                  {needs.length > 0 && <GateSymbols symbols={needs.map((t) => tasks![t].symbol!)} lit={lit} />}
                </div>
              );
            }
            const locked = !isCellOpen(state.session, pos) || heldBack.includes(ri);
            const plate = plates.get(`${r},${c}`);
            const fixed = !!plate && isFixed(state.session, pos);
            const treasure = !plateGoal(state.session.level) && goal.kind === 'treasure' && same(goal.at, pos) && treasureShown(state);
            // Party levels: Alisha's plates, once revealed: never an item's, glowing once she can move there, and her target
            // while she is picked up; she stands on one once placed (on a trap's until she is freed).
            const charPlate = alishaPlates.find((q) => q.shown && same(q.at, pos));
            const standHere = !!charPlate;
            const isTarget = !!destination && same(destination, pos);
            const standing = standHere && !!spots && same(spots.alisha, pos);
            // Merge to treasure: the crafted chest stands on a cell that holds no item.
            const chest = same(state.session.chest, pos);
            // Container levels: a closed container stands on a cell that holds no item, covered by a dust sheet until its
            // item is made; uncovered, it shows what it holds.
            const box = closedContainerAt(state.session, pos);
            const container = box === -1 ? undefined : state.session.level.containers![box];
            const covered = !!container && !containerShown(state.session, box);
            // An `open` item goal (the attic): the made goal item, waiting to be tapped open.
            const openable = goalOpenableAt(state.session, pos);
            if (item || treasure || chest || container || standing) cls.push('has-item');
            if (standHere) {
              cls.push('is-character-plate');
              if (charPlate.pressed) cls.push('is-pressed');
              else if (aiming && isTarget) cls.push('is-alisha-target');
              else if (movable && isTarget) cls.push('is-ready');
            }
            if (openable) cls.push('is-openable');
            if (container) cls.push(covered ? 'is-covered' : 'has-container');
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
              const fits = drag.alisha ? isTarget : canDropAt(state, drag.origin, pos);
              cls.push(fits ? 'is-drop-target' : 'is-drop-blocked');
            }
            if (same(origin, pos)) cls.push('is-drag-origin');
            const target = has(guide.targets, pos);
            const combines = target && !!picked && !!craftedItem(state.session, picked, pos);
            const source = has(guide.sources, pos);
            if (target) cls.push('is-merge-target');
            if (source) cls.push('is-merge-source');
            const isGoal = has(goals, pos);
            if (isGoal) cls.push('is-goal-item');
            const isOutput = !!merge && has(merge.outputs, pos);
            const isConsumed = !!merge && !isOutput && has(merge.cells, pos);
            const label = standHere
              ? `Alisha's pressure plate${standing && shut ? ': Alisha is standing on it, behind a crystal partition'
                : standing ? `: ${prize.opened}` : charPlate.pressed ? ', pressed down' : state.alishaSelected && isTarget ? ', tap to stand Alisha here' : ''}`
              : treasure
              ? `${prize.name}, ${state.session.collected ? prize.opened : prize.idle ?? `closed, tap to ${prize.verb}`}`
              : chest ? `${state.session.level.recipe!.name}, closed, tap to open`
              : container ? (covered ? 'something under a dust sheet'
                : `${container.name}, closed, holds ${batchText(container.contents)}, tap to open`)
              : item ? `${itemLabel(item)}${openable ? ', tap to open' : ''}` : 'empty';
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
                aria-label={`Row ${r + 1}, column ${c + 1}${place}: ${label}${combines ? ', combines here' : target ? ', merges here' : source ? ', can merge' : ''}`}
                aria-pressed={same(state.selected, pos)}
                aria-disabled={over || locked || fixed || covered ? true : undefined}
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
                {chest && <span className="cell-art"><ChestArt /></span>}
                {container && (covered ? <span className="cell-art"><DustSheetArt /></span> : (
                  <>
                    <span className="cell-art"><ContainerArt art={container.art} /></span>
                    <span className="container-badge" aria-hidden="true">
                      {batchGroups(container.contents).map(({ item: c, n }) => (
                        <span key={`${c.family}${c.tier}`} className="container-badge-part">
                          {n}<span className="container-badge-art"><ItemArt item={c} /></span>
                        </span>
                      ))}
                    </span>
                  </>
                ))}
                {container && !covered && revealed === box && (
                  <span key={`unveil-${seq}`} data-fx="unveil" aria-hidden="true"><DustSheetArt /></span>
                )}
                {has(unpacked, pos) && (
                  <span key={`unpack-${seq}`} data-fx="output" aria-hidden="true">
                    {SPARKS.map((i) => <i key={i} className="fx-spark" />)}
                  </span>
                )}
                {treasure && goal.kind === 'treasure' && (
                  <span className="cell-art"><PrizeArt prize={goal.prize} open={state.session.collected} /></span>
                )}
                {standHere && <span className="cell-art plate-art"><CharacterPlateArt pressed={charPlate.pressed} /></span>}
                {standing && <span className="cell-art plate-alisha"><AlishaArt /></span>}
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
        {/* Chapter 1's woodland and palace boards: each tile's floor (grass, or marble), its cell and half the gaps around it,
            the texture lined up across the board so a room reads as one patch of ground. After the cells (which Board
            finds by their index), drawn under them all (see .floor). */}
        {(scene === 'entrance' || scene === 'palace') && board.flatMap((rowCells, r) => rowCells.map((_, c) => (
          isCell({ row: r, col: c }) && (!regions || regionAt(regions, { row: r, col: c }) !== -1) ? (
            <div key={`floor-${r}-${c}`} className="floor" aria-hidden="true"
              style={{ gridRow: `${r + 1} / span 1`, gridColumn: `${c + 1} / span 1`, '--r': r, '--c': c } as CSSProperties} />
          ) : null)))}
        {/* Chapter 1's room boards: one backdrop across the whole board, gaps included, under the rooms' floors, the
            terrain, paths, gates and everything else, so it runs on unbroken between the rooms: the woodland's forest
            (.forest), the palace's deeper marble halls (.halls). In the woodland a hidden link shows a glade through the
            forest, its clue, until its part opens (not under fog), and Alisha and Fiona stand in a clearing joined to the
            ground beside them (see clearings). */}
        {surround && <div className={woodland ? 'forest' : 'halls'} aria-hidden="true" />}
        {woodland?.map((r, i) => (r.link && !isCell(r.link) && !fogged.includes(i) ? (
          <div key={`clue-${i}`} className="forest-clue" aria-hidden="true" data-clue
            style={{ gridRow: `${r.link.row + 1} / span 1`, gridColumn: `${r.link.col + 1} / span 1` }} />
        ) : null))}
        {clearings.map(({ at, sides }) => (
          <div key={`clearing-${at.row}-${at.col}`} className={['clearing', ...sides.map((side) => `join-${side}`)].join(' ')}
            aria-hidden="true" data-clearing
            style={{ gridRow: `${at.row + 1} / span 1`, gridColumn: `${at.col + 1} / span 1`, '--r': at.row, '--c': at.col } as CSSProperties} />
        ))}
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
          // A region under fog: its shape, misted over, with nothing to read or tap.
          if (fogged.includes(i)) {
            return (
              <div key={r.name} className="region is-fog" data-fog={i} aria-hidden="true"
                style={{ gridRow: `${r.row + 1} / span ${r.rows}`, gridColumn: `${r.col + 1} / span ${r.cols}` }} />
            );
          }
          const locked = !shownOpen(i);
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
        {/* The fog lifting off the regions a story scene held back, once it has been read (it stays, faded out, until the
            next action). */}
        {regions && lifted.map((i) => (
          <div key={`lift-${seq}-${i}`} className="region is-fog is-lifting" data-fog-lifting={i} aria-hidden="true"
            style={{ gridRow: `${regions[i].row + 1} / span ${regions[i].rows}`, gridColumn: `${regions[i].col + 1} / span ${regions[i].cols}` }} />
        ))}
        {/* Party levels: the speech bubble showing, beside its speaker. It pauses the board until it is tapped (or Enter or
            Space pressed on it), one line at a time; taps elsewhere do nothing, and its own tap never reaches the board. */}
        {speaking && spots && line && !storyPaused && (
          // A story scene due first (the forecourt's, C1-08B) comes before it: it appears once that has been read, and the
          // camera frames it then.
          <div className={`bubble-anchor is-${line.who}`}
            style={{ gridRow: `${spots[line.who].row + 1} / span 1`, gridColumn: `${spots[line.who].col + 1} / span 1` }}>
            <button key={state.talkLine} ref={bubbleRef} type="button" className="speech-bubble"
              data-bubble data-speaker={line.who}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                // A pointer's tap may be followed by a stray click on what was under the bubble; a key press has none.
                if (e.detail > 0) suppressClick();
                dispatch({ type: 'dismissBubble' });
              }}>
              <span className="sr-only">{NAMES[line.who]} says: </span>
              <span className="bubble-text">{line.text}</span>
              <span className="bubble-prompt">Tap to continue</span>
            </button>
          </div>
        )}
        {scene === 'attic' && <AtticDecor />}
      </div>
      </div>
      {overflowing && (
        <button type="button" className="center-board" data-action="center-board" onClick={() => { settle(); centerBoard(); }}>
          Center board
        </button>
      )}
      {drag && (ghostItem || drag.alisha) && (
        <div
          className={`drag-ghost${drag.alisha ? ' is-alisha' : ''}`}
          data-drag-ghost
          style={{ left: drag.x, top: drag.y, width: drag.size, height: drag.size }}
        >
          {ghostItem ? <ItemArt item={ghostItem} /> : <AlishaArt />}
        </div>
      )}
    </div>
  );
}
