import {
  CompactionEntry,
  type ConversationId,
} from '@earendil-works/pi-durable';

import {
  BLOATED,
  LONG_LIVED_COMPACT_AT,
  contextUsage,
  pruneBlocked,
} from '@bica/shared/context-usage';
import { isLongLived } from '@bica/shared/agents';
import { SentEntry } from '@bica/shared/transcript';
import { context, getHarness } from '../harness';
import { getCatalog } from '../models/models';
import { readActive } from './active-view';
import { markSeen } from './meta';
import { pruneContext, compact, submit } from './prompts';
import { listSessions } from './store';

// Housekeeping: Bica keeps long-lived sessions, assistant mode
// (docs/assistant-mode.md) and the hub (docs/hub.md), small while they sit
// idle. Pruning runs once the cache is cold, when it is free. The memory
// save and compaction call the model, so they run just before the cache expires, while reading
// it is still cheap.

const MINUTE = 60_000;
const WARM_MARGIN = 5 * MINUTE;

const SAVE_NOTE = 'Memory save:';
const SAVE_PROMPT = `${SAVE_NOTE} this session is about to be compacted, and older turns will shrink to a summary. Save what should outlast it to the memory files, as your memory rules and the project's instructions say. Look for what was said but never written down. Then reply with one line. Start nothing else.`;

// Taelin's compaction rules (OptChat), trimmed.
const SUMMARY_RULES = `This is a long-lived session. Keep the user's words close to verbatim: orders, decisions, corrections, preferences, and their reasons. Then what has lasting effect, and what failed and why. Copy names, numbers, ids, paths, and errors exactly. Name a minor item in a few words rather than drop it. Never make work look further along than it was. The memory files hold the long-term record: name the ones that matter instead of repeating them.`;

const busy = new Set<string>();
// Memory saves whose compaction was tried again, so a failing one can't loop.
const retried = new Set<string>();

/** Checks long-lived sessions every minute. */
export function startHousekeeping() {
  Bun.cron('* * * * *', housekeepAll);
}

async function housekeepAll() {
  const sessions = await listSessions().catch(() => []);
  for (const s of sessions)
    if (isLongLived(s.agent) && !s.archivedAt && !busy.has(s.id)) {
      busy.add(s.id);
      void housekeep(s.id, s.status === 'done')
        .catch((error) => console.error('[housekeeping]', error))
        .finally(() => busy.delete(s.id));
    }
}

async function housekeep(id: string, unread: boolean) {
  const conversation = await (
    await getHarness()
  ).conversation(Number(id) as ConversationId, context);
  if (!conversation) return;
  const view = await readActive(conversation);
  const usage = contextUsage(view, await getCatalog());
  // No cache lifetime known (not Anthropic): no clock to plan around.
  if (usage.running || usage.compacting || !usage.cache) return;
  const idle = Date.now() - usage.cache.at;

  // Decided on the size after pruning: cleared often enough, it frees
  // nothing, and only compaction helps.
  const size = usage.used - usage.prunable;
  if (size > LONG_LIVED_COMPACT_AT) {
    // Past BLOATED, at the first idle minute: reads cost enough, and quality
    // drops, so waiting for a long pause isn't worth it.
    if (size <= BLOATED && idle < usage.cache.ttl - WARM_MARGIN) return;
    const at = view.entries.findLastIndex(
      (e) => e.kind === 'pi.user' || SentEntry.is(e),
    );
    const save = view.entries[at];
    if (SentEntry.is(save) && save.data.text.startsWith(SAVE_NOTE)) {
      // Compacted since, with nothing new: compacting again would loop
      // hourly. Not compacted: a restart or an error cut in after the save.
      const done = view.entries
        .slice(at + 1)
        .some((e) => CompactionEntry.is(e));
      if (done || retried.has(String(save.id))) return;
      retried.add(String(save.id));
    } else {
      await submit(id, SAVE_PROMPT, [], `memory:${Date.now()}`, 'bica');
      await conversation.waitForIdle(context);
    }
    await compact(id, SUMMARY_RULES);
    // The save is bookkeeping, not news: a read session stays read.
    if (!unread) await markSeen(id);
  } else if (idle >= usage.cache.ttl && !pruneBlocked(usage))
    await pruneContext(id);
}
