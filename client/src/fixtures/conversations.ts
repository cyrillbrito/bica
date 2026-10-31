// Test transcripts for the session page (`?data=demo`, `?data=worst`): every
// kind of row, and one run that plays out live (thinking, parallel tools,
// streaming text) on a loop. Shaped like the server's conversation view.
import type { ConversationView } from '@earendil-works/pi-durable';
import { createSignal } from 'solid-js';

import type { StepDetail } from '@bica/shared/protocol';
import { PRUNE_ENTRY } from '@bica/shared/prune';
import { fixtureContext } from './usage';

const MIN = 60_000;
const now = Date.now();

type Block =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; durationMs?: number }
  | {
      type: 'toolCall';
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    };

export interface Call {
  name: string;
  args: Record<string, unknown>;
  output?: string;
  error?: boolean;
  details?: Record<string, unknown>;
  ms?: number;
}

/** Builds a view entry by entry, the way Pi Durable stores them. */
class Transcript {
  entries: Record<string, unknown>[] = [];
  details = new Map<string, StepDetail>();
  private id = 0;
  private callId = 0;
  private at = now - 40 * MIN;
  constructor(private session: string) {}

  private push(kind: string, model: unknown[]) {
    this.entries.push({
      id: ++this.id,
      conversationId: this.session,
      kind,
      model,
    });
  }
  write(kind: string, data: unknown) {
    this.entries.push({
      id: ++this.id,
      conversationId: this.session,
      kind,
      data,
    });
    return this;
  }
  compaction(summary: string) {
    this.push('pi.compaction', [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `The conversation so far was summarized:\n<summary>\n${summary}\n</summary>`,
          },
        ],
        timestamp: this.later(MIN),
      },
    ]);
    this.entries.at(-1)!.data = { reason: 'manual' };
    return this;
  }
  private later(ms: number) {
    this.at += ms;
    return this.at;
  }

  user(text: string, at = this.later(MIN)) {
    this.at = at;
    this.push('pi.user', [{ role: 'user', content: text, timestamp: at }]);
    return this;
  }

  /** An answer: blocks in order; `calls` become tool calls with results. */
  answer(
    parts: (string | { think: string; ms: number } | Call | Call[])[],
    extra: { error?: string } = {},
  ) {
    const blocks: Block[] = [];
    const results: unknown[] = [];
    for (const part of parts) {
      if (typeof part === 'string') blocks.push({ type: 'text', text: part });
      else if ('think' in part) {
        const key = `${this.id + 1}:0:${blocks.length}`;
        this.details.set(key, { text: part.think });
        blocks.push({
          type: 'thinking',
          thinking: '',
          durationMs: part.ms,
          folded: true,
        } as Block);
      } else
        for (const call of [part].flat()) {
          const id = `call_${this.session}_${++this.callId}`;
          blocks.push({
            type: 'toolCall',
            id,
            name: call.name,
            arguments: call.args,
          });
          const start = this.later(1500);
          const details = {
            ...call.details,
            startedAt: start,
            durationMs: call.ms ?? 400,
          };
          this.details.set(id, {
            args: call.args,
            output: call.output,
            details,
          });
          results.push({
            role: 'toolResult',
            toolCallId: id,
            toolName: call.name,
            content: [{ type: 'text', text: call.output ?? '' }],
            details,
            isError: !!call.error,
            timestamp: start + (call.ms ?? 400),
          });
        }
    }
    this.push('pi.assistant', [
      {
        role: 'assistant',
        content: blocks,
        api: 'anthropic-messages',
        provider: 'anthropic',
        model: 'claude-opus-4-5',
        usage: USAGE,
        stopReason: extra.error ? 'error' : results.length ? 'toolUse' : 'stop',
        errorMessage: extra.error,
        timestamp: this.later(MIN / 2),
      },
    ]);
    for (const r of results) this.push('pi.toolResult', [r]);
    return this;
  }

  view(docs: Record<string, unknown> = {}): ConversationView {
    return {
      conversation: { id: this.session } as never,
      entries: this.entries as never,
      docs: {
        'pi.agent': {
          model: { provider: 'anthropic', modelId: 'claude-opus-4-5' },
          thinkingLevel: 'medium',
        },
        'bica.context': CONTEXT,
        ...docs,
      } as never,
    };
  }
}

