// Test transcripts for the session page (`?data=demo`, `?data=worst`): every
// kind of row, and one run that plays out live (thinking, parallel tools,
// streaming text) on a loop. Built with chat(), so they go through the same
// projection as live data.
import { createSignal } from 'solid-js';

import type { ProjectedView } from '@bica/shared/projection';
import type { StepDetail } from '@bica/shared/protocol';
import { chat, type Block, type ChatOptions, type Turn } from './conversation';
import { fixtureContext } from './usage';

const MIN = 60_000;
const START = Date.now() - 40 * MIN;

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

/** A finished session with every kind of row. */
function finished(): Turn[] {
  return [
    { user: 'Why does the sidebar collapse to nothing when I drag it?' },
    {
      agent: [
        {
          think:
            'The drag handler sets the width straight from the pointer. Nothing clamps it, so a fast drag past the edge sets a negative width. I should read the resizer and the layout state first.',
          ms: 6400,
        },
        { say: 'Let me look at how the width is set.' },
        {
          tool: 'read',
          args: {
            path: 'src/components/Sidebar.tsx',
            summary: 'Read the sidebar',
          },
          output: 'export default function Sidebar() {\n  // …\n}',
          ms: 120,
        },
        {
          tool: 'bash',
          args: {
            command: 'rg -n "layout.sessions" src',
            summary: 'Find who sets the width',
          },
          output:
            'client/src/ui/layout.ts:88:  sessions: 280,\nsrc/components/Resizer.tsx:31:    layout.sessions = next;',
          ms: 340,
        },
        {
          tool: 'web_search',
          args: { queries: ['CSS anchor positioning resize handle'] },
          output: '5 results',
          ms: 4100,
        },
      ],
    },
    {
      agent: [
        {
          tool: 'edit',
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
          tool: 'bash',
          args: { command: 'bun run check', summary: 'Type check' },
          output:
            "client/src/ui/layout.ts(91,7): error TS2322: Type 'string' is not assignable to type 'number'.\nexit code 2",
          error: true,
          ms: 5200,
        },
      ],
    },
    {
      agent: [
        { think: 'One more cast in layout.ts, then check again.', ms: 1800 },
        {
          tool: 'edit',
          args: { path: 'client/src/ui/layout.ts', summary: 'Fix the type' },
          details: { stats: { added: 1, removed: 1 } },
          ms: 70,
        },
        {
          tool: 'codemode',
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
    },
    { agent: [{ say: REPLY }] },
    { user: 'Can it remember the width per device?' },
    {
      agent: [{ say: 'Saving it in `localStorage` would make it per device.' }],
      error:
        '429 {"type":"error","error":{"type":"rate_limit_error","message":"This request would exceed your organization\'s rate limit of 80,000 output tokens per minute. Try again later, or see https://docs.anthropic.com/en/api/rate-limits"}}',
    },
  ];
}

/** Waiting on the `ask` tool: the session stopped on its result. */
function asking(): Turn[] {
  return [
    { user: 'Write the post about the new diff view.' },
    {
      agent: [
        {
          think: 'Two choices the author has to make before I write.',
          ms: 2100,
        },
        { say: 'Before I start, two quick questions.' },
        {
          tool: 'ask',
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
      ],
    },
  ];
}

/** Long names, huge output, non-Latin text, many calls. */
function worstHistory(): Turn[] {
  const huge = Array.from(
    { length: 400 },
    (_, i) => `line ${i + 1}: ${'█'.repeat(i % 60)} ok`,
  ).join('\n');
  return [
    {
      user: `${'Please '.repeat(30)}fix the sidebar. https://example.com/${'very-long-path/'.repeat(12)}`,
    },
    {
      agent: [
        { think: 'x'.repeat(5000), ms: 184_000 },
        ...Array.from({ length: 12 }, (_, i): Block => ({
          tool: i % 3 ? 'read' : 'bash',
          args: {
            path: `/Users/aleksandra/Repos/northwind-enterprise-platform/packages/${'nested/'.repeat(6)}component-${i}.tsx`,
            command: `bun x vitest run --reporter=verbose ${'--filter something '.repeat(6)}`,
          },
          output: i === 4 ? huge : 'ok',
          error: i === 7,
          ms: i * 2300,
        })),
      ],
    },
    {
      agent: [
        {
          say: 'نور الهدى: إصلاح القائمة الجانبية. 侧边栏已修复。 Боковая панель исправлена.',
        },
        {
          tool: 'mcp__northwind__very_long_tool_name_that_never_ends',
          args: { input: '{"nested":{"deeply":[1,2,3,{"more":true}]}}' },
          output: JSON.stringify({ ok: false, reason: 'n'.repeat(300) }),
          error: true,
          ms: 61_000,
        },
      ],
    },
    {
      agent: [],
      error:
        '500 {"type":"error","error":{"type":"api_error","message":"Internal server error"},"request_id":"req_011CTqXk3b9mF8vF3sYyKq2P"}',
    },
  ];
}

/** A transcript a page can open, ask for step details, and play actions on. */
interface Talk {
  readonly value: ProjectedView;
  detail: (key: string) => StepDetail | null;
  submit?: (text: string) => void;
  compact?: () => Promise<void>;
  prune?: () => Promise<void>;
}

/**
 * A run that plays out on a 30s loop: thinking, a round of parallel tools
 * with a live timer, then the reply streaming in word by word.
 */
function live(id: string, worst: boolean) {
  const base: Turn[] = [
    ...(worst ? worstHistory() : finished()),
    {
      user: worst
        ? 'Ahora haz que el ancho se guarde por dispositivo, y añade una prueba. 也请检查手机布局。'
        : 'Now make the width stick per device, and add a test.',
    },
  ];
  const words = (
    worst
      ? `${REPLY}\n\n${'Then the same again, with a much longer paragraph so the streaming text wraps over several lines and keeps going for a while. '.repeat(3)}`
      : `I'll store the width under \`bica.sidebar\` in \`localStorage\` and read it back before the first paint, so there is no jump on load.\n\n${REPLY}`
  ).split(/(?<=\s)/);
  const calls: { tool: string; args: Record<string, unknown> }[] = worst
    ? Array.from({ length: 7 }, (_, i) => ({
        tool: ['bash', 'read', 'web_fetch', 'grep_everything_in_the_workspace'][
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
          tool: 'bash',
          args: {
            command: 'bun test client/src/lib/layout.test.ts',
            summary: 'Run the layout tests',
          },
        },
        {
          tool: 'read',
          args: {
            path: 'client/src/ui/layout.ts',
            summary: 'Read the layout state',
          },
        },
      ];
  // In the worst case one call hangs and fails.
  const failing = (i: number) => worst && i === 2;
  const THINK = 4000;
  const ends = (i: number) => 1500 + i * 900;
  const settled = THINK + ends(calls.length);
  const queue: ChatOptions['queue'] = [
    [
      'followUp',
      worst
        ? 'And after that, please also double check that the phone layout still works with the keyboard open on iOS Safari and on Android Chrome with a long title'
        : 'Then update the docs',
    ],
    ['steer', 'Use sessionStorage instead'],
  ];

  const LOOP = 30_000;
  const start = Date.now();
  const frame = () => {
    const t = (Date.now() - start) % LOOP;
    const thought: Block = { think: '', ms: THINK };
    if (t < THINK)
      return chat(id, base, { start: START, live: [{ think: '' }], queue });
    if (t < settled)
      return chat(id, base, {
        start: START,
        queue,
        live: [
          thought,
          ...calls.map((c, i): Block => {
            const done = t - THINK >= ends(i) && !failing(i);
            return {
              ...c,
              done,
              output: done ? 'ok' : undefined,
              ms: done ? ends(i) : t - THINK,
            };
          }),
        ],
      });
    // The round is in: its answer and results, then the reply streams.
    const round: Turn = {
      agent: [
        thought,
        ...calls.map((c, i): Block => ({
          ...c,
          output: failing(i) ? 'fetch failed: ETIMEDOUT after 30s' : 'ok',
          error: failing(i),
          ms: ends(i),
        })),
      ],
    };
    const shown = Math.min(words.length, Math.floor((t - settled) / 60));
    return chat(id, [...base, round], {
      start: START,
      queue,
      live: shown ? [{ say: words.slice(0, shown).join('') }] : [],
    });
  };
  const [view, setView] = createSignal(frame(), { name: 'fixtureLive' });
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    get value() {
      if (!timer) timer = setInterval(() => setView(frame()), 60);
      return view().view;
    },
    detail: (key: string) => view().detail(key),
  } satisfies Talk;
}

/**
 * A finished transcript that takes a prompt: it lands, and a reply follows.
 * A compaction or a prune adds its row.
 */
function answering(id: string, start: Turn[]) {
  const turns = [...start];
  let running = false;
  const build = () =>
    chat(id, turns, { start: START, ...(running && { live: [] }) });
  const [built, setBuilt] = createSignal(build(), { name: 'fixtureTalk' });
  const add = (turn: Turn) => {
    turns.push(turn);
    setBuilt(build());
  };
  return {
    get value() {
      return built().view;
    },
    detail: (key: string) => built().detail(key),
    submit(text: string) {
      // The run starts; nothing streams for a moment, then the reply lands.
      running = true;
      add({ user: text });
      setTimeout(() => {
        running = false;
        add({ agent: [{ say: 'Got it, writing it now.' }] });
      }, 2500);
    },
    compacted: (summary: string) => add({ compacted: summary, auto: false }),
    pruned: (freed: number) => add({ cleaned: freed }),
  };
}

type Shape = 'running' | 'finished' | 'asking';

/** The talk with its own context, which compaction and pruning change. */
function withContext(
  talk: Talk & {
    compacted?: (summary: string) => void;
    pruned?: (freed: number) => void;
  },
  shape: Shape,
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
          'bica.context': context.value(),
          ...(context.spend && { 'pi.usage': context.spend }),
        },
      };
    },
    detail: talk.detail,
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
      talk.pruned?.(freed);
    },
  };
}

export interface Conversations {
  views: Map<string, Talk>;
}

/** Transcripts for the given session ids; any can be absent. */
export function conversations(ids: {
  running?: string;
  finished?: string;
  asking?: string;
  worst?: boolean;
}): Conversations {
  const views = new Map<string, Talk>();
  const worst = !!ids.worst;
  if (ids.finished)
    views.set(
      ids.finished,
      withContext(
        answering(ids.finished, worst ? worstHistory() : finished()),
        'finished',
        worst,
      ),
    );
  if (ids.asking)
    views.set(
      ids.asking,
      withContext(answering(ids.asking, asking()), 'asking', worst),
    );
  if (ids.running)
    views.set(
      ids.running,
      withContext(live(ids.running, worst), 'running', worst),
    );
  return { views };
}
