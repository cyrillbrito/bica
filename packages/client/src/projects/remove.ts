import type { WorkspaceRef } from '@bica/shared/protocol';
import { request } from '../socket/socket';
import { toast } from '../ui/Toast';

/** Removes a worktree; without force, what that would lose instead. */
export function removeWorktree(projectId: string, cwd: string, force = false) {
  return request('worktree.cleanUp', { projectId, cwd, force });
}

/**
 * Removes a worktree, and asks first when that would lose uncommitted files
 * or unmerged commits. False: the user kept it.
 */
export async function removeWorktreeAsking(
  projectId: string,
  cwd: string,
  label: string,
) {
  const risk = await removeWorktree(projectId, cwd);
  if (!risk) return true;
  if (!confirm(`${label} has ${risk}. Delete it anyway? They are lost.`))
    return false;
  await removeWorktree(projectId, cwd, true);
  return true;
}

/** For the archive toast: removes worktrees left with no open session. */
export async function removeEmptied(refs: readonly WorkspaceRef[]) {
  for (const { projectId, cwd } of refs) {
    const label = cwd.split('/').filter(Boolean).pop() ?? cwd;
    try {
      if (await removeWorktreeAsking(projectId, cwd, label))
        toast(`Removed ${label}`);
    } catch (e) {
      toast.error(e);
    }
  }
}
