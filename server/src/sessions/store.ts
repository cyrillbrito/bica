import {
  AgentDoc,
  CompactionEntry,
  type CommitChange,
  type ConversationId,
  type Cursor,
  LiveDoc,
  type LiveState,
  type SubmissionId,
  UsageDoc,
  type UsageState,
} from '@earendil-works/pi-durable';

import type { SessionSummary } from '@bica/shared/protocol';
import { isBusy } from '@bica/shared/status';
import { isTurn, statusOf } from '@bica/shared/transcript';
import { context, getHarness } from '../harness';
import { live } from '../live';
import {
  SessionDoc,
  type SessionMeta,
  agentIdOf,
  parentOf,
} from './session-doc';
import { isStuck, watchStuck } from './stuck';

export { SessionDoc, agentIdOf, parentOf };

// Summaries by conversation, kept between reads. Every commit marks the
// conversations it touched; a read re-summarizes only those.
const summaries = new Map<ConversationId, SessionSummary>();
// Owned conversations are subagents; they belong under their tool call.
const subagents = new Set<ConversationId>();
const dirty = new Set<ConversationId>();
// When each running run began, by its first input: found once per run.
const runStarts = new Map<
  ConversationId,
  { input?: SubmissionId; at: number }
>();
let loaded: Promise<void> | undefined;

/**
 * Listens to commits for good, then marks every session dirty once.
 * Pi Durable has no watch over all conversations; streaming commits every
 * ~100 ms, hence the throttle.
 */
export function load() {
  return (loaded ??= (async () => {
    const harness = await getHarness();
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    harness.observeCommits({
      advance: ({ changes }) => {
        for (const change of changes) {
          const id = touched(change);
          if (id !== undefined) dirty.add(id);
          // Automatic ones too. The prompt cache starts over anyway, so the next
          // prompt takes a fresh memory index and project list (prompts.ts).
          if (
            change.type === 'entry' &&
            CompactionEntry.is(change.value) &&
            !subagents.has(change.value.conversationId)
          )
            void editSession(change.value.conversationId, (meta) => {
              delete meta.memory;
              delete meta.projects;
            }).catch((error) => console.error('[sessions]', error));
        }
        scheduled ??= setTimeout(() => {
          scheduled = undefined;
          void sessions.refresh();
        }, 250);
      },
      end: (end) => console.error('[sessions] commits ended', end),
    });
    await watchStuck(harness, (ids) => {
      for (const id of ids) dirty.add(id);
      void sessions.refresh();
    });
    for (const id of await allConversations()) dirty.add(id);
  })().catch((error) => {
    loaded = undefined;
    throw error;
  }));
}

export async function listSessions(): Promise<SessionSummary[]> {
  await load();
  const ids = [...dirty];
  dirty.clear();
  try {
    await Promise.all(
      ids.map(async (id) => {
        const s = await summarize(id);
        if (s) summaries.set(id, s);
        else summaries.delete(id);
      }),
    );
  } catch (error) {
    for (const id of ids) dirty.add(id);
    throw error;
  }
  // Creation order: rows don't jump around while agents work.
  return [...summaries.values()].sort((a, b) => b.createdAt - a.createdAt);
}

async function allConversations() {
  const harness = await getHarness();
  const ids: ConversationId[] = [];
  let cursor: Cursor | undefined;
  do {
    const page = await harness.commit(
      (tx) => tx.scanConversations({}, 500, cursor),
      context,
    );
    for (const c of page.items)
      if (c.owner) subagents.add(c.id);
      else ids.push(c.id);
    cursor = page.next;
  } while (cursor);
  return ids;
}

