import { useLocation, useNavigate } from '@solidjs/router';

import { closeDrawer, toggleSidePanel, toggleSidebar } from '../../ui/layout';
import {
  CHATS_ID,
  currentTarget,
  setCurrentTarget,
  useProjects,
  workspaceName,
  type Target,
} from '../../projects/projects';
import type { SessionSummary } from '@bica/shared/protocol';
import {
  forkSession,
  markSeen,
  renameSession,
  setArchived,
  stopSession,
  useSessions,
} from '../../sessions/sessions';
import { createTerminal, useTerminals } from '../../terminals/terminals';
import { setTheme, theme, type Theme } from '../../ui/theme';
import { age } from '../../ui/time';
import { useCurrentWorkspace } from '../../projects/projects';
import { workspaceHref } from '../../files/files';
import { paths } from '../../router';
import { openProjectPicker } from '../../projects/ProjectPicker';
import { archiveWithChildren } from '../../sessions/ArchiveDialog';
import { setStartAgent } from '../../sessions/StartComposer';
import StatusDot from '../../sessions/StatusDot';
import {
  ArchiveIcon,
  ArrowDownIcon,
  AssistantIcon,
  BranchIcon,
  CheckIcon,
  FolderIcon,
  ForkIcon,
  HubIcon,
  SidePanelIcon,
  KeyboardIcon,
  PencilIcon,
  PlusIcon,
  RestoreIcon,
  SearchIcon,
  SessionIcon,
  SettingsIcon,
  SidebarIcon,
  StopIcon,
  TerminalIcon,
  ThemeIcon,
  UnreadIcon,
} from '../../ui/icons';
import { toast } from '../../ui/Toast';
import type { Command, Page } from './commands';

// Answers first: these are why you came back.
const NEEDS_YOU: SessionSummary['status'][] = ['waiting', 'done', 'error'];

// After the page changes, the new page's composer is the place to type.
function focusComposer() {
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLTextAreaElement>('main textarea[name=prompt]')
        ?.focus(),
    ),
  );
}

/**
 * What ⌘K offers: the root page, with the pages it opens, and every action
 * with a shortcut, which work with the palette closed too.
 */
