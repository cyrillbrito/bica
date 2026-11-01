import {
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';

import {
  BLOATED,
  EXPIRING,
  bloat,
  cacheLeft,
  formatTokens,
  nearAutoCompact,
  type ContextUsage,
} from '@bica/shared/context-usage';
import { PRUNE_HINT } from '@bica/shared/prune';
import {
  pruneSession,
  compactSession,
  isCompacting,
  isPruning,
  pruneUnavailable,
} from '../sessions/sessions';
import { cheer } from '../ui/sound';
import { tick } from '../ui/time';
import type { Message } from '@bica/shared/transcript';
import { Button, IconButton } from '../ui/Button';
import { toast } from '../ui/Toast';
import { PruneIcon, CloseIcon, CompactIcon } from '../ui/icons';

type Compaction = Extract<Message, { kind: 'compaction' }>;
type Prune = Extract<Message, { kind: 'prune' }>;

// Below this, resending the whole context costs little.
const COLD_WORTH_IT = 30_000;
// Below this, pruning saves too little to offer on its own.
const CLEAN_WORTH_IT = 5_000;

/**
 * Which hint shows, and the key that dismissing it remembers: a dismissed
 * hint returns when its key changes (the next 100k, the next cold cache).
 */
type Hint = {
  kind: 'cold' | 'big' | 'auto';
  key: string;
  // Cold: which actions are worth it.
  clean?: boolean;
  compact?: boolean;
  // Big: the cache's last minutes.
  left?: number;
};

// Per session, until the key changes.
const dismissed = new Map<string, string>();

/**
 * Above the composer, one calm line about the context when there is
 * something worth doing: Prune once the cache is cold, Compact while it is
 * warm and the session is big. Cheers when it shrinks.
 */
function fail(e: unknown) {
  return toast.error(e);
}

export default function ContextNag(props: {
  id: string;
  usage: ContextUsage;
  compaction: Compaction | undefined;
  prune: Prune | undefined;
}) {
  // The map isn't reactive; the signal says it changed.
  const [dismissals, setDismissals] = createSignal(0, { name: 'nagDismiss' });
  const compacting = () => isCompacting(props.id, props.usage);
  const pruning = () => isPruning(props.id);

  // Only what lands while watching: not what was already there on open.
  let seen: { id: string; key?: string } | undefined;
  let seenPrune: { id: string; key?: string } | undefined;
  createEffect(
    () => ({ id: props.id, c: props.compaction }),
    ({ id, c }) => {
      const prev = seen;
      seen = { id, key: c?.key };
      if (!c || !prev || prev.id !== id || prev.key === c.key) return;
      cheer();
    },
    { name: 'nagCompacted' },
  );
  createEffect(
    () => ({ id: props.id, c: props.prune }),
    ({ id, c }) => {
      const prev = seenPrune;
      seenPrune = { id, key: c?.key };
      if (!c || !prev || prev.id !== id || prev.key === c.key) return;
      cheer();
    },
    { name: 'nagSwept' },
  );

  const hint = createMemo<Hint | undefined>(
    () => {
      const u = props.usage;
      if (u.running || u.compacting) return;
      const left = cacheLeft(u, tick());
      const big = u.used >= BLOATED;
      if (left !== undefined && left <= 0) {
        if (u.used < COLD_WORTH_IT) return;
        const clean = u.prunable >= CLEAN_WORTH_IT;
        // Compacting a cold session rereads all of it first: only worth it
        // when even a clean session would stay big.
        const compact = u.used - (clean ? u.prunable : 0) >= BLOATED;
        if (!clean && !compact) return;
        return {
          kind: 'cold',
          key: `cold:${u.cache!.at}`,
          clean,
          compact,
        };
      }
      if (big) {
        return {
          kind: 'big',
          key: `big:${bloat(u.used)}`,
          left: left !== undefined && left < EXPIRING ? left : undefined,
        };
      }
      if (nearAutoCompact(u)) return { kind: 'auto', key: 'auto' };
    },
    { name: 'nagHint' },
  );
  const shown = () => {
    dismissals();
    const h = hint();
    return !pruning() && h && dismissed.get(props.id) !== h.key ? h : undefined;
  };
  const dismiss = () => {
    const h = hint();
    if (!h) return;
    dismissed.set(props.id, h.key);
    setDismissals((n) => n + 1);
  };

  const compact = () => void compactSession(props.id).catch(fail);
  const prune = () => void pruneSession(props.id).catch(fail);

  const CompactButton = (p: { primary: boolean }) => (
    <Button
      size="sm"
      variant={p.primary ? 'primary' : 'outline'}
      loading={compacting()}
      disabled={compacting() || pruning()}
      title="Summarizes older context. The last ~20k stay as they are."
      onClick={compact}
    >
      <CompactIcon />
      Compact
    </Button>
  );

  return (
    <div>
      <Show when={shown()}>
        {(h) => (
          <div
            class={[
              'appear mb-1 flex min-h-8 items-center gap-2 py-0.5 pr-0.5 pl-2.5 text-ui',
            ]}
          >
            <span class="flex min-w-0 flex-1 items-center">
              <span class="min-w-0 py-1 text-pretty">
                <Text hint={h()} usage={props.usage} />
              </span>
            </span>
            <span class="flex shrink-0 items-center gap-1">
              <Show when={h().kind === 'cold'}>
                <Show when={h().compact}>
                  <CompactButton primary={!h().clean} />
                </Show>
                <Show when={h().clean}>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!!pruneUnavailable(props.id, props.usage)}
                    title={
                      pruneUnavailable(props.id, props.usage) ?? PRUNE_HINT
                    }
                    onClick={prune}
                  >
                    <PruneIcon />
                    <span class="tabular-nums">
                      Prune −{formatTokens(props.usage.prunable)}
                    </span>
                  </Button>
                </Show>
              </Show>
              <Show when={h().kind !== 'cold'}>
                <CompactButton primary />
              </Show>
              <IconButton size="sm" title="Not now" onClick={dismiss}>
                <CloseIcon />
              </IconButton>
            </span>
          </div>
        )}
      </Show>
    </div>
  );
}

function Text(props: { hint: Hint; usage: ContextUsage }) {
  const used = () => formatTokens(props.usage.used);
  return (
    <Switch>
      <Match when={props.hint.kind === 'cold'}>
        Cache expired: your next message resends all {used()}.
      </Match>
      <Match when={props.hint.kind === 'auto'}>
        Compacts on its own at {formatTokens(props.usage.compactAt ?? 0)}.
      </Match>
      <Match when={props.hint.left}>
        {(left) => (
          <>
            Cache expires in {Math.max(1, Math.ceil(left() / 60_000))}m, the
            cheapest moment to compact.
          </>
        )}
      </Match>
      <Match when>{used()} in context: compacting keeps replies quick.</Match>
    </Switch>
  );
}
