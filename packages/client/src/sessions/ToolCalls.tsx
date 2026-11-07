import { dynamic, type JSX } from '@solidjs/web';
import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  onSettled,
} from 'solid-js';

import { useSessions } from './sessions';
import { useStepDetail } from './step-detail';
import { createStopwatch, formatDuration, formatLive } from '../ui/time';
import { paths } from '../router';
import type { ToolCall, ToolStatus } from '@bica/shared/transcript';
import DiffBlock, { type DiffSource } from '../files/DiffBlock';
import { CopyButton } from '../ui/CopyButton';
import {
  CodeIcon,
  DrawnCheckIcon,
  FileEditIcon,
  FileReadIcon,
  FileWriteIcon,
  GlobeIcon,
  SearchIcon,
  SessionIcon,
  TerminalIcon,
  ToolIcon,
} from '../ui/icons';
import { summaryClass } from '../ui/Summary';
import Chevron from '../ui/Chevron';
import { Spinner } from '../ui/Spinner';

/** One round of tool calls; calls in the same round ran in parallel. */
export default function ToolCalls(props: { calls: ToolCall[] }) {
  return (
    <div class="flex flex-col">
      <For each={props.calls} keyed={(c) => c.id}>
        {(call) => <ToolRow call={call()} />}
      </For>
    </div>
  );
}

function ToolRow(props: { call: ToolCall }) {
  const summary = () => {
    const s = props.call.args.summary;
    return typeof s === 'string' && s.trim() ? s : undefined;
  };
  // The body mounts on first open: Pierre diffs are too heavy to build for
  // every row in a long transcript. Its input and output load then too, and
  // again when the call's status moves on.
  const [opened, setOpened] = createSignal(false);
  const [detail, setDetail] = createSignal<Partial<ToolCall>>();
  const load = useStepDetail();
  createEffect(
    () => (opened() ? `${props.call.id} ${props.call.status}` : undefined),
    (opened) => {
      if (!opened) return;
      void load(opened.split(' ')[0]!).then((d) => {
        if (d && 'args' in d) setDetail(d);
      });
    },
  );
  const full = () => {
    const d = detail();
    return d && { ...props.call, ...d };
  };
  return (
    <details
      class="group/row expand rounded-md"
      data-call={props.call.id}
      onToggle={(e) => e.currentTarget.open && setOpened(true)}
    >
      <summary class={ROW}>
        <StatusIcon name={props.call.name} status={props.call.status} />
        <span class={[LABEL, props.call.status === 'running' && 'shimmer']}>
          {NAMES[props.call.name] ?? props.call.name}
        </span>
        <Show
          when={summary()}
          fallback={
            // Models often write the summary after the path or command, so
            // the target would flash and then be swapped for it.
            <span class="min-w-0 flex-1 truncate font-mono text-meta">
              {props.call.streaming ? '' : targetOf(props.call)}
            </span>
          }
        >
          <span class="min-w-0 flex-1 truncate text-fg">{summary()}</span>
        </Show>
        <Show when={props.call.stats}>
          {(stats) => (
            <span class="shrink-0 font-mono text-meta tabular-nums">
              <Show when={stats().added}>
                <span class="text-running">+{stats().added}</span>
              </Show>
              <Show when={stats().removed}>
                <span class="ml-1.5 text-danger">−{stats().removed}</span>
              </Show>
            </span>
          )}
        </Show>
        <CallStatus call={props.call} />
        <RowChevron />
      </summary>
      <Show when={full()}>
        {(call) => (
          <Show
            when={changesOf(call())}
            fallback={
              <div class="mt-1 mb-2 md:ml-7.5">
                <ToolBody call={call()} />
              </div>
            }
          >
            {(sources) => <ChangeBody call={call()} sources={sources()} />}
          </Show>
        )}
      </Show>
    </details>
  );
}

/**
 * The right end of a row, after affectUI's Tool Call Card: a spinner and a
 * live timer while it runs; once done, a check that draws in (only when you
 * saw it finish) and then the time, if it was slow; "Failed" on an error.
 */
