// Test data for the whole app in development (`?data=worst`): realistic
// worst cases next to the kind demo data. See ./index.ts.
import type {
  GitChange,
  GitCommit,
  GitStatus,
  Project,
  PullRequest,
  SessionStatus,
  SessionSummary,
  TerminalInfo,
  Workspace,
} from '@bica/shared/protocol';
import type { Kept } from '../files/files';
import {
  SHORTCUTS_TS,
  SIDEBAR_AFTER,
  SIDEBAR_BEFORE,
  demoChat,
  worstAsk,
  worstChat,
  worstLive,
} from './chats';
import type { ChatOptions, Turn } from './conversation';
import {
  blogDraft,
  calmerVoice,
  reconnectQueue,
  releaseNotes,
  sourdough,
  streamTerminals,
  voiceHandoff,
} from './demo-chats';
import { conversations, type Conversations } from './conversations';

export interface Dataset {
  projects: Project[];
  sessions: SessionSummary[];
  terminals: TerminalInfo[];
  kept: Kept[];
  // Transcripts by session id; sessions without one get a short exchange
  // from their title and status.
  chats?: Record<string, { turns: Turn[] } & Partial<ChatOptions>>;
  // Live transcripts that play out on a timer, by session id. They stand in
  // for `chats` where both have one.
  conversations?: Conversations;
  // The side panel, by workspace path. Absent: not a git repository / no files.
  git?: Record<string, GitStatus>;
  files?: Record<string, string[]>;
  // Folders without git: what each session changed, by session id.
  // File contents by absolute path, for opened files and diffs: `old` is
  // the committed side, absent for a new file.
  texts?: Record<string, { old?: string; new: string }>;
}

export const MODES = ['demo', 'worst', 'empty', 'one', 'huge'] as const;
export type Mode = (typeof MODES)[number];

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.now();
const HOME = '/Users/aleksandra';

function pr(
  number: number,
  state: PullRequest['state'],
  title = 'Pull request',
): PullRequest {
  return {
    number,
    state,
    title,
    url: `https://example.com/pulls/${number}`,
    head: 'abc123',
  };
}

function ws(
  path: string,
  branch: string | null,
  main = false,
  p: PullRequest | null = null,
): Workspace {
  return { path, branch, main, pr: p };
}

function project(
  id: string,
  name: string,
  workspaces: Workspace[],
  extra: Partial<Project> = {},
): Project {
  return {
    id,
    name,
    path: workspaces[0]!.path,
    git: true,
    workspaces,
    ...extra,
  };
}

let n = 0;
function session(
  projectId: string | null,
  cwd: string | null,
  title: string,
  status: SessionStatus,
  age: number,
  extra: Partial<SessionSummary> = {},
): SessionSummary {
  return {
    id: `fixture-${++n}`,
    title,
    status,
    createdAt: now - age - HOUR,
    updatedAt: now - age,
    runningSince: status === 'running' ? now - age : null,
    projectId,
    cwd,
    archivedAt: null,
    forkedFrom: null,
    forkedAt: null,
    startedBy: null,
    parent: null,
    handoffs: [],
    watchedBy: [],
    cleanedUp: null,
    agent: 'coding',
    voice: null,
    tonight: null,
    stuck: false,
    // Varied, so branch totals on the hub board differ.
    cost: ((n * 37) % 290) / 100,
    ...extra,
  };
}

function terminal(
  projectId: string,
  cwd: string,
  title: string,
  exitCode: number | null,
  command: string | null = title,
  parent: string | null = null,
): TerminalInfo {
  return {
    id: `fixture-t-${++n}`,
    projectId,
    cwd,
    title,
    command,
    status: exitCode === null ? 'running' : 'exited',
    exitCode,
    busy: exitCode === null ? false : null,
    lastExit: null,
    startedBy: parent,
    parent,
    createdAt: now - HOUR,
  };
}

function chats(workspaces: Workspace[] = []): Project {
  return {
    id: 'chats',
    name: 'Chats',
    path: `${HOME}/.bica/chats`,
    git: false,
    workspaces: [ws(`${HOME}/.bica/chats`, null, true), ...workspaces],
  };
}

function change(
  path: string,
  status: GitChange['status'],
  added?: number,
  removed?: number,
  extra: Partial<GitChange> = {},
): GitChange {
  return {
    path,
    status,
    version: `${path}@1`,
    added,
    removed,
    ...extra,
  };
}

