import { useEffect, useRef, useState } from 'react';
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

/** The number of panels shown after one more advance (never more than `total`). */
export function nextShown(shown: number, total: number): number {
  return Math.min(shown + 1, total);
}

/** The primary button's visible and accessible labels for the current state. */
export function comicButtonLabels(shown: number, total: number, finishLabel: string): { text: string; name: string } {
  if (shown >= total) return { text: finishLabel, name: finishLabel };
  return { text: 'Next', name: `Next panel, ${shown + 1} of ${total}` };
}

function announcement(panel: ComicPanel, n: number, total: number): string {
  const spoken = panel.lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join(' ');
  return `Panel ${n} of ${total}. ${panel.description} ${spoken}`;
}

export function Comic({ title, label, panels, finishLabel, onFinish, secondary, onShown, onHome, musicControl }: {
  title: string;
  label: string;
  panels: readonly ComicPanel[];
  finishLabel: string;
  onFinish: () => void;
  secondary?: { readonly label: string; readonly onClick: () => void };
  /** Called with the number of panels shown, on entry and after each reveal. */
  onShown?: (shown: number) => void;
  onHome: () => void;
  musicControl: ReactNode;
}) {
  const total = panels.length;
  const [shown, setShown] = useState(1);
  const done = shown >= total;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const { text, name } = comicButtonLabels(shown, total, finishLabel);

  useEffect(() => { buttonRef.current?.focus(); }, []);
  useEffect(() => { onShown?.(shown); }, [shown, onShown]);
  useEffect(() => {
    if (shown <= 1) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    listRef.current?.querySelector(`[data-panel]:nth-child(${shown})`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [shown]);

  const advance = () => setShown((s) => nextShown(s, total));
  const press = () => { if (done) onFinish(); else advance(); };

  return (
    <div className="page comic-page">
      <header className="title-row">
        <h1>{title}</h1>
        <div className="title-controls">{musicControl}</div>
      </header>
      <button type="button" className="back-button" data-action="home" onClick={onHome}>‹ Home</button>
      <section aria-label={`${title}: ${label}`} data-comic>
        <div className="comic-stage" onClick={() => { if (!done) advance(); }}>
          <ol ref={listRef} className="comic-grid">
            {panels.map((p, i) => i < shown ? (
              <li key={p.id} data-panel={p.id} className={i > 0 ? 'is-new' : undefined}>
                <figure>
                  <div className="comic-art" role="img" aria-label={p.description}>{p.art}</div>
                  <figcaption>
                    {p.lines.map((l, j) => l.speaker
                      ? <p key={j}><strong>{l.speaker}:</strong> {l.text}</p>
                      : <p key={j} className="comic-narration">{l.text}</p>)}
                  </figcaption>
                </figure>
              </li>
            ) : (
              <li key={p.id} className="comic-empty" aria-hidden="true"><div className="comic-art" /></li>
            ))}
          </ol>
        </div>
        <div role="status" aria-live="polite" className="sr-only">
          {shown > 1 ? announcement(panels[shown - 1]!, shown, total) : ''}
        </div>
        <div className="comic-actions row">
          <button ref={buttonRef} type="button" className="btn" data-action={done ? 'comic-finish' : 'comic-next'}
            aria-label={name} onClick={press}>{text}</button>
          {done && secondary && (
            <button type="button" className="btn btn-quiet" data-action="comic-secondary" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
