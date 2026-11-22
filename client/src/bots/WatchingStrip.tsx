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

const [stripOpen, setStripOpen] = stored('watchingOpen', true);

/**
 * Above a bot's session: the sessions it hears from, its child sessions and
 * the ones it watches, with what needs you first (docs/bots.md).
 */
export default function WatchingStrip(props: { sessionId: string }) {
  const sessions = useSessions();
  const watching = createMemo(
    () =>
      sessions()
        .filter(
          (s) =>
            !s.archivedAt &&
            s.id !== props.sessionId &&
            (s.parent === props.sessionId ||
              s.watchedBy.includes(props.sessionId)),
        )
        .sort(
          (a, b) =>
            urgency(a.status) - urgency(b.status) || b.updatedAt - a.updatedAt,
        ),
    { name: 'watching' },
  );
  const spent = () => watching().reduce((n, s) => n + s.cost, 0);
  const waiting = () => watching().filter((s) => needsYou(s.status)).length;
  const running = () => watching().filter((s) => isBusy(s.status)).length;
  return (
    <Show when={watching().length}>
      <details
        class="group/watching expand shrink-0 border-t border-line"
        open={stripOpen()}
        onToggle={(e) => setStripOpen(e.currentTarget.open)}
      >
        <summary class="chat-column flex h-10 items-center gap-2 text-meta text-muted hover:text-fg touch:h-11">
          <Chevron class="group-open/watching:rotate-90" />
          <span class="font-medium text-fg">Watching</span>
          <span class="min-w-0 flex-1 truncate">
            {[
              waiting() && `${waiting()} need you`,
              running() && `${running()} running`,
              `${watching().length} open`,
              spent() >= 0.01 && `${formatCost(spent())} spent`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </summary>
        <ul class="chat-column max-h-[38dvh] overflow-y-auto overscroll-contain pb-2">
          <For each={watching()} keyed={(s) => s.id}>
            {(s) => <Row session={s()} />}
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

function Row(props: { session: SessionSummary }) {
  const projects = useProjects();
  const s = () => props.session;
  const where = () => {
    const p = projects().find((p) => p.id === s().projectId);
    return p && s().cwd ? workspaceName(p, s().cwd!) : undefined;
  };
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
        <Show when={s().cost >= 0.01}>
          <span
            class="w-12 shrink-0 text-right text-meta text-muted tabular-nums"
            title="Spent at list prices"
          >
            {formatCost(s().cost)}
          </span>
        </Show>
      </a>
    </li>
  );
}