function commits(subjects: string[]): GitCommit[] {
  return subjects.map((subject, i) => ({
    hash: (0x9f3c2a1 + i * 0x1d4b7).toString(16).padStart(7, '0'),
    subject,
    time: now - (i + 1) * 3 * HOUR,
  }));
}

function status(s: Partial<GitStatus>): GitStatus {
  return {
    branch: 'main',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    recent: [],
    submodules: [],
    ...s,
  };
}

// This repo's own layout, so the file tree looks like a real project.
const BICA_FILES =
  `AGENTS.md README.md package.json bun.lock vite.config.ts tsconfig.json
docs/UI.md docs/architecture.md docs/context-usage.md docs/deploy.md docs/files.md docs/git.md
docs/projects.md docs/models.md docs/sessions.md docs/terminals.md docs/tools.md docs/voice.md
public/favicon.svg public/apple-touch-icon.png src/App.css src/App.tsx src/Document.tsx src/router.ts
src/components/Activity.tsx src/components/AskCard.tsx src/components/ChangeList.tsx
src/components/CodeView.tsx src/components/CommitBox.tsx src/components/Composer.tsx
src/components/ContextChip.tsx src/components/DiffBlock.tsx src/components/FileTree.tsx
src/components/GitPanel.tsx src/components/SidePanel.tsx src/components/Markdown.tsx
src/components/ModelPicker.tsx src/components/Sidebar.tsx src/components/StatusDot.tsx
src/components/TerminalView.tsx src/components/ToolCalls.tsx src/components/TopBar.tsx
src/components/ui/Button.tsx src/components/ui/Empty.tsx src/components/ui/Select.tsx
src/components/ui/Toast.tsx src/components/ui/icons.tsx shared/src/context-usage.ts client/src/ui/layout.ts
client/src/models/models.ts client/src/projects/projects.ts shared/src/protocol.ts client/src/sessions/sessions.ts client/src/lib/shortcuts.ts
client/src/socket/socket.ts client/src/terminals/terminals.ts shared/src/transcript.ts client/src/voice/voice.ts client/src/files/workspace.ts
src/routes/index.tsx src/routes/settings.tsx src/routes/p/[id].tsx src/routes/s/[id].tsx
server/src/agent.ts server/src/git.ts server/src/projection.ts server/src/sessions.ts
server/src/socket.ts server/src/terminals.ts server/src/voice/voice.ts`.split(
    /\s+/,
  );

const APP_BEFORE = `export default function App() {
  const sessions = useSessions();
  const projects = useProjects();
`;
const DOC_BEFORE = `# Sessions

Each session is one conversation with an agent, in one folder.

## Keyboard

- Enter sends, Shift+Enter adds a line.
`;

