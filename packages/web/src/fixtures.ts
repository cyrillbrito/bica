// Everything the mock shows. Names, paths, and people are made up.

export type SessionStatus = 'running' | 'waiting' | 'idle' | 'error';

export type Session = {
  id: string;
  title: string;
  status: SessionStatus;
  /** Last activity, as the sidebar shows it. */
  time: string;
  workspace: string;
  unread?: boolean;
  model: string;
};

export type Workspace = {
  id: string;
  project: string;
  /** The main folder has no branch of its own in the sidebar. */
  main: boolean;
  branch: string;
  ticket?: string;
  pr?: { number: number; state: 'open' | 'draft' | 'merged' };
  ahead: number;
  behind: number;
};

export type Project = { id: string; name: string; path: string };

export type Terminal = {
  id: string;
  name: string;
  workspace: string;
  command: string;
  running: boolean;
};

export const PROJECTS: Project[] = [
  { id: 'bica', name: 'bica', path: '~/code/bica' },
  { id: 'shop', name: 'shop', path: '~/code/shop' },
];

export const WORKSPACES: Workspace[] = [
  {
    id: 'bica-main',
    project: 'bica',
    main: true,
    branch: 'main',
    ahead: 0,
    behind: 2,
  },
  {
    id: 'bica-react',
    project: 'bica',
    main: false,
    branch: 'react-mock',
    ahead: 3,
    behind: 0,
  },
  {
    id: 'bica-queue',
    project: 'bica',
    main: false,
    branch: 'queue-glide',
    pr: { number: 142, state: 'open' },
    ahead: 0,
    behind: 0,
  },
  {
    id: 'bica-socket',
    project: 'bica',
    main: false,
    branch: 'socket-retry',
    pr: { number: 139, state: 'draft' },
    ahead: 1,
    behind: 4,
  },
  {
    id: 'shop-main',
    project: 'shop',
    main: true,
    branch: 'main',
    ahead: 0,
    behind: 0,
  },
  {
    id: 'shop-refunds',
    project: 'shop',
    main: false,
    branch: 'refunds',
    ticket: 'PAY-212',
    ahead: 5,
    behind: 1,
  },
  { id: 'chats', project: '', main: true, branch: '', ahead: 0, behind: 0 },
];

export const SESSIONS: Session[] = [
  {
    id: 'hub',
    title: 'Hub',
    status: 'idle',
    time: '8m',
    workspace: 'hub',
    model: 'Sonnet',
  },
  {
    id: 'mock-ui',
    title: 'Mock the whole UI in React',
    status: 'running',
    time: 'now',
    workspace: 'bica-react',
    model: 'Opus',
  },
  {
    id: 'queue-glide',
    title: 'Glide queued prompts into the transcript',
    status: 'waiting',
    time: '4m',
    workspace: 'bica-queue',
    model: 'Opus',
  },
  {
    id: 'socket-retry',
    title: 'Flaky socket reconnect test',
    status: 'error',
    time: '22m',
    workspace: 'bica-socket',
    model: 'GPT-5.5',
  },
  {
    id: 'sidebar-flicker',
    title: 'Sidebar flickers on reload',
    status: 'idle',
    time: '1h',
    workspace: 'bica-main',
    unread: true,
    model: 'Sonnet',
  },
  {
    id: 'release-notes',
    title: 'Draft release notes',
    status: 'idle',
    time: 'Mon',
    workspace: 'bica-main',
    model: 'Sonnet',
  },
  {
    id: 'refunds',
    title: 'Partial refunds for split orders',
    status: 'running',
    time: '1m',
    workspace: 'shop-refunds',
    model: 'GPT-5.5',
  },
  {
    id: 'rounding',
    title: 'Checkout totals round twice',
    status: 'idle',
    time: 'Sun',
    workspace: 'shop-main',
    model: 'Sonnet',
  },
  {
    id: 'grind',
    title: 'Espresso grind sizes',
    status: 'idle',
    time: 'Fri',
    workspace: 'chats',
    model: 'Haiku',
  },
];

