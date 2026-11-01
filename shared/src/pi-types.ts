// What Bica knows about Pi's data that Pi's own types leave loose: the
// documents a view carries, the fields Bica adds to message blocks, and the
// data of each entry kind it reads.
import type {
  AgentState,
  CompactionReason,
  ConversationView,
  Entry,
  EntryRecord,
  InboxState,
  LiveState,
  TypedEntry,
  UsageState,
} from '@earendil-works/pi-durable';
import type { JsonValue } from '@earendil-works/chord';

declare module '@earendil-works/pi-ai' {
  interface ThinkingContent {
    /** Stamped as it streams (server/src/models/thinking-time.ts) and saved. */
    durationMs?: number;
    /** Projected: the text was left out and loads when the row opens. */
    folded?: boolean;
  }
  interface ToolCall {
    /** Projected: lines a write or edit added and removed. */
    stats?: { added: number; removed: number };
    /** Projected: the model is still writing its arguments. */
    streaming?: boolean;
  }
}

/** The built-in documents Bica reads, which Pi Durable's view leaves untyped. */
export type PiDocs = {
  'pi.live'?: LiveState;
  'pi.agent'?: AgentState;
  'pi.inbox'?: InboxState;
  'pi.usage'?: UsageState;
};

export function piDocs(view: ConversationView) {
  return view.docs as PiDocs;
}

/**
 * An entry kind and the shape of its data, like Pi Durable's `defineEntry`,
 * which the browser can't import without the whole harness.
 */
/** Pi Durable's own compaction entry, as its `CompactionEntry` defines it. */
export const CompactionEntry = entryKind<{ reason: CompactionReason }>(
  'pi.compaction',
);

export function entryKind<D extends JsonValue = never>(kind: string): Entry<D> {
  return {
    kind,
    is: (entry: EntryRecord | undefined): entry is TypedEntry<D> =>
      entry?.kind === kind,
  };
}
