import { useLocation, useNavigate } from '@solidjs/router';
import { Show } from 'solid-js';

import type { TerminalInfo } from '@bica/shared/protocol';
import { paths } from '../router';
import { copyText } from '../ui/clipboard';
import { contextMenu, MenuButton, type MenuEntry } from '../ui/ContextMenu';
import {
  CloseIcon,
  CopyIcon,
  ExternalIcon,
  RestoreIcon,
  StopIcon,
  TerminalIcon,
} from '../ui/icons';
import { closeDrawer } from '../ui/layout';
import { toast } from '../ui/Toast';
import { removeTerminal, restartTerminal, stopTerminal } from './terminals';

// A terminal's row in the sidebar, under its workspace.
export default function TerminalRow(p: { terminal: TerminalInfo }) {
  const location = useLocation();
  const navigate = useNavigate();

  const closeTerminal = async (t: TerminalInfo) => {
    if (location.pathname === paths.t(t.id)()) navigate(paths());
    try {
      await removeTerminal(t.id);
      toast({ title: 'Closed terminal', description: t.title });
    } catch (e) {
      toast.error(e);
    }
  };

  const terminalMenu = (t: TerminalInfo): MenuEntry[] => [
    t.status === 'running'
      ? {
          label: 'Stop',
          icon: <StopIcon />,
          onSelect: () => void stopTerminal(t.id),
        }
      : {
          label: 'Restart',
          icon: <RestoreIcon />,
          onSelect: () => void restartTerminal(t.id),
        },
    {
      label: 'Close',
      icon: <CloseIcon />,
      onSelect: () => void closeTerminal(t),
    },
    'separator',
    {
      label: 'Open in new tab',
      icon: <ExternalIcon />,
      onSelect: () => window.open(paths.t(t.id)(), '_blank'),
    },
    ...(t.command
      ? ([
          {
            label: 'Copy command',
            icon: <CopyIcon />,
            onSelect: () => void copyText(t.command!),
          },
        ] satisfies MenuEntry[])
      : []),
  ];

  const t = () => p.terminal;
  const state = () =>
    t().status === 'running' ? 'Running' : `Exited with code ${t().exitCode}`;
  return (
    <li data-flip={`t:${t().id}`}>
      <div
        class="context-target relative rounded-md"
        {...contextMenu(() => terminalMenu(t()))}
      >
        <a
          class="flex items-center gap-2 rounded-md px-2 py-[3px] transition-colors hover:bg-hover aria-[current=page]:bg-active touch:py-3 touch:pr-11"
          href={paths.t(t().id)}
          title={t().command ? `${state()}: ${t().command}` : state()}
          onClick={closeDrawer}
        >
          <span
            class={[
              // Icon width minus the status dot's, so titles line up.
              '-mx-0.75',
              t().status === 'running'
                ? 'text-running'
                : t().exitCode
                  ? 'text-danger'
                  : 'text-muted',
            ]}
            role="img"
            aria-label={state()}
          >
            <TerminalIcon />
          </span>
          <span
            class={[
              'flex-1 truncate',
              t().status !== 'running' && 'text-muted',
            ]}
          >
            {t().title}
          </span>
          <Show when={t().status !== 'running'}>
            <span class="text-meta text-muted tabular-nums">
              exit {t().exitCode}
            </span>
          </Show>
        </a>
        <MenuButton
          class="absolute inset-y-0 right-0.5 my-auto hidden touch:grid"
          items={() => terminalMenu(t())}
        />
      </div>
    </li>
  );
}