export const TERMINALS: Terminal[] = [
  {
    id: 'dev',
    name: 'dev server',
    workspace: 'bica-react',
    command: 'bun run dev',
    running: true,
  },
  {
    id: 'tests',
    name: 'tests',
    workspace: 'shop-refunds',
    command: 'bun test --watch',
    running: false,
  },
];

export function sessionById(id: string) {
  return SESSIONS.find((s) => s.id === id);
}
export function workspaceById(id: string) {
  return WORKSPACES.find((w) => w.id === id);
}
export function projectById(id: string) {
  return PROJECTS.find((p) => p.id === id);
}

/** "bica · react-mock", or just the project on its main folder. */
export function workspaceLabel(w: Workspace) {
  if (!w.project) return 'Chats';
  return w.main ? w.project : `${w.project} · ${w.branch}`;
}

// ---------------------------------------------------------------- transcript

export type Tool = {
  id: string;
  name: 'bash' | 'read' | 'edit' | 'write' | 'grep' | 'web_search';
  /** The arguments in short, shown on the folded row. */
  target: string;
  output: string;
  ms: number;
  /** Lines added and removed, for edits. */
  diff?: [number, number];
  failed?: boolean;
};

export type Ask = {
  question: string;
  options: { label: string; description: string }[];
};

export type Row =
  | { kind: 'prompt'; text: string }
  | { kind: 'reply'; text: string }
  | { kind: 'activity'; seconds: number; thought?: string; tools: Tool[] }
  | { kind: 'ask'; ask: Ask }
  | { kind: 'note'; from: string; text: string }
  | { kind: 'error'; text: string };

const MOCK_UI: Row[] = [
  {
    kind: 'prompt',
    text: 'Start packages/web: a React app that mocks every Bica screen in BoardUI, on fake data. Sidebar, session, files, Git, terminals, settings, and the command palette.',
  },
  {
    kind: 'activity',
    seconds: 18,
    thought:
      'BoardUI ships its components as source, shadcn style. Copying them into the package keeps their tokens and lets the mock change what it needs. The free tier has no command palette, so that one is built on React Aria with their menu surface.',
    tools: [
      {
        id: 't1',
        name: 'bash',
        target:
          'git clone --depth 1 https://github.com/BoardUI/boardui /tmp/boardui',
        output:
          "Cloning into '/tmp/boardui'...\nReceiving objects: 100% (412/412), done.",
        ms: 2140,
      },
      {
        id: 't2',
        name: 'read',
        target: 'styles/theme.css',
        output:
          '@theme {\n  --color-accent-500: var(--color-blue-500);\n  --radius-2lg: 10px;\n  …',
        ms: 12,
      },
      {
        id: 't3',
        name: 'write',
        target: 'packages/web/src/router.tsx',
        output: 'Wrote 64 lines.',
        ms: 8,
        diff: [64, 0],
      },
      {
        id: 't4',
        name: 'bash',
        target: 'bun check',
        output: '✓ No type errors in 74 files',
        ms: 820,
      },
    ],
  },
  {
    kind: 'reply',
    text: [
      'The package runs on port 3145 with every screen on fixture data:',
      '',
      '1. **Sessions** at `/s/$id`, with the transcript, the composer, and the side panel.',
      '2. **Workspaces** at `/p/$id`, with a file or diff full size from Pierre.',
      '3. **Terminals** at `/t/$id`, with static output.',
      '',
      'BoardUI layers its tokens the way Tailwind v4 expects: primitives in `@theme`, semantic tokens on `:root`, and a `.dark` class that flips them.',
      '',
      '```ts',
      "const router = createRouter({ routeTree, defaultPreload: 'intent' });",
      '```',
      '',
      'One thing to watch: BoardUI is less dense than Bica, with 36px rows and 24px corners.',
    ].join('\n'),
  },
];

