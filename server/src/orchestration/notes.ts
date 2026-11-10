import { LiveDoc, type ConversationId } from '@earendil-works/pi-durable';

import { context, getHarness } from '../harness';
import { archiveWithWorktree } from '../projects/worktrees';
import { tell } from '../sessions/notes';
import {
  lastSender,
  named,
  readSession,
  recentMessages,
} from '../sessions/read';
import {
  editSession,
  getConversation,
  listSessions,
  parentOf,
} from '../sessions/store';

// When a run ends, its parent gets a note, and so do the hubs that watch it
// (docs/sessions.md). The last run state seen of every session tells when a
// run ends.
const runState = new Map<ConversationId, boolean>();
let watching: Promise<void> | undefined;

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
            runChanged(
              change.conversationId,
              change.kind === 'change' && !!change.value.run,
            );
      },
      end: (end) => console.error('[notes] commits ended', end),
    });
    // Runs a restart left unfinished resume; their end must still be heard.
    await Promise.all(
      (await listSessions()).map(async ({ id }) => {
        const conversation = Number(id) as ConversationId;
        const live = await harness.snapshot(LiveDoc, conversation, context);
        if (live?.run && !runState.has(conversation))
          runState.set(conversation, true);
      }),
    );
  })().catch((error) => {
    watching = undefined;
    throw error;
  }));
}

/** `hub` starts or stops hearing each run this session ends. */
export async function watch(id: string, hub: string, on: boolean) {
  const conversation = await getConversation(id);
  await editSession(conversation.id, (meta) => {
    const rest = (meta.watchedBy ?? []).filter((w) => w !== hub);
    if (on) meta.watchedBy = [...rest, hub];
    else if (rest.length) meta.watchedBy = rest;
    else delete meta.watchedBy;
  });
}

/** The user ends every watch on a session, and the hubs hear of it. */
export async function unwatch(id: string) {
  const conversation = await getConversation(id);
  const hubs = await editSession(conversation.id, (meta) => {
    const was = [...(meta.watchedBy ?? [])];
    delete meta.watchedBy;
    return was;
  });
  if (!hubs.length) return;
  const s = await readSession(id);
  for (const hub of hubs)
    await tell(
      hub,
      `The user stopped your watch on ${named(s)}: you hear no more of its turns. Drop it from your board unless they want it kept.`,
    );
}

function runChanged(id: ConversationId | undefined, running: boolean) {
  if (id === undefined) return;
  const was = runState.get(id);
  runState.set(id, running);
  if (running || !was) return;
  void runEnded(id)
    .then(() => archiveIfAsked(id))
    .catch((error) => console.error('[note]', error));
}

/**
 * A session archived while it ran (session_archive) goes once its run ends,
 * after its notes, so its parent still hears the last reply. A run that fails
 * or asks keeps it open: the user has something to read there.
 */
export async function archiveIfAsked(id: ConversationId) {
  const asked = await editSession(id, (meta) => {
    const was = meta.archiveAfterRun && { ...meta.archiveAfterRun };
    delete meta.archiveAfterRun;
    return was;
  });
  if (!asked) return;
  const s = await readSession(String(id));
  if (s.status === 'error' || s.status === 'waiting') return;
  await archiveWithWorktree(String(id), asked.worktree);
}

/**
 * Notes for the end of a run: to its parent and the hubs that watch it, and
 * when it asks or fails, to every hub too, which coordinates them all
 * (docs/hub.md).
 */
async function runEnded(id: ConversationId) {
  const s = await readSession(String(id)).catch(() => undefined);
  // Archived: done with, so it doesn't report.
  if (!s || s.archivedAt) return;
  const listeners = new Set(s.watchedBy);
  if (s.parent) listeners.add(s.parent);
  const asksOrFailed = s.status === 'error' || s.status === 'waiting';
  if (asksOrFailed)
    for (const other of await listSessions())
      if (other.agent === 'hub' && !other.archivedAt) listeners.add(other.id);
  listeners.delete(String(id));
  if (!listeners.size) return;
  let what = `finished its turn. Its last reply:\n\n${s.reply || '(none)'}`;
  if (s.status === 'error')
    what = `stopped with an error. Its last reply:\n\n${s.reply || '(none)'}`;
  if (s.status === 'waiting') {
    const { questions } = await recentMessages(String(id), 1);
    what = `is waiting for the user's answer to:\n${questions.map((q) => `- ${q.question} (${q.options.map((o) => o.label).join(' / ')})`).join('\n') || s.reply}`;
  }
  // A parent learns what the user told its child session along with the
  // reply, so writing to a child session costs the parent no run of its own.
  const words =
    (await lastSender(String(id))) === 'user'
      ? (await recentMessages(String(id), 2)).messages.findLast(
          (m) => m.from === 'prompt',
        )?.text
      : undefined;
  for (const w of listeners) {
    // The hub leaves sessions with no parent to the user (docs/hub.md), so it
    // must know them.
    const whose =
      w === s.parent
        ? ', your child session,'
        : s.watchedBy.includes(w)
          ? `, which you watch${s.parent ? '' : " and which is the user's"},`
          : s.parent
            ? ''
            : ", which is the user's,";
    await tell(
      w,
      w === s.parent && words
        ? `${named(s)}${whose} got this from the user:\n\n${words}\n\nThen it ${what}`
        : `${named(s)}${whose} ${what}`,
    );
  }
}

/**
 * The user takes a session from its parent: it's theirs from now on, and the
 * parent hears to leave it alone.
 */
export async function detach(id: string) {
  const conversation = await getConversation(id);
  const parent = await editSession(conversation.id, (meta) => {
    const was = parentOf(meta);
    if (!was) return undefined;
    meta.parent = null;
    meta.handoffs = [...(meta.handoffs ?? []), { at: Date.now(), to: 'you' }];
    return was;
  });
  if (!parent) return;
  const s = await readSession(id);
  await tell(
    parent,
    `The user detached ${named(s)} from you, so it's theirs now. Leave it to them: don't message, steer, or stop it unless they ask. You hear no more of its turns.`,
  );
}