// What the design was drawn against: short names, a few rows, all filled in.
// Also the screenshot data: one session tells the whole story.
function demo(): Dataset {
  const bica = `${HOME}/Repos/bica`;
  const keys = `${bica}-shortcuts`;
  const voice = `${bica}-voice`;
  const blog = `${HOME}/Repos/blog`;
  return {
    projects: [
      project('bica', 'bica', [
        ws(bica, 'main', true),
        ws(
          keys,
          'session-shortcuts',
          false,
          pr(57, 'open', 'Keyboard shortcuts for sessions'),
        ),
        ws(voice, 'voice-handoff', false, pr(54, 'draft')),
        ws(`${bica}-diffs`, 'diff-view', false, pr(49, 'merged')),
      ]),
      project('blog', 'blog', [ws(blog, 'main', true)]),
      chats([ws(`${HOME}/.bica/chats/2026-10-10-sourdough`, null)]),
    ],
    sessions: [
      session(null, `${HOME}/Vault/Hub`, 'Hub', 'idle', 2 * MIN, {
        id: 'demo-hub',
        agent: 'hub',
      }),
      session('bica', keys, 'Keyboard shortcuts for sessions', 'idle', MIN, {
        id: 'demo-shortcuts',
        watchedBy: ['demo-hub'],
      }),
      session('bica', bica, 'Stream tool output in terminals', 'running', 0, {
        id: 'demo-terminals',
        startedBy: 'demo-hub',
        parent: 'demo-hub',
      }),
      session(
        'bica',
        bica,
        'Why does reconnect drop the queue?',
        'waiting',
        4 * MIN,
        {
          id: 'demo-reconnect',
          startedBy: 'demo-hub',
          parent: 'demo-hub',
        },
      ),
      session('bica', bica, 'Research offline drafts', 'idle', 30 * MIN, {
        id: 'demo-tonight',
        agent: 'night',
        tonight:
          'Research how other apps keep drafts offline on the phone and sync them later. Write a report to docs/explorations/offline-drafts.md with options, trade-offs, and sources.',
      }),
      session('bica', bica, 'Release notes for 0.9', 'idle', 2 * HOUR, {
        id: 'demo-release',
        startedBy: 'demo-shortcuts',
        parent: 'demo-shortcuts',
      }),
      session(
        'bica',
        voice,
        'Hand off a voice call to a new session',
        'running',
        0,
        {
          id: 'demo-handoff',
          startedBy: 'demo-hub',
          parent: 'demo-hub',
        },
      ),
      session('bica', voice, 'Pick a calmer voice', 'done', 25 * MIN, {
        id: 'demo-voice',
        startedBy: 'demo-shortcuts',
        // You detached it before your follow-up, the fourth turn (20s apart).
        parent: null,
        handoffs: [{ at: now - 26 * MIN + 70_000, to: 'you' }],
      }),
      session(
        'blog',
        blog,
        'Draft: building Bica with Bica',
        'done',
        10 * MIN,
        {
          id: 'demo-blog',
          startedBy: 'demo-hub',
        },
      ),
      session('bica', bica, 'Fix the flaky reconnect test', 'error', 40 * MIN, {
        id: 'demo-flaky',
        startedBy: 'demo-hub',
        parent: 'demo-hub',
      }),
      session(
        'bica',
        bica,
        'Bisect the reconnect test across 40 commits',
        'done',
        45 * MIN,
        {
          id: 'demo-bisect',
          startedBy: 'demo-flaky',
          parent: 'demo-flaky',
        },
      ),
      session(
        'chats',
        `${HOME}/.bica/chats/2026-10-10-sourdough`,
        'Sourdough starter schedule',
        'idle',
        DAY,
        { id: 'demo-sourdough' },
      ),
      session('bica', bica, 'Old idea', 'idle', 2 * DAY, {
        archivedAt: now - DAY,
      }),
    ],
    terminals: [
      terminal('bica', bica, 'bun run dev', null),
      terminal('bica', keys, 'bun run check', 0),
    ],
    kept: [],
    chats: {
      'demo-shortcuts': { turns: demoChat, start: now - 14 * MIN },
      'demo-terminals': { ...streamTerminals, start: now - 4 * MIN },
      'demo-reconnect': { turns: reconnectQueue, start: now - 6 * MIN },
      'demo-release': { turns: releaseNotes, start: now - 2 * HOUR - MIN },
      'demo-handoff': { ...voiceHandoff, start: now - 3 * MIN },
      'demo-voice': { turns: calmerVoice, start: now - 26 * MIN },
      'demo-blog': { turns: blogDraft, start: now - 11 * MIN },
      'demo-sourdough': { turns: sourdough, start: now - DAY - 3 * MIN },
    },
    git: {
      [bica]: status({
        unstaged: [
          change('server/src/terminal-tools.ts', 'M', 3, 1),
          change('server/src/terminals.ts', 'M', 5, 1),
        ],
        recent: commits([
          'Show unread sessions in the tab title',
          'Keep the composer focused after sending',
          'Fold thinking rows by default',
        ]),
      }),
      [keys]: status({
        branch: 'session-shortcuts',
        upstream: 'origin/session-shortcuts',
        ahead: 1,
        unstaged: [
          change('client/src/lib/shortcuts.ts', 'U', 38, 0),
          change('src/components/Sidebar.tsx', 'M', 25, 9),
          change('src/App.tsx', 'M', 1, 0),
          change('docs/sessions.md', 'M', 4, 0),
        ],
        recent: commits([
          'Open sessions with ⌘1–9',
          'Show unread sessions in the tab title',
          'Keep the composer focused after sending',
        ]),
      }),
      [voice]: status({
        branch: 'voice-handoff',
        upstream: 'origin/voice-handoff',
        staged: [change('client/src/voice/voice.ts', 'M', 24, 9)],
        unstaged: [change('server/src/voice/voice.ts', 'M', 61, 12)],
      }),
      [blog]: status({
        unstaged: [change('posts/building-bica-with-bica.md', 'U', 112, 0)],
      }),
    },
    files: { [bica]: BICA_FILES, [keys]: BICA_FILES, [voice]: BICA_FILES },
    texts: {
      [`${keys}/src/lib/shortcuts.ts`]: { new: SHORTCUTS_TS },
      [`${keys}/src/components/Sidebar.tsx`]: {
        old: SIDEBAR_BEFORE,
        new: SIDEBAR_AFTER,
      },
      [`${keys}/src/App.tsx`]: {
        old: APP_BEFORE,
        new: APP_BEFORE.replace(
          '  const projects',
          '  useSessionShortcuts(() => currentSession()?.id);\n  const projects',
        ),
      },
      [`${keys}/docs/sessions.md`]: {
        old: DOC_BEFORE,
        new: `${DOC_BEFORE}- ⌘1 to ⌘9 open the sidebar’s first nine sessions.\n- ⌥↑ and ⌥↓ open the previous and next session.\n- Neither fires while you type.\n`,
      },
    },
  };
}

