// What the browser gets of a conversation: the transcript without what only
// an opened row shows. Tool inputs and outputs, thinking and the system
// prompt stay here, and `stepDetail` sends one when its row opens. Like Pi
// Pocket's projection (https://github.com/TannerMidd/pi-pocket).
import type { Message } from '@earendil-works/pi-ai';
import type {
  AgentState,
  ConversationView,
  EntryRecord,
  InboxState,
  LiveState,
  ToolSlot,
  UsageState,
} from '@earendil-works/pi-durable';

import { contextBreakdown, type ContextBreakdown } from './context-breakdown';
import { contextOf, contextUsage, type ContextUsage } from './context-usage';
import { piDocs } from './pi-types';
import type { ModelCatalog, StepDetail } from './protocol';

type Json = Record<string, unknown>;

/** When a tool started and how long it took: all a running row shows. */
export type ToolTiming = { startedAt?: number; durationMs?: number };

/** `pi.live` without tool output or nested calls; an opened row loads them. */
export type ProjectedLive = Omit<LiveState, 'tools' | 'nestedTools'> & {
  tools?: (Omit<ToolSlot, 'output' | 'details'> & { details: ToolTiming })[];
};

/**
 * What the browser gets of a conversation. Entries keep Pi's types, but tool
 * results, thinking and the system prompt in them are emptied, and tool calls
 * carry `stats` and `streaming`.
 */
export type ProjectedView = Omit<ConversationView, 'docs'> & {
  readonly docs: {
    'pi.live'?: ProjectedLive;
    'pi.agent'?: Omit<AgentState, 'instructions'>;
    'pi.inbox'?: InboxState;
    'pi.usage'?: UsageState;
    'bica.context'?: ContextUsage & ContextBreakdown;
  };
};

// Long enough for a summary, a path or a command's first line.
const ARG_CHARS = 200;
// Shown whole: its questions are the card.
const ASK = 'ask';

/**
 * Projects views one after another; entries never change, so each is
 * projected once. `image` saves a prompt's image and returns its file, which
 * the browser loads over HTTP; without it, images stay inline.
 */
export function projector(
  catalog: () => ModelCatalog | undefined,
  image?: (mimeType: string, data: string) => string,
) {
  const entries = new WeakMap<EntryRecord, EntryRecord>();
  const entry = (e: EntryRecord) => {
    let slim = entries.get(e);
    if (!slim) entries.set(e, (slim = slimEntry(e, image)));
    return slim;
  };
  // Context usage reads everything, so it's worked out here; only when the
  // entries or the run change, not on every streamed word.
  let usageKey: unknown[] = [];
  let usage: (ContextUsage & ContextBreakdown) | undefined;
  return (view: ConversationView): ProjectedView => {
    const docs = piDocs(view);
    const live = docs['pi.live'];
    const key = [
      view.entries,
      docs['pi.agent'],
      live?.run,
      live?.compactions,
      catalog(),
    ];
    if (key.some((k, i) => k !== usageKey[i])) {
      usageKey = key;
      const status = contextUsage(view, catalog());
      const breakdown = contextBreakdown(contextOf(view), status.used);
      // Rounded to what the client's formatTokens shows, so a new answer,
      // which rescales every part, changes fewer of them.
      for (const p of [...breakdown.parts, ...breakdown.biggest])
        p.tokens = shown(p.tokens);
      // Through JSON to drop the fields it leaves undefined.
      usage = JSON.parse(JSON.stringify({ ...status, ...breakdown }));
    }
    const { instructions: _instructions, ...agent } = docs['pi.agent'] ?? {};
    return {
      ...view,
      entries: view.entries.map(entry),
      docs: defined({
        ...docs,
        'pi.agent': agent,
        'pi.live': live && slimLive(live),
        'bica.context': usage,
      }),
    };
  };
}

function slimEntry(
  { edits: _edits, ...e }: EntryRecord,
  image?: (mimeType: string, data: string) => string,
): EntryRecord {
  return e.model
    ? { ...e, model: e.model.map((m) => slimMessage(m, image)) }
    : e;
}

function slimLive(
  // Their arguments can hold whole files; an opened row loads them.
  { nestedTools: _nested, ...live }: LiveState,
): ProjectedLive {
  const message = live.generation?.message as Message | undefined;
  return defined({
    ...live,
    generation:
      live.generation &&
      defined({
        ...live.generation,
        message: message && (slimMessage(message) as never),
      }),
    tools: live.tools?.map(({ output: _output, details, ...slot }) => ({
      ...slot,
      details: timing(details),
    })),
  });
}

function slimMessage(
  m: Message,
  image?: (mimeType: string, data: string) => string,
): Message {
  if (m.role === 'user' && image && typeof m.content !== 'string')
    return {
      ...m,
      content: m.content.map((b) =>
        b.type === 'image'
          ? { ...b, data: '', file: image(b.mimeType, b.data) }
          : b,
      ),
    };
  // Only the context breakdown reads it, and that's worked out here.
  if ((m.role as string) === 'system')
    return { role: 'system', content: '' } as never;
  if (m.role === 'toolResult')
    return {
      ...m,
      content: [],
      details: defined({
        ...timing(m.details),
        stats: statsOf(m.details),
      }) as never,
    };
  if (m.role !== 'assistant') return m;
  return {
    ...m,
    content: m.content.map((b) => {
      if (b.type === 'thinking')
        // Kept so the row shows; its text comes when opened.
        return defined({
          type: 'thinking' as const,
          thinking: '',
          folded: !!b.thinking.trim(),
          durationMs: b.durationMs,
        });
      if (b.type !== 'toolCall') return b;
      const { partialJson, ...call } = b as typeof b & {
        partialJson?: string;
      };
      return call.name === ASK
        ? call
        : defined({
            ...call,
            arguments: slimArgs(call.arguments),
            stats: statsOf(undefined, call),
            // pi-ai drops the buffer once the arguments are complete.
            streaming: partialJson !== undefined || undefined,
          });
    }),
  } as Message;
}