const USAGE = {
  input: 1200,
  output: 800,
  cacheRead: 42_000,
  cacheWrite: 900,
  totalTokens: 44_900,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const CONTEXT = {
  used: 46_000,
  measured: true,
  window: 200_000,
  parts: [],
  biggest: [],
  misses: 0,
  compacting: false,
  running: false,
  prunable: 0,
};

const PATCH = `--- a/src/components/Sidebar.tsx
+++ b/src/components/Sidebar.tsx
@@ -40,4 +40,6 @@ export default function Sidebar() {
   const width = () => layout.sessions;
-  const min = 200;
+  // Below this, titles truncate to a few letters.
+  const min = 220;
+  const max = () => Math.min(480, innerWidth - 400);
   return (
     <aside style={{ width: \`\${width()}px\` }}>
`;

const REPLY = `The sidebar now keeps its width between **220px** and the window minus the chat's 400px, so it can't squeeze the transcript.

- \`src/components/Sidebar.tsx\`: the bounds, read on every drag.
- \`client/src/ui/layout.ts:88\`: the width is clamped again when the window shrinks.

\`\`\`ts
const max = () => Math.min(480, innerWidth - 400);
\`\`\`

| Check | Result |
| --- | --- |
| \`bun run check\` | passes |
| Phone layout | unchanged |`;

function queue(...items: [mode: 'steer' | 'followUp', text: string][]) {
  return {
    'pi.inbox': {
      items: items.map(([mode, content], i) => ({
        id: String(100 + i),
        mode,
        content,
      })),
    },
  };
}

/** A finished session with every kind of row. */
function finished(id: string) {
  const t = new Transcript(id)
    .user('Why does the sidebar collapse to nothing when I drag it?')
    .answer([
      {
        think:
          'The drag handler sets the width straight from the pointer. Nothing clamps it, so a fast drag past the edge sets a negative width. I should read the resizer and the layout state first.',
        ms: 6400,
      },
      'Let me look at how the width is set.',
      [
        {
          name: 'read',
          args: {
            path: 'src/components/Sidebar.tsx',
            summary: 'Read the sidebar',
          },
          output: 'export default function Sidebar() {\n  // …\n}',
          ms: 120,
        },
        {
          name: 'bash',
          args: {
            command: 'rg -n "layout.sessions" src',
            summary: 'Find who sets the width',
          },
          output:
            'client/src/ui/layout.ts:88:  sessions: 280,\nsrc/components/Resizer.tsx:31:    layout.sessions = next;',
          ms: 340,
        },
        {
          name: 'web_search',
          args: { queries: ['CSS anchor positioning resize handle'] },
          output: '5 results',
          ms: 4100,
        },
      ],
    ])
    .answer([
      [
        {
          name: 'edit',
          args: {
            path: 'src/components/Sidebar.tsx',
            summary: 'Clamp the width',
            edits: [
              { oldText: 'const min = 200;', newText: 'const min = 220;' },
            ],
          },
          details: { patch: PATCH, stats: { added: 3, removed: 1 } },
          ms: 90,
        },
        {
          name: 'bash',
          args: { command: 'bun run check', summary: 'Type check' },
          output:
            "client/src/ui/layout.ts(91,7): error TS2322: Type 'string' is not assignable to type 'number'.\nexit code 2",
          error: true,
          ms: 5200,
        },
      ],
    ])
    .answer([
      {
        think: 'One more cast in layout.ts, then check again.',
        ms: 1800,
      },
      [
        {
          name: 'edit',
          args: { path: 'client/src/ui/layout.ts', summary: 'Fix the type' },
          details: { stats: { added: 1, removed: 1 } },
          ms: 70,
        },
        {
          name: 'codemode',
          args: {
            code: 'const r = await tools.bash({ command: "bun run check" });\nreturn r.exit_code;',
            summary: 'Check types and lint together',
          },
          output: 'Script completed\nWall time 3.1 seconds\nOutput:\n0',
          details: {
            calls: [
              {
                name: 'bash',
                args: 'bun run check',
                status: 'ok',
                durationMs: 3100,
              },
            ],
          },
          ms: 3200,
        },
      ],
    ])
    .answer([REPLY])
    .user('Can it remember the width per device?')
    .answer(['Saving it in `localStorage` would make it per device.'], {
      error:
        '429 {"type":"error","error":{"type":"rate_limit_error","message":"This request would exceed your organization\'s rate limit of 80,000 output tokens per minute. Try again later, or see https://docs.anthropic.com/en/api/rate-limits"}}',
    });
  return t;
}

/** Waiting on the `ask` tool: the session stopped on its result. */
function asking(id: string) {
  const t = new Transcript(id).user('Write the post about the new diff view.');
  t.answer([
    { think: 'Two choices the author has to make before I write.', ms: 2100 },
    'Before I start, two quick questions.',
    {
      name: 'ask',
      args: {
        questions: [
          {
            header: 'Tone',
            question: 'How should the post sound?',
            options: [
              {
                label: 'Casual (Recommended)',
                description: 'Like the other posts: short, first person.',
              },
              {
                label: 'Technical',
                description: 'Explain how Pierre renders.',
              },
              { label: 'Release notes', description: 'A list of changes.' },
            ],
          },
          {
            header: 'Media',
            question: 'What should it show?',
            multiSelect: true,
            options: [
              { label: 'Screenshots' },
              { label: 'A short video' },
              { label: 'Code samples' },
            ],
          },
        ],
      },
      output: 'Asked the user; their answer arrives as the next prompt.',
    },
  ]);
  return t;
}

/**
 * A run that plays out on a 30s loop: thinking, a round of parallel tools
 * with a live timer, then the reply streaming in word by word.
 */
function live(id: string, worst: boolean) {
  const base = worst ? worstHistory(id) : finished(id);
  base.user(
    worst
      ? 'Ahora haz que el ancho se guarde por dispositivo, y añade una prueba. 也请检查手机布局。'
      : 'Now make the width stick per device, and add a test.',
  );
  const committed = base.entries.slice();
  const words = (
    worst
      ? `${REPLY}\n\n${'Then the same again, with a much longer paragraph so the streaming text wraps over several lines and keeps going for a while. '.repeat(3)}`
      : `I'll store the width under \`bica.sidebar\` in \`localStorage\` and read it back before the first paint, so there is no jump on load.\n\n${REPLY}`
  ).split(/(?<=\s)/);
  const calls = worst
    ? Array.from({ length: 7 }, (_, i) => ({
        name: ['bash', 'read', 'web_fetch', 'grep_everything_in_the_workspace'][
          i % 4
        ]!,
        args: {
          command: `bun test client/src/lib/layout.test.ts --filter "${'width '.repeat(i + 3)}"`,
          path: `/Users/aleksandra/Repos/northwind-enterprise-platform/packages/${'deeply/'.repeat(4)}file-${i}.ts`,
          urls: [
            'https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage',
          ],
        },
      }))
    : [
        {
          name: 'bash',
          args: {
            command: 'bun test client/src/lib/layout.test.ts',
            summary: 'Run the layout tests',
          },
        },
        {
          name: 'read',
          args: {
            path: 'client/src/ui/layout.ts',
            summary: 'Read the layout state',
          },
        },
      ];
  const LOOP = 30_000;
  const start = Date.now();
  const frame = (): ConversationView => {
    const t = (Date.now() - start) % LOOP;
    const cycle = Math.floor((Date.now() - start) / LOOP);
    const at = start + cycle * LOOP;
    const content: Block[] = [];
    const slots: unknown[] = [];
    const entries = committed.slice();
    if (t < 4000)
      content.push({ type: 'thinking', thinking: '', folded: true } as Block);
    else {
      content.push({
        type: 'thinking',
        thinking: '',
        durationMs: 4000,
        folded: true,
      } as Block);
      const callIds = calls.map((_, i) => `live_${id}_${cycle}_${i}`);
      calls.forEach((c, i) =>
        content.push({
          type: 'toolCall',
          id: callIds[i]!,
          name: c.name,
          arguments: c.args,
        }),
      );
      // The round: each call finishes a little after the one before.
      calls.forEach((c, i) => {
        const startedAt = at + 4000;
        const ends = 4000 + 1500 + i * 900;
        const done = t >= ends && !(worst && i === 2);
        if (done && t >= 4000 + 1500 + calls.length * 900) return;
        slots.push({
          callId: callIds[i],
          name: c.name,
          status: done ? 'done' : 'running',
          output: done ? 'ok' : undefined,
          details: { startedAt, durationMs: done ? ends - 4000 : undefined },
        });
      });
      const settled = 4000 + 1500 + calls.length * 900;
      if (t >= settled) {
        // The round is committed: an entry for the call answer and its results.
        entries.push({
          id: 9000 + cycle * 10,
          conversationId: id,
          kind: 'pi.assistant',
          model: [
            {
              role: 'assistant',
              content: content.slice(),
              usage: USAGE,
              stopReason: 'toolUse',
              timestamp: at + 4000,
            },
          ],
        });
        calls.forEach((c, i) =>
          entries.push({
            id: 9001 + cycle * 10 + i,
            conversationId: id,
            kind: 'pi.toolResult',
            model: [
              {
                role: 'toolResult',
                toolCallId: callIds[i],
                toolName: c.name,
                content: [
                  {
                    type: 'text',
                    text:
                      worst && i === 2
                        ? 'fetch failed: ETIMEDOUT after 30s'
                        : 'ok',
                  },
                ],
                details: { startedAt: at + 4000, durationMs: 1500 + i * 900 },
                isError: worst && i === 2,
                timestamp: at + settled,
              },
            ],
          }),
        );
        content.length = 0;
        const shown = Math.min(words.length, Math.floor((t - settled) / 60));
        if (shown)
          content.push({ type: 'text', text: words.slice(0, shown).join('') });
      }
    }
    const v = base.view();
    return {
      ...v,
      entries: entries as never,
      docs: {
        ...v.docs,
        ...queue(
          [
            'followUp',
            worst
              ? 'And after that, please also double check that the phone layout still works with the keyboard open on iOS Safari and on Android Chrome with a long title'
              : 'Then update the docs',
          ],
          ['steer', 'Use sessionStorage instead'],
        ),
        'pi.live': {
          run: { taskId: 1, inputs: [] },
          generation: content.length
            ? {
                attempt: 1,
                message: {
                  role: 'assistant',
                  content,
                  usage: USAGE,
                  timestamp: at,
                },
              }
            : { attempt: 1 },
          tools: slots.length ? slots : undefined,
        },
      } as never,
    };
  };
  const [view, setView] = createSignal(frame(), { name: 'fixtureLive' });
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    details: base.details,
    get value() {
      if (!timer) timer = setInterval(() => setView(frame()), 60);
      return view();
    },
  };
}