const QUEUE_GLIDE: Row[] = [
  {
    kind: 'prompt',
    text: 'When the agent takes a queued prompt, glide it from its line in the tray into the transcript.',
  },
  {
    kind: 'activity',
    seconds: 41,
    tools: [
      {
        id: 'q1',
        name: 'grep',
        target: '"QueueTray" packages/client/src',
        output: 'sessions/QueueTray.tsx:12\nsessions/Composer.tsx:88',
        ms: 44,
      },
      {
        id: 'q2',
        name: 'read',
        target: 'packages/client/src/sessions/QueueTray.tsx',
        output: 'export function QueueTray(props: { items: Queued[] }) {\n  …',
        ms: 9,
      },
      {
        id: 'q3',
        name: 'edit',
        target: 'packages/client/src/sessions/queue-glide.ts',
        output:
          '- el.animate(frames, 240);\n+ el.animate(frames, { duration: 320, easing: SPRING });',
        ms: 15,
        diff: [38, 4],
      },
    ],
  },
  {
    kind: 'reply',
    text: 'The glide works on desktop. On the phone the tray sits above the keyboard, so the line has to travel past the fold, and there are two ways to handle it.',
  },
  {
    kind: 'ask',
    ask: {
      question: 'How should a queued prompt move on the phone?',
      options: [
        {
          label: 'Glide like desktop',
          description: 'Same motion, scrolls the transcript first',
        },
        {
          label: 'Fade in place',
          description: 'No travel, the prompt appears at the end',
        },
        {
          label: 'Skip the motion',
          description: 'Instant, as with reduced motion',
        },
      ],
    },
  },
];

const SOCKET_RETRY: Row[] = [
  {
    kind: 'prompt',
    text: 'The reconnect test fails one run in ten. Find out why and fix it.',
  },
  {
    kind: 'activity',
    seconds: 96,
    tools: [
      {
        id: 'r1',
        name: 'bash',
        target: 'bun test socket/reconnect.test.ts --rerun-each 20',
        output:
          '18 pass\n2 fail\n\nerror: expect(received).toBe(expected)\nExpected: "open"\nReceived: "connecting"',
        ms: 14_200,
        failed: true,
      },
      {
        id: 'r2',
        name: 'read',
        target: 'packages/server/src/socket/backoff.ts',
        output: 'export function nextDelay(attempt: number) {\n  …',
        ms: 7,
      },
    ],
  },
  {
    kind: 'note',
    from: 'Hub',
    text: 'The nightly run saw the same failure on main, so it predates this branch.',
  },
  {
    kind: 'error',
    text: 'Provider error: 529 overloaded. The run stopped after 3 retries.',
  },
];

const SIDEBAR_FLICKER: Row[] = [
  { kind: 'prompt', text: 'Why does the sidebar flicker on reload?' },
  {
    kind: 'reply',
    text: 'The sidebar draws from the cached session list, then again once the socket answers, and the second list sorts differently. Sorting both by last activity fixes it, so I changed `sortSessions` to use one key.',
  },
];

const HUB: Row[] = [
  { kind: 'prompt', text: 'What needs me this morning?' },
  {
    kind: 'reply',
    text: [
      'Three sessions want you:',
      '',
      '- **Glide queued prompts** is waiting on a question about the phone.',
      '- **Flaky socket reconnect test** stopped on a provider error.',
      '- **Sidebar flickers on reload** finished, and you have not read it yet.',
      '',
      'The night run finished both of its sessions, and the report is in **Draft release notes**.',
    ].join('\n'),
  },
];

export const TRANSCRIPTS: Record<string, Row[]> = {
  hub: HUB,
  'mock-ui': MOCK_UI,
  'queue-glide': QUEUE_GLIDE,
  'socket-retry': SOCKET_RETRY,
  'sidebar-flicker': SIDEBAR_FLICKER,
};

/** The turn a session plays after each prompt, so the mock feels alive. */
export const SCRIPT = {
  thought:
    'The side panel should follow the BoardUI chat history rail: a card of its own beside the transcript, hidden below xl.',
  tools: [
    {
      id: 'n1',
      name: 'grep',
      target: '"AgentChatHistory" /tmp/boardui/components',
      output: 'application/agent-chat/agent-chat.tsx:513',
      ms: 64,
    },
    {
      id: 'n2',
      name: 'read',
      target: 'packages/web/src/app/SidePanel.tsx',
      output: 'export function SidePanel() {\n  …',
      ms: 9,
    },
    {
      id: 'n3',
      name: 'edit',
      target: 'packages/web/src/app/SidePanel.tsx',
      output:
        '- <aside className="w-72">\n+ <aside className="w-80 rounded-3xl bg-background-secondary-default">',
      ms: 15,
      diff: [6, 2],
    },
  ] satisfies Tool[],
  reply: [
    'Done. The side panel is now a card of its own, like the chat history rail in BoardUI.',
    '',
    '- It sits beside the transcript from `xl` up.',
    '- Below that it slides in from the right, over the page.',
    '- Files and Git are pill tabs at its top.',
    '',
    'Light and dark both read well.',
  ].join('\n'),
};

