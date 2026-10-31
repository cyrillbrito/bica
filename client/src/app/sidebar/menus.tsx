import { useLocation, useNavigate } from '@solidjs/router';

import type { SessionSummary } from '@bica/shared/protocol';
import { openInEditor, workspaceHref } from '../../files/files';
import { openEditProject } from '../../projects/EditProject';
import { openProjectPicker } from '../../projects/ProjectPicker';
import {
  CHATS_ID,
  pinProject,
  setCurrentTarget,
  type Target,
} from '../../projects/projects';
import { removeWorktreeAsking } from '../../projects/remove';
import { paths } from '../../router';
import { archiveWithChildren } from '../../sessions/ArchiveDialog';
import { forkSession, markSeen, setArchived } from '../../sessions/sessions';
import { createTerminal } from '../../terminals/terminals';
import { copyText } from '../../ui/clipboard';
import type { MenuEntry } from '../../ui/ContextMenu';
import {
  ArchiveIcon,
  CodeIcon,
  CopyIcon,
  DeleteIcon,
  DiffIcon,
  ExternalIcon,
  FolderIcon,
  ForkIcon,
  MoonIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  ReadIcon,
  RestoreIcon,
  SessionIcon,
  SettingsIcon,
  SunIcon,
  SystemThemeIcon,
  TerminalIcon,
  UnreadIcon,
} from '../../ui/icons';
import { closeDrawer } from '../../ui/layout';
import { setTheme, theme } from '../../ui/theme';
import { toast } from '../../ui/Toast';
import { nameOf, type Group } from './groups';

const THEMES = {
  system: ['Light theme', 'light', SunIcon],
  light: ['Dark theme', 'dark', MoonIcon],
  dark: ['System theme', 'system', SystemThemeIcon],
} as const;