/** Short strings and numbers: what the row shows next to the name. */
function slimArgs(args: Json) {
  const slim: Json = {};
  for (const [k, v] of Object.entries(args ?? {}))
    if (typeof v === 'string')
      slim[k] = v.split('\n', 1)[0]!.slice(0, ARG_CHARS);
    else if (typeof v === 'number' || typeof v === 'boolean') slim[k] = v;
  return slim;
}

function shown(n: number) {
  return n < 1000
    ? Math.round(n)
    : Math.round(n / (n < 10_000 ? 100 : 1000)) * (n < 10_000 ? 100 : 1000);
}

// Stamped by server/src/tools/tool-time.ts.
function timing(details: unknown): ToolTiming {
  const d = (details ?? {}) as ToolTiming;
  return defined({ startedAt: d.startedAt, durationMs: d.durationMs });
}

// JSON has no `undefined`, and the diff of two projections fails on one.
function defined<T extends object>(value: T): T {
  const record = value as Json;
  for (const key of Object.keys(record))
    if (record[key] === undefined) delete record[key];
  return value;
}

function str(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function lines(text: string) {
  return text ? text.replace(/\n$/, '').split('\n') : [];
}

/**
 * Lines added and removed by a write or edit: from the finished edit's
 * patch, or roughly from the call's blocks while it streams.
 */
function statsOf(
  details: unknown,
  call?: { name: string; arguments: Json },
): { added: number; removed: number } | undefined {
  let added = 0;
  let removed = 0;
  const patch = (details as { patch?: unknown } | undefined)?.patch;
  if (typeof patch === 'string') {
    // Skip the `---`/`+++` header: changed lines only follow the first hunk.
    const body = lines(patch);
    const start = body.findIndex((l) => l.startsWith('@@'));
    for (const line of start < 0 ? [] : body.slice(start)) {
      if (line[0] === '+') added++;
      else if (line[0] === '-') removed++;
    }
  } else if (call?.name === 'write')
    added = lines(str(call.arguments.content)).length;
  else if (call?.name === 'edit') {
    const edits = Array.isArray(call.arguments.edits)
      ? call.arguments.edits
      : [];
    // Drop the lines both sides share at the ends, count the rest.
    for (const e of edits as { oldText?: unknown; newText?: unknown }[]) {
      const a = lines(str(e?.oldText));
      const b = lines(str(e?.newText));
      let start = 0;
      while (start < a.length && start < b.length && a[start] === b[start])
        start++;
      let end = 0;
      while (
        end < a.length - start &&
        end < b.length - start &&
        a[a.length - 1 - end] === b[b.length - 1 - end]
      )
        end++;
      removed += a.length - start - end;
      added += b.length - start - end;
    }
  }
  return added || removed ? { added, removed } : undefined;
}

/**
 * What an opened row shows: a tool call by its id, or a thought by its step
 * key (`entry:message:block`, or `live:block` while it streams).
 */
export function stepDetail(
  view: ConversationView,
  key: string,
): StepDetail | null {
  const live = piDocs(view)['pi.live'];
  const partial = live?.generation?.message as Message | undefined;
  const thought = /^(?:(\d+):(\d+)|live):(\d+)$/.exec(key);
  if (thought) {
    const message = thought[1]
      ? view.entries.find((e) => e.id === Number(thought[1]))?.model?.[
          Number(thought[2])
        ]
      : partial;
    const block =
      message?.role === 'assistant'
        ? message.content[Number(thought[3])]
        : undefined;
    return block?.type === 'thinking' ? { text: block.thinking } : null;
  }
  let args: Json | undefined;
  let result: Extract<Message, { role: 'toolResult' }> | undefined;
  for (const m of [
    ...view.entries.flatMap((e) => e.model ?? []),
    ...(partial ? [partial] : []),
  ]) {
    if (m.role === 'assistant')
      for (const b of m.content)
        if (b.type === 'toolCall' && b.id === key) args = b.arguments;
    if (m.role === 'toolResult' && m.toolCallId === key) result = m;
  }
  if (!args) return null;
  const slot = live?.tools?.find((s) => s.callId === key);
  return {
    args,
    output: result
      ? result.content
          .flatMap((b) => (b.type === 'text' && b.text ? [b.text] : []))
          .join('\n')
      : slot?.output,
    details: result?.details ?? withNested(slot?.details, live, key),
  };
}

/**
 * A running codemode call lists its script's calls only in `pi.live`; its
 * result's details list them once it ends, in the same shape.
 */
function withNested(
  details: unknown,
  live: LiveState | undefined,
  key: string,
) {
  const nested = live?.nestedTools?.filter((n) => n.parentCallId === key);
  if (!nested?.length) return details;
  return {
    ...(details as Json),
    calls: nested.map((n) =>
      defined({
        name: n.name,
        args: JSON.stringify(n.arguments).slice(0, ARG_CHARS),
        status: !n.summary ? 'running' : n.summary.isError ? 'error' : 'ok',
        durationMs: n.summary?.durationMs,
        error: n.summary?.error,
      }),
    ),
  };
}
