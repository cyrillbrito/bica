// How full a session's context window is, whether the prompt cache is warm,
// and the rules for when to speak up (docs/context-usage.md). The chip, the
// nag above the composer, and housekeeping read this; the details add
// context-breakdown.ts.
import type { Message, Usage } from '@earendil-works/pi-ai';
import {
  calculateContextTokens,
  estimateMessageTokens,
} from '@earendil-works/pi-ai/utils/estimate';
import type { ContextView, ConversationView } from '@earendil-works/pi-durable';

import { piDocs } from './pi-types';
import { PruneEntry, pruneEdits, prunedTokens } from './prune';
import type { ModelCatalog } from './protocol';

export interface ContextUsage {
  /** Tokens in the window: the last request, plus estimates of what came after. */
  used: number;
  /** False: no answer since the start or the last compaction or prune. */
  measured: boolean;
  /** Absent: the model isn't in the catalog. */
  window?: number;
  /** Where Pi Durable compacts before the next request. */
  compactAt?: number;
  /** Where it starts compacting in the background. */
  backgroundAt?: number;
  /** What a compaction keeps as it is, the newest turns. */
  keepRecent?: number;
  /** When the last request went out and how long its cache lives (ms). */
  cache?: { at: number; ttl: number };
  compacting: boolean;
  running: boolean;
  /** Tokens pruning would take off now (shared/src/prune.ts). */
  prunable: number;
}

/** The part of Pi Durable's ContextView the context is measured from. */
export type ModelContext = Pick<ContextView, 'entries' | 'contributions'>;

// Pi Durable leaves these answers out of the model context.
const EXCLUDED = new Set(['aborted', 'error', 'deferred']);

/**
 * What each active entry adds to the model context now, after pruning's
 * edits: Pi Durable's ContextView, worked out from a watched view, since
 * Durable only gives it through an async read.
 */
export function contextOf(view: ConversationView): ModelContext {
  const edits = new Map<number, readonly Message[]>();
  for (const entry of view.entries)
    for (const edit of entry.edits ?? [])
      edits.set(edit.target, edit.action === 'replace' ? edit.messages : []);
  return {
    entries: view.entries,
    contributions: view.entries.map((entry) =>
      (edits.get(entry.id) ?? entry.model ?? []).filter(
        (m) => m.role !== 'assistant' || !EXCLUDED.has(m.stopReason),
      ),
    ),
  };
}

/**
 * Measured as Pi Durable measures it before auto-compacting (its
 * estimateContext): the newest answer's request, plus pi-ai's estimates of
 * the messages after it. Pruning since that answer shrank what it measured.
 */
