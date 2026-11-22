import type { ConversationId } from '@earendil-works/pi-durable';

import { archiveWithWorktree } from '../projects/worktrees';
import { archiveIfQuiet } from '../schedules/schedules';
import { tell } from '../sessions/notes';
import {
  lastSender,
  named,
  readSession,
  recentMessages,
} from '../sessions/read';
import { editSession, getConversation, parentOf } from '../sessions/store';

/**
 * When a run ends, its parent gets a note, and so do the sessions that watch
 * it (docs/orchestration.md). Subscribed to sessions/runs.ts at startup.
 */
export function reportRunEnd(id: ConversationId) {
  void archiveIfQuiet(id)
    .then(() => runEnded(id))
    .then(() => archiveIfAsked(id))
    .catch((error) => console.error('[note]', error));
}

/** The session `watcher` starts or stops hearing each run this session ends. */
export async function watch(id: string, watcher: string, on: boolean) {
  const conversation = await getConversation(id);
  await editSession(conversation.id, (meta) => {
    const rest = (meta.watchedBy ?? []).filter((w) => w !== watcher);
    if (on) meta.watchedBy = [...rest, watcher];
    else if (rest.length) meta.watchedBy = rest;
    else delete meta.watchedBy;
  });
}

/** The user ends every watch on a session, and the watchers hear of it. */
export async function unwatch(id: string) {
  const conversation = await getConversation(id);
  const watchers = await editSession(conversation.id, (meta) => {
    const was = [...(meta.watchedBy ?? [])];
    delete meta.watchedBy;
    return was;
  });
  if (!watchers.length) return;
  const s = await readSession(id);
  for (const watcher of watchers)
    await tell(
      watcher,
      `The user stopped your watch on ${named(s)}: you hear no more of its turns.`,
    );
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
 * Notes for the end of a run: to its parent and the sessions that watch it,
 * nothing further up. A parent that can't settle a question or failure
 * passes it up in its own reply, which its parent hears.
 */
async function runEnded(id: ConversationId) {
  const s = await readSession(String(id)).catch(() => undefined);
  // Archived: done with, so it doesn't report.
  if (!s || s.archivedAt) return;
  const listeners = new Set(s.watchedBy);
  if (s.parent) listeners.add(s.parent);
  listeners.delete(String(id));
  if (!listeners.size) return;
  let what = `finished its turn. Its last reply:\n\n${s.reply || '(none)'}`;
  if (s.status === 'error')
    what = `stopped with an error. Its last reply:\n\n${s.reply || '(none)'}`;
  if (s.status === 'waiting')
    what = `is waiting for the user:\n${s.waits.map((w) => `- ${w}`).join('\n') || s.reply}`;
  // Its parent may itself be a child session, so the question climbs one
  // step at a time instead of every session above hearing it.
  const passUp =
    s.status === 'error' || s.status === 'waiting'
      ? '\n\nSettle it only if what you were told covers it. Otherwise say it in your reply, so it reaches the session that leads you, or the user.'
      : '';
  // A parent learns what the user told its child session along with the
  // reply, so writing to a child session costs the parent no run of its own.
  const words =
    (await lastSender(String(id))) === 'user'
      ? (await recentMessages(String(id), 2)).findLast(
          (m) => m.from === 'prompt',
        )?.text
      : undefined;
  for (const w of listeners) {
    // A session with no parent is the user's, to be left alone, so the
    // watcher must know which.
    if (w !== s.parent) {
      const whose = s.parent ? '' : " and which is the user's";
      await tell(w, `${named(s)}, which you watch${whose}, ${what}`);
      continue;
    }
    await tell(
      w,
      words
        ? `${named(s)}, your child session, got this from the user:\n\n${words}\n\nThen it ${what}${passUp}`
        : `${named(s)}, your child session, ${what}${passUp}`,
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