// The most annoying real data: every catalog row the sidebar renders, spread
// across the first rows instead of stacked into one.
function worst(): Dataset {
  const nw = `${HOME}/Repos/northwind-industries-customer-onboarding-platform`;
  const x = `${HOME}/x`;
  const shop = `${HOME}/Repos/shop`;
  const cjk = `${HOME}/Repos/王秀英的毕业设计`;
  const long200 =
    'Investigate why the session list in the left sidebar overflows when a worktree branch name, a pull request badge and a ticket tag all share one line on a 320px phone, then fix it without moving rows';
  return {
    projects: [
      project(
        'nw',
        'northwind-industries-customer-onboarding-platform',
        [
          ws(nw, 'main', true),
          ws(
            `${nw}-restore-export-of-archived-sessions-wit`,
            'aleksandra/NW-69095-restore-export-of-archived-sessions-with-unicode-titles',
            false,
            pr(
              128473,
              'open',
              'Restore export of archived sessions with unicode titles and emoji in their names',
            ),
          ),
          ws(
            `${nw}-renovate`,
            'renovate/major-typescript-eslint-monorepo',
            false,
            pr(7, 'draft'),
          ),
          ws(`${nw}-bisect-flaky-checkout-e2e`, null),
          ws(`${nw}-NW-123456789`, 'NW-123456789', false, pr(9999, 'closed')),
          // Parked: nothing open, PR merged or closed.
          ws(
            `${nw}-benachrichtigungseinstellungen`,
            'Benachrichtigungseinstellungen-Überarbeitung',
            false,
            pr(100234, 'merged'),
          ),
          ws(
            `${nw}-paramètres-de-confidentialité`,
            'feature/paramètres-de-confidentialité-et-de-sécurité',
            false,
            pr(100235, 'closed'),
          ),
          ws(`${nw}-wip`, 'wip', false),
        ],
        { tickets: 'https://example.atlassian.net/browse/{key}' },
      ),
      project('x', 'x', [ws(x, null, true)], { git: false }),
      project('shop', 'shop', [ws(shop, 'main', true)]),
      project('cjk', '王秀英的毕业设计', [ws(cjk, '修复侧边栏溢出', true)]),
      // Parked, alone in its project: the project's name shares the line.
      project('parked-long', 'konstantin-oberhauser-wettstein-dotfiles', [
        ws(
          `${HOME}/Repos/konstantin-oberhauser-wettstein-dotfiles`,
          'main',
          true,
          pr(31, 'merged'),
        ),
      ]),
      project('dup', 'api', [ws(`${HOME}/Repos/api`, 'main', true)]),
      chats([ws(`${HOME}/.bica/chats/2026-10-11-recipe-ideas`, null)]),
    ],
    sessions: [
      session('nw', nw, long200, 'running', 0, { id: 'worst-long' }),
      session('nw', nw, 'J', 'done', 59 * 1000),
      session('nw', nw, long200, 'idle', 9 * MIN, {
        id: 'worst-tonight',
        agent: 'night',
        tonight: `${long200} ${long200}`,
      }),
      session('nw', nw, '', 'waiting', 3 * MIN, { id: 'worst-ask' }),
      session('nw', nw, long200, 'error', 4 * MIN, {
        id: 'worst-stuck',
        stuck: true,
      }),
      session(
        'nw',
        nw,
        'Benachrichtigungseinstellungenüberarbeitung',
        'error',
        1 * HOUR,
        // Its parent's title runs to 200 characters.
        { startedBy: 'worst-long', parent: 'worst-long' },
      ),
      session(
        'nw',
        `${nw}-restore-export-of-archived-sessions-wit`,
        'Đặng Thị Ngọc Hân: kiểm tra lỗi hiển thị tiếng Việt',
        'retrying',
        2 * MIN,
      ),
      session(
        'nw',
        `${nw}-restore-export-of-archived-sessions-wit`,
        'Fix the flaky checkout test (fork) (fork) (fork)',
        'idle',
        400 * DAY,
        // Started by another session, and forked from the long one.
        {
          forkedFrom: 'worst-long',
          forkedAt: 6,
          startedBy: 'worst-ask',
          parent: 'worst-ask',
        },
      ),
      session(
        'nw',
        `${nw}-renovate`,
        '<script>alert(1)</script> &amp; **bold**',
        'idle',
        3 * HOUR,
      ),
      session(
        'nw',
        `${nw}-bisect-flaky-checkout-e2e`,
        'Fix tests',
        'done',
        5 * MIN,
      ),
      session(
        'nw',
        `${nw}-bisect-flaky-checkout-e2e`,
        'Fix tests',
        'idle',
        6 * MIN,
      ),
      session(
        'nw',
        `${nw}-NW-123456789`,
        '👩🏽‍💻 Pair on the release checklist',
        'idle',
        2 * DAY,
      ),
      session('x', x, 'نور الهدى: إصلاح القائمة الجانبية', 'done', 30 * MIN, {
        id: 'worst-x',
      }),
      session('shop', shop, 'Split the export lane', 'running', MIN),
      session('shop', shop, 'Rename', 'idle', 9 * HOUR),
      session(
        'cjk',
        cjk,
        '修复侧边栏在窄屏幕上的溢出问题并检查所有状态',
        'waiting',
        12 * MIN,
      ),
      // A worktree whose folder was removed by hand.
      session(
        'nw',
        `${HOME}/Repos/northwind-industries-customer-onboarding-platform-old-spike-on-virtualized-session-list`,
        'Spike: virtualize the list',
        'idle',
        40 * DAY,
      ),
      // From before projects.
      session(null, `${HOME}/somewhere`, 'hi', 'idle', 900 * DAY),
      session(
        'chats',
        `${HOME}/.bica/chats/2026-10-11-recipe-ideas`,
        'Recipe ideas for twelve people with nut, gluten and lactose allergies',
        'done',
        MIN,
      ),
      session('dup', `${HOME}/Repos/api`, 'Fix tests', 'idle', 10 * MIN),
      // Archived.
      session('nw', nw, long200, 'idle', 3 * DAY, {
        archivedAt: now - 2 * DAY,
      }),
      session('nw', `${nw}-gone`, 'Ship the restore flow', 'idle', 800 * DAY, {
        archivedAt: now - 700 * DAY,
        cleanedUp: {
          branch:
            'aleksandra/NW-70001-ship-the-restore-flow-behind-a-feature-flag',
          pr: pr(127001, 'merged'),
        },
      }),
      session(null, null, '', 'idle', DAY, { archivedAt: now - MIN }),
    ],
    terminals: [
      terminal(
        'nw',
        nw,
        'bun run dev --port 3143 --host 0.0.0.0 --strictPort --open fal',
        null,
        'bun run dev --port 3143 --host 0.0.0.0 --strictPort --open false --mode development',
      ),
      // Led by a session, so archiving that session offers to close it.
      terminal(
        'nw',
        nw,
        'Setup',
        130,
        'pnpm install --frozen-lockfile',
        'worst-ask',
      ),
      terminal('x', x, 'zsh', 255, null),
    ],
    kept: [
      {
        projectId: 'nw',
        cwd: nw,
        path: 'docs/board/Q3 Board Deck — FINAL (revised) v12 [approved by legal].pdf',
        view: 'file',
      },
      {
        projectId: 'nw',
        cwd: nw,
        path: 'packages/web/src/index.ts',
        view: 'file',
      },
      {
        projectId: 'nw',
        cwd: nw,
        path: 'packages/server/src/index.ts',
        view: 'file',
      },
      {
        projectId: 'x',
        cwd: x,
        path: 'IMG_20250914_183022_HDR_portrait_edited_edited.HEIC',
        view: 'file',
      },
    ],
    chats: {
      'worst-long': {
        turns: worstChat,
        start: now - 3 * DAY,
        live: worstLive,
        thinking: 'max',
      },
      'worst-ask': { turns: worstAsk, start: now - 4 * MIN },
    },
    git: {
      [nw]: status({
        ahead: 1284,
        behind: 3,
        staged: [
          change(
            'packages/web/src/features/session-export/components/RestoreExportOfArchivedSessionsWithUnicodeTitlesDialog.tsx',
            'R',
            0,
            0,
            {
              oldPath:
                'packages/web/src/features/session-export/components/RestoreExportDialog.tsx',
            },
          ),
          change(
            'docs/board/Q3 Board Deck — FINAL (revised) v12 [approved by legal].pdf',
            'A',
          ),
          change('packages/legacy/index.js', 'D', 0, 4096),
        ],
        unstaged: [
          change('packages/web/src/features/session-export/serialize.ts', '!'),
          change(
            'packages/web/src/features/session-export/serialize.test.ts',
            'M',
            1284,
            977,
          ),
          change(
            'packages/web/src/i18n/王秀英的毕业设计/修复侧边栏溢出.json',
            'U',
            3,
            0,
          ),
          change('packages/web/src/i18n/ar/نور_الهدى.json', 'M', 1, 1),
          change('IMG_20250914_183022_HDR_portrait_edited_edited.HEIC', 'U'),
          change('.env', 'M', 1, 1),
          ...Array.from({ length: 120 }, (_, i) =>
            change(
              `packages/web/src/features/feature-${String(i).padStart(3, '0')}/index.ts`,
              'M',
              i,
              i % 7,
            ),
          ),
        ],
        recent: commits([
          'Revert "Revert "Restore export of archived sessions with unicode titles and emoji in their names (#128473)""',
          '👩🏽‍💻',
          'wip',
          "Merge branch 'main' of github.com:northwind-industries/customer-onboarding-platform into aleksandra/NW-69095",
        ]),
        submodules: [
          {
            ...status({
              branch: null,
              upstream: null,
              unstaged: [change('tokens/colors.json', 'M', 12, 12)],
            }),
            path: 'vendor/northwind-design-system-with-a-long-submodule-name',
          },
        ],
      }),
      // Detached HEAD, no upstream, nothing changed.
      [`${nw}-restore-export-of-archived-sessions-wit`]: status({
        branch: null,
        upstream: null,
      }),
      [`${nw}-renovate`]: status({
        branch: 'renovate/major-typescript-eslint-monorepo',
        upstream: null,
        ahead: 1,
      }),
      [`${nw}-bisect-flaky-checkout-e2e`]: status({
        branch: null,
        upstream: null,
      }),
      [`${nw}-NW-123456789`]: status({
        branch: 'NW-123456789',
        upstream: 'origin/NW-123456789',
        behind: 99,
      }),
      [cjk]: status({
        branch: '修复侧边栏溢出',
        upstream: null,
        unstaged: [change('论文/第三章.md', 'M', 40, 2)],
      }),
      [`${HOME}/Repos/api`]: status({}),
    },
    files: {
      [nw]: [
        'docs/board/Q3 Board Deck — FINAL (revised) v12 [approved by legal].pdf',
        'IMG_20250914_183022_HDR_portrait_edited_edited.HEIC',
        '.env',
        'packages/web/src/i18n/王秀英的毕业设计/修复侧边栏溢出.json',
        'packages/web/src/i18n/ar/نور_الهدى.json',
        'packages/web/src/features/session-export/serialize.ts',
        'packages/web/src/features/session-export/serialize.test.ts',
        'packages/web/src/features/session-export/components/RestoreExportOfArchivedSessionsWithUnicodeTitlesDialog.tsx',
        ...Array.from(
          { length: 120 },
          (_, i) =>
            `packages/web/src/features/feature-${String(i).padStart(3, '0')}/index.ts`,
        ),
        'vendor/northwind-design-system-with-a-long-submodule-name/tokens/colors.json',
      ],
      [x]: ['notes.txt', 'IMG_20250914_183022_HDR_portrait_edited_edited.HEIC'],
    },
  };
}

