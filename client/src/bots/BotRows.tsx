import { useLocation, useNavigate } from '@solidjs/router';
import { For, Show } from 'solid-js';

import type { Bot } from '@bica/shared/protocol';
import { useSidebar } from '../app/sidebar/context';
import type { Group } from '../app/sidebar/groups';
import { WorkspaceHeader, WorkspaceRows } from '../app/sidebar/WorkspaceRows';
import type { Target } from '../projects/projects';
import { paths } from '../router';
import StatusDot from '../sessions/StatusDot';
import { IconButton } from '../ui/Button';
import { contextMenu, MenuButton, type MenuEntry } from '../ui/ContextMenu';
import {
  BotIcon,
  DeleteIcon,
  PlusIcon,
  SessionIcon,
  SettingsIcon,
} from '../ui/icons';
import { closeDrawer } from '../ui/layout';
import BotMark from './BotMark';
import { openBotDialog } from './BotDialog';
import { useBotSession, useBots } from './bots';

/** Each bot with its workspace's groups, in the sidebar's order. */
export function groupsByBot(bots: Bot[], groups: Group[]) {
  return bots.map((bot) => ({
    bot,
    groups: groups.filter((g) => g.bot && g.projectKey === bot.id),
  }));
}

// Hover-only actions; always shown on touch.
const REVEAL =
  'invisible group-focus-within:visible group-hover:visible touch:visible';

/**
 * The bots on top of the sidebar, each with the terminals, kept files, and
 * sessions of its workspace under it. `groups` are the bot workspaces' groups,
 * already filtered.
 */
export default function BotRows(props: { groups: Group[]; filtered: boolean }) {
  const bots = useBots();
  return (
    <Show
      when={bots().length}
      fallback={
        // Always here when there are none, so bots are one tap away.
        <Show when={!props.filtered}>
          <button
            class="mt-2 mb-3 flex w-full items-center gap-2 rounded-md px-2 py-[3px] text-left text-muted transition-colors hover:bg-hover hover:text-fg touch:py-3"
            title="A bot talks with you about your work and gets it done through sessions"
            onClick={() => {
              closeDrawer();
              openBotDialog();
            }}
          >
            <BotIcon />
            <span class="flex-1 truncate">New bot</span>
          </button>
        </Show>
      }
    >
      <div class="mt-2 mb-3 flex flex-col gap-0.5">
        <For each={groupsByBot(bots(), props.groups)} keyed={(b) => b.bot.id}>
          {(b) => <BotBlock bot={b().bot} groups={b().groups} />}
        </For>
      </div>
    </Show>
  );
}

function BotBlock(props: { bot: Bot; groups: Group[] }) {
  const rows = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const session = useBotSession(() => props.bot.id);
  const href = () => paths.b(props.bot.id)();
  const open = () => {
    const s = session();
    return !!s && location.pathname === paths.s(s.id)();
  };
  // An answer in the open session is already read. A bot
  // sits idle most of the time, so only what changes gets a dot.
  const status = () => {
    const s = session();
    if (!s || (s.status === 'done' && open()) || s.status === 'idle') return;
    return s.status;
  };
  const main = () =>
    props.groups.find((g) => g.target && g.path === props.bot.workspace);
  const target = (): Target =>
    main()?.target ?? { projectId: props.bot.id, cwd: props.bot.workspace };
  // The main folder has no header of its own: the bot row stands for it.
  const shown = () =>
    props.groups.filter(
      (g) =>
        g !== main() ||
        g.sessions.length ||
        g.terminals.length ||
        g.files.length,
    );

  const menu = (): MenuEntry[] => {
    const m = main();
    return [
      {
        label: 'Open',
        icon: <SessionIcon />,
        onSelect: () => {
          closeDrawer();
          navigate(href());
        },
      },
      ...(m
        ? rows.workspaceMenu(m)
        : [
            {
              label: 'New session here',
              icon: <PlusIcon />,
              onSelect: () => rows.newSession(target()),
            },
          ]),
      'separator',
      {
        label: 'Edit bot',
        icon: <SettingsIcon />,
        onSelect: () => openBotDialog(props.bot.id),
      },
      {
        label: 'Delete bot',
        icon: <DeleteIcon />,
        danger: true,
        onSelect: () => openBotDialog(props.bot.id, { delete: true }),
      },
    ];
  };

  return (
    <section>
      <div
        data-flip={`b:${props.bot.id}`}
        class={[
          'group context-target flex items-center gap-1 rounded-md pr-0.5 transition-colors hover:bg-hover',
          open() && 'bg-active',
        ]}
        {...contextMenu(menu)}
      >
        <a
          class="flex min-h-7 min-w-0 flex-1 items-center gap-2 pl-2 touch:min-h-11"
          href={href()}
          aria-current={open() ? 'page' : undefined}
          title={props.bot.name}
          onClick={closeDrawer}
        >
          <BotMark bot={props.bot} />
          <span
            dir="auto"
            class="min-w-0 flex-1 truncate text-left font-semibold"
          >
            {props.bot.name}
          </span>
          <Show when={status()}>{(s) => <StatusDot status={s()} />}</Show>
        </a>
        <IconButton
          size="sm"
          class={REVEAL}
          title={`New session in ${props.bot.name}'s workspace`}
          onClick={() => rows.newSession(target())}
        >
          <PlusIcon />
        </IconButton>
        <MenuButton class="hidden touch:grid" items={menu} />
      </div>
      <For each={shown()} keyed={(g) => g.key}>
        {(g) => (
          <div class="group">
            <Show when={g() !== main()}>
              <WorkspaceHeader group={g()} />
            </Show>
            <WorkspaceRows group={g()} />
          </div>
        )}
      </For>
    </section>
  );
}
