// The transcript parts of the mock Bica screen, drawn in BoardUI's visual
// language. The prompt bubble and the line-by-line fade come from BoardUI's
// free chat screen (agent-chat-message.tsx, MIT). Tool calls, the progress
// list, and the thinking line are the prototype's own, written from scratch.
import { marked } from 'marked';
import { For, Show, createMemo, createSignal, onSettled } from 'solid-js';

import { cx } from '../ui/cx';
import { Chip } from '../ui/display';
import { Glyph, type IconComponent } from '../ui/icon';
import {
  RiArrowRightSLine,
  RiCheckLine,
  RiCheckboxBlankCircleLine,
  RiCheckboxCircleFill,
  RiFileCopyLine,
  RiFileEditLine,
  RiFileSearchLine,
  RiLoader4Line,
  RiPencilLine,
  RiSearchLine,
  RiTerminalBoxLine,
} from '../ui/icons';
import type { Step, Tool } from './data';

/* ------------------------------------------------------------ user prompt */

export function UserPrompt(props: { text: string }) {
  return (
    <p class="ms-auto flex w-fit max-w-[85%] flex-col rounded-2xl bg-background-primary-default px-3 py-[11px] text-start text-body-regular break-words whitespace-pre-wrap text-text-primary shadow-card sm:max-w-[75%]">
      {props.text}
    </p>
  );
}

/* -------------------------------------------------------- assistant reply */

