import { LiveDoc, type ConversationId } from '@earendil-works/pi-durable';

import { context, getHarness } from '../harness';
import { listSessions } from './store';

// The last run state seen of every session tells when a run ends.
const running = new Map<ConversationId, boolean>();
const listeners = new Set<(id: ConversationId) => void>();
let watching: Promise<void> | undefined;

/** Hears every run that ends, in any session; returns the unsubscribe. */
export function onRunEnd(listener: (id: ConversationId) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * Follows every session's runs for good, from startup, so a run's end is
 * heard with no tab open, after a restart too.
 */
export function watchRuns() {
  return (watching ??= (async () => {
    const harness = await getHarness();
    harness.observeCommits({
      advance: ({ changes }) => {
        for (const change of changes)
          if (change.type === 'document' && change.record.kind === 'pi.live')
            changed(
              change.conversationId,
              change.kind === 'change' && !!change.value.run,
            );
      },
      end: (end) => console.error('[runs] commits ended', end),
    });
    // Runs a restart left unfinished resume; their end must still be heard.
    await Promise.all(
      (await listSessions()).map(async ({ id }) => {
        const conversation = Number(id) as ConversationId;
        const live = await harness.snapshot(LiveDoc, conversation, context);
        if (live?.run && !running.has(conversation))
          running.set(conversation, true);
      }),
    );
  })().catch((error) => {
    watching = undefined;
    throw error;
  }));
}

function changed(id: ConversationId | undefined, run: boolean) {
  if (id === undefined) return;
  const was = running.get(id);
  running.set(id, run);
  if (!run && was) for (const listener of listeners) listener(id);
}
