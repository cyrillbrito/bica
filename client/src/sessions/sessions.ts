import { createMemo, createSignal } from 'solid-js';
import type { AgentId } from '@bica/shared/agents';
import type {
  ModelChoice,
  PromptImage,
  SessionSummary,
  VoiceSettings,
  WorkspaceRef,
} from '@bica/shared/protocol';
import { removeEmptied } from '../projects/remove';
import { errorText } from '../ui/errors';
import { toast } from '../ui/Toast';
import {
  request,
  requestId,
  useTopic,
  useTopicWhenReady,
} from '../socket/socket';

export function useSessions() {
  return useTopic('sessions', () => ({}));
}

/** The hub (docs/hub.md): the newest open hub session outside any project. */
export function useHub() {
  const sessions = useSessions();
  return createMemo(
    () =>
      sessions().find(
        (s) => s.agent === 'hub' && !s.archivedAt && !s.projectId,
      ),
    { name: 'hub' },
  );
}

// Undefined while it loads: the session page shows its frame from the list.
export function useConversation(id: () => string) {
  return useTopicWhenReady('conversation', () => ({ id: id() }));
}

export function startSession(
  projectId: string,
  cwd: string,
  prompt: string,
  images: PromptImage[],
  choice?: ModelChoice,
  worktree?: boolean,
  agent?: AgentId,
  tonight?: boolean,
) {
  return request('session.create', {
    projectId,
    cwd,
    prompt,
    images,
    requestId: requestId(),
    choice,
    worktree,
    agent,
    tonight,
  });
}

/** A session held for tonight: save its prompt, run it now, or cancel. */
export function tonightAction(
  id: string,
  action: 'save' | 'run' | 'cancel',
  prompt?: string,
) {
  return request('session.tonight', { id, action, prompt });
}

function archiveSession(id: string, archived = true) {
  return request('session.archive', { id, archived });
}

/**
 * Archives or brings back `list`, and says how it went in a toast. A
 * worktree left with no open session is offered for removal there, so
 * finished work doesn't linger on disk.
 */
export async function setArchived(
  list: readonly SessionSummary[],
  archived = true,
  note?: string,
) {
  if (!list.length) return;
  // Child sessions go before their parents: archiving a parent detaches the
  // ones still open, and those archived with it should keep their place.
  const failed: unknown[] = [];
  const changed: SessionSummary[] = [];
  const emptied: WorkspaceRef[] = [];
  let left = [...list];
  while (left.length) {
    const leaves = left.filter((s) => !left.some((o) => o.parent === s.id));
    left = left.filter((s) => !leaves.includes(s));
    const results = await Promise.allSettled(
      leaves.map((s) => archiveSession(s.id, archived)),
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') return failed.push(r.reason);
      changed.push(leaves[i]!);
      if (r.value && !emptied.some((o) => o.cwd === r.value!.cwd))
        emptied.push(r.value);
    });
  }
  const done = changed.length;
  const verb = archived ? 'Archived' : 'Unarchived';
  const count = (n: number) => `${n} session${n === 1 ? '' : 's'}`;
  if (failed.length)
    toast.error({
      title: `Couldn't ${archived ? 'archive' : 'unarchive'} ${count(failed.length)}`,
      description: errorText(failed[0]),
    });
  if (!done) return;
  const one = list.length === 1 ? list[0]!.title : '';
  const alone =
    emptied.length === 1 &&
    `No sessions left in ${emptied[0]!.cwd.split('/').pop()}`;
  // One button: removing the emptied worktree matters more than Undo, which
  // unarchiving still does.
  const action = emptied.length
    ? {
        label:
          emptied.length === 1
            ? 'Remove worktree'
            : `Remove ${emptied.length} worktrees`,
        onClick: () => void removeEmptied(emptied),
      }
    : // Brings the sessions back, but not the terminals closed with them.
      archived && {
        label: 'Undo',
        onClick: () => void setArchived(changed, false),
      };
  toast(
    {
      title: `${verb} ${count(done)}`,
      description: [one, note, alone].filter(Boolean).join(' · ') || undefined,
    },
    action ? { action, duration: emptied.length ? 8000 : 6000 } : undefined,
  );
}

export function markSeen(id: string, seen = true) {
  return request('session.seen', { id, seen });
}

export function renameSession(id: string, title: string) {
  return request('session.rename', { id, title });
}

export function sendPrompt(
  id: string,
  prompt: string,
  images: PromptImage[],
  opts: { steer?: boolean } = {},
) {
  return request('session.submit', {
    id,
    prompt,
    images,
    requestId: requestId(),
    whenBusy: opts.steer ? 'steer' : undefined,
  });
}

export function withdrawQueued(id: string, submission: number) {
  return request('session.withdraw', { id, submission });
}

export function pushQueued(id: string, submission: number) {
  return request('session.push', { id, submission });
}

export function stopSession(id: string) {
  return request('session.stop', { id });
}

export function retrySession(id: string) {
  return request('session.retry', { id });
}

export function compactSession(id: string, instructions?: string) {
  return request('session.compact', { id, instructions });
}

const [pruning, setPruning] = createSignal<ReadonlySet<string>>(new Set(), {
  name: 'pruning',
});

/** Pruning asked for here that hasn't landed yet. */
export function isPruning(id: string) {
  return pruning().has(id);
}

export async function pruneSession(id: string) {
  if (isPruning(id)) return;
  setPruning((s) => new Set(s).add(id));
  try {
    await request('session.cleanup', { id });
  } finally {
    setPruning((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }
}

export function setAgent(id: string, agent: AgentId) {
  return request('session.agent', { id, agent });
}

export function setVoiceSettings(id: string, voice: VoiceSettings) {
  return request('session.voice', { id, voice });
}

export function configureSession(id: string, choice: ModelChoice) {
  return request('session.configure', { id, ...choice });
}

/** A new session with the history up to entry `at` (absent: all); its id. */
export function forkSession(id: string, at?: number) {
  return request('session.fork', { id, at });
}