// One of everything: one project, one workspace, one session, counts of 1.
function one(): Dataset {
  const p = `${HOME}/Repos/bica`;
  return {
    projects: [
      project('bica', 'bica', [
        ws(p, 'main', true),
        ws(`${p}-parked`, 'parked', false, pr(1, 'merged')),
      ]),
    ],
    sessions: [
      session('bica', p, 'Only session', 'idle', MIN),
      session('bica', p, 'Only archived', 'idle', DAY, { archivedAt: now }),
    ],
    terminals: [],
    kept: [],
    git: {
      [p]: status({
        ahead: 1,
        behind: 1,
        staged: [change('a.ts', 'M', 1, 1)],
        unstaged: [change('b.ts', 'M', 1, 0)],
        recent: commits(['First commit']),
      }),
    },
    files: { [p]: ['a.ts', 'b.ts'] },
  };
}

// The realistic upper bound: months of daily use with nothing archived.
function huge(): Dataset {
  const p = `${HOME}/Repos/bica`;
  const statuses: SessionStatus[] = ['idle', 'idle', 'idle', 'done', 'running'];
  const worktrees = Array.from({ length: 40 }, (_, i) =>
    ws(`${p}-feature-${i}`, `feature-${i}`, false, pr(1000 + i, 'merged')),
  );
  const files = Array.from(
    { length: 20_000 },
    (_, i) => `src/module-${Math.floor(i / 100)}/part-${i % 100}.ts`,
  );
  const first = `fixture-${n + 1}`;
  return {
    projects: [project('bica', 'bica', [ws(p, 'main', true), ...worktrees])],
    sessions: [
      ...Array.from({ length: 1000 }, (_, i) =>
        session(
          'bica',
          p,
          `Session number ${i + 1}`,
          statuses[i % 5]!,
          i * HOUR,
        ),
      ),
      ...Array.from({ length: 1284 }, (_, i) =>
        session('bica', p, `Archived ${i + 1}`, 'idle', i * HOUR, {
          archivedAt: now - i * HOUR,
        }),
      ),
    ],
    terminals: [],
    kept: [],
    chats: {
      [first]: {
        start: now - 30 * DAY,
        // A month in one session, never compacted.
        turns: Array.from({ length: 300 }, (_, i): Turn[] => [
          { user: `Step ${i + 1}: keep going` },
          {
            agent: [
              { think: 'Next step.', ms: 1_000 },
              {
                tool: 'bash',
                args: { summary: `Run step ${i + 1}`, command: 'true' },
              },
            ],
          },
          { agent: [{ say: `Step ${i + 1} is done.` }] },
        ]).flat(),
      },
    },
    git: {
      [p]: status({
        ahead: 40,
        staged: files.slice(0, 1000).map((f) => change(f, 'M', 1, 1)),
        unstaged: files.slice(1000, 3000).map((f) => change(f, 'M', 2, 0)),
        recent: commits(
          Array.from({ length: 20 }, (_, i) => `Commit ${1000 - i}`),
        ),
      }),
    },
    files: { [p]: files },
  };
}

/** Each mode's data, built on first use. */
export const datasets: Record<Mode, () => Dataset> = {
  demo: () => talking(demo(), { running: 0, finished: 1, asking: 3 }),
  worst: () =>
    talking(worst(), { running: 0, finished: 3, asking: 2, worst: true }),
  empty: () => ({
    projects: [chats()],
    sessions: [],
    terminals: [],
    kept: [],
  }),
  one,
  huge,
};

/** Gives the sessions at these positions a transcript. */
function talking(
  data: Dataset,
  at: { running: number; finished: number; asking: number; worst?: boolean },
): Dataset {
  const id = (i: number) => data.sessions[i]?.id;
  return {
    ...data,
    conversations: conversations({
      running: id(at.running),
      finished: id(at.finished),
      asking: id(at.asking),
      worst: at.worst,
    }),
  };
}
