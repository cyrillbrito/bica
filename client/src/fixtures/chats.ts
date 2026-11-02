// The transcripts behind the test sessions: one polished exchange for the
// demo, and every row shape at its worst for `?data=worst`.
import type { Turn } from './conversation';

const MIN = 60_000;

// The file the demo session writes; its diff opens from the side panel too.
export const SHORTCUTS_TS = `// ⌘1–9 open the sidebar's nth session; ⌥↑ and ⌥↓ step through them.
import { useNavigate } from '@solidjs/router';
import { onSettled } from 'solid-js';

import { paths } from '../router';
import { visibleSessions } from './sessions';

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function useSessionShortcuts(current: () => string | undefined) {
  const navigate = useNavigate();
  onSettled(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || typing(e.target)) return;
      const list = visibleSessions();
      const open = (i: number) => {
        const s = list[i];
        if (!s) return;
        e.preventDefault();
        navigate(paths.s(s.id)());
      };
      if (e.metaKey && /^[1-9]$/.test(e.key)) open(Number(e.key) - 1);
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const at = list.findIndex((s) => s.id === current());
        open(at + (e.key === 'ArrowUp' ? -1 : 1));
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
}
`;

function SIDEBAR(row: string, extra = '') {
  return `import { For, Show, createMemo } from 'solid-js';

import { paths } from '../router';
import { useSessions } from '../lib/sessions';
import { relativeTime } from '../lib/time';
import StatusDot from './StatusDot';
${extra}
const ROW =
  'flex h-7 items-center gap-2 rounded-md px-2 text-ui transition-colors hover:bg-hover aria-[current=page]:bg-active';

export function SessionList(props: { projectId: string; current?: string }) {
  const sessions = useSessions();
  const list = createMemo(() =>
    sessions().filter((s) => s.projectId === props.projectId && !s.archivedAt),
  );
  return (
    <ul class="flex flex-col gap-px">
      <For each={list()}>
        {(session, index) => {
          const active = () => session().id === props.current;
          return (
            <li>
${row}            </li>
          );
        }}
      </For>
    </ul>
  );
}
`;
}

const ROW_BEFORE = `              <a
                class={ROW}
                href={paths.s(session().id)}
                aria-current={active() ? 'page' : undefined}
              >
                <StatusDot status={session().status} />
                <span class="min-w-0 flex-1 truncate">{session().title}</span>
                <time class="text-meta text-muted">
                  {relativeTime(session().updatedAt)}
                </time>
              </a>
`;

const ROW_AFTER = `              <a
                class={['group/session', ROW]}
                href={paths.s(session().id)}
                aria-current={active() ? 'page' : undefined}
                title={withShortcut(session().title, index())}
              >
                <StatusDot status={session().status} />
                <span class="min-w-0 flex-1 truncate">{session().title}</span>
                <Show
                  when={shortcut(index())}
                  fallback={
                    <time class="text-meta text-muted">
                      {relativeTime(session().updatedAt)}
                    </time>
                  }
                >
                  {(key) => (
                    <kbd class="text-meta text-muted group-hover/session:inline">
                      {key()}
                    </kbd>
                  )}
                </Show>
              </a>
`;

const HELPERS = `
// The first nine rows get ⌘1–⌘9 (client/src/lib/shortcuts.ts).
const shortcut = (index: number) => (index < 9 ? \`⌘\${index + 1}\` : undefined);
const withShortcut = (title: string, index: number) =>
  shortcut(index) ? \`\${title} (\${shortcut(index)})\` : title;
`;

export const SIDEBAR_BEFORE = SIDEBAR(ROW_BEFORE);
export const SIDEBAR_AFTER = SIDEBAR(ROW_AFTER, HELPERS);