export function contextUsage(
  view: ConversationView,
  catalog: ModelCatalog | undefined,
): ContextUsage {
  const ctx = contextOf(view);
  // Answers before the head marker (kept entries) measured a context that no
  // longer exists.
  const marker = ctx.entries[0]?.head !== undefined ? ctx.entries[0].id : -1;
  const estimates = ctx.contributions.map((messages) =>
    messages.reduce((n, m) => n + estimateMessageTokens(m), 0),
  );
  const estimated = estimates.reduce((a, b) => a + b, 0);

  let used = 0;
  let measuredAt = -1;
  for (let i = ctx.entries.length - 1; i >= 0 && measuredAt < 0; i--) {
    const messages = ctx.contributions[i]!;
    const at =
      ctx.entries[i]!.id > marker
        ? messages.findLastIndex(
            (m) =>
              m.role === 'assistant' && calculateContextTokens(m.usage) > 0,
          )
        : -1;
    if (at < 0) {
      used += estimates[i]!;
      continue;
    }
    const answer = messages[at] as Extract<Message, { role: 'assistant' }>;
    used += calculateContextTokens(answer.usage);
    for (const m of messages.slice(at + 1)) used += estimateMessageTokens(m);
    measuredAt = i;
  }
  let stale = 0;
  if (measuredAt >= 0)
    for (const entry of ctx.entries.slice(measuredAt + 1)) {
      if (!PruneEntry.is(entry)) continue;
      const freed = entry.data.freed;
      // Older prunes didn't store it: estimate all, as before an answer.
      if (freed === undefined) {
        used = estimated;
        measuredAt = -1;
        break;
      }
      stale += freed;
    }
  used = Math.max(0, used - stale);
  // The estimates miss the provider's own framing and real tokenizer; scaled
  // to the measured size, pruning's saving matches the chip's number.
  const scale = estimated > 0 && measuredAt >= 0 ? used / estimated : 1;
  const prunable = prunedTokens(ctx, pruneEdits(ctx)) * scale;

  const model = piDocs(view)['pi.agent'];
  const info = catalog?.models.find(
    (m) =>
      m.provider === model?.model?.provider && m.id === model?.model?.modelId,
  );
  const window = info?.contextWindow;
  const compactAt =
    window && catalog ? window - catalog.compaction.reserveTokens : undefined;

  // The cache restarts with every request the provider counted, failed ones
  // too, so this reads the raw entries rather than the model context.
  let lastRequest: number | undefined;
  let lastWrite: Usage | undefined;
  for (const entry of view.entries)
    for (const m of entry.model ?? []) {
      if (m.role !== 'assistant') continue;
      if (calculateContextTokens(m.usage) > 0) lastRequest = m.timestamp;
      if (m.usage.cacheWrite > 0) lastWrite = m.usage;
    }
  // The long tier only when the provider reported writing to it.
  const ttl = lastWrite?.cacheWrite1h
    ? info?.cacheTtl.long
    : info?.cacheTtl.short;
  const live = piDocs(view)['pi.live'];

  return {
    used,
    measured: measuredAt >= 0 && stale === 0,
    window,
    compactAt,
    keepRecent: catalog?.compaction.keepRecentTokens,
    backgroundAt:
      compactAt && catalog
        ? compactAt - catalog.compaction.backgroundTokens
        : undefined,
    cache:
      lastRequest !== undefined && lastWrite && ttl
        ? { at: lastRequest, ttl: ttl * 1000 }
        : undefined,
    compacting: !!live?.compactions?.length,
    running: !!live?.run,
    prunable,
  };
}

// The rules the chip, the nag, the details, and housekeeping share.

const MINUTE = 60_000;

// Below this pruning isn't worth offering.
export const MIN_PRUNE = 1000;

// Past 200k a session gets slow, pricey and forgetful, whatever the window.
export const BLOATED = 200_000;

// A long-lived session above this, even after pruning, compacts before its
// cache expires (server/src/sessions/housekeeping.ts). Below it, the
// compaction may cost more than it saves.
export const LONG_LIVED_COMPACT_AT = 120_000;

// The cache's last minutes: an hour is long, so only these get a countdown,
// and they are the cheapest moment to compact.
export const EXPIRING = 10 * MINUTE;

/** 0 below 200k, then one step per 100k, up to 4 at 500k. */
export function bloat(used: number) {
  return used < BLOATED ? 0 : Math.min(4, Math.floor(used / 100_000) - 1);
}

/** The chip's color: how full the window is, or how big the session grew. */
export function level(u: ContextUsage): 'warn' | 'danger' | undefined {
  const share = u.window ? u.used / u.window : 0;
  const steps = bloat(u.used);
  return share >= 0.9 || steps >= 3
    ? 'danger'
    : share >= 0.7 || steps >= 1
      ? 'warn'
      : undefined;
}

/** How long the prompt cache stays warm (ms, 0 or less: cold), if known. */
export function cacheLeft(u: ContextUsage, now: number) {
  return u.cache ? u.cache.at + u.cache.ttl - now : undefined;
}

/**
 * Why Prune can't run now, if it can't. A running agent doesn't block it: the
 * edits land at its next step. A compaction does, since its summary would
 * hide the entries the edits target. The server refuses on this rule too.
 */
export function pruneBlocked(u: Pick<ContextUsage, 'compacting' | 'prunable'>) {
  if (u.compacting) return 'Wait for the compaction to finish';
  if (u.prunable < MIN_PRUNE) return 'No long output past the last few steps';
}

/** Close enough to Pi Durable's auto-compaction to say it is coming. */
export function nearAutoCompact(u: ContextUsage) {
  return !!u.compactAt && u.used >= u.compactAt * 0.85;
}