export const WORKING_PHRASES = [
  'Pulling a shot',
  'Tamping the grounds',
  'Steaming the milk',
  'Warming the cups',
];

// --------------------------------------------------------------------- models

export type Model = {
  id: string;
  name: string;
  short: string;
  provider: string;
  context: string;
  price: string;
  thinking: boolean;
};

export const MODELS: Model[] = [
  {
    id: 'claude-opus',
    name: 'Claude Opus 4.5',
    short: 'Opus',
    provider: 'Anthropic',
    context: '200K',
    price: '$5 / $25',
    thinking: true,
  },
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4.5',
    short: 'Sonnet',
    provider: 'Anthropic',
    context: '1M',
    price: '$3 / $15',
    thinking: true,
  },
  {
    id: 'claude-haiku',
    name: 'Claude Haiku 4.5',
    short: 'Haiku',
    provider: 'Anthropic',
    context: '200K',
    price: '$1 / $5',
    thinking: false,
  },
  {
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    short: 'GPT-5.5',
    provider: 'OpenAI',
    context: '400K',
    price: '$1.25 / $10',
    thinking: true,
  },
  {
    id: 'gemini-pro',
    name: 'Gemini 3 Pro',
    short: 'Gemini Pro',
    provider: 'Google',
    context: '1M',
    price: '$2 / $12',
    thinking: true,
  },
];

export type Provider = {
  id: string;
  name: string;
  kind: 'plan' | 'key';
  account?: string;
  state: 'connected' | 'expired' | 'off';
  usage?: number;
};

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'plan',
    account: 'Claude Max · dev@example.com',
    state: 'connected',
    usage: 42,
  },
  {
    id: 'anthropic-2',
    name: 'Anthropic',
    kind: 'plan',
    account: 'Claude Max · second account',
    state: 'expired',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'plan',
    account: 'ChatGPT Plus',
    state: 'connected',
    usage: 12,
  },
  { id: 'google', name: 'Google', kind: 'key', state: 'off' },
  {
    id: 'exa',
    name: 'Exa',
    kind: 'key',
    account: 'Web search and fetch',
    state: 'connected',
  },
];

// ---------------------------------------------------------------- files, git

export type Change = {
  path: string;
  added: number;
  removed: number;
  status: 'modified' | 'added' | 'deleted';
  staged: boolean;
};

export const CHANGES: Change[] = [
  {
    path: 'packages/web/src/app/Sidebar.tsx',
    added: 214,
    removed: 0,
    status: 'added',
    staged: true,
  },
  {
    path: 'packages/web/src/app/SidePanel.tsx',
    added: 96,
    removed: 12,
    status: 'modified',
    staged: true,
  },
  {
    path: 'packages/web/src/sessions/Composer.tsx',
    added: 48,
    removed: 9,
    status: 'modified',
    staged: false,
  },
  {
    path: 'oxlint.config.ts',
    added: 18,
    removed: 6,
    status: 'modified',
    staged: false,
  },
  {
    path: 'docs/old-notes.md',
    added: 0,
    removed: 31,
    status: 'deleted',
    staged: false,
  },
];

export const COMMITS = [
  {
    hash: 'a41c9e2',
    subject: 'feat: mock the session screen in BoardUI',
    author: 'Ana Ribeiro',
    when: '12 min ago',
    pushed: false,
  },
  {
    hash: '7d03b18',
    subject: 'chore: add a React package next to the Solid client',
    author: 'Ana Ribeiro',
    when: '40 min ago',
    pushed: false,
  },
  {
    hash: 'e90f4aa',
    subject: 'docs: record the move to React',
    author: 'Ana Ribeiro',
    when: '1 hour ago',
    pushed: false,
  },
  {
    hash: '3b7e5c1',
    subject: 'fix: handle expired provider sign-ins gracefully',
    author: 'Ana Ribeiro',
    when: 'yesterday',
    pushed: true,
  },
  {
    hash: '1f2ad70',
    subject: 'refactor: move client, server, and shared into packages/',
    author: 'Ana Ribeiro',
    when: '2 days ago',
    pushed: true,
  },
];