/** One session's row; undefined for subagents and missing conversations. */
export async function summarize(
  id: ConversationId,
): Promise<SessionSummary | undefined> {
  if (subagents.has(id)) return undefined;
  const harness = await getHarness();
  if (!(await harness.conversation(id, context))) return undefined;
  const [meta, live, agent, newest, usage] = await Promise.all([
    sessionMeta(id),
    harness.snapshot(LiveDoc, id, context),
    harness.snapshot(AgentDoc, id, context),
    newestTurn(id),
    harness.snapshot(UsageDoc, id, context),
  ]);
  const createdAt = meta?.createdAt ?? 0;
  let status = statusOf(live, newest);
  const stuck = isStuck(id);
  // Its run would look busy for good.
  if (stuck && isBusy(status)) status = 'error';
  if (
    status === 'idle' &&
    newest &&
    newest.id > (meta?.seenEntry ?? Infinity) &&
    newest.model?.at(-1)?.role !== 'user'
  )
    status = 'done';
  return {
    id: String(id),
    // Empty while the model is still naming it; the UI shows a quiet ellipsis.
    title: meta?.title ?? '',
    status,
    createdAt,
    updatedAt: Math.max(createdAt, newest?.model?.at(-1)?.timestamp ?? 0),
    runningSince: await runningSince(id, live),
    projectId: meta?.projectId ?? null,
    cwd: agent?.cwd ?? null,
    archivedAt: meta?.archivedAt || null,
    forkedFrom: meta?.forkedFrom ?? null,
    forkedAt: meta?.forkedAt ?? null,
    startedBy: meta?.startedBy || null,
    parent: parentOf(meta),
    handoffs: meta?.handoffs ?? [],
    watchedBy: meta?.watchedBy ?? [],
    cleanedUp: meta?.cleanedUp ?? null,
    agent: agentIdOf(meta),
    voice: meta?.voice ?? null,
    tonight: meta?.tonight || null,
    stuck,
    cost: costOf(usage),
  };
}

/** Dollars spent at list prices, by models and tools both. */
function costOf(usage?: UsageState) {
  let total = 0;
  for (const u of Object.values(usage?.models ?? {})) total += u.cost.total;
  for (const u of Object.values(usage?.tools ?? {})) total += u.cost.total;
  return total;
}

async function runningSince(id: ConversationId, live?: LiveState) {
  if (!live?.run) {
    runStarts.delete(id);
    return null;
  }
  const input = live.run.inputs[0];
  const known = runStarts.get(id);
  if (known && known.input === input) return known.at;
  const at = await runStart(id);
  runStarts.set(id, { input, at });
  return at;
}

/**
 * The time of the running run's first entry: the oldest one after the last
 * answer that ended a run. Steers join the run, so they don't move it.
 */
async function runStart(id: ConversationId) {
  const conversation = await (await getHarness()).conversation(id, context);
  let start = Date.now();
  let cursor: Cursor | undefined;
  do {
    const page = await conversation?.entries({}, 100, cursor, context);
    if (!page) break;
    for (const entry of page.items) {
      if (!isTurn(entry)) continue;
      const last = entry.model?.at(-1);
      if (last?.role === 'assistant' && last.stopReason !== 'toolUse')
        return start;
      start = entry.model?.[0]?.timestamp ?? start;
    }
    cursor = page.next;
  } while (cursor);
  return start;
}

/** The conversation a commit change belongs to, if any. */
function touched(change: CommitChange) {
  if (change.type === 'document') return change.conversationId;
  if (change.type === 'conversation') {
    if (change.value.owner) subagents.add(change.value.id);
    return change.value.id;
  }
  if (change.type === 'entry') return change.value.conversationId;
  return undefined;
}

export async function newestEntry(id: ConversationId) {
  const conversation = await (await getHarness()).conversation(id, context);
  return (await conversation?.entries({}, 1, undefined, context))?.items[0];
}

/** The newest entry from the agent or a prompt: voice lines don't set the status. */
async function newestTurn(id: ConversationId) {
  const conversation = await (await getHarness()).conversation(id, context);
  const page = await conversation?.entries({}, 50, undefined, context);
  return page?.items.find(isTurn);
}

/** The session list now and whenever it changes. */
export const sessions = live(listSessions);

export const watchSessions = sessions.watch;

/** The project and workspace a session works in; throws if it has none. */
export async function sessionWorkspace(id: ConversationId) {
  const [meta, agent] = await Promise.all([
    sessionMeta(id),
    (await getHarness()).snapshot(AgentDoc, id, context),
  ]);
  if (!meta?.projectId || !agent?.cwd)
    throw new Error('This session has no workspace');
  return { projectId: meta.projectId, cwd: agent.cwd, agent };
}

/** A session's own fields (session-doc.ts); undefined for a missing session. */
export async function sessionMeta(id: ConversationId) {
  return (await getHarness()).snapshot(SessionDoc, id, context);
}

/** Changes a session's own fields in one commit; resolves to what `change` returns. */
export async function editSession<R>(
  id: ConversationId,
  change: (meta: SessionMeta) => R | Promise<R>,
) {
  return (await getHarness()).commit(
    async (tx) => change(await tx.doc(SessionDoc, id)),
    context,
  );
}

export async function getConversation(id: string) {
  const conversation = await (
    await getHarness()
  ).conversation(Number(id) as ConversationId, context);
  if (!conversation) throw new Error(`No session ${id}`);
  return conversation;
}
