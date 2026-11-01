import { For, Show, createMemo } from 'solid-js';

import type { SessionSummary } from '@bica/shared/protocol';
import { isBusy, needsYou, urgency } from '@bica/shared/status';
import { useProjects, workspaceName } from '../projects/projects';
import { useSessions } from '../sessions/sessions';
import { formatCost } from '../ui/format';
import { timeAgo } from '../ui/time';
import { paths } from '../router';
import StatusDot, { STATUS } from '../sessions/StatusDot';
import { stored } from '../ui/stored';
import Chevron from '../ui/Chevron';

const [boardOpen, setBoardOpen] = stored('hubBoardOpen', true);

type Branch = { session: SessionSummary; cost: number; children: Branch[] };

// What needs you first, then the newest.
function byRank(a: SessionSummary, b: SessionSummary) {
  return urgency(a.status) - urgency(b.status) || b.updatedAt - a.updatedAt;
}

/**
 * The listed sessions as branches: each holds its child sessions, and a
 * listed session with a listed ancestor hangs under it rather than on top.
 * Archived sessions leave the rows, not the branch's cost.
 */
function growTree(
  all: SessionSummary[],
  listed: SessionSummary[],
  hubId: string,
) {
  const kids = new Map<string, SessionSummary[]>();
  for (const s of all)
    if (s.parent && s.id !== hubId)
      kids.set(s.parent, [...(kids.get(s.parent) ?? []), s]);
  const seen = new Set<string>();
  const grow = (s: SessionSummary): Branch => {
    seen.add(s.id);
    const children = (kids.get(s.id) ?? [])
      .filter((k) => !seen.has(k.id))
      .map(grow);
    return {
      session: s,
      cost: s.cost + children.reduce((n, c) => n + c.cost, 0),
      children: children
        .filter((c) => !c.session.archivedAt)
        .sort((a, b) => byRank(a.session, b.session)),
    };
  };
  const ids = new Set(listed.map((s) => s.id));
  const byId = new Map(all.map((s) => [s.id, s]));
  const under = (s: SessionSummary) => {
    for (let p = s.parent, hops = 0; p && hops < 20; hops++) {
      if (ids.has(p)) return true;
      p = byId.get(p)?.parent ?? null;
    }
    return false;
  };
  return listed.filter((s) => !under(s)).map(grow);
}

/**
 * Above the hub's chat: the sessions it tracks with their live status, what
 * needs you first (docs/hub.md). It tracks its child sessions, the sessions it
 * watches, and any session that asks or failed: the ones the hub hears of. A
 * child session's own children hang under it, after affectUI's Agent Tree,
 * and each row's cost is its whole branch.
 */
export default function HubBoard(props: { hubId: string }) {
  const sessions = useSessions();
  const tracked = createMemo(
    () =>
      sessions()
        .filter(
          (s) =>
            !s.archivedAt &&
            s.id !== props.hubId &&
            (s.parent === props.hubId ||
              s.watchedBy.includes(props.hubId) ||
              s.status === 'waiting' ||
              s.status === 'error'),
        )
        .sort(byRank),
    { name: 'hubTracked' },
  );
  const tree = createMemo(() => growTree(sessions(), tracked(), props.hubId), {
    name: 'hubTree',
  });
  const spent = () => tree().reduce((n, b) => n + b.cost, 0);
  const rows = (list: Branch[]): number =>
    list.reduce((n, b) => n + 1 + rows(b.children), 0);
  const waiting = () => tracked().filter((s) => needsYou(s.status));
  const running = () => tracked().filter((s) => isBusy(s.status));
  return (
    <Show when={tracked().length}>
      <details
        class="group/board expand shrink-0 border-t border-line"
        open={boardOpen()}
        onToggle={(e) => setBoardOpen(e.currentTarget.open)}
      >
        <summary class="chat-column flex h-10 items-center gap-2 text-meta text-muted hover:text-fg touch:h-11">
          <Chevron class="group-open/board:rotate-90" />
          <span class="font-medium text-fg">Threads</span>
          <span class="min-w-0 flex-1 truncate">
            {[
              waiting().length && `${waiting().length} need you`,
              running().length && `${running().length} running`,
              `${rows(tree())} open`,
              spent() >= 0.01 && `${formatCost(spent())} spent`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </summary>
        <ul class="chat-column max-h-[38dvh] overflow-y-auto overscroll-contain pb-2">
          <For each={tree()} keyed={(b) => b.session.id}>
            {(b) => <Row branch={b()} />}
          </For>
        </ul>
      </details>
    </Show>
  );
}

const TEXT = {
  accent: 'text-accent',
  danger: 'text-danger',
  warn: 'text-warn-ink',
  muted: 'text-muted',
} as const;

function Row(props: { branch: Branch }) {
  const projects = useProjects();
  const s = () => props.branch.session;
  const where = () => {
    const p = projects().find((p) => p.id === s().projectId);
    return p && s().cwd ? workspaceName(p, s().cwd!) : undefined;
  };
  const started = () => props.branch.children.length;
  return (
    <li>
      <a
        class={[
          '-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-hover touch:py-2.5',
          s().status === 'idle' && 'text-muted',
        ]}
        href={paths.s(s().id)()}
        title={[s().title, where()].filter(Boolean).join('\n')}
      >
        <StatusDot status={s().status} />
        <span
          class={[
            'min-w-0 flex-1 truncate',
            needsYou(s().status) && 'font-semibold',
          ]}
        >
          {s().title || 'New session'}
        </span>
        <Show when={where()}>
          {(w) => (
            <span class="max-w-[35%] shrink truncate text-meta text-muted max-sm:hidden">
              {w()}
            </span>
          )}
        </Show>
        <span
          class={[
            'shrink-0 text-meta tabular-nums',
            TEXT[STATUS[s().status].tone ?? 'muted'],
          ]}
        >
          {[STATUS[s().status].word, timeAgo(s().updatedAt)]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <Show when={props.branch.cost >= 0.01}>
          <span
            class="w-12 shrink-0 text-right text-meta text-muted tabular-nums"
            title={
              started()
                ? `This session and the ${started() === 1 ? 'one' : started()} it started`
                : 'Spent at list prices'
            }
          >
            {formatCost(props.branch.cost)}
          </span>
        </Show>
      </a>
      <Show when={started()}>
        {/* A guide line, like the sidebar's, says whose they are. */}
        <ul class="ml-[5px] border-l border-line pl-2.5">
          <For each={props.branch.children} keyed={(c) => c.session.id}>
            {(c) => <Row branch={c()} />}
          </For>
        </ul>
      </Show>
    </li>
  );
}
