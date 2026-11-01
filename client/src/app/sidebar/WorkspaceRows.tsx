import { useLocation } from '@solidjs/router';
import { For, Show } from 'solid-js';

import { isOpenKept } from '../../files/KeptFileRow';
import KeptFileRow from '../../files/KeptFileRow';
import { workspaceHref } from '../../files/files';
import BranchName from '../../projects/BranchName';
import { CHATS_ID } from '../../projects/projects';
import PullRequestBadge from '../../projects/PullRequestBadge';
import { isWorkspacePage } from '../../router';
import TerminalRow from '../../terminals/TerminalRow';
import { IconButton } from '../../ui/Button';
import { contextMenu } from '../../ui/ContextMenu';
import { BranchIcon, DeleteIcon, PlusIcon } from '../../ui/icons';
import { closeDrawer } from '../../ui/layout';
import { useSidebar } from './context';
import { nameOf, type Group } from './groups';
import SessionRow from './SessionRow';

/** The one indent step under a project or list heading, with a guide line. */
export const INDENT = 'ml-2.5 border-l border-line pl-1';

// Hover-only actions on a workspace row; always shown on touch.
const REVEAL =
  'invisible group-focus-within:visible group-hover:visible touch:visible';

// The branch, else what stands in for it.
function WorkspaceLabel(props: { group: Group; class?: string }) {
  return (
    <Show
      when={props.group.branch}
      fallback={
        <span class={['flex min-w-0 items-center gap-1', props.class]}>
          <span class="min-w-0 truncate">{props.group.folder}</span>
          {/* Its own span, so a long folder name can't push it out of sight. */}
          <Show when={props.group.note}>
            <span class="shrink-0 text-muted">
              {props.group.folder && '· '}
              {props.group.note}
            </span>
          </Show>
        </span>
      }
    >
      {(branch) => (
        <BranchName
          branch={branch()}
          tickets={props.group.tickets}
          class={props.class}
        />
      )}
    </Show>
  );
}

// The one action a workspace row shows: hidden until hover, but its room is
// kept, so nothing on the row moves. The rest is in the row's menu.
function NewSessionButton(props: { group: Group }) {
  const rows = useSidebar();
  return (
    <Show when={!!props.group.target}>
      <IconButton
        size="sm"
        class={REVEAL}
        title={`New session in ${nameOf(props.group)}`}
        onClick={() => rows.newSession(props.group.target!)}
      >
        <PlusIcon />
      </IconButton>
    </Show>
  );
}

/** A workspace with nothing open, on one line in Parked. */
export function ParkedRow(props: { group: Group; project?: boolean }) {
  const rows = useSidebar();
  const g = () => props.group;
  return (
    <li
      data-flip={`pk:${g().key}`}
      class="group context-target flex items-center gap-1 rounded-md pr-0.5 transition-colors hover:bg-hover"
      {...contextMenu(() => rows.workspaceMenu(g()))}
    >
      <a
        class="flex min-w-0 flex-1 items-center gap-2 py-1 pl-2 touch:py-3"
        href={workspaceHref({
          projectId: g().target!.projectId,
          cwd: g().target!.cwd!,
        })}
        title={[g().path, g().note].filter(Boolean).join('\n')}
        onClick={closeDrawer}
      >
        <Show when={props.project}>
          <span class="min-w-0 truncate text-muted">{g().projectName}</span>
        </Show>
        <WorkspaceLabel group={g()} class="text-meta" />
      </a>
      <Show when={g().pr}>{(pr) => <PullRequestBadge pr={pr()} />}</Show>
      <Show
        when={
          g().worktree &&
          (g().pr?.state === 'merged' || g().pr?.state === 'closed')
        }
      >
        <IconButton
          size="sm"
          title="Remove worktree: delete the folder and local branch"
          onClick={() => void rows.removeWorkspace(g())}
        >
          <DeleteIcon />
        </IconButton>
      </Show>
      <NewSessionButton group={g()} />
    </li>
  );
}

/**
 * The workspace's branch and PR. Alone in its project, the project's name
 * sits on a line above, so the branch keeps the full width.
 */
export function WorkspaceHeader(props: { group: Group; project?: string }) {
  const rows = useSidebar();
  const location = useLocation();
  const g = () => props.group;
  const branchLine = () => (
    <div
      class="flex min-w-0 flex-1 items-center gap-2"
      title={[g().path, g().note].filter(Boolean).join('\n')}
    >
      <Show when={!props.project}>
        {/* Centered on the status dots below it. */}
        <span class="-ml-0.5 grid text-muted [&_svg]:size-3.5">
          <BranchIcon />
        </span>
      </Show>
      <WorkspaceLabel group={g()} class="text-meta text-muted" />
      <Show when={g().pr}>{(pr) => <PullRequestBadge pr={pr()} />}</Show>
    </div>
  );
  const href = () =>
    g().target?.cwd
      ? workspaceHref({
          projectId: g().target!.projectId,
          cwd: g().target!.cwd!,
        })
      : undefined;
  // Lit while its page is open, unless one of its kept files is the open row.
  const open = () => {
    const t = g().target;
    return (
      !!t?.cwd &&
      isWorkspacePage(location, t.projectId, t.cwd) &&
      !g().files.some((k) => isOpenKept(k, location))
    );
  };
  return (
    <div
      data-flip={`w:${g().key}`}
      // The fill spans the whole row, + included, so it reads as one row.
      class={[
        'context-target flex items-center gap-1 rounded-md pr-0.5 transition-colors',
        href() && 'hover:bg-hover',
        open() && 'bg-active',
      ]}
      {...contextMenu(() => rows.workspaceMenu(g()))}
      // Alone in its project, this is the project's header: it drags the project.
      data-drag-handle={
        (props.project && g().projectKey !== CHATS_ID && g().projectKey) ||
        undefined
      }
    >
      <a
        draggable="false"
        class="flex min-w-0 flex-1 flex-col justify-center pl-2 pr-1"
        href={href()}
        title={
          href() ? `Open ${nameOf(g())}: files, changes and Git` : undefined
        }
        onClick={closeDrawer}
      >
        <div class="flex min-h-7 items-center">
          <Show when={props.project} fallback={branchLine()}>
            <h2 class="min-w-0 flex-1 truncate font-semibold">
              {props.project}
            </h2>
          </Show>
        </div>
        {/* Alone, a plain main folder or one without git says nothing new. */}
        <Show
          when={
            props.project &&
            (g().branch || g().note) &&
            !(
              !g().folder &&
              (g().note === 'no git' ||
                (!g().note && ['main', 'master'].includes(g().branch!)))
            )
          }
        >
          <div class="-mt-1 flex pb-0.5">{branchLine()}</div>
        </Show>
      </a>
      <NewSessionButton group={g()} />
    </div>
  );
}

/** A workspace's terminals, kept files, and sessions. */
export function WorkspaceRows(props: { group: Group; nested?: boolean }) {
  return (
    <ul class={!props.nested && INDENT}>
      <For each={props.group.terminals} keyed={(t) => t.id}>
        {(t) => <TerminalRow terminal={t()} />}
      </For>
      <For each={props.group.files} keyed={(k) => k.path}>
        {(k) => <KeptFileRow file={k()} files={props.group.files} />}
      </For>
      <For
        each={props.group.sessions}
        // Every snapshot is new objects; keep rows by id.
        keyed={(s) => s.id}
      >
        {(s) => <SessionRow session={s()} />}
      </For>
    </ul>
  );
}
