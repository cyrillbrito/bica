import {
  diffRevisions,
  type JsonValue,
  type Op,
} from '@earendil-works/chord/delta';
import type { ConversationId } from '@earendil-works/pi-durable';

import type { EntriesHeld, ModelCatalog } from '@bica/shared/protocol';
import { context, getHarness } from '../harness';
import {
  projector,
  stepDetail,
  type ProjectedView,
} from '@bica/shared/projection';
import { watchModels } from '../models/models';
import { activeView, readActive, WHOLE_HISTORY } from './active-view';
import { saveImage } from './attachments';

/**
 * The conversation's view now, then the ops of every commit that changes it;
 * both slimmed by shared/src/projection.ts.
 */
export async function watchConversation(
  id: string,
  sink: {
    snapshot: (view: ProjectedView | null, kept?: number) => void;
    changes: (ops: readonly Op[]) => void;
  },
  have?: EntriesHeld,
) {
  const conversationId = Number(id);
  const conversation = Number.isInteger(conversationId)
    ? await (
        await getHarness()
      ).conversation(conversationId as ConversationId, context)
    : undefined;
  if (!conversation) {
    sink.snapshot(null);
    return () => {};
  }
  let catalog: ModelCatalog | undefined;
  const unwatchModels = await watchModels((c) => (catalog = c));
  const project = projector(() => catalog, saveImage);
  const watch = await conversation.watch(context, WHOLE_HISTORY);
  let sent = project(activeView(watch.value));
  const kept = keptEntries(sent.entries, have);
  sink.snapshot(
    kept ? { ...sent, entries: sent.entries.slice(kept) } : sent,
    kept || undefined,
  );
  // The commit's own ops would carry what the projection leaves out, so the
  // browser gets the difference between two projections instead.
  watch.start(async (call) => {
    if (call.kind !== 'value') return;
    try {
      const next = project(activeView(call.value));
      const ops = diffRevisions(
        sent as unknown as JsonValue,
        next as unknown as JsonValue,
      );
      sent = next;
      if (ops.length) sink.changes(ops);
    } catch (error) {
      console.error('[conversation]', error);
    }
  });
  return () => {
    unwatchModels();
    void watch.stop();
  };
}

/** What an opened transcript row shows (shared/src/projection.ts). */
export async function conversationDetail(id: string, key: string) {
  const conversation = await (
    await getHarness()
  ).conversation(Number(id) as ConversationId, context);
  if (!conversation) return null;
  return stepDetail(await readActive(conversation), key);
}

// Entries never change once saved, and the active ones run in id order from
// the head marker, so matching ids at both ends mean the browser's copy is
// the same prefix. A compaction moves the head, and the first id stops
// matching.
function keptEntries(
  entries: ProjectedView['entries'],
  have: EntriesHeld | undefined,
) {
  if (!have || have.count < 1 || have.count > entries.length) return 0;
  return entries[0]?.id === have.first &&
    entries[have.count - 1]?.id === have.last
    ? have.count
    : 0;
}