function CallStatus(props: { call: ToolCall }) {
  const running = () => props.call.status === 'running';
  const now = createStopwatch(() => running() && !!props.call.startedAt);
  const live = () =>
    props.call.startedAt
      ? formatLive(Math.max(0, now() - props.call.startedAt))
      : undefined;
  // Quick calls stay quiet; a time only shows once a call was slow.
  const took = () => {
    const ms = props.call.durationMs;
    return ms !== undefined && ms >= SLOW_MS ? formatDuration(ms) : undefined;
  };
  // Seen running here: the end state swaps in. Calls already over when the
  // transcript loads just show it.
  const ran = createMemo<boolean>((prev) => !!prev || running());
  const [justDone, setJustDone] = createSignal(false, { name: 'callJustDone' });
  createEffect(
    () => props.call.status,
    (status, prev) => {
      if (prev !== 'running' || status !== 'done') return;
      setJustDone(true);
      const id = setTimeout(() => setJustDone(false), 1200);
      return () => clearTimeout(id);
    },
  );
  return (
    <span class="flex shrink-0 items-center gap-1 text-meta tabular-nums">
      <Switch>
        <Match when={running()}>
          <span class="flex items-center gap-1 text-muted [&_svg]:size-3.5">
            <Spinner />
            <Show when={live()}>{(t) => <span>{t()}</span>}</Show>
          </span>
        </Match>
        <Match when={props.call.status === 'error'}>
          <span class={[ran() ? 'swap-in' : 'inline-flex', 'text-danger']}>
            Failed
          </span>
        </Match>
        <Match when={justDone()}>
          <span class="swap-in text-running [&_svg]:size-3.5">
            <DrawnCheckIcon />
          </span>
        </Match>
        <Match when={took()}>
          <span class="text-muted/70">{took()}</span>
        </Match>
      </Switch>
    </span>
  );
}

const SLOW_MS = 3000;

/** A foldable step: a tool call or a thought. */
export const ROW = summaryClass;

/** Hidden until hover, turned while open; the parent is `group/row`. */
export function RowChevron() {
  return (
    <Chevron class="ml-auto opacity-0 transition-[rotate,opacity] group-open/row:rotate-90 group-hover/row:opacity-100 group-focus-visible/row:opacity-100" />
  );
}

/** The name column; fixed width so every row's summary starts at the same x. */
export const LABEL = 'w-14 shrink-0 truncate';

// Short enough for the name column.
const NAMES: Record<string, string> = {
  web_search: 'search',
  web_fetch: 'fetch',
  start_session: 'session',
  session_start: 'session',
  codemode: 'code',
};

// The icon shows what the call does. Its status only tints it, so a round
// doesn't read as a column of checkmarks.
const ICONS: Record<string, () => JSX.Element> = {
  bash: TerminalIcon,
  read: FileReadIcon,
  write: FileWriteIcon,
  edit: FileEditIcon,
  web_search: SearchIcon,
  web_fetch: GlobeIcon,
  start_session: SessionIcon,
  session_start: SessionIcon,
  codemode: CodeIcon,
};

/** The icon for a tool, for rows and the group's stack. */
export function toolIcon(name: string) {
  return ICONS[name] ?? ToolIcon;
}

function StatusIcon(props: { name: string; status: ToolStatus }) {
  const Icon = dynamic(() => toolIcon(props.name));
  return (
    <span
      class={{
        'flex shrink-0 transition-colors duration-200': true,
        'text-running': props.status === 'running',
        'text-danger': props.status === 'error',
        'opacity-50': props.status === 'pending',
      }}
      role="img"
      aria-label={props.status}
    >
      <Icon />
    </span>
  );
}

/**
 * A write or edit: the diff spans the whole card, no indent and no frame of
 * its own, so the code gets every pixel. Edits go side by side when there's
 * room; a write has no old side, so it stays one column.
 */
