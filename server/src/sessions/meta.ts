import type { ConversationId } from '@earendil-works/pi-durable';

import type { AgentId } from '@bica/shared/agents';
import type {
  PullRequest,
  VoiceSettings,
  WorkspaceRef,
} from '@bica/shared/protocol';
import { context } from '../harness';
import { getAgent, selection } from '../agents/registry';
import {
  getProject,
  removeGitWorktree,
  worktreeRisk,
} from '../projects/projects';
import {
  allTerminals,
  removeTerminal,
  terminalsIn,
} from '../terminals/terminals';
import { named } from './read';
import {
  editSession,
  getConversation,
  listSessions,
  newestEntry,
  sessions,
} from './store';

/**
 * Switches the agent a session runs as: its tools now, its instructions with
 * the next prompt. Both are part of the prompt cache, so it is rebuilt once.
 */
export async function setAgent(id: string, agent: AgentId) {
  const conversation = await getConversation(id);
  await editSession(conversation.id, (meta) => void (meta.profile = agent));
  await conversation.configure(
    { extensions: selection(getAgent(agent)) },
    context,
  );
  await sessions.refresh();
}

/** How the session's next voice calls sound. */
export async function setVoice(id: string, voice: VoiceSettings) {
  const { id: conversationId } = await getConversation(id);
  await editSession(conversationId, (meta) => {
    meta.voice = {
      speed: Math.min(1.5, Math.max(0.25, voice.speed)),
      instructions: voice.instructions.trim().slice(0, 4000),
    };
  });
  await sessions.refresh();
}

/** A name chosen by hand; it replaces the generated one for good. */
export async function rename(id: string, title: string) {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!clean) throw new Error('A title cannot be empty');
  const { id: conversationId } = await getConversation(id);
  await editSession(conversationId, (meta) => void (meta.title = clean));
  // The list goes out before the reply, so the new name never flickers back.
  // (Commit listeners run before commit() resolves: the id is already stale.)
  await sessions.refresh();
}

/** Marks everything in the session so far as read, or the newest reply unread. */
export async function markSeen(id: string, seen = true) {
  const conversationId = Number(id) as ConversationId;
  if (!Number.isInteger(conversationId)) throw new Error(`No session ${id}`);
  const newest = await newestEntry(conversationId);
  if (!newest) return;
  await editSession(conversationId, (meta) => {
    if (!seen) meta.seenEntry = newest.id - 1;
    else if ((meta.seenEntry ?? 0) < newest.id) meta.seenEntry = newest.id;
  });
}

/**
 * Removes a worktree: its sessions archived, terminals closed, folder and
 * local branch gone. Without force, returns what would be lost instead.
 */
export async function removeWorktree(
  projectId: string,
  cwd: string,
  force: boolean,
) {
  const project = await getProject(projectId);
  const w = project.workspaces.find((w) => w.path === cwd && !w.main);
  if (!w) throw new Error(`${cwd} is not a worktree of ${project.name}`);
  if (!force) {
    const risk = await worktreeRisk(cwd, w.pr);
    if (risk) return risk;
  }
  await retireSessions(cwd, w.branch, w.pr);
  await Promise.all(terminalsIn(cwd).map((t) => removeTerminal(t.id)));
  await removeGitWorktree(projectId, cwd);
  return null;
}

/**
 * Before a worktree goes: archives its sessions and notes the branch and PR
 * on each, so the archived list still says what they were for.
 */
export async function retireSessions(
  cwd: string,
  branch: string | null,
  pr: PullRequest | null,
) {
  const here = (await listSessions()).filter((s) => s.cwd === cwd);
  if (here.some((s) => s.status === 'running' || s.status === 'retrying'))
    throw new Error('A session there is still running');
  for (const s of here)
    await editSession(Number(s.id) as ConversationId, (meta) => {
      meta.archivedAt ||= Date.now();
      meta.cleanedUp = { branch, pr };
      delete meta.watchedBy;
    });
  await releaseChildren(here.map((s) => s.id));
}

/**
 * The open child sessions of archived `parents` become the user's, as with
 * Detach: an archived parent hears nothing, so no one would lead them. It
 * isn't told, since a note would wake it.
 */
async function releaseChildren(parents: string[]) {
  for (const s of await listSessions())
    if (s.parent && parents.includes(s.parent) && !s.archivedAt)
      await editSession(Number(s.id) as ConversationId, (meta) => {
        meta.parent = null;
        meta.handoffs = [
          ...(meta.handoffs ?? []),
          { at: Date.now(), to: 'you' },
        ];
      });
}

/**
 * Hides a session from the list, or brings it back. Nothing is deleted.
 * The worktree it leaves with no open session, so the user can be offered
 * to remove it; null: none.
 */
export async function archive(
  id: string,
  archived: boolean,
): Promise<WorkspaceRef | null> {
  const { id: conversationId } = await getConversation(id);
  await editSession(conversationId, (meta) => {
    // Done with, so nobody watches it any more.
    if (archived) {
      meta.archivedAt ||= Date.now();
      delete meta.watchedBy;
    } else delete meta.archivedAt;
  });
  if (!archived) return null;
  // The dev servers and shells it leads go with it; detached ones stay.
  await Promise.all(
    allTerminals()
      .filter((t) => t.parent === id)
      .map((t) => removeTerminal(t.id)),
  );
  await releaseChildren([id]);
  return emptiedWorktree(id);
}

async function emptiedWorktree(id: string) {
  const all = await listSessions();
  const s = all.find((s) => s.id === id);
  if (!s?.cwd || !s.projectId) return null;
  if (all.some((o) => o.cwd === s.cwd && !o.archivedAt)) return null;
  const project = await getProject(s.projectId).catch(() => null);
  if (!project?.workspaces.some((w) => w.path === s.cwd && !w.main))
    return null;
  return { projectId: s.projectId, cwd: s.cwd };
}

/**
 * Archives a session, then with `worktree` removes its worktree too, unless
 * another open session works there or something would be lost. Returns what
 * happened to the worktree, '' when not asked.
 */
export async function archiveWithWorktree(id: string, worktree: boolean) {
  await archive(id, true);
  const all = await listSessions();
  const s = all.find((o) => o.id === id);
  if (!worktree || !s?.cwd || !s.projectId) return '';
  const project = await getProject(s.projectId);
  if (!project.workspaces.some((w) => w.path === s.cwd && !w.main))
    return `Its folder ${s.cwd} isn't a worktree, so it stays.`;
  const others = all.filter((o) => o.cwd === s.cwd && !o.archivedAt);
  if (others.length)
    return `Kept the worktree: ${others.map(named).join(', ')} still works there.`;
  const risk = await removeWorktree(s.projectId, s.cwd, false);
  return risk
    ? `Kept the worktree ${s.cwd}: it has ${risk}.`
    : `Removed its worktree ${s.cwd} and its branch.`;
}