export const demoChat: Turn[] = [
  {
    user: 'Add keyboard shortcuts to jump between sessions: ⌘1–9 opens the nth session in the sidebar, and ⌥↑ / ⌥↓ go to the previous and next one. They must not fire while I type in the composer.',
  },
  {
    agent: [
      {
        think:
          'The sidebar already sorts sessions by project and recency, so the shortcuts should follow exactly what it shows. A single window keydown listener is enough; it has to skip inputs and contenteditable so the composer keeps ⌥↑ for moving the cursor.',
        ms: 4_200,
      },
      {
        tool: 'read',
        args: {
          summary: "Read the sidebar's session list",
          path: 'src/components/Sidebar.tsx',
        },
        output: SIDEBAR_BEFORE,
        ms: 12,
      },
      {
        tool: 'bash',
        args: {
          summary: 'Find existing key handlers',
          command: 'rg -n "addEventListener\\(\'keydown\'" src',
        },
        output:
          "src/routes/s/[id].tsx:412:    addEventListener('keydown', onKey);\nsrc/components/Composer.tsx:188:    addEventListener('keydown', onKey);",
        ms: 180,
      },
      {
        tool: 'read',
        args: { summary: 'Read the sessions doc', path: 'docs/sessions.md' },
        output: '# Sessions\n\nEach session is one conversation with an agent…',
        ms: 9,
      },
    ],
  },
  {
    agent: [
      {
        say: "The sidebar's order is already in `visibleSessions()`, so the shortcuts reuse it. I'll put the handler in its own module and register it once in `App.tsx`.",
      },
      {
        tool: 'write',
        args: {
          summary: 'Add the shortcut handler',
          path: 'client/src/lib/shortcuts.ts',
          content: SHORTCUTS_TS,
        },
        output: 'Wrote client/src/lib/shortcuts.ts',
        ms: 6,
      },
      {
        tool: 'edit',
        args: {
          summary: 'Register the shortcuts in the app shell',
          path: 'src/App.tsx',
          edits: [
            {
              oldText: '  const sessions = useSessions();\n',
              newText:
                '  const sessions = useSessions();\n  useSessionShortcuts(() => currentSession()?.id);\n',
            },
          ],
        },
        output: 'Edited src/App.tsx',
        ms: 8,
      },
      {
        tool: 'edit',
        args: {
          summary: 'Document the new keys',
          path: 'docs/sessions.md',
          edits: [
            {
              oldText: '## Keyboard\n',
              newText:
                '## Keyboard\n\n- ⌘1 to ⌘9 open the sidebar’s first nine sessions.\n- ⌥↑ and ⌥↓ open the previous and next session.\n- Neither fires while you type.\n',
            },
          ],
        },
        output: 'Edited docs/sessions.md',
        ms: 7,
      },
    ],
  },
  {
    agent: [
      {
        tool: 'bash',
        args: {
          summary: 'Type-check and lint',
          command: 'bun run check && bun run lint',
        },
        output: '$ tsc --noEmit\n$ oxlint\nFound 0 warnings and 0 errors.',
        ms: 6_400,
      },
      {
        tool: 'bash',
        args: {
          summary: 'Try ⌘2 and ⌥↓ in the browser',
          command:
            'agent-browser press Meta+2 && agent-browser get url && agent-browser press Alt+ArrowDown && agent-browser get url',
        },
        output:
          'http://localhost:3142/s/fixture-2\nhttp://localhost:3142/s/fixture-3',
        ms: 3_100,
      },
    ],
  },
  {
    agent: [
      {
        say: `⌘1–9 now open the nth session in the sidebar, and ⌥↑ / ⌥↓ step to the previous and next one. Checked in the browser; types and lint pass.

- The keys are ignored while focus is in a text field, so the composer keeps ⌥↑ for moving the cursor.
- The order is what the sidebar shows, so collapsed projects are skipped.
- \`docs/sessions.md\` lists the new keys.`,
      },
    ],
  },
  { user: 'Nice. Can the row show its shortcut on hover, so I learn them?' },
  {
    agent: [
      {
        think: 'A small kbd hint in the row, only for the first nine.',
        ms: 1_800,
      },
      {
        tool: 'edit',
        args: {
          summary: 'Show the shortcut on the first nine rows',
          path: 'src/components/Sidebar.tsx',
          edits: [
            { oldText: ROW_BEFORE, newText: ROW_AFTER },
            {
              oldText: "import StatusDot from './StatusDot';\n",
              newText: `import StatusDot from './StatusDot';\n${HELPERS}`,
            },
          ],
        },
        output: 'Edited src/components/Sidebar.tsx',
        ms: 9,
      },
      {
        tool: 'bash',
        args: {
          summary: 'Screenshot the sidebar on hover',
          command: 'agent-browser hover @e14 && agent-browser screenshot',
        },
        output: 'Screenshot saved to /tmp/agent-browser/shot-1.png',
        ms: 2_300,
      },
    ],
  },
  {
    agent: [
      {
        say: 'Hovering a row now shows its key on the right, like `⌘2`, and the tooltip says it too. Only the first nine rows get one, since ⌘0 is taken by the browser.',
      },
    ],
  },
];

