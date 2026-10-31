import { defineDoc } from '@earendil-works/pi-durable';

import { isAgent } from '@bica/shared/agents';
import type {
  InCharge,
  PullRequest,
  VoiceSettings,
} from '@bica/shared/protocol';

// App metadata stored next to each conversation; Pi Durable has no titles.
// Read and changed through sessionMeta and editSession (store.ts).
export type SessionMeta = {
  title: string;
  createdAt: number;
  projectId?: string;
  // When it was archived; 0 or unset: shown in the list.
  archivedAt?: number;
  // Newest entry opened in the browser; later ones are unread. Unset: treated
  // as read, so sessions that predate the field don't all light up.
  seenEntry?: number;
  // The session this one was forked from.
  forkedFrom?: string;
  // Its last entry from that session.
  forkedAt?: number;
  // The session whose agent started this one (session_start). History only:
  // `parent` says who is in charge now.
  startedBy?: string;
  // The session in charge of it, which hears each run it ends
  // (docs/sessions.md); null: none, so it's the user's. Unset: from before
  // the field, read through parentOf.
  parent?: string | null;
  // Its worktree was removed: the branch and PR it had then. Named when
  // removing was called clean up.
  cleanedUp?: { branch: string | null; pr: PullRequest | null };
  // The id of the agent it runs as (shared/src/agents.ts), read through
  // agentIdOf. Agents were called profiles when the field was named, and it
  // keeps the name so stored sessions read as they are. Unset: from before
  // the field, coding.
  profile?: string;
  // From before `parent`: started with `notify: false`, so it had none.
  quiet?: boolean;
  // Who sent the newest prompt: "user", "bica" for a note, or the id of a
  // session that sent a message.
  lastFrom?: string;
  // From before `parent`: the user had taken it over, so it had none.
  userPrompted?: boolean;
  // Each time it left its parent, or went back to it. Named when leaving
  // was called taking over, and stored so.
  handoffs?: InCharge[];
  voice?: VoiceSettings;
  // The hubs that watch it (session_watch), which hear each run it ends.
  watchedBy?: string[];
  // The memory index as the agent sees it (loadMemory), '' for none. Unset:
  // taken again on the next prompt, as after a compaction.
  memory?: string;
  // The project list for the hub, kept like `memory`.
  projects?: string;
  // The first prompt, held for tonight's run (docs/night-runs.md); '' or
  // unset: none waiting.
  tonight?: string;
  // It asked to archive itself (session_archive), which waits for its run to
  // end; `worktree`: remove its worktree too.
  archiveAfterRun?: { worktree: boolean };
};

export const SessionDoc = defineDoc<SessionMeta>({
  kind: 'bica.session',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'current',
  initial: () => ({ title: '', createdAt: 0 }),
  // Small and often changed: a base now and then keeps replay short.
  checkpointWhen: (_value, _ops, { deltasSinceBase }) => deltasSinceBase >= 32,
});

/** The session in charge of it; null: none, so it's the user's. */
export function parentOf(meta?: SessionMeta): string | null {
  if (!meta) return null;
  if (meta.parent !== undefined) return meta.parent;
  return meta.startedBy && !meta.quiet && !meta.userPrompted
    ? meta.startedBy
    : null;
}

/** The agent a session runs as; one this Bica doesn't know runs as Coding. */
export function agentIdOf(meta?: { profile?: string }) {
  return isAgent(meta?.profile) ? meta.profile : 'coding';
}