export const FILE_PATHS = [
  'AGENTS.md',
  'README.md',
  'package.json',
  'oxlint.config.ts',
  'docs/architecture.md',
  'docs/records/react.md',
  'packages/web/index.html',
  'packages/web/package.json',
  'packages/web/vite.config.ts',
  'packages/web/src/main.tsx',
  'packages/web/src/router.tsx',
  'packages/web/src/fixtures.ts',
  'packages/web/src/app/Shell.tsx',
  'packages/web/src/app/Sidebar.tsx',
  'packages/web/src/app/SidePanel.tsx',
  'packages/web/src/app/CommandPalette.tsx',
  'packages/web/src/sessions/Composer.tsx',
  'packages/web/src/sessions/Transcript.tsx',
  'packages/web/src/styles/theme.css',
  'packages/server/src/main.ts',
  'packages/shared/status.ts',
];

const SIDE_PANEL_OLD = `import { useState } from 'react';

export function SidePanel() {
  const [tab, setTab] = useState('files');
  return (
    <aside className="w-72 border-l">
      <Tabs value={tab} onChange={setTab} />
      {tab === 'files' ? <FilesTab /> : <GitTab />}
    </aside>
  );
}
`;

const SIDE_PANEL_NEW = `import { useState } from 'react';
import { PillTab, PillTabList } from '@/components/base/tabs/pill-tab';

/** Files and Git for the open workspace, as a card beside the centre. */
export function SidePanel({ workspace }: { workspace: string }) {
  const [tab, setTab] = useState<'files' | 'git'>('files');
  return (
    <aside className="flex w-80 flex-col rounded-3xl bg-background-secondary-default">
      <PillTabList>
        <PillTab isSelected={tab === 'files'} onSelect={() => setTab('files')}>
          Files
        </PillTab>
        <PillTab isSelected={tab === 'git'} onSelect={() => setTab('git')}>
          Git
        </PillTab>
      </PillTabList>
      {tab === 'files' ? (
        <FilesTab workspace={workspace} />
      ) : (
        <GitTab workspace={workspace} />
      )}
    </aside>
  );
}
`;

/** Old and new contents for the diffs; any other path gets a placeholder. */
export const FILE_CONTENTS: Record<string, { old: string; new: string }> = {
  'packages/web/src/app/SidePanel.tsx': {
    old: SIDE_PANEL_OLD,
    new: SIDE_PANEL_NEW,
  },
  'oxlint.config.ts': {
    old: `export default defineConfig({
  plugins: ['unicorn', 'typescript', 'oxc', 'import'],
  rules: {
    ...solidV2.rules,
    'bica/type-tokens': 'error',
  },
});
`,
    new: `export default defineConfig({
  plugins: ['unicorn', 'typescript', 'oxc', 'import'],
  overrides: [
    {
      files: ['packages/client/**'],
      rules: { ...solidV2.rules, 'bica/type-tokens': 'error' },
    },
    {
      files: ['packages/web/**'],
      plugins: ['react'],
      rules: { 'react/rules-of-hooks': 'error' },
    },
  ],
});
`,
  },
};

export function fileContents(path: string) {
  const known = FILE_CONTENTS[path];
  if (known) return known;
  const body = `// ${path}\n// A made-up file for the mock.\n\nexport function example() {\n  return 'Bica';\n}\n`;
  return { old: body, new: body.replace("'Bica'", "'Bica, in React'") };
}

export const TERMINAL_OUTPUT = `$ bun run dev
$ vite --port 3145

  VITE v8.3.5  ready in 412 ms

  ➜  Local:   http://localhost:3145/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help

10:42:07 [vite] page reload src/app/Sidebar.tsx
10:42:31 [vite] hmr update /src/sessions/Composer.tsx
10:43:02 [vite] hmr update /src/app/SidePanel.tsx, /src/app.css
`;
