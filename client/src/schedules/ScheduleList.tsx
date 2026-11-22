import { For, Show, createSignal } from 'solid-js';

import type { Schedule } from '@bica/shared/protocol';
import { momentWords, timeWords } from '@bica/shared/schedules';
import { useBots } from '../bots/bots';
import { useProjects } from '../projects/projects';
import { useSessions } from '../sessions/sessions';
import { paths } from '../router';
import { IconButton } from '../ui/Button';
import Empty from '../ui/Empty';
import { ClockIcon, DeleteIcon, RepeatIcon } from '../ui/icons';
import { timeUntil } from '../ui/time';
import { toast } from '../ui/Toast';
import { deleteSchedule, useSchedules } from './schedules';

/** Every schedule, soonest first: what it does, when, and where it goes. */
export default function ScheduleList() {
  const schedules = useSchedules();
  return (
    <Show
      when={schedules().length}
      fallback={
        <Empty icon={<ClockIcon />} title="No schedules yet">
          Ask any session for a reminder or a routine, like "remind me Friday to
          pay rent" or "every weekday at 8, check my inbox". Schedule… under the
          send button starts a new session later.
        </Empty>
      }
    >
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div class="chat-column pt-2 pb-[max(--spacing(8),env(safe-area-inset-bottom))]">
          <ul class="flex flex-col">
            <For each={schedules()} keyed={(s) => s.id}>
              {(s) => <Row s={s()} />}
            </For>
          </ul>
          <p class="mt-6 text-meta text-muted">
            Times are the dev machine's. A schedule due while Bica is off or the
            machine sleeps fires once it's back.
          </p>
        </div>
      </div>
    </Show>
  );
}

function Row(props: { s: Schedule }) {
  const [deleting, setDeleting] = createSignal(false, {
    name: 'scheduleDeleting',
  });
  const remove = async () => {
    setDeleting(true);
    try {
      await deleteSchedule(props.s.id);
    } catch (error) {
      toast.error(error);
      setDeleting(false);
    }
  };
  const repeat = () => 'cron' in props.s.time;
  return (
    <li class="-mx-2.5 flex items-start gap-3 rounded-lg px-2.5 py-2.5">
      <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-well text-muted">
        <Show when={repeat()} fallback={<ClockIcon />}>
          <RepeatIcon />
        </Show>
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="line-clamp-2 font-semibold [overflow-wrap:anywhere]">
          {props.s.prompt}
        </span>
        <span class="text-meta text-muted [overflow-wrap:anywhere]">
          {repeat() ? timeWords(props.s.time) : momentWords(props.s.next ?? 0)}
          <Show when={props.s.next}>
            {(next) => (
              <span title={momentWords(next())}>
                {' · '}
                {timeUntil(next()) === 'now'
                  ? 'due now'
                  : `${repeat() ? 'next in' : 'in'} ${timeUntil(next())}`}
              </span>
            )}
          </Show>
        </span>
        <Where s={props.s} />
      </span>
      <IconButton
        title="Delete schedule"
        loading={deleting()}
        onClick={() => void remove()}
      >
        <DeleteIcon />
      </IconButton>
    </li>
  );
}

/** Where a fire goes: back into a session, or a new session somewhere. */
function Where(props: { s: Schedule }) {
  const sessions = useSessions();
  const projects = useProjects();
  const bots = useBots();
  const from = () => sessions().find((o) => o.id === props.s.session);
  const name = () => {
    const s = from();
    if (!s) return null;
    return bots().find((b) => b.id === s.bot)?.name ?? (s.title || 'Untitled');
  };
  const project = () =>
    projects().find((p) => p.id === props.s.start?.projectId)?.name;
  const link = () => (
    <Show when={name()} fallback="a session that's gone">
      {(n) => (
        <a
          href={paths.s(props.s.session!)}
          class="text-fg/80 underline decoration-line underline-offset-2 hover:text-fg"
        >
          {n()}
        </a>
      )}
    </Show>
  );
  return (
    <span class="truncate text-meta text-muted">
      <Show when={props.s.start} fallback={<>Comes back to {link()}</>}>
        {(start) => (
          <Show
            when={props.s.session}
            fallback={
              <>
                New session{start().worktree ? ' in a new worktree' : ''} in{' '}
                {project() ?? 'a project that’s gone'}
              </>
            }
          >
            New session{start().worktree ? ' in a new worktree' : ''}, reporting
            to {link()}
          </Show>
        )}
      </Show>
    </span>
  );
}
