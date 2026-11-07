import { For, createEffect, createSignal, onSettled } from 'solid-js';

import type { TerminalOutput } from '@bica/shared/protocol';
import { resizeTerminal, terminalInput, useTerminalOutput } from './terminals';
import { theme } from '../ui/theme';

type Ghostty = typeof import('ghostty-web');
type Term = InstanceType<Ghostty['Terminal']>;

// The WASM loads once per tab, on the first terminal opened.
let ghostty: Promise<Ghostty> | undefined;
function load() {
  return (ghostty ??= import('ghostty-web').then(async (m) => {
    await m.init();
    return m;
  }));
}

// Keys a phone keyboard lacks.
const KEYS = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t' },
  { label: '^C', data: '\x03' },
  { label: '↑', data: '\x1b[A' },
  { label: '↓', data: '\x1b[B' },
  { label: '←', data: '\x1b[D' },
  { label: '→', data: '\x1b[C' },
];

// Ghostty reads hex or rgb(); computed styles may say rgba() or oklch().
function hex(css: string) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = css;
  return ctx.fillStyle.startsWith('#') ? ctx.fillStyle : '#808080';
}

export default function TerminalView(props: { id: string }) {
  const output = useTerminalOutput(() => props.id);
  let host: HTMLDivElement | undefined;
  let term: Term | undefined;
  let latest: TerminalOutput | null = null;
  // What the screen has shown so far: which run, and up to which character.
  let shown = { run: -1, end: 0 };

  function sync() {
    const v = latest;
    if (!term || !v) return;
    const end = v.start + v.output.length;
    if (v.run !== shown.run || shown.end < v.start || shown.end > end) {
      term.reset();
      term.write(v.output);
    } else if (end > shown.end) {
      term.write(v.output.slice(shown.end - v.start));
    }
    shown = { run: v.run, end };
  }

  createEffect(
    () => output(),
    (v) => {
      latest = v;
      sync();
    },
  );

  // Follow the system scheme too; a forced theme pins it.
  const [systemDark, setSystemDark] = createSignal(false);
  onSettled(() => {
    const q = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(q.matches);
    update();
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  });

  // Colors are fixed once open, so a theme change makes a new screen and
  // replays the kept output into it.
  createEffect(
    () => [theme(), systemDark()] as const,
    () => {
      let gone = false;
      let made: Term | undefined;
      // The screen measures its cells once: the font must be in by then.
      const font = document.fonts.load('13px "Atkinson Hyperlegible Mono"');
      void Promise.all([load(), font]).then(([m]) => {
        if (gone || !host) return;
        const style = getComputedStyle(host);
        made = new m.Terminal({
          fontSize: parseFloat(style.fontSize),
          fontFamily: style.fontFamily,
          cursorBlink: true,
          scrollback: 10_000,
          theme: {
            background: hex(style.backgroundColor),
            foreground: hex(style.color),
            cursor: hex(style.color),
            // Selected text reads inverted, in the muted gray.
            selectionBackground: hex(style.borderColor),
            selectionForeground: hex(style.backgroundColor),
          },
        });
        const fit = new m.FitAddon();
        made.loadAddon(fit);
        host.replaceChildren();
        made.open(host);
        fit.fit();
        fit.observeResize();
        const id = props.id;
        made.onData((data) => void terminalInput(id, data).catch(() => {}));
        made.onResize(
          ({ cols, rows }) =>
            void resizeTerminal(id, cols, rows).catch(() => {}),
        );
        void resizeTerminal(id, made.cols, made.rows).catch(() => {});
        term = made;
        shown = { run: -1, end: 0 };
        sync();
        made.focus();
      });
      return () => {
        gone = true;
        if (term === made) term = undefined;
        made?.dispose();
      };
    },
  );

  // Phone keyboards (and IME) type through beforeinput with no keydown,
  // which ghostty-web ignores. Its own keydowns cancel this event, so
  // nothing is sent twice.
  const onBeforeInput = (e: InputEvent) => {
    const data =
      e.inputType === 'insertText' || e.inputType === 'insertReplacementText'
        ? e.data
        : e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph'
          ? '\r'
          : e.inputType === 'deleteContentBackward'
            ? '\x7f'
            : null;
    if (!data) return;
    e.preventDefault();
    void terminalInput(props.id, data).catch(() => {});
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <div
        ref={(el) => (host = el)}
        onBeforeInput={onBeforeInput}
        class="min-h-0 flex-1 overflow-hidden border-muted bg-bg px-2 pt-1 font-mono text-code text-fg"
      />
      <div class="hidden shrink-0 gap-1 overflow-x-auto border-t border-line bg-panel px-2 py-1.5 pb-[max(--spacing(1.5),env(safe-area-inset-bottom))] touch:flex">
        <For each={KEYS}>
          {(key) => (
            <button
              type="button"
              class="h-9 min-w-11 rounded-md border border-line bg-surface px-2 font-mono text-meta"
              onClick={() => {
                void terminalInput(props.id, key.data).catch(() => {});
                term?.focus();
              }}
            >
              {key.label}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