function ChangeBody(props: { call: ToolCall; sources: DiffSource[] }) {
  return (
    <div class="mt-0.5 mb-1 flex flex-col gap-1">
      <For each={props.sources} keyed={false}>
        {(source) => (
          <DiffBlock source={source()} split={props.call.name === 'edit'} />
        )}
      </For>
      <Show when={props.call.status === 'error' && props.call.output}>
        {(output) => <Code danger>{output()}</Code>}
      </Show>
    </div>
  );
}

function ToolBody(props: { call: ToolCall }) {
  const args = () => props.call.args;
  const rest = () => {
    const { summary: _summary, ...rest } = args();
    return rest;
  };
  const failed = () => props.call.status === 'error';
  const waiting = () =>
    props.call.status === 'running' || props.call.status === 'pending';
  // What it returned: output, or that it's still coming.
  const result = (label = 'Result') => (
    <Show
      when={props.call.output}
      fallback={
        <Show when={waiting()}>
          <Section label={label}>
            <p class="shimmer text-meta">Waiting for {label.toLowerCase()}…</p>
          </Section>
        </Show>
      }
    >
      {(output) => (
        <Section label={failed() ? 'Error' : label} copy={output}>
          <Code danger={failed()} json>
            {output()}
          </Code>
        </Section>
      )}
    </Show>
  );
  return (
    <div class="flex flex-col gap-3">
      <Switch
        fallback={
          <>
            <Section
              label="Arguments"
              copy={() => JSON.stringify(rest(), null, 2)}
            >
              <Code json>{JSON.stringify(rest(), null, 2)}</Code>
            </Section>
            {result()}
          </>
        }
      >
        <Match when={props.call.name === 'bash'}>
          {/* Like a terminal: the command, then what it printed. */}
          <Section label="Command" copy={() => str(args().command)}>
            <Code>
              <span class="text-muted select-none">$ </span>
              {str(args().command)}
            </Code>
          </Section>
          {result('Output')}
        </Match>
        <Match when={props.call.name === 'read'}>
          <Section label="Path" copy={() => str(args().path)}>
            <span class="font-mono text-meta wrap-anywhere text-muted">
              {targetOf(props.call)}
            </span>
          </Section>
          <Show when={failed()}>{result()}</Show>
        </Match>
        <Match when={startsSession(props.call.name)}>
          <StartedSession call={props.call} />
          {/* A started session's link says what its output does. */}
          <Show when={failed()}>{result()}</Show>
        </Match>
        <Match when={props.call.name === 'codemode'}>
          <Script call={props.call} />
        </Match>
      </Switch>
    </div>
  );
}

/**
 * A labelled part of an opened call, with its own copy button: arguments,
 * command, output (affectUI's Tool Call Card).
 */
function Section(props: {
  label: string;
  copy?: () => string;
  children: JSX.Element;
}) {
  return (
    <section class="flex min-w-0 flex-col gap-1">
      <div class="flex h-6 items-center justify-between gap-2">
        <h4 class="text-meta font-medium text-muted">{props.label}</h4>
        <Show when={props.copy}>
          {(copy) => (
            <CopyButton
              text={copy()}
              title={`Copy ${props.label.toLowerCase()}`}
              class="-mr-1"
            />
          )}
        </Show>
      </div>
      {props.children}
    </section>
  );
}

/** The prompt it was given, and a way into the session it started. */
// start_session is the old name, still in older transcripts.
function startsSession(name: string) {
  return name === 'session_start' || name === 'start_session';
}

function StartedSession(props: { call: ToolCall }) {
  const sessions = useSessions();
  const id = () => {
    const id = (props.call.details as { sessionId?: unknown } | undefined)
      ?.sessionId;
    return typeof id === 'string' ? id : undefined;
  };
  const title = () => sessions().find((s) => s.id === id())?.title;
  return (
    <>
      <Show when={id()}>
        {(id) => (
          <a
            class="flex min-w-0 items-center gap-1.5 self-start text-meta text-muted hover:text-fg"
            href={paths.s(id())}
          >
            <SessionIcon />
            <span class="truncate">Open {title() || 'the session'}</span>
          </a>
        )}
      </Show>
      <div class="rounded-md border border-line bg-bg px-2.5 py-2 text-meta leading-relaxed whitespace-pre-wrap md:px-3">
        {str(props.call.args.prompt)}
      </div>
    </>
  );
}