/** Long names, huge output, non-Latin text, many calls. */
function worstHistory(id: string) {
  const huge = Array.from(
    { length: 400 },
    (_, i) => `line ${i + 1}: ${'█'.repeat(i % 60)} ok`,
  ).join('\n');
  return new Transcript(id)
    .user(
      `${'Please '.repeat(30)}fix the sidebar. https://example.com/${'very-long-path/'.repeat(12)}`,
    )
    .answer([
      { think: 'x'.repeat(5000), ms: 184_000 },
      Array.from({ length: 12 }, (_, i) => ({
        name: i % 3 ? 'read' : 'bash',
        args: {
          path: `/Users/aleksandra/Repos/northwind-enterprise-platform/packages/${'nested/'.repeat(6)}component-${i}.tsx`,
          command: `bun x vitest run --reporter=verbose ${'--filter something '.repeat(6)}`,
        },
        output: i === 4 ? huge : 'ok',
        error: i === 7,
        ms: i * 2300,
      })),
    ])
    .answer([
      'نور الهدى: إصلاح القائمة الجانبية. 侧边栏已修复。 Боковая панель исправлена.',
      {
        name: 'mcp__northwind__very_long_tool_name_that_never_ends',
        args: { input: '{"nested":{"deeply":[1,2,3,{"more":true}]}}' },
        output: JSON.stringify({ ok: false, reason: 'n'.repeat(300) }),
        error: true,
        ms: 61_000,
      },
    ])
    .answer([], {
      error:
        '500 {"type":"error","error":{"type":"api_error","message":"Internal server error"},"request_id":"req_011CTqXk3b9mF8vF3sYyKq2P"}',
    });
}