const LONG_URL =
  'https://northwind-industries.atlassian.net/wiki/spaces/ONBOARDING/pages/2147483647/Customer+Onboarding+Platform+%E2%80%94+Session+Export+Specification+v12+(approved)?focusedCommentId=99887766#comment-99887766';

const PASTE = Array.from(
  { length: 40 },
  (_, i) =>
    `    at Object.<anonymous> (/Users/aleksandra/Repos/northwind-industries-customer-onboarding-platform/packages/web/src/features/session-export/__tests__/restore-export-of-archived-sessions.test.ts:${120 + i}:${7 + (i % 30)})`,
).join('\n');

const WIDE_TABLE = `| Session | Branch | Pull request | Status | Owner | Last run |
| --- | --- | --- | --- | --- | --- |
| Benachrichtigungseinstellungenüberarbeitung | aleksandra/NW-69095-restore-export-of-archived-sessions-with-unicode-titles | #128473 | error | Aleksandra Wiśniewska-Kowalczyk | 2026-10-11 09:41:07 |
| J | wip | — | done | Jo | 59 s ago |
| 修复侧边栏在窄屏幕上的溢出问题 | 修复侧边栏溢出 | #100234 | waiting | 王秀英 | 12 min ago |`;

/** Every row shape at its worst, in the order a long session meets them. */
export const worstChat: Turn[] = [
  {
    compacted: `## Goal
Fix the session list overflowing in the left sidebar at 320px.

## Done so far
- Reproduced with the branch \`aleksandra/NW-69095-restore-export-of-archived-sessions-with-unicode-titles\`.
- Ruled out the PR badge; the ticket tag is what wraps.

## Open
- ${LONG_URL}`,
  },
  {
    user: `${LONG_URL}\n\nThe export test fails again on CI, see the trace below. Also: why does the sidebar still overflow with this branch? aleksandra/NW-69095-restore-export-of-archived-sessions-with-unicode-titles\n\n${PASTE}`,
    images: [
      {
        mimeType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
    ],
  },
  {
    agent: [
      {
        think:
          'The trace points at the export test, but the sidebar question is separate. '.repeat(
            30,
          ),
        ms: 94_000,
      },
      ...Array.from({ length: 12 }, (_, i) => ({
        tool: i % 3 ? 'read' : 'bash',
        args:
          i % 3
            ? {
                path: `packages/web/src/features/session-export/components/RestoreExportOfArchivedSessionsWithUnicodeTitlesDialog.${i}.tsx`,
                offset: 1200,
                limit: 400,
              }
            : {
                command: `cd packages/web && NODE_OPTIONS=--max-old-space-size=8192 pnpm vitest run src/features/session-export --reporter=verbose --bail=1 --shard=${i + 1}/12`,
              },
        output: 'ok',
        ms: i === 0 ? 312_000 : 40,
      })),
    ],
  },
  {
    agent: [
      {
        tool: 'bash',
        args: {
          summary:
            'Run the whole export suite against the archived sessions fixture with unicode titles and emoji, then diff the snapshot against the one from main',
          command: 'pnpm test:export',
        },
        output:
          'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  Command failed with exit code 1.',
        error: true,
        ms: 48_000,
      },
      {
        tool: 'edit',
        args: {
          summary: 'Rewrite the export serializer',
          path: 'packages/web/src/features/session-export/serialize.ts',
          edits: [
            {
              oldText: 'old\n'.repeat(977),
              newText: 'new\n'.repeat(1284),
            },
          ],
        },
        output: 'Edited',
        ms: 30,
      },
    ],
  },
  {
    agent: [
      {
        say: `# Why it overflows

The ticket tag \`NW-69095\` sits in a flex row without \`min-width: 0\`, so the branch name pushes it out: ${LONG_URL}

${WIDE_TABLE}

\`\`\`ts
export const restoreExportOfArchivedSessionsWithUnicodeTitles = async (sessions: ReadonlyArray<ArchivedSessionWithUnicodeTitleAndOptionalPullRequestBadge>, options: RestoreExportOptions = { includeArchived: true, normalizeUnicode: 'NFC', preserveEmoji: true }) => {
  return sessions.map((s) => s);
};
\`\`\`

1. نور الهدى: القائمة الجانبية تتجاوز العرض عند 320 بكسل.
2. Đặng Thị Ngọc Hân: kiểm tra lỗi hiển thị tiếng Việt với dấu chồng ở dòng trên cùng.
3. 修复侧边栏在窄屏幕上的溢出问题并检查所有状态。
   - Nested once
     - Nested twice, with **bold**, _italic_, ~~strike~~ and \`code\`.

> A quote that goes on long enough to wrap onto a second and a third line on a phone, because quotes from tickets are never short.`,
      },
    ],
  },
  { cleaned: 48_000 },
  {
    user: '[Note from Bica, not from the user] Context is 92% full. Compact now, or prune old tool output first.\n\nThe last 14 answers rewrote most of their context: the prompt cache keeps expiring.',
  },
  {
    user: '[Message from "Benachrichtigungseinstellungenüberarbeitung: alle Zustände prüfen und Übersetzungen nachziehen" (session 51715), which reads your replies] Done with the German strings. I left `Benachrichtigungseinstellungen` untranslated in two places because the design has no room for it.',
  },
  {
    voice: [
      ['you', 'Okay so what is left on the export, in one sentence?'],
      [
        'voice',
        'The serializer is rewritten and the tests pass, but the snapshot for archived sessions with emoji titles still differs from main, and I have not checked the 320 pixel sidebar yet.',
      ],
      ['you', 'Ok'],
    ],
  },
  {
    agent: [{ say: 'Trying the export again.' }],
    error:
      '529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_011CfvW9TwfMpujAFCdaDzFv0123456789abcdefghijklmnopqrstuvwxyz"}',
  },
  { user: 'J' },
];

/** The running worst-case session's answer, mid-stream. */
export const worstLive = [
  {
    think: 'Checking the narrow layout before I touch the CSS.',
    ms: 2_000,
  },
  {
    tool: 'bash',
    args: {
      summary: 'Screenshot the sidebar at 320px',
      command: 'agent-browser set viewport 320 844 && agent-browser screenshot',
    },
    ms: 7 * MIN,
  },
  {
    tool: 'bash',
    args: { command: 'pnpm --filter web dev --port 3143 --host 0.0.0.0' },
    ms: 2_000,
  },
];

/** Questions the agent waits on: long, many, and multi-select. */
export const worstAsk: Turn[] = [
  { user: '' },
  {
    agent: [
      {
        tool: 'ask',
        args: {
          questions: [
            {
              header: 'Overflow',
              question:
                'The ticket tag, the PR badge and the branch name can’t all fit on one line at 320px. Which should give way first?',
              options: [
                {
                  label: 'Truncate the branch (Recommended)',
                  description:
                    'The tag and badge stay readable; the full branch shows on hover and in the Git tab.',
                },
                {
                  label: 'Wrap onto two lines',
                  description:
                    'Nothing is hidden, but rows get taller and the list jumps when a PR opens.',
                },
                { label: 'Hide the ticket tag' },
                {
                  label:
                    'Benachrichtigungseinstellungen-Überarbeitung-Variante-mit-sehr-langem-Namen',
                },
              ],
            },
            {
              header: 'Translations that need a much longer header',
              question: 'Which languages should I check?',
              multiSelect: true,
              options: [
                { label: 'Deutsch' },
                { label: 'Tiếng Việt' },
                { label: 'العربية' },
                { label: '中文' },
              ],
            },
          ],
        },
        output: 'Waiting for the user.',
      },
    ],
  },
];
