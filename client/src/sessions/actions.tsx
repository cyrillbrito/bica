// What can be done to a session, and starting one, for every place that
// offers it: the sidebar's menus, ⌘K, and the session's own menu. Each
// place draws the list its own way and may leave entries out by id.
import { useLocation, useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';

import type { SessionSummary, WorkspaceRef } from '@bica/shared/protocol';
import { isBusy } from '@bica/shared/status';
import { setCurrentTarget, type Target } from '../projects/projects';
import { paths } from '../router';
import { createTerminal } from '../terminals/terminals';
import { copyText } from '../ui/clipboard';
import type { MenuItem } from '../ui/ContextMenu';
import {
  ArchiveIcon,
  AssistantIcon,
  CodeIcon,
  CopyIcon,
  ExternalIcon,
  ForkIcon,
  PencilIcon,
  ReadIcon,
  RestoreIcon,
  StopIcon,
  UnreadIcon,
} from '../ui/icons';
import { closeDrawer, isTouch } from '../ui/layout';
import { toast } from '../ui/Toast';
import { archiveWithChildren } from './ArchiveDialog';
import {
  forkSession,
  markSeen,
  setAgent,
  setArchived,
  stopSession,
  useSessions,
} from './sessions';

export type SessionActionId =
  | 'stop'
  | 'read'
  | 'unread'
  | 'rename'
  | 'fork'
  | 'assistant'
  | 'archive'
  | 'unarchive'
  | 'new-tab'
  | 'copy-id';

export interface SessionAction {
  id: SessionActionId;
  label: string;
  icon: () => JSX.Element;
  // Other words ⌘K finds it by.
  words?: string;
  hint?: string;
  // Why it can't run now.
  disabled?: string;
  run: () => void;
}

/** A session action as a menu row. */
export function menuItem(a: SessionAction): MenuItem {
  return {
    label: a.label,
    icon: <a.icon />,
    hint: a.hint,
    disabled: a.disabled,
    onSelect: a.run,
  };
}

// After the page changes, the new page's composer is the place to type. On
// a phone that would pop the keyboard over the page.
function focusComposer() {
  if (isTouch()) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLTextAreaElement>('main textarea[name=prompt]')
        ?.focus(),
    ),
  );
}

export function useSessionActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessions = useSessions();
  const isOpen = (id: string) => location.pathname === paths.s(id)();

  /** Opens the start page with `target` picked; none: the last one picked. */
  const startIn = (target?: Target) => {
    if (target) setCurrentTarget(target);
    closeDrawer();
    navigate(paths());
    focusComposer();
  };

  const openTerminalIn = async (ref: WorkspaceRef) => {
    closeDrawer();
    try {
      navigate(paths.t(await createTerminal(ref))());
    } catch (e) {
      toast.error(e);
    }
  };

  /** What can be done to `s` now, in menu order. */
  const actionsFor = (
    s: SessionSummary,
    rename: () => void,
  ): SessionAction[] => {
    const busy = isBusy(s.status);
    const live = !s.archivedAt;
    const list: (SessionAction | false)[] = [
      busy && {
        id: 'stop',
        label: 'Stop',
        icon: StopIcon,
        words: 'cancel abort',
        run: () => void stopSession(s.id).catch((e) => toast.error(e)),
      },
      live &&
        s.status === 'done' && {
          id: 'read',
          label: 'Mark as read',
          icon: ReadIcon,
          run: () => void markSeen(s.id),
        },
      live &&
        s.status === 'idle' && {
          id: 'unread',
          label: 'Mark as unread',
          icon: UnreadIcon,
          run: () => {
            // The open session marks itself read again right away.
            if (isOpen(s.id)) navigate(paths());
            void markSeen(s.id, false);
          },
        },
      {
        id: 'rename',
        label: 'Rename',
        icon: PencilIcon,
        words: 'title',
        run: rename,
      },
      {
        id: 'fork',
        label: 'Fork',
        icon: ForkIcon,
        words: 'copy branch duplicate',
        run: () =>
          void forkSession(s.id).then((id) => {
            closeDrawer();
            navigate(paths.s(id)());
          }),
      },
      s.agent === 'coding' && {
        id: 'assistant',
        label: 'Turn on assistant mode',
        icon: AssistantIcon,
        words: 'long-running memory notes',
        hint: 'Keeps notes in memory files and stays small while idle. Rebuilds the prompt cache once.',
        run: () => void setAgent(s.id, 'assistant'),
      },
      s.agent === 'assistant' && {
        id: 'assistant',
        label: 'Turn off assistant mode',
        icon: CodeIcon,
        hint: 'Back to a coding session. Rebuilds the prompt cache once.',
        run: () => void setAgent(s.id, 'coding'),
      },
      live
        ? {
            id: 'archive',
            label: 'Archive',
            icon: ArchiveIcon,
            words: 'hide done close',
            // Hidden but still spending tokens would be a surprise.
            disabled: busy ? 'Still running' : undefined,
            run: () =>
              void archiveWithChildren(s, sessions(), (ids) => {
                // Leave a session that's about to vanish from the list.
                if (ids.some(isOpen)) navigate(paths());
              }),
          }
        : {
            id: 'unarchive',
            label: 'Unarchive',
            icon: RestoreIcon,
            run: () => void setArchived([s], false),
          },
      {
        id: 'new-tab',
        label: 'Open in new tab',
        icon: ExternalIcon,
        run: () => window.open(paths.s(s.id)(), '_blank'),
      },
      {
        id: 'copy-id',
        label: 'Copy session ID',
        icon: CopyIcon,
        run: () => void copyText(s.id),
      },
    ];
    return list.filter((a) => a !== false);
  };

  return { actionsFor, startIn, openTerminalIn };
}