type Talk = {
  readonly value: ConversationView;
  submit?: (text: string) => void;
  compact?: () => Promise<void>;
  prune?: () => Promise<void>;
  write?: (kind: string, data: unknown) => void;
  compacted?: (summary: string) => void;
};

/** The talk with its own context, which compaction and pruning change. */
function withContext(
  talk: Talk,
  shape: 'running' | 'finished' | 'asking',
  worst: boolean,
): Talk {
  const context = fixtureContext(shape, worst);
  return {
    get value() {
      const v = talk.value;
      return {
        ...v,
        docs: {
          ...v.docs,
          'bica.context': context.value() as never,
          ...(context.spend && { 'pi.usage': context.spend }),
        },
      };
    },
    submit: talk.submit,
    compact: async () => {
      await context.compact();
      // The summary lands when the fixture's compaction ends.
      setTimeout(
        () =>
          talk.compacted?.(
            '## Goal\nFix the sidebar overflow.\n\n## Done so far\n- Clamped the width.',
          ),
        3200,
      );
    },
    prune: async () => {
      const freed = context.value().prunable;
      await context.prune();
      talk.write?.(PRUNE_ENTRY, { freed });
    },
  };
}

export interface Conversations {
  views: Map<string, Talk>;
  details: Map<string, StepDetail>;
}

