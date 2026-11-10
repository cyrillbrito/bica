import type {
  ConversationId,
  Harness,
  TaskGraph,
} from '@earendil-works/pi-durable';

import { context } from '../harness';

// Work Pi Durable won't run because its code is gone, as with a removed
// extension. Its session would look busy for good, so the row says why.
// Keyed by the session the work is for: a subagent's goes to the session
// whose tool started it.
let stuck = new Set<ConversationId>();

/** Follows the task graph for good; `changed` gets the sessions whose state moved. */
export async function watchStuck(
  harness: Harness,
  changed: (ids: ConversationId[]) => void,
) {
  const watch = await harness.watchTaskGraph(context);
  const update = (graph: TaskGraph) => {
    const next = find(graph);
    const moved = [...new Set([...stuck, ...next])].filter(
      (id) => stuck.has(id) !== next.has(id),
    );
    stuck = next;
    if (moved.length) changed(moved);
  };
  update(watch.value);
  watch.start(async (call) => {
    if (call.kind === 'value') update(call.value);
  });
  void watch.closed.then((end) => console.error('[stuck] watch ended', end));
}

function find(graph: TaskGraph) {
  const nodes = Object.values(graph.tasks);
  const ownerOf = new Map<ConversationId, ConversationId>();
  for (const node of nodes)
    for (const owned of node.conversations)
      ownerOf.set(owned, node.conversationId);
  const sessionOf = (id: ConversationId) => {
    const seen = new Set<ConversationId>();
    for (
      let owner = ownerOf.get(id);
      owner !== undefined && !seen.has(owner);
    ) {
      seen.add(owner);
      id = owner;
      owner = ownerOf.get(id);
    }
    return id;
  };
  const found = new Set<ConversationId>();
  for (const node of nodes)
    if (node.blocked) found.add(sessionOf(node.conversationId));
  return found;
}

export function isStuck(id: ConversationId) {
  return stuck.has(id);
}
