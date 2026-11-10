import type {
  Conversation,
  ConversationView,
} from '@earendil-works/pi-durable';

import { context } from '../harness';

/** Pi's view holds only the newest entries by default; this holds them all. */
export const WHOLE_HISTORY = { min: 1_000_000_000 };

/**
 * The view with only its active transcript: the newest head marker, such as
 * a compaction summary, then the entries from its head on. The transcript,
 * the status, and the context meter show what the model reads now.
 */
export function activeView(view: ConversationView): ConversationView {
  const marker = view.entries.findLast((e) => e.head !== undefined);
  if (!marker) return view;
  const kept = view.entries.filter(
    (e) => e.head === undefined && e.id >= marker.head!,
  );
  return { ...view, entries: [marker, ...kept] };
}

/** The active view once, for a read that doesn't follow it. */
export async function readActive(conversation: Conversation) {
  const watch = await conversation.watch(context, WHOLE_HISTORY);
  void watch.stop();
  return activeView(watch.value);
}
