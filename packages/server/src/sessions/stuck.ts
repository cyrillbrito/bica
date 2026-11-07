import type {
  ConversationId,
  Harness,
  TaskGraph,
  TaskId,
} from '@earendil-works/pi-durable';

import type { Stuck } from '@bica/shared/protocol';
import { context, getHarness } from '../harness';

// Work Pi Durable won't run: parked after it was cut off by crashes again and
// again, or left without its code, as by a removed extension. Its session
// would look busy for good, so the row says why. Keyed by the session the
// work is for: a subagent's goes to the session whose tool started it.
let stuck = new Map<ConversationId, { why: Stuck; tasks: TaskId[] }>();

/** Follows the task graph for good; `changed` gets the sessions whose state moved. */
export async function watchStuck(
  harness: Harness,
  changed: (ids: ConversationId[]) => void,
) {
  const watch = await harness.watchTaskGraph(context);
  const update = (graph: TaskGraph) => {
    const next = find(graph);
    const ids = new Set([...stuck.keys(), ...next.keys()]);
    const moved = [...ids].filter(
      (id) => JSON.stringify(stuck.get(id)) !== JSON.stringify(next.get(id)),
    );
    stuck = next;
    if (moved.length) changed(moved);
  };
  update(watch.value);
  watch.start(async (graph) => update(graph));
  void watch.closed.then((end) => console.error('[stuck] watch ended', end));
}

function find(graph: TaskGraph) {
  const nodes = Object.values(graph.tasks);
  const ownerOf = new Map<ConversationId, TaskId>();
  for (const node of nodes)
    for (const owned of node.conversations) ownerOf.set(owned, node.id);
  const sessionOf = (id: ConversationId) => {
    for (let owner = ownerOf.get(id); owner !== undefined;) {
      const node = graph.tasks[String(owner)];
      if (!node) break;
      id = node.conversationId;
      owner = ownerOf.get(id);
    }
    return id;
  };
  const found = new Map<ConversationId, { why: Stuck; tasks: TaskId[] }>();
  for (const node of nodes) {
    if (!node.blocked) continue;
    const id = sessionOf(node.conversationId);
    const entry = found.get(id) ?? { why: 'crashed' as Stuck, tasks: [] };
    if (node.blocked !== 'restart_limit') entry.why = 'missing';
    entry.tasks.push(node.id);
    found.set(id, entry);
  }
  return found;
}

export function stuckOf(id: ConversationId) {
  return stuck.get(id)?.why ?? null;
}

/** Runs the session's parked work again; work without its code stays stuck. */
export async function retryStuck(id: string) {
  const harness = await getHarness();
  for (const task of stuck.get(Number(id) as ConversationId)?.tasks ?? [])
    await harness.retryTask(task, context);
}