export function useCommands() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessions = useSessions();
  const projects = useProjects();
  const terminals = useTerminals();
  const workspace = useCurrentWorkspace();

  const sessionId = () => {
    const [, kind, id] = location.pathname.split('/');
    return kind === 's' && id ? decodeURIComponent(id) : undefined;
  };

  const whereOf = (s: SessionSummary) => {
    const project = projects().find((p) => p.id === s.projectId);
    if (!project) return undefined;
    if (project.id === CHATS_ID || !s.cwd) return project.name;
    return workspaceName(project, s.cwd);
  };

  const sessionItem = (s: SessionSummary, group?: string): Command => ({
    id: `s:${s.id}`,
    label: s.title || 'Untitled',
    hint: [whereOf(s), s.archivedAt && 'archived'].filter(Boolean).join(' · '),
    icon: () => <StatusDot status={s.archivedAt ? 'idle' : s.status} />,
    meta: age(s.updatedAt),
    group,
    run: () => navigate(paths.s(s.id)()),
  });

  const startIn = (target: Target) => {
    setCurrentTarget(target);
    closeDrawer();
    navigate(paths());
    focusComposer();
  };

  // Where a new session would start: this page's workspace, else the last one picked.
  const newSessionHere = () => {
    const w = workspace();
    if (w) startIn({ projectId: w.project.id, cwd: w.workspace.path });
    else {
      closeDrawer();
      navigate(paths());
      focusComposer();
    }
  };

  const newTerminalHere = async () => {
    const w = workspace();
    if (!w) return;
    closeDrawer();
    navigate(paths.t(await createTerminal(w.ref))());
  };

  // Waiting first, then unread answers, then failures; newest first in each.
  // The open one is skipped, so pressing again moves on.
  const needsYou = () =>
    sessions()
      .filter((s) => !s.archivedAt && NEEDS_YOU.includes(s.status))
      .sort(
        (a, b) =>
          NEEDS_YOU.indexOf(a.status) - NEEDS_YOU.indexOf(b.status) ||
          b.updatedAt - a.updatedAt,
      );

  const nextNeedsYou = () => {
    const next = needsYou().find((s) => s.id !== sessionId());
    if (!next) return toast('Nothing needs you');
    closeDrawer();
    navigate(paths.s(next.id)());
  };

  const targetsPage = (): Page => ({
    title: 'New session',
    placeholder: 'Where should it start?',
    items: () =>
      projects().flatMap((p): Command[] =>
        p.id === CHATS_ID
          ? [
              {
                id: `t:${p.id}`,
                label: 'New chat',
                hint: 'no project',
                icon: SessionIcon,
                run: () =>
                  startIn({ projectId: p.id, cwd: p.path, worktree: true }),
              },
            ]
          : [
              ...p.workspaces.map((w) => ({
                id: `t:${p.id}:${w.path}`,
                label: workspaceName(p, w.path),
                hint: w.branch ?? undefined,
                icon: FolderIcon,
                run: () => startIn({ projectId: p.id, cwd: w.path }),
              })),
              ...(p.git
                ? [
                    {
                      id: `t:${p.id}:new`,
                      label: `${p.name} / New worktree`,
                      words: 'branch',
                      icon: BranchIcon,
                      run: () =>
                        startIn({
                          projectId: p.id,
                          cwd: p.path,
                          worktree: true,
                        }),
                    },
                  ]
                : []),
            ],
      ),
  });

  const workspaceItems = (): Command[] =>
    projects()
      .filter((p) => p.id !== CHATS_ID)
      .flatMap((p) =>
        p.workspaces.map((w) => ({
          id: `w:${p.id}:${w.path}`,
          label: workspaceName(p, w.path),
          hint: w.branch ?? undefined,
          words: 'project',
          icon: w.main ? FolderIcon : BranchIcon,
          group: 'Projects',
          run: () => navigate(workspaceHref({ projectId: p.id, cwd: w.path })),
        })),
      );

  const workspacesPage = (): Page => ({
    title: 'Go to workspace',
    placeholder: 'Search projects and worktrees…',
    items: () => workspaceItems().map((c) => ({ ...c, group: undefined })),
  });

  const themePage = (): Page => ({
    title: 'Theme',
    placeholder: 'Pick a theme…',
    items: () =>
      (['system', 'light', 'dark'] as Theme[]).map((t) => ({
        id: `theme:${t}`,
        label: t[0]!.toUpperCase() + t.slice(1),
        icon: theme() === t ? CheckIcon : undefined,
        run: () => setTheme(t),
      })),
  });

  const renamePage = (s: SessionSummary): Page => ({
    title: 'Rename',
    placeholder: s.title || 'New title…',
    raw: true,
    items: (q) =>
      q.trim()
        ? [
            {
              id: 'rename',
              label: `Rename to “${q.trim()}”`,
              icon: PencilIcon,
              run: () => void renameSession(s.id, q.trim()),
            },
          ]
        : [],
  });

  const shortcutsPage = (): Page => ({
    title: 'Keyboard shortcuts',
    placeholder: 'Search shortcuts…',
    items: () => [
      {
        id: 'k:palette',
        label: 'Open the command palette',
        icon: SearchIcon,
        keys: { code: 'KeyK', mod: true },
      },
      ...actions()
        .filter((c) => c.keys)
        .map((c) => ({ ...c, group: undefined })),
    ],
  });

  // The open session's own actions, as in its sidebar menu.
  const sessionActions = (): Command[] => {
    const s = sessions().find((s) => s.id === sessionId());
    if (!s) return [];
    const group = 'This session';
    const running = s.status === 'running' || s.status === 'retrying';
    return [
      ...(running
        ? [
            {
              id: 'c:stop',
              label: 'Stop',
              icon: StopIcon,
              group,
              run: () => void stopSession(s.id),
            },
          ]
        : []),
      {
        id: 'c:rename',
        label: 'Rename',
        words: 'title',
        icon: PencilIcon,
        group,
        page: () => renamePage(s),
      },
      {
        id: 'c:fork',
        label: 'Fork',
        words: 'copy branch duplicate',
        icon: ForkIcon,
        group,
        run: () => void forkSession(s.id).then((id) => navigate(paths.s(id)())),
      },
      ...(s.status === 'idle' && !s.archivedAt
        ? [
            {
              id: 'c:unread',
              label: 'Mark as unread',
              icon: UnreadIcon,
              group,
              run: () => {
                navigate(paths());
                void markSeen(s.id, false);
              },
            },
          ]
        : []),
      ...(s.archivedAt
        ? [
            {
              id: 'c:unarchive',
              label: 'Unarchive',
              icon: RestoreIcon,
              group,
              run: () => void setArchived([s], false),
            },
          ]
        : running
          ? []
          : [
              {
                id: 'c:archive',
                label: 'Archive',
                words: 'hide done close',
                icon: ArchiveIcon,
                group,
                run: () =>
                  void archiveWithChildren(s, sessions(), () =>
                    navigate(paths()),
                  ),
              },
            ]),
    ];
  };

  const actions = (): Command[] => {
    const group = 'Actions';
    const w = workspace();
    const here = w
      ? workspaceName(w.project, w.workspace.path)
      : (projects().find((p) => p.id === currentTarget()?.projectId)?.name ??
        undefined);
    return [
      {
        id: 'a:new-here',
        label: 'New session',
        hint: here,
        words: 'chat start create',
        icon: PlusIcon,
        keys: { code: 'KeyO', mod: true, shift: true },
        group,
        run: newSessionHere,
      },
      {
        id: 'a:new',
        label: 'New session in…',
        words: 'chat start create worktree',
        icon: SessionIcon,
        group,
        page: targetsPage,
      },
      {
        id: 'a:assistant',
        label: 'New assistant session',
        hint: here,
        words: 'assistant mode long-running memory notes helper',
        icon: AssistantIcon,
        group,
        run: () => {
          newSessionHere();
          setStartAgent('assistant');
        },
      },
      {
        id: 'a:hub',
        label: 'Hub',
        words: 'orchestrator coordinator home inbox',
        icon: HubIcon,
        group,
        run: () => navigate(paths.hub()),
      },
      {
        id: 'a:next',
        label: 'Next session that needs you',
        words: 'unread waiting inbox jump answer',
        icon: ArrowDownIcon,
        keys: { code: 'ArrowDown', alt: true, shift: true },
        group,
        run: nextNeedsYou,
      },
      ...(w
        ? [
            {
              id: 'a:terminal',
              label: 'New terminal',
              hint: here,
              words: 'shell console',
              icon: TerminalIcon,
              keys: { code: 'Backquote', ctrl: true },
              group,
              run: () => void newTerminalHere(),
            },
          ]
        : []),
      {
        id: 'a:workspaces',
        label: 'Go to workspace…',
        words: 'open project worktree branch',
        icon: FolderIcon,
        group,
        page: workspacesPage,
      },
      {
        id: 'a:add-project',
        label: 'Add project',
        words: 'folder repo',
        icon: FolderIcon,
        group,
        run: openProjectPicker,
      },
      {
        id: 'a:sidebar',
        label: 'Show or hide sessions',
        words: 'sidebar toggle panel',
        icon: SidebarIcon,
        keys: { code: 'KeyB', mod: true },
        group,
        run: toggleSidebar,
      },
      {
        id: 'a:side-panel',
        label: 'Show or hide files and changes',
        words: 'inspector git diff toggle panel',
        icon: SidePanelIcon,
        keys: { code: 'KeyB', mod: true, alt: true },
        group,
        run: toggleSidePanel,
      },
      {
        id: 'a:theme',
        label: 'Theme…',
        words: 'dark light appearance',
        icon: ThemeIcon,
        group,
        page: themePage,
      },
      {
        id: 'a:settings',
        label: 'Settings',
        words: 'preferences models providers',
        icon: SettingsIcon,
        group,
        run: () => navigate(paths.settings()),
      },
      {
        id: 'a:shortcuts',
        label: 'Keyboard shortcuts',
        words: 'keys help',
        icon: KeyboardIcon,
        keys: { code: 'Slash', mod: true },
        group,
        page: shortcutsPage,
      },
    ];
  };

  const root: Page = {
    placeholder: 'Search sessions, projects, and actions…',
    items: (q) => {
      const open = sessions().filter((s) => s.id !== sessionId());
      if (q)
        return [
          // Live sessions before archived ones, newest first in each.
          ...[...open]
            .sort(
              (a, b) =>
                Number(!!a.archivedAt) - Number(!!b.archivedAt) ||
                b.updatedAt - a.updatedAt,
            )
            .map((s) => sessionItem(s)),
          ...workspaceItems(),
          ...terminals().map((t) => ({
            id: `term:${t.id}`,
            label: t.title,
            hint: projects().find((p) => p.id === t.projectId)?.name,
            words: 'terminal',
            icon: TerminalIcon,
            run: () => navigate(paths.t(t.id)()),
          })),
          ...sessionActions(),
          ...actions(),
        ];
      const waiting = needsYou().filter((s) => s.id !== sessionId());
      const recent = open
        .filter((s) => !s.archivedAt && !NEEDS_YOU.includes(s.status))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5);
      return [
        ...waiting.slice(0, 9).map((s) => sessionItem(s, 'Needs you')),
        ...recent.map((s) => sessionItem(s, 'Recent')),
        ...sessionActions(),
        ...actions(),
      ];
    },
  };

  return { root, actions, shortcutsPage };
}
