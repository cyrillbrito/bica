// Compacting and pruning a session's context, for every button that offers
// them: the chip's menu, the nag, the field, and the details (docs/context-usage.md).
import { createSignal } from 'solid-js';

import { pruneBlocked, type ContextUsage } from '@bica/shared/context-usage';
import { request } from '../socket/socket';
import { formatTokens } from '../ui/format';

// Prunes and compactions asked for in this tab whose request hasn't returned,
// as `prune:<id>` and `compact:<id>`, so every button shows the same state.
const [asked, setAsked] = createSignal<ReadonlySet<string>>(new Set(), {
  name: 'contextAsked',
});

async function once(key: string, work: () => Promise<unknown>) {
  if (asked().has(key)) return;
  setAsked((s) => new Set(s).add(key));
  try {
    await work();
  } finally {
    setAsked((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  }
}

/** Pruning asked for here that hasn't landed yet. */
export function isPruning(id: string) {
  return asked().has(`prune:${id}`);
}

/** A compaction running, or asked for here and not started yet. */
export function isCompacting(id: string, usage: ContextUsage) {
  return usage.compacting || asked().has(`compact:${id}`);
}

/** Why Prune can't run now (pruneBlocked), counting what this tab asked for. */
export function pruneUnavailable(id: string, usage: ContextUsage) {
  if (isPruning(id)) return 'Already pruning';
  return pruneBlocked({ ...usage, compacting: isCompacting(id, usage) });
}

/** Why Compact can't run now: one at a time, and not over a prune landing. */
export function compactUnavailable(id: string, usage: ContextUsage) {
  if (isCompacting(id, usage)) return 'Already compacting';
  if (isPruning(id)) return 'Wait for the prune to finish';
}

/** What Compact does, in one sentence for its button. */
export function compactHint(usage: ContextUsage) {
  const kept = usage.keepRecent
    ? `, and keeps the last ~${formatTokens(usage.keepRecent)} as they are`
    : '';
  return `A model summarizes the older part of the session${kept}, so the next prompt sends far less. The transcript keeps everything.`;
}

export function compactSession(id: string, instructions?: string) {
  return once(`compact:${id}`, () =>
    request('session.compact', { id, instructions }),
  );
}

export function pruneSession(id: string) {
  return once(`prune:${id}`, () => request('session.cleanup', { id }));
}