/** The sidebar's menus: a session's, a workspace's, and the Bica button's. */
export function createSidebarMenus(props: {
  sessions: () => SessionSummary[];
  rename: (id: string) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isOpen = (id: string) => location.pathname === paths.s(id)();

  const archive = (s: SessionSummary) =>
    archiveWithChildren(s, props.sessions(), (ids) => {
      // Leave a session that's about to vanish from the list.
      if (ids.some(isOpen)) navigate(paths());
    });

  const markUnread = (s: SessionSummary) => {
    // The open session marks itself read again right away.
    if (isOpen(s.id)) navigate(paths());
    void markSeen(s.id, false);
  };

  const newSession = (target: Target) => {
    setCurrentTarget(target);
    closeDrawer();
    navigate(paths());
  };

  const newTerminal = async (target: Target) => {
    closeDrawer();
    const id = await createTerminal({
      projectId: target.projectId,
      cwd: target.cwd!,
    });
    navigate(paths.t(id)());
  };

  // Merged or closed: the server's check for unsaved work is the only question.
  const removeWorkspace = async (g: Group) => {
    const { projectId, cwd } = g.target!;
    const label = nameOf(g);
    const done = g.pr?.state === 'merged' || g.pr?.state === 'closed';
    if (
      !done &&
      !confirm(
        `Remove ${label}? Its folder and local branch are deleted, and its sessions archived.`,
      )
    )
      return;
    try {
      if (!(await removeWorktreeAsking(projectId, cwd!, label))) return;
      // Any file open or panel tab picked there is in the query too.
      if (
        location.pathname === paths.p(projectId)() &&
        new URLSearchParams(location.search).get('w') === cwd
      )
        navigate(paths());
      toast(`Removed ${label}`);
    } catch (e) {
      toast.error(e);
    }
  };

  const sessionMenu = (s: SessionSummary): MenuEntry[] => [
    ...(s.archivedAt
      ? []
      : s.status === 'done'
        ? [
            {
              label: 'Mark as read',
              icon: <ReadIcon />,
              onSelect: () => void markSeen(s.id),
            },
          ]
        : s.status === 'idle'
          ? [
              {
                label: 'Mark as unread',
                icon: <UnreadIcon />,
                onSelect: () => markUnread(s),
              },
            ]
          : []),
    {
      label: 'Rename',
      icon: <PencilIcon />,
      onSelect: () => props.rename(s.id),
    },
    {
      label: 'Fork',
      icon: <ForkIcon />,
      onSelect: () =>
        void forkSession(s.id).then((id) => {
          closeDrawer();
          navigate(paths.s(id)());
        }),
    },
    s.archivedAt
      ? {
          label: 'Unarchive',
          icon: <RestoreIcon />,
          onSelect: () => void setArchived([s], false),
        }
      : {
          label: 'Archive',
          icon: <ArchiveIcon />,
          // Hidden but still spending tokens would be a surprise.
          disabled:
            (s.status === 'running' || s.status === 'retrying') &&
            'Still running',
          onSelect: () => void archive(s),
        },
    'separator',
    {
      label: 'Open in new tab',
      icon: <ExternalIcon />,
      onSelect: () => window.open(paths.s(s.id)(), '_blank'),
    },
    {
      label: 'Copy session ID',
      icon: <CopyIcon />,
      onSelect: () => void copyText(s.id),
    },
  ];

  const workspaceMenu = (g: Group): MenuEntry[] => [
    ...(g.target
      ? ([
          {
            label: 'New session here',
            icon: <PlusIcon />,
            onSelect: () => newSession(g.target!),
          },
          {
            label: 'New terminal here',
            icon: <TerminalIcon />,
            onSelect: () => void newTerminal(g.target!),
          },
          {
            label: 'Files and changes',
            icon: <DiffIcon />,
            onSelect: () => {
              closeDrawer();
              navigate(
                workspaceHref({
                  projectId: g.target!.projectId,
                  cwd: g.target!.cwd!,
                }),
              );
            },
          },
          {
            label: 'Open in editor',
            icon: <CodeIcon />,
            onSelect: () =>
              void openInEditor({
                projectId: g.target!.projectId,
                cwd: g.target!.cwd!,
              }),
          },
        ] satisfies MenuEntry[])
      : []),
    ...(g.target && !g.worktree && g.projectKey !== CHATS_ID
      ? ([
          {
            label: 'Edit project',
            icon: <SettingsIcon />,
            onSelect: () => openEditProject(g.projectKey),
          },
          {
            label: g.pinned ? 'Unpin project' : 'Pin project',
            icon: <PinIcon />,
            onSelect: () =>
              void pinProject(g.projectKey, !g.pinned).catch((e) =>
                toast.error(e),
              ),
          },
        ] satisfies MenuEntry[])
      : []),
    ...(g.path
      ? ([
          ...(g.target ? (['separator'] as const) : []),
          {
            label: 'Copy path',
            icon: <CopyIcon />,
            onSelect: () => void copyText(g.path!),
          },
        ] satisfies MenuEntry[])
      : []),
    ...(g.target && g.worktree
      ? ([
          'separator',
          {
            label: 'Remove worktree',
            icon: <DeleteIcon />,
            onSelect: () => void removeWorkspace(g),
          },
        ] satisfies MenuEntry[])
      : []),
  ];

  // In the place of App Shell's workspace switcher.
  const appMenu = (): MenuEntry[] => {
    const [label, next, Icon] = THEMES[theme()];
    return [
      {
        label: 'New session',
        icon: <SessionIcon />,
        onSelect: () => {
          closeDrawer();
          navigate(paths());
        },
      },
      {
        label: 'Add project',
        icon: <FolderIcon />,
        onSelect: () => {
          closeDrawer();
          openProjectPicker();
        },
      },
      'separator',
      {
        label: 'Settings',
        icon: <SettingsIcon />,
        onSelect: () => {
          closeDrawer();
          navigate(paths.settings());
        },
      },
      { label, icon: <Icon />, onSelect: () => setTheme(next) },
    ];
  };

  return { sessionMenu, workspaceMenu, appMenu, newSession, removeWorkspace };
}
