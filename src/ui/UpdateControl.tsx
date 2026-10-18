import { useEffect, useState } from 'react';
import { applyUpdate, BUILD_ID, checkForUpdate, cleanUpdateParam } from '../update';
import './update.css';

type State = 'idle' | 'checking' | 'current' | 'available' | 'error';

export function UpdateControl() {
  const [state, setState] = useState<State>('idle');
  const [latest, setLatest] = useState('');

  useEffect(() => {
    cleanUpdateParam();
  }, []);

  const check = async () => {
    setState('checking');
    const result = await checkForUpdate();
    if (result.kind === 'available') setLatest(result.build);
    setState(result.kind);
  };

  const text: Record<State, string> = {
    idle: '',
    checking: 'Checking…',
    current: "You're up to date.",
    available: `Update available (build ${latest}). Updating restarts from level 1 (progress isn't saved).`,
    error: "Couldn't check for updates. Check your connection and try again.",
  };

  return (
    <div className="update-control" data-update>
      <span className="update-build">
        Build <span data-build-id>{BUILD_ID}</span>
      </span>
      <button
        type="button"
        className="update-btn"
        data-action="check-updates"
        disabled={state === 'checking'}
        onClick={check}
      >
        Check for updates
      </button>
      <div aria-live="polite" className="update-live">
        <span className="update-status" data-update-status={state}>
          {text[state]}
        </span>
      </div>
      {state === 'available' && (
        <button
          type="button"
          className="update-btn update-btn-primary"
          data-action="apply-update"
          onClick={() => applyUpdate(latest)}
        >
          Update now
        </button>
      )}
    </div>
  );
}