/** A finished transcript that takes a prompt: it lands, and a reply follows. */
function answering(t: Transcript): Talk {
  const [view, setView] = createSignal(t.view(), { name: 'fixtureTalk' });
  return {
    get value() {
      return view();
    },
    write(kind, data) {
      setView(t.write(kind, data).view());
    },
    compacted(summary) {
      setView(t.compaction(summary).view());
    },
    submit(text) {
      // The run starts; nothing streams for a moment, then the reply lands.
      t.user(text, Date.now());
      setView(t.view({ 'pi.live': { run: { taskId: 1, inputs: [] } } }));
      setTimeout(
        () => setView(t.answer(['Got it, writing it now.']).view()),
        2500,
      );
    },
  };
}

/** Transcripts for the given session ids; any can be absent. */
export function conversations(ids: {
  running?: string;
  finished?: string;
  asking?: string;
  worst?: boolean;
}): Conversations {
  const views = new Map<string, Talk>();
  const details = new Map<string, StepDetail>();
  const worst = !!ids.worst;
  const add = (id: string, t: Transcript, shape: 'finished' | 'asking') => {
    views.set(id, withContext(answering(t), shape, worst));
    for (const [k, v] of t.details) details.set(k, v);
  };
  if (ids.finished)
    add(
      ids.finished,
      ids.worst ? worstHistory(ids.finished) : finished(ids.finished),
      'finished',
    );
  if (ids.asking) add(ids.asking, asking(ids.asking), 'asking');
  if (ids.running) {
    const l = live(ids.running, worst);
    views.set(ids.running, withContext(l, 'running', worst));
    for (const [k, v] of l.details) details.set(k, v);
  }
  return { views, details };
}
