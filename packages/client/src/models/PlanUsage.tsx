import { For, Show, createMemo } from 'solid-js';

import { openModel } from './models';
import type { PlanWindow, ProviderUsage } from '@bica/shared/protocol';
import { useTopic } from '../socket/socket';
import { clockTime, timeAgo, timeUntil } from '../ui/time';
import { RollingNumber } from '../ui/RollingNumber';

// Near a limit the meter warns; affectUI's Usage Meter starts at 80% too.
const WARN_AT = 80;

/**
 * The limits of the accounts serving the open session's model, at the foot
 * of the sidebar; hidden outside a session.
 */
export default function PlanUsage() {
  const usage = useTopic('plan.usage', () => ({}));
  const shown = () => {
    const open = openModel();
    if (!open) return [];
    return (
      usage()?.filter((p) => p.family === open.provider && p.windows.length) ??
      []
    );
  };

  return (
    <Show when={shown().length}>
      <UsageList
        usage={shown()}
        class="shrink-0 border-t border-line px-4 pt-2.5 pb-[max(--spacing(2.5),env(safe-area-inset-bottom))]"
      />
    </Show>
  );
}

export function UsageList(props: { usage: ProviderUsage[]; class?: string }) {
  return (
    <div
      class={[
        'grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 gap-y-1 text-meta text-muted tabular-nums',
        props.class,
      ]}
    >
      <For each={props.usage} keyed={(p) => p.id}>
        {(p) => <Provider usage={p()} />}
      </For>
    </div>
  );
}

function Provider(props: { usage: ProviderUsage }) {
  return (
    <>
      <div
        class="col-span-4 flex min-w-0 gap-1.5 not-first:mt-1.5"
        title={`As of ${timeAgo(props.usage.updatedAt)} ago. Refreshes every minute.`}
      >
        <span class="truncate text-fg">{props.usage.name}</span>
        <Show when={props.usage.inUse}>
          <span class="shrink-0">In use</span>
        </Show>
      </div>
      <For each={props.usage.windows} keyed={(w) => w.key}>
        {(w) => <Row label={w().label} window={w()} />}
      </For>
    </>
  );
}

/** A window's share, 0 once it has reset, and its tone. */
function level(w: PlanWindow) {
  // Past its reset, the window starts over; the old number would mislead.
  const reset = w.resetsAt !== null && timeUntil(w.resetsAt) === 'now';
  const percent = reset ? 0 : Math.round(w.utilization * 100);
  const tone =
    !reset && w.limited
      ? ('danger' as const)
      : percent >= WARN_AT
        ? ('warn' as const)
        : undefined;
  return { reset, percent, tone };
}

const FILL = { danger: 'bg-danger', warn: 'bg-warn', ok: 'bg-muted' };
const TEXT = {
  danger: 'text-danger-ink',
  warn: 'text-warn-ink',
  ok: undefined,
};

function Row(props: { label: string; window: PlanWindow }) {
  const l = createMemo(() => level(props.window), { name: 'planLevel' });
  return (
    <>
      <span>{props.label}</span>
      <Meter label={props.label} percent={l().percent} tone={l().tone} />
      <span
        class={['flex items-center justify-end gap-1', TEXT[l().tone ?? 'ok']]}
      >
        <Show when={l().tone}>
          <span
            class={['swap-in size-1.5 rounded-full', FILL[l().tone!]]}
            aria-hidden="true"
          />
        </Show>
        <RollingNumber value={l().percent} format={(n) => `${n}%`} />
      </span>
      <span
        class="min-w-12 text-right"
        title={
          l().reset || props.window.resetsAt === null
            ? 'Reset'
            : `Resets ${clockTime(props.window.resetsAt)}`
        }
      >
        {l().reset || props.window.resetsAt === null
          ? '—'
          : timeUntil(props.window.resetsAt)}
      </span>
    </>
  );
}

function Meter(props: {
  label: string;
  percent: number;
  tone: 'danger' | 'warn' | undefined;
  class?: string;
}) {
  return (
    <div
      class={['h-1.5 overflow-hidden rounded-full bg-line', props.class]}
      role="meter"
      aria-label={`${props.label} limit`}
      aria-valuenow={props.percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        class={[
          'h-full rounded-full transition-[width,background-color] duration-300 ease-out',
          FILL[props.tone ?? 'ok'],
        ]}
        style={{ width: `${Math.min(100, props.percent)}%` }}
      />
    </div>
  );
}