/** A tool call a codemode script made (stepDetail in shared/src/projection.ts). */
type NestedCall = {
  name: string;
  args: string;
  status: 'running' | 'ok' | 'error' | 'cancelled';
  durationMs?: number;
  error?: string;
};

const SCRIPT_HEADER =
  /^Script (completed|failed)\nWall time [\d.]+ seconds\nOutput:\n/;

/** Like Pi's renderer: the script, the calls it made, then what it printed. */
function Script(props: { call: ToolCall }) {
  const calls = (): NestedCall[] => {
    const calls = (props.call.details as { calls?: unknown } | undefined)
      ?.calls;
    return Array.isArray(calls) ? calls : [];
  };
  const output = () => props.call.output?.replace(SCRIPT_HEADER, '').trim();
  return (
    <>
      <Section label="Script" copy={() => str(props.call.args.code)}>
        <Code>{str(props.call.args.code)}</Code>
      </Section>
      <Show when={calls().length}>
        <Section label={`Calls · ${calls().length}`}>
          <div class="flex flex-col gap-0.5 font-mono text-meta">
            <For each={calls()} keyed={false}>
              {(c) => (
                <div class="flex min-w-0 flex-col">
                  <div class="flex min-w-0 items-baseline gap-2">
                    <span
                      class={{
                        'shimmer text-running': c().status === 'running',
                        'text-danger': c().status === 'error',
                        'text-muted': c().status === 'cancelled',
                      }}
                    >
                      {c().name}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-muted">
                      {c().args}
                    </span>
                    <Show when={(c().durationMs ?? 0) >= 1000}>
                      <span class="shrink-0 text-muted/70 tabular-nums">
                        {formatDuration(c().durationMs!)}
                      </span>
                    </Show>
                  </div>
                  <Show when={c().error}>
                    <span class="truncate text-danger">{c().error}</span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Section>
      </Show>
      <Show when={output()}>
        {(text) => (
          <Section
            label={props.call.status === 'error' ? 'Error' : 'Output'}
            copy={text}
          >
            <Code danger={props.call.status === 'error'} json>
              {text()}
            </Code>
          </Section>
        )}
      </Show>
    </>
  );
}

// Past this, a block folds to a fade and "Show all".
const CAP_PX = 224;

/**
 * Code or output. Long blocks stop at a fade with "Show all", which opens
 * them to full height (affectUI's Tool Call Card); on a phone that beats a
 * scroller inside the page's. `json` highlights it when it parses.
 */
function Code(props: {
  children: JSX.Element;
  danger?: boolean;
  json?: boolean;
}) {
  let pre!: HTMLPreElement;
  const [height, setHeight] = createSignal(0, { name: 'codeHeight' });
  const [full, setFull] = createSignal(false, { name: 'codeFull' });
  onSettled(() => {
    const measure = () => setHeight(pre.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pre.firstElementChild ?? pre);
    return () => ro.disconnect();
  });
  const capped = () => height() > CAP_PX + 48;
  const text = () =>
    typeof props.children === 'string' ? props.children : undefined;
  const pretty = createMemo(() => {
    const t = text();
    return props.json && t ? prettyJson(t) : undefined;
  });
  return (
    <div class="flex flex-col items-start gap-1">
      <pre
        ref={(el) => (pre = el)}
        class={[
          'relative w-full overflow-hidden rounded-md border px-2.5 py-2 font-mono text-code break-words whitespace-pre-wrap motion-safe:transition-[max-height] motion-safe:duration-300 motion-safe:ease-out md:px-3',
          props.danger
            ? 'border-danger/25 bg-danger/5 text-danger'
            : 'border-line bg-bg',
          capped() &&
            !full() &&
            'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-14 after:bg-linear-to-b after:from-transparent after:to-bg',
        ]}
        style={
          capped()
            ? { 'max-height': `${full() ? height() + 2 : CAP_PX}px` }
            : undefined
        }
      >
        <code class="block">
          <Show when={pretty()} fallback={props.children}>
            {(json) => <Json text={json()} />}
          </Show>
        </code>
      </pre>
      <Show when={capped()}>
        <button
          type="button"
          class="-ml-1 rounded-sm px-1 text-meta font-medium text-muted transition-colors hover:text-fg"
          aria-expanded={full() ? 'true' : 'false'}
          onClick={() => setFull(!full())}
        >
          {full() ? 'Show less' : `Show all · ${lines(text())} lines`}
        </button>
      </Show>
    </div>
  );
}

function lines(text?: string) {
  return text ? text.split('\n').length.toLocaleString() : '…';
}

/** Pretty-printed when the text is a JSON object or array, else undefined. */
function prettyJson(text: string) {
  const t = text.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return undefined;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return undefined;
  }
}

// Strings (keys when a colon follows), literals and numbers; the rest is punctuation.
const TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/** JSON with keys, strings, numbers and literals tinted (affectUI's highlighter). */
function Json(props: { text: string }) {
  const parts = createMemo(() => {
    const out: { text: string; kind?: 'key' | 'str' | 'num' | 'lit' }[] = [];
    let last = 0;
    for (const m of props.text.matchAll(TOKEN)) {
      if (m.index > last) out.push({ text: props.text.slice(last, m.index) });
      if (m[1] && m[2]) out.push({ text: m[1], kind: 'key' }, { text: m[2] });
      else
        out.push({
          text: m[0],
          kind: m[1] ? 'str' : /^[tfn]/.test(m[0]) ? 'lit' : 'num',
        });
      last = m.index + m[0].length;
    }
    if (last < props.text.length) out.push({ text: props.text.slice(last) });
    return out;
  });
  return (
    <For each={parts()} keyed={false}>
      {(p) => (
        <Show when={p().kind} fallback={p().text}>
          {(kind) => <span class={JSON_TINT[kind()]}>{p().text}</span>}
        </Show>
      )}
    </For>
  );
}

const JSON_TINT = {
  key: 'text-fg',
  str: 'text-running',
  num: 'text-accent',
  lit: 'text-merged',
};

/** What the call acts on, shown after its name. */
function targetOf(call: ToolCall) {
  const { args } = call;
  if (call.name === 'bash') return str(args.command).split('\n')[0];
  if (typeof args.path === 'string') {
    const offset = typeof args.offset === 'number' ? args.offset : undefined;
    const limit = typeof args.limit === 'number' ? args.limit : undefined;
    if (offset === undefined && limit === undefined) return args.path;
    const from = offset ?? 1;
    return `${args.path}:${from}${limit ? `-${from + limit - 1}` : ''}`;
  }
  return Object.values(args).find((v) => typeof v === 'string') ?? '';
}

function str(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function patchOf(call: ToolCall) {
  const patch = (call.details as { patch?: unknown } | undefined)?.patch;
  return typeof patch === 'string' ? patch : undefined;
}

/** The edit's blocks; they stream in, so any field may still be missing. */
function editsOf(call: ToolCall) {
  return (Array.isArray(call.args.edits) ? call.args.edits : []).map(
    (e: { oldText?: unknown; newText?: unknown }) => ({
      old: str(e?.oldText),
      new: str(e?.newText),
    }),
  );
}

/**
 * What a write or edit changed, as diffs. A finished edit has a real patch
 * with line numbers; until then, each block's old and new text.
 */
function changesOf(call: ToolCall): DiffSource[] | undefined {
  const name = str(call.args.path);
  if (call.name === 'write') {
    const content = str(call.args.content);
    return content ? [{ name, old: '', new: content }] : undefined;
  }
  if (call.name !== 'edit') return;
  const patch = patchOf(call);
  if (patch) return [{ name, patch }];
  const edits = editsOf(call).filter((e) => e.old || e.new);
  return edits.length ? edits.map((e) => ({ name, ...e })) : undefined;
}
