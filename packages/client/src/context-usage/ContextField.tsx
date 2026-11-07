import {
  For,
  Repeat,
  Show,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';

import { PRUNE_HINT } from '@bica/shared/prune';
import type { ContextBreakdown, Part } from '@bica/shared/context-breakdown';
import {
  level,
  nearAutoCompact,
  type ContextUsage,
} from '@bica/shared/context-usage';
import { formatTokens } from '../ui/format';
import {
  pruneSession,
  compactSession,
  isCompacting,
  isPruning,
  pruneUnavailable,
  compactHint,
  compactUnavailable,
} from './context-usage';
import { toast } from '../ui/Toast';
import { buttonClass } from '../ui/Button';
import Chevron from '../ui/Chevron';
import { PruneIcon, CompactIcon, DrawnCheckIcon } from '../ui/icons';
import { Spinner } from '../ui/Spinner';
import { RollingNumber } from '../ui/RollingNumber';

// What the field shows, in the order it fills. Tool output is its own kind
// because it's what pruning clears.
type Kind = 'system' | 'tools' | 'talk' | 'output';
const KINDS: Kind[] = ['system', 'tools', 'talk', 'output'];

const LABEL: Record<Kind, string> = {
  system: 'System prompt',
  tools: 'Tools',
  talk: 'Conversation',
  output: 'Tool output',
};

// Shape as well as color: every row repeats its label next to the swatch.
const FILL: Record<Kind | 'free' | 'reserve', string> = {
  system: 'bg-fg',
  tools: 'bg-fg/40',
  talk: 'bg-accent',
  output: 'bg-accent/45',
  free: 'bg-active',
  // Room the model keeps for its answer: auto-compaction starts here.
  reserve: 'border border-line-strong',
};

function kindOf(p: Part): Kind {
  return p.group === 'conversation'
    ? p.key.startsWith('result:')
      ? 'output'
      : 'talk'
    : p.group;
}

// 240 divides into rows of 40 (desktop) and 24 (phone).
const CELLS = 240;

type Cell = { kind: Kind | 'free' | 'reserve'; part?: string; clean?: true };
type Hot = { kind: Kind } | { part: string; kind: Kind } | { clean: true };

/**
 * What fills the context, as a field of cells, after affectUI's Context
 * Window: point at a part to light up its cells, compact or prune from
 * its row while the cells breathe, and watch them clear.
 */
export default function ContextField(props: {
  id: string;
  usage: ContextUsage & ContextBreakdown;
}) {
  const u = () => props.usage;
  const total = () => Math.max(u().window ?? 0, u().used, 1);
  const reserve = () =>
    u().window && u().compactAt ? u().window! - u().compactAt! : 0;

  const byKind = createMemo(
    () => {
      const parts = new Map<Kind, Part[]>(KINDS.map((k) => [k, []]));
      for (const p of u().parts) parts.get(kindOf(p))!.push(p);
      return KINDS.map((kind) => {
        const list = parts.get(kind)!;
        return {
          kind,
          parts: list,
          tokens: list.reduce((n, p) => n + p.tokens, 0),
        };
      }).filter((k) => k.tokens > 0);
    },
    { name: 'contextKinds' },
  );

  // Each part takes its share of cells, at least one, rounded on the running
  // total so the parts never drift past the window.
  const cells = createMemo(
    () => {
      const per = total() / CELLS;
      const out: Cell[] = [];
      let sum = 0;
      for (const k of byKind())
        for (const p of k.parts) {
          sum += p.tokens;
          const end = Math.min(
            CELLS,
            Math.max(out.length + 1, Math.round(sum / per)),
          );
          while (out.length < end) out.push({ kind: k.kind, part: p.key });
        }
      // The oldest output goes first; mark that many cells from the start.
      let clean = Math.round(u().prunable / per);
      for (const c of out)
        if (clean > 0 && c.kind === 'output') {
          c.clean = true;
          clean--;
        }
      const reserved = CELLS - Math.round(reserve() / per);
      while (out.length < CELLS)
        out.push({ kind: out.length >= reserved ? 'reserve' : 'free' });
      return out;
    },
    { name: 'contextCells' },
  );

  const [hot, setHot] = createSignal<Hot | null>(null, { name: 'contextHot' });
  const [open, setOpen] = createSignal<Kind | null>(null, {
    name: 'contextOpen',
  });
  const pruning = () => isPruning(props.id);
  const compacting = () => isCompacting(props.id, u());
  // What just finished while watching, for a moment: the check and the line.
  const [done, setDone] = createSignal<
    { what: 'compact' | 'clean'; saved: number } | undefined
  >(undefined, { name: 'contextDone' });
  let doneTimer: ReturnType<typeof setTimeout> | undefined;
  const finish = (what: 'compact' | 'clean', saved: number) => {
    clearTimeout(doneTimer);
    setDone({ what, saved });
    doneTimer = setTimeout(() => setDone(undefined), 4000);
  };

  let before = 0;
  createEffect(
    () => ({ now: u().compacting, used: u().used }),
    ({ now, used }, prev) => {
      if (now) {
        if (!prev?.now) before = used;
      } else if (prev?.now) finish('compact', Math.max(0, before - used));
    },
    { name: 'contextCompactDone' },
  );

  const lit = (c: Cell) => {
    const h = hot();
    if (!h) return false;
    if ('clean' in h) return !!c.clean;
    if ('part' in h) return c.part === h.part;
    return c.kind === h.kind;
  };
  const busy = (c: Cell) =>
    (compacting() && (c.kind === 'talk' || c.kind === 'output')) ||
    (pruning() && !!c.clean);

  const hotTokens = () => {
    const h = hot();
    if (!h) return u().used;
    if ('clean' in h) return u().prunable;
    if ('part' in h)
      return u().parts.find((p) => p.key === h.part)?.tokens ?? 0;
    return byKind().find((k) => k.kind === h.kind)?.tokens ?? 0;
  };
  const hotLabel = () => {
    const h = hot();
    if (!h) return undefined;
    if ('clean' in h) return 'Pruning clears';
    if ('part' in h) return u().parts.find((p) => p.key === h.part)?.label;
    return LABEL[h.kind];
  };
  const hotPart = () => {
    const h = hot();
    return h && 'part' in h ? h.part : undefined;
  };
  const tone = () => level(u());

  const caption = () => {
    const d = done();
    if (d?.saved)
      return {
        text: `${d.what === 'compact' ? 'Compacted' : 'Pruned'}: ${formatTokens(d.saved)} tokens freed`,
        tone: 'ok' as const,
      };
    if (compacting()) return { text: 'Summarizing older turns…' };
    if (pruning()) return { text: 'Clearing old tool output…' };
    const at = u().compactAt;
    if (!at) return { text: `${formatTokens(u().used)} tokens in the window` };
    const left = at - u().used;
    if (left <= 0)
      return { text: 'Past the auto-compact point', tone: 'danger' as const };
    if (nearAutoCompact(u()))
      return {
        text: `${formatTokens(left)} left before it auto-compacts`,
        tone: 'warn' as const,
      };
    return { text: `Auto-compacts at ${formatTokens(at)}` };
  };

  const compact = () =>
    void compactSession(props.id).catch((e) => toast.error(e));
  const prune = () => {
    const saved = u().prunable;
    void pruneSession(props.id)
      .then(() => finish('clean', saved))
      .catch((e) => toast.error(e));
  };
  const cleanBlocked = () => pruneUnavailable(props.id, u());

  return (
    <section class="flex flex-col" aria-label="Context window">
      <div class="rounded-sheet border border-line bg-surface px-3.5 pt-3 pb-2">
        <div class="flex items-baseline gap-2" aria-hidden="true">
          <RollingNumber
            value={hotTokens()}
            format={formatTokens}
            class="text-display font-semibold"
          />
          <span class="min-w-0 flex-1 truncate text-muted">
            {hotLabel() ??
              (u().window ? `of ${formatTokens(u().window!)}` : 'tokens')}
          </span>
          <Show when={u().window}>
            <span
              class={[
                'shrink-0 font-medium tabular-nums transition-colors duration-300',
                hot()
                  ? 'text-muted'
                  : tone() === 'danger'
                    ? 'text-danger-ink'
                    : tone() === 'warn'
                      ? 'text-warn-ink'
                      : 'text-muted',
              ]}
            >
              {percent(hotTokens(), u().window!)}
            </span>
          </Show>
        </div>
        <p class="sr-only">
          {formatTokens(u().used)}
          {u().window
            ? ` of ${formatTokens(u().window!)} tokens used, ${percent(u().used, u().window!)}`
            : ' tokens used'}
        </p>
        <div
          class="group/field mt-2.5 grid grid-cols-40 gap-0.5 max-md:grid-cols-24"
          data-hot={hot() ? '' : undefined}
          aria-hidden="true"
          onPointerOver={(e) => {
            const i = (e.target as HTMLElement).dataset.i;
            const c = i === undefined ? undefined : cells()[Number(i)];
            setHot(c?.part ? { kind: c.kind as Kind } : null);
          }}
          onPointerLeave={() => setHot(null)}
        >
          <Repeat count={CELLS}>
            {(i) => (
              <span
                data-i={i}
                class={[
                  'cell aspect-square',
                  FILL[cells()[i]!.kind],
                  'group-data-hot/field:not-data-on:opacity-20 data-on:motion-safe:scale-115',
                ]}
                style={{ '--i': i }}
                data-on={lit(cells()[i]!) || undefined}
                data-busy={busy(cells()[i]!) || undefined}
              />
            )}
          </Repeat>
        </div>
        <ul class="mt-2 flex flex-col" onPointerLeave={() => setHot(null)}>
          <For each={byKind()} keyed={(k) => k.kind}>
            {(k) => {
              const isOpen = () => open() === k().kind;
              const dim = () => {
                const h = hot();
                return !!h && !('clean' in h) && h.kind !== k().kind;
              };
              return (
                <li
                  class={[
                    '-mx-2 rounded-lg px-2 transition-[background-color,opacity] duration-150',
                    hot() && !dim() && !('clean' in hot()!) && 'bg-hover',
                    dim() && 'opacity-55',
                  ]}
                  onPointerEnter={() => setHot({ kind: k().kind })}
                  onFocusIn={() => setHot({ kind: k().kind })}
                  onFocusOut={() => setHot(null)}
                >
                  <div class="flex min-h-8 items-center gap-2 touch:min-h-11">
                    <button
                      type="button"
                      class="flex min-w-0 flex-1 items-center gap-2.5 self-stretch rounded-md text-left"
                      aria-expanded={isOpen() ? 'true' : 'false'}
                      onClick={() => setOpen(isOpen() ? null : k().kind)}
                    >
                      <span
                        class={['size-2 shrink-0 rounded-cell', FILL[k().kind]]}
                      />
                      <span class="truncate">{LABEL[k().kind]}</span>
                      <Chevron open={isOpen()} class="text-muted" />
                    </button>
                    <Show when={k().kind === 'talk'}>
                      <Action
                        state={
                          compacting()
                            ? 'busy'
                            : done()?.what === 'compact'
                              ? 'done'
                              : 'idle'
                        }
                        icon={<CompactIcon />}
                        labels={['Compact', 'Compacting', 'Compacted']}
                        title={
                          compactUnavailable(props.id, u()) ?? compactHint(u())
                        }
                        disabled={
                          !compacting() && !!compactUnavailable(props.id, u())
                        }
                        onClick={compact}
                      />
                    </Show>
                    <Show when={k().kind === 'output'}>
                      <Action
                        state={
                          pruning()
                            ? 'busy'
                            : done()?.what === 'clean'
                              ? 'done'
                              : 'idle'
                        }
                        icon={<PruneIcon />}
                        labels={['Prune', 'Pruning', 'Pruned']}
                        title={
                          cleanBlocked() ??
                          `${PRUNE_HINT} Frees ~${formatTokens(u().prunable)}.`
                        }
                        disabled={!!cleanBlocked()}
                        onClick={prune}
                        onHover={(on) =>
                          setHot(on ? { clean: true } : { kind: 'output' })
                        }
                      />
                    </Show>
                    <Amount tokens={k().tokens} of={u().used} />
                  </div>
                  <div
                    class="fold"
                    data-open={isOpen() || undefined}
                    inert={!isOpen()}
                  >
                    <div>
                      <ul class="flex flex-col pb-1.5 pl-4.5">
                        <For each={k().parts} keyed={(p) => p.key}>
                          {(p) => (
                            <li
                              class={[
                                'flex min-h-7 items-center gap-2 rounded-md text-muted transition-colors',
                                hotPart() &&
                                  hotPart() !== p().key &&
                                  'opacity-60',
                              ]}
                              onPointerEnter={() =>
                                setHot({ kind: k().kind, part: p().key })
                              }
                              onPointerLeave={() => setHot({ kind: k().kind })}
                            >
                              <span class="min-w-0 flex-1">
                                <span class="block truncate">{p().label}</span>
                                <Show when={p().detail}>
                                  {(detail) => (
                                    <span class="block pb-1 text-meta">
                                      {detail()}
                                    </span>
                                  )}
                                </Show>
                              </span>
                              <Amount tokens={p().tokens} of={u().used} />
                            </li>
                          )}
                        </For>
                      </ul>
                    </div>
                  </div>
                </li>
              );
            }}
          </For>
        </ul>
      </div>
      <div class="flex min-h-9 items-center gap-2 px-3 pt-1 text-meta tabular-nums">
        <span class="min-w-0 flex-1 truncate" aria-live="polite">
          <For each={[caption()]} keyed={(c) => c.text}>
            {(c) => (
              <span
                class={[
                  'block truncate appear',
                  c().tone === 'ok'
                    ? 'text-running-ink'
                    : c().tone === 'warn'
                      ? 'text-warn-ink'
                      : c().tone === 'danger'
                        ? 'text-danger-ink'
                        : 'text-muted',
                ]}
              >
                {c().text}
              </span>
            )}
          </For>
        </span>
        <Show when={reserve()}>
          <span class="flex shrink-0 items-center gap-1.5 text-muted">
            <span class={['size-2 rounded-cell', FILL.reserve]} />
            Reserved
          </span>
        </Show>
        <Show when={!u().measured}>
          <span class="shrink-0 text-muted">Estimated</span>
        </Show>
      </div>
    </section>
  );
}

/** A row's action: idle, busy with a spinner, then a drawn check for a moment. */
function Action(props: {
  state: 'idle' | 'busy' | 'done';
  icon: import('@solidjs/web').JSX.Element;
  labels: [idle: string, busy: string, done: string];
  title: string;
  disabled?: boolean;
  onClick: () => void;
  onHover?: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      class={[
        buttonClass({ size: 'sm' }),
        '-mr-1 max-md:px-1.5',
        props.state === 'done' && 'text-running-ink',
        props.state === 'busy' && 'text-fg',
      ]}
      title={props.title}
      // Busy and done stay lit, not greyed out like a blocked action.
      disabled={props.disabled && props.state === 'idle'}
      aria-disabled={props.state !== 'idle' ? 'true' : undefined}
      onClick={() => props.state === 'idle' && props.onClick()}
      onPointerEnter={() => props.onHover?.(true)}
      onPointerLeave={() => props.onHover?.(false)}
    >
      <For each={[props.state]}>
        {(s) => (
          <>
            <span class={['inline-flex', s !== 'idle' && 'swap-in']}>
              {s === 'busy' ? (
                <Spinner />
              ) : s === 'done' ? (
                <DrawnCheckIcon />
              ) : (
                props.icon
              )}
            </span>
            <span class={[s !== 'idle' && 'appear', 'max-[22rem]:sr-only']}>
              {props.labels[s === 'idle' ? 0 : s === 'busy' ? 1 : 2]}
            </span>
          </>
        )}
      </For>
    </button>
  );
}

/** Tokens and share, in fixed columns so rows line up. */
function Amount(props: { tokens: number; of: number }) {
  return (
    <>
      <span class="w-12 shrink-0 text-right text-fg tabular-nums">
        {formatTokens(props.tokens)}
      </span>
      <span class="w-9 shrink-0 text-right text-meta text-muted tabular-nums">
        {percent(props.tokens, props.of)}
      </span>
    </>
  );
}

export function percent(part: number, whole: number) {
  const p = (part / whole) * 100;
  return `${p > 0 && p < 1 ? '<1' : Math.round(p)}%`;
}
