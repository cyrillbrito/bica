import { Show } from 'solid-js';

import type { ContextBreakdown } from '@bica/shared/context-breakdown';
import type { ProjectedView } from '@bica/shared/projection';
import {
  EXPIRING,
  bloat,
  cacheLeft,
  level,
  type ContextUsage,
} from '@bica/shared/context-usage';
import { formatCost, formatTokens } from '../ui/format';
import { formatDuration, tick } from '../ui/time';
import { PRUNE_HINT } from '@bica/shared/prune';
import { toast } from '../ui/Toast';
import {
  pruneSession,
  compactSession,
  isCompacting,
  isPruning,
  pruneUnavailable,
  compactHint,
  compactUnavailable,
} from './context-usage';
import ContextDetails, { spendOf } from './ContextDetails';
import { percent } from './ContextField';
import { RollingNumber } from '../ui/RollingNumber';
import { openContextMenu } from '../ui/ContextMenu';
import { buttonClass } from '../ui/Button';
import {
  PruneIcon,
  ColdIcon,
  CompactIcon,
  ExpiringIcon,
  InfoIcon,
} from '../ui/icons';

/** The context chip in the session's top bar: compact, prune, or the details. */
export default function ContextChip(props: {
  id: string;
  view: ProjectedView;
  usage: ContextUsage & ContextBreakdown;
}) {
  let dialog: HTMLDialogElement | undefined;
  const usage = () => props.usage;
  const left = () => cacheLeft(usage(), tick());
  // An hour is long; the chip only speaks up near the end.
  const expiring = () => {
    const l = left();
    return l !== undefined && l > 0 && l < EXPIRING;
  };
  const cold = () => (left() ?? 1) <= 0;
  const spend = () => spendOf(props.view.docs['pi.usage']);
  const spent = () => spend().reduce((n, s) => n + s.cost, 0);

  const menu = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(r.right - 200, r.bottom + 4, [
      {
        label: isCompacting(props.id, usage()) ? 'Compacting…' : 'Compact',
        hint: compactHint(usage()),
        icon: <CompactIcon />,
        disabled: compactUnavailable(props.id, usage()),
        onSelect: () =>
          void compactSession(props.id).catch((e) => toast.error(e)),
      },
      {
        label: isPruning(props.id) ? 'Pruning…' : 'Prune',
        hint: PRUNE_HINT,
        icon: <PruneIcon />,
        disabled: pruneUnavailable(props.id, usage()),
        onSelect: () =>
          void pruneSession(props.id).catch((e) => toast.error(e)),
      },
      'separator',
      {
        label: spent()
          ? `Context and cost · ${formatCost(spent())}`
          : 'Context details',
        icon: <InfoIcon />,
        onSelect: () => dialog?.showModal(),
      },
    ]);
  };

  return (
    <>
      <button
        type="button"
        class={[
          buttonClass({ size: 'md' }),
          'tabular-nums',
          // Important: the ghost button's own text-muted sorts after
          // text-danger and would win.
          level(usage()) === 'danger' && 'text-danger!',
          level(usage()) === 'warn' && 'text-warn-ink!',
          // Past 500k it won't sit still.
          bloat(usage().used) >= 4 && 'motion-safe:animate-nudge',
        ]}
        title={chipTitle(usage(), left(), spent())}
        aria-haspopup="menu"
        onClick={menu}
      >
        <Ring usage={usage()} />
        <RollingNumber value={usage().used} format={formatTokens} />
        <Show when={!usage().running && expiring()}>
          <span
            class="flex items-center gap-1 text-warn"
            title={`Prompt cache expires in ${formatDuration(left()!)}. A message sent before then rereads the context from cache, cheaper and faster.`}
          >
            <ExpiringIcon />
            {Math.max(1, Math.ceil(left()! / 60_000))}m
          </span>
        </Show>
        <Show when={!usage().running && cold()}>
          <span
            class="text-muted"
            title={`Prompt cache expired. The next message rewrites ~${formatTokens(usage().used)} to the cache.`}
          >
            <ColdIcon />
          </span>
        </Show>
      </button>
      <ContextDetails
        id={props.id}
        usage={usage()}
        spend={spend()}
        ref={(el) => (dialog = el)}
      />
    </>
  );
}

function chipTitle(u: ContextUsage, left: number | undefined, spent: number) {
  const size = u.window
    ? `${formatTokens(u.used)} of ${formatTokens(u.window)} tokens (${percent(u.used, u.window)})`
    : `${formatTokens(u.used)} tokens`;
  const cost = spent ? `. Spent ${formatCost(spent)}` : '';
  if (u.running || left === undefined) return `Context: ${size}${cost}`;
  return `Context: ${size}. Prompt cache ${left > 0 ? `warm for ${formatDuration(left)}` : 'cold'}${cost}`;
}

function Ring(props: { usage: ContextUsage }) {
  const share = () =>
    props.usage.window ? Math.min(1, props.usage.used / props.usage.window) : 0;
  const C = 2 * Math.PI * 6;
  return (
    <svg
      class="size-4 shrink-0 -rotate-90"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        opacity="0.2"
      />
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-dasharray={`${share() * C} ${C}`}
      />
    </svg>
  );
}
