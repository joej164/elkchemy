import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './comic.css';

export interface ComicLine { readonly speaker?: string; readonly text: string }
export interface ComicPanel {
  readonly id: string;
  /** Alt text for the art: what the picture shows. */
  readonly description: string;
  readonly art: ReactNode;
  readonly lines: readonly ComicLine[];
}

/**
 * A tap this soon after the comic appears is the second half of the double tap that opened it (on the button that was
 * under the same finger), not a request to move on, so it is ignored.
 */
export const COMIC_SETTLE_MS = 350;

/** One text beat: line `line` of panel `panel`. A comic shows one beat at a time, with its panel's picture. */
export interface Beat { readonly panel: number; readonly line: number }

/** Every beat in reading order: each panel's lines in turn. */
export function comicBeats(panels: readonly ComicPanel[]): Beat[] {
  return panels.flatMap((p, panel) => p.lines.map((_, line) => ({ panel, line })));
}

/**
 * The beat shown after a tap on the scene (`next`) or Back (`back`), crossing pictures as needed. Back stays on the
 * first beat; `next` on the last beat is 'finish'.
 */
export function stepBeat(beat: number, total: number, move: 'next' | 'back'): number | 'finish' {
  if (move === 'back') return Math.max(beat - 1, 0);
  return beat + 1 < total ? beat + 1 : 'finish';
}

/**
 * What beat `beat` shows: its panel and line, whether it is the last, the prompt under its line (the finish prompt on the
 * last beat; on the first, that tapping moves on) and the scene button's name.
 */
export function comicView(beats: readonly Beat[], beat: number, finish: { readonly prompt: string; readonly name: string }) {
  const last = beat === beats.length - 1;
  return {
    ...beats[beat], last,
    prompt: last ? finish.prompt : beat === 0 ? 'Tap to continue' : '',
    name: last ? finish.name : 'Next',
  };
}

/** What moving to `beat` announces: the picture (its number and description) when it changed, then the line. */
export function beatAnnouncement(panels: readonly ComicPanel[], beat: Beat, newPicture: boolean, prompt: string): string {
  const p = panels[beat.panel];
  const l = p.lines[beat.line];
  const picture = newPicture ? `Picture ${beat.panel + 1} of ${panels.length}. ${p.description} ` : '';
  return `${picture}${l.speaker ? `${l.speaker}: ${l.text}` : l.text}${prompt ? ` ${prompt}` : ''}`;
}

/**
 * A comic told one picture and one line at a time. The picture fills the screen; tapping it (or its caption) shows the
 * next line, then the next picture, and on the last line (which shows `finish.prompt`) calls `onFinish`. The scene is
 * one transparent button over the picture and caption (focused on entry; Enter or Space moves on), named Next or
 * `finish.name`. Back (to the previous line, across pictures) and Home sit outside it, so they never move on.
 */
export function Comic({ title, label, panels, finish, onFinish, onPanel, onHome, musicControl }: {
  title: string;
  label: string;
  panels: readonly ComicPanel[];
  finish: { readonly prompt: string; readonly name: string };
  onFinish: () => void;
  /** Called with the index of the panel shown, on entry and whenever the picture changes. */
  onPanel?: (panel: number) => void;
  onHome: () => void;
  musicControl: ReactNode;
}) {
  const [beats] = useState(() => comicBeats(panels));
  // `newPicture` and `moved`: what the last move did, for its announcement (none on entry: the focused scene says it).
  const [view, setView] = useState({ beat: 0, newPicture: true, moved: false });
  const { panel, line, last, prompt, name } = comicView(beats, view.beat, finish);
  const p = panels[panel];
  const l = p.lines[line];
  const sceneRef = useRef<HTMLButtonElement>(null);
  const onPanelRef = useRef(onPanel);
  onPanelRef.current = onPanel;
  const id = useId();

  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = performance.now(); sceneRef.current?.focus(); }, []);
  useEffect(() => { onPanelRef.current?.(panel); }, [panel]);

  const move = (to: 'next' | 'back') => {
    if (to === 'next' && performance.now() - shownAt.current < COMIC_SETTLE_MS) return;
    const next = stepBeat(view.beat, beats.length, to);
    if (next === 'finish') onFinish();
    else if (next !== view.beat) setView({ beat: next, newPicture: beats[next].panel !== panel, moved: true });
  };

  return (
    <div className="page comic-page">
      <header className="comic-top">
        <button type="button" className="back-button" data-action="home" onClick={onHome}>‹ Home</button>
        <h1 className="comic-title">{title}</h1>
        <div className="title-controls">{musicControl}</div>
      </header>
      <section className="comic-stage" aria-label={`${title}: ${label}`} data-comic>
        <figure className="comic-scene" data-panel={p.id} data-beat={view.beat}>
          <div className="comic-frame">
            <div key={p.id} id={`${id}-art`} className="comic-art" role="img" aria-label={p.description}>{p.art}</div>
          </div>
          <figcaption key={view.beat} id={`${id}-caption`} className="comic-caption">
            {l.speaker ? <p><strong>{l.speaker}:</strong> {l.text}</p> : <p className="comic-narration">{l.text}</p>}
            {prompt && <p className={`comic-prompt${last ? ' is-finish' : ''}`}>{prompt}</p>}
          </figcaption>
        </figure>
        <button ref={sceneRef} type="button" className="comic-advance" data-action={last ? 'comic-finish' : 'comic-next'}
          aria-label={name} aria-describedby={`${id}-art ${id}-caption`} onClick={() => move('next')} />
      </section>
      <div className="comic-bottom">
        <button type="button" className="back-button" data-action="comic-back" aria-disabled={view.beat === 0 ? true : undefined}
          onClick={() => move('back')}>‹ Back</button>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {view.moved ? beatAnnouncement(panels, beats[view.beat], view.newPicture, last ? finish.prompt : '') : ''}
      </div>
    </div>
  );
}