export function AssistantReply(props: { text: string; streaming?: boolean }) {
  // One element per Markdown block, kept in place while text streams in, so
  // only a block that just arrived plays the fade.
  const blocks = createMemo(() =>
    marked
      .lexer(props.text)
      .filter((t) => t.type !== 'space')
      .map((t) => t.raw),
  );
  const [copied, setCopied] = createSignal(false);
  return (
    <div class="group/message flex flex-col gap-1 px-1">
      {/* Blocks fade and unblur in as they arrive, like BoardUI's StreamedText. */}
      <div class="bui-markdown bui-line-in">
        <For each={blocks()} keyed={false}>
          {(raw) => <div innerHTML={marked.parse(raw(), { async: false })} />}
        </For>
      </div>
      <div
        class={cx(
          'flex items-center gap-1 transition-opacity duration-150',
          props.streaming
            ? 'pointer-events-none opacity-0'
            : 'opacity-0 group-hover/message:opacity-100 focus-within:opacity-100 max-sm:opacity-100',
        )}
      >
        <button
          type="button"
          aria-label={copied() ? 'Copied' : 'Copy message'}
          title={copied() ? 'Copied' : 'Copy message'}
          onClick={() => {
            void navigator.clipboard?.writeText(props.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          class="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary transition-colors hover:bg-background-primary-default hover:text-foreground-icon-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:outline-none"
        >
          <Glyph of={copied() ? RiCheckLine : RiFileCopyLine} class="size-4" />
        </button>
        <span class="ms-1 text-caption-1-regular text-text-tertiary">
          just now
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- thinking */

/** Three dots rising in turn and a shimmering label with a live timer. */
export function Thinking(props: { label?: string }) {
  const [seconds, setSeconds] = createSignal(0);
  onSettled(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  });
  return (
    <div role="status" class="flex items-center gap-2 px-1 text-body-regular">
      <span
        aria-hidden="true"
        class="flex items-center gap-[3px] text-accent-500"
      >
        <span class="bui-dot size-1.5 rounded-full bg-current" />
        <span class="bui-dot size-1.5 rounded-full bg-current [animation-delay:150ms]" />
        <span class="bui-dot size-1.5 rounded-full bg-current [animation-delay:300ms]" />
      </span>
      <span class="agent-progress-loading-text">
        {props.label ?? 'Thinking'}
      </span>
      <Show when={seconds() >= 2}>
        <span class="text-caption-1-medium text-text-tertiary tabular-nums">
          {seconds()}s
        </span>
      </Show>
    </div>
  );
}

/* ------------------------------------------------------------- tool calls */

const TOOL_ICON: Record<string, IconComponent> = {
  bash: RiTerminalBoxLine,
  read: RiFileSearchLine,
  write: RiFileEditLine,
  edit: RiPencilLine,
  grep: RiSearchLine,
};

const formatMs = (ms: number) =>
  ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

export type LiveTool = Tool & { running?: boolean };

/** Tool calls as one card of collapsed rows, each a <details> that opens to
 * its output. */
export function ToolCalls(props: { tools: LiveTool[] }) {
  return (
    <div class="flex flex-col overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card">
      <For each={props.tools}>
        {(tool) => (
          <details class="group/tool border-b border-separator-border last:border-b-0">
            <summary
              class={cx(
                'flex h-10 cursor-pointer list-none items-center gap-2 px-3 outline-none select-none',
                'transition-colors duration-150 hover:bg-background-primary-hover focus-visible:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring',
              )}
            >
              <Show
                when={!tool.running}
                fallback={
                  <RiLoader4Line class="bui-spin size-4 shrink-0 text-accent-500" />
                }
              >
                <Glyph
                  of={TOOL_ICON[tool.name] ?? RiTerminalBoxLine}
                  class="size-4 shrink-0 text-foreground-icon-secondary"
                />
              </Show>
              <span
                class={cx(
                  'shrink-0 text-body-medium',
                  tool.running
                    ? 'agent-progress-loading-text'
                    : 'text-text-primary',
                )}
              >
                {tool.name}
              </span>
              <span class="min-w-0 flex-1 truncate font-mono text-[12px] text-text-secondary">
                {tool.target}
              </span>
              <Show when={tool.diff}>
                {(diff) => (
                  <span class="hidden shrink-0 items-center gap-1 sm:flex">
                    <Chip
                      variant="caption"
                      color="lime"
                      class="py-0 tabular-nums"
                    >
                      +{diff()[0]}
                    </Chip>
                    <Show when={diff()[1]}>
                      <Chip
                        variant="caption"
                        color="rose"
                        class="py-0 tabular-nums"
                      >
                        −{diff()[1]}
                      </Chip>
                    </Show>
                  </span>
                )}
              </Show>
              <Show when={!tool.running}>
                <span class="shrink-0 text-caption-1-medium text-text-tertiary tabular-nums">
                  {formatMs(tool.ms)}
                </span>
              </Show>
              <RiArrowRightSLine class="size-4 shrink-0 text-foreground-icon-tertiary transition-transform duration-150 group-open/tool:rotate-90" />
            </summary>
            <pre class="max-h-56 overflow-auto border-t border-separator-border bg-background-secondary-default px-3 py-2.5 font-mono text-[12px] leading-[18px] whitespace-pre-wrap text-text-secondary">
              {tool.output}
            </pre>
          </details>
        )}
      </For>
    </div>
  );
}

/* --------------------------------------------------------- agent progress */

/** The agent's plan as a checklist: done steps tick, the active one
 * shimmers, and a ring in the header fills as steps finish. */
export function AgentProgress(props: { steps: Step[] }) {
  const done = () => props.steps.filter((s) => s.state === 'done').length;
  const ring = () => 2 * Math.PI * 7;
  return (
    <section class="flex flex-col gap-1 rounded-2xl bg-background-tertiary-default/60 p-1.5 dark:bg-black/25">
      <header class="flex items-center gap-2 px-2 pt-1 pb-0.5">
        <svg viewBox="0 0 18 18" class="size-4 -rotate-90" aria-hidden="true">
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="var(--color-border-button-default)"
            stroke-width="2"
          />
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="var(--color-accent-500)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-dasharray={`${ring()}`}
            stroke-dashoffset={`${ring() * (1 - done() / Math.max(1, props.steps.length))}`}
            class="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <span class="text-body-2-medium text-text-primary">Plan</span>
        <span class="text-body-2-regular text-text-tertiary tabular-nums">
          {done()} of {props.steps.length}
        </span>
      </header>
      <ol class="flex flex-col rounded-xl bg-background-primary-default p-1 shadow-card">
        <For each={props.steps}>
          {(step) => (
            <li class="flex min-h-8 items-center gap-2 rounded-lg px-2 py-1.5">
              <Show
                when={step.state !== 'active'}
                fallback={
                  <RiLoader4Line class="bui-spin size-4 shrink-0 text-accent-500" />
                }
              >
                <Glyph
                  of={
                    step.state === 'done'
                      ? RiCheckboxCircleFill
                      : RiCheckboxBlankCircleLine
                  }
                  class={cx(
                    'size-4 shrink-0',
                    step.state === 'done'
                      ? 'text-accent-500'
                      : 'text-foreground-icon-quaternary',
                  )}
                />
              </Show>
              <span
                class={cx(
                  'text-body-2-regular',
                  step.state === 'active' && 'agent-progress-loading-text',
                  step.state === 'done' &&
                    'text-text-secondary line-through decoration-text-tertiary/60',
                  step.state === 'pending' && 'text-text-tertiary',
                )}
              >
                {step.label}
              </span>
            </li>
          )}
        </For>
      </ol>
    </section>
  );
}
