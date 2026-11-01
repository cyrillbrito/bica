import { Dynamic, type JSX } from '@solidjs/web';
import { Show } from 'solid-js';

import type { ContextBreakdown } from '@bica/shared/context-breakdown';
import type { ProjectedView } from '@bica/shared/projection';
import {
  BLOATED,
  EXPIRING,
  LONG_LIVED_COMPACT_AT,
  bloat,
  cacheLeft,
  formatClock,
  formatCost,
  formatTokens,
  level,
  type ContextUsage,
} from '@bica/shared/context-usage';
import { tick } from '../ui/time';
import { PRUNE_HINT } from '@bica/shared/prune';
import { toast } from '../ui/Toast';
import {
  pruneSession,
  compactSession,
  isCompacting,
  isPruning,
  pruneUnavailable,
  setAgent,
} from '../sessions/sessions';
import { AGENTS, isLongLived, type AgentId } from '@bica/shared/agents';
import type { VoiceSettings as Voice } from '@bica/shared/protocol';
import ContextDetails, { spendOf } from './ContextDetails';
import { percent } from './ContextField';
import { RollingNumber } from '../ui/RollingNumber';
import VoiceSettings from '../voice/VoiceSettings';
import { openContextMenu } from '../ui/ContextMenu';
import { buttonClass } from '../ui/Button';
import {
  AssistantIcon,
  PruneIcon,
  CodeIcon,
  HubIcon,
  ColdIcon,
  CompactIcon,
  ExpiringIcon,
  InfoIcon,
  MoonIcon,
  VoiceIcon,
} from '../ui/icons';

const LONG_LIVED_HINT = `While it sits idle, Bica clears old tool output once the cache is cold, and past ${formatTokens(LONG_LIVED_COMPACT_AT)} it has the agent save to its memory files, then compacts. Past ${formatTokens(BLOATED)} it does that at the first pause.`;

const AGENT_ICON: Record<AgentId, () => JSX.Element> = {
  coding: CodeIcon,
  assistant: AssistantIcon,
  night: MoonIcon,
  hub: HubIcon,
};

/** The context chip in the session's top bar: compact, prune, or the details. */
export default function ContextChip(props: {
  id: string;
  view: ProjectedView;
  usage: ContextUsage & ContextBreakdown;
  agent: AgentId;
  voice: Voice | null;
}) {
  let voiceDialog: HTMLDialogElement | undefined;
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
        hint: 'A model summarizes the older part of the session, so the next prompt sends far less. The transcript keeps everything.',
        icon: <CompactIcon />,
        disabled: isCompacting(props.id, usage()) && 'Already compacting',
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
      ...(props.agent === 'assistant'
        ? [
            {
              label: 'Turn off assistant mode',
              hint: 'Back to a coding session. Rebuilds the prompt cache once.',
              icon: <CodeIcon />,
              onSelect: () => void setAgent(props.id, 'coding'),
            },
          ]
        : []),
      {
        label: 'Voice settings',
        icon: <VoiceIcon />,
        onSelect: () => voiceDialog?.showModal(),
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
        <Show when={props.agent !== 'coding'}>
          <span
            class="text-muted"
            title={`${AGENTS[props.agent].label}: ${AGENTS[props.agent].description}.${isLongLived(props.agent) ? ` ${LONG_LIVED_HINT}` : ''}`}
          >
            <Dynamic component={AGENT_ICON[props.agent]} />
          </span>
        </Show>
        <Ring usage={usage()} />
        <RollingNumber value={usage().used} format={formatTokens} />
        <Show when={!usage().running && expiring()}>
          <span
            class="flex items-center gap-1 text-warn"
            title={`Prompt cache expires in ${formatClock(left()!)}. A message sent before then rereads the context from cache, cheaper and faster.`}
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
      <VoiceSettings
        id={props.id}
        voice={props.voice}
        ref={(el) => (voiceDialog = el)}
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
  return `Context: ${size}. Prompt cache ${left > 0 ? `warm for ${formatClock(left)}` : 'cold'}${cost}`;
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
