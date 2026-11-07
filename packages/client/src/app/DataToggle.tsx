import { For, Show, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';

import {
  MODE_LABELS,
  MODES,
  enabled,
  exitFixtures,
  mode,
  setMode,
  type Mode,
} from '../fixtures';

// Dev-only chrome for test data (lib/fixtures), not part of the design:
// plain on purpose. Shows only after `?data=` was in the URL in this tab.
const OPTIONS: [Mode | undefined, string][] = [
  [undefined, 'Live'],
  ...MODES.map((m): [Mode, string] => [m, MODE_LABELS[m]]),
];

function button(active: boolean): JSX.CSSProperties {
  return {
    border: '0',
    padding: '6px 8px',
    'border-radius': '6px',
    'white-space': 'nowrap',
    color: '#171717',
    background: active ? '#fff' : 'transparent',
  };
}

export default function DataToggle() {
  // Out of the way for a screenshot; the data stays until a reload.
  const [hidden, setHidden] = createSignal(false);
  return (
    <Show when={enabled() && !hidden()}>
      <div
        style={{
          position: 'fixed',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          'z-index': 9999,
          display: 'flex',
          gap: '2px',
          padding: '2px',
          background: '#d4d4d4',
          'border-radius': '8px',
          font: '12px/1 system-ui, sans-serif',
          'max-width': 'calc(100vw - 16px)',
          'overflow-x': 'auto',
        }}
        aria-label="Test data"
      >
        <For each={OPTIONS}>
          {(option) => (
            <button
              style={button(mode() === option[0])}
              aria-pressed={mode() === option[0] ? 'true' : 'false'}
              onClick={() => setMode(option[0])}
            >
              {option[1]}
            </button>
          )}
        </For>
        <button
          style={button(false)}
          title="Hide this until a reload, keeping the data"
          onClick={() => setHidden(true)}
        >
          –
        </button>
        <button
          style={button(false)}
          title="Back to live data and hide this"
          onClick={exitFixtures}
        >
          ×
        </button>
      </div>
    </Show>
  );
}
