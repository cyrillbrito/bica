import { useLocation, useNavigate } from '@solidjs/router';

import type { SessionSummary } from '@bica/shared/protocol';
import { openInEditor, workspaceHref } from '../../files/files';
import { openEditProject } from '../../projects/EditProject';
import { openProjectPicker } from '../../projects/ProjectPicker';
import { CHATS_ID, pinProject, type Target } from '../../projects/projects';
import { removeWorktreeAsking } from '../../projects/remove';
import { menuItem, useSessionActions } from '../../sessions/actions';
import { isWorkspacePage, paths } from '../../router';
import { copyText } from '../../ui/clipboard';
import type { MenuEntry } from '../../ui/ContextMenu';
import {
  CodeIcon,
  CopyIcon,
  DeleteIcon,
  DiffIcon,
  FolderIcon,
  MoonIcon,
  PinIcon,
  PlusIcon,
  SessionIcon,
  SettingsIcon,
  SunIcon,
  SystemThemeIcon,
  TerminalIcon,
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
export function createSidebarMenus(options: { rename: (id: string) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { actionsFor, startIn, openTerminalIn } = useSessionActions();

  const newSession = (target: Target) => startIn(target);

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
      if (isWorkspacePage(location, projectId, cwd!)) navigate(paths());
      toast(`Removed ${label}`);
    } catch (e) {
      toast.error(e);
    }
  };

  // Open in new tab and Copy session ID after a line: they leave Bica.
  const sessionMenu = (s: SessionSummary): MenuEntry[] =>
    actionsFor(s, () => options.rename(s.id)).flatMap((a) =>
      a.id === 'new-tab' ? ['separator', menuItem(a)] : [menuItem(a)],
    );

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
            onSelect: () =>
              void openTerminalIn({
                projectId: g.target!.projectId,
                cwd: g.target!.cwd!,
              }),
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
