import { useEffect, useId, useRef, useState } from 'react';

/** Copies `text` to the clipboard; true only once the browser confirms it was written. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const FEEDBACK_MS = 2000;

/** The puzzle's reproduction ID in a compact read-only field with a Copy button. */
export function PuzzleId({ id }: { id: string }) {
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<'copied' | 'failed' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const selectAll = () => {
    const el = field.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
  };
  const copy = async () => {
    const ok = await copyText(id);
    clearTimeout(timer.current);
    setResult(ok ? 'copied' : 'failed');
    // Without clipboard access, leave the ID selected so it can be copied by hand.
    if (!ok) selectAll();
    else timer.current = setTimeout(() => setResult(null), FEEDBACK_MS);
  };

  return (
    <div className="puzzle-id-row">
      <label htmlFor={fieldId}>Puzzle ID</label>
      <input ref={field} id={fieldId} className="puzzle-id" data-puzzle-id type="text" readOnly value={id}
        spellCheck={false} autoComplete="off" onFocus={selectAll}
        // A click inside an existing selection collapses it after this handler runs, so reselect afterwards.
        onClick={() => setTimeout(selectAll)} />
      <button type="button" className="copy-button" data-action="copy-puzzle-id" onClick={copy}>
        {result === 'copied' ? 'Copied' : 'Copy'}
      </button>
      <span className={`copy-status${result === 'failed' ? '' : ' sr-only'}`} role="status">
        {result === 'copied' ? 'Puzzle ID copied.' : result === 'failed' ? "Couldn't copy. The ID is selected; copy it by hand." : ''}
      </span>
    </div>
  );
}
