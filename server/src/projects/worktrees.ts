// Worktrees: made for a session, removed once its work is merged or done.
import { existsSync } from 'node:fs';

import type { PullRequest } from '@bica/shared/protocol';
import * as git from '../git/commands';
import { archive, retireSessions } from '../sessions/meta';
import { named } from '../sessions/read';
import { listSessions } from '../sessions/store';
import { removeTerminal, terminalsIn } from '../terminals/terminals';
import { copyIgnored } from './copy-ignored';
import { getProject, refreshProjects, slugify } from './projects';

/**
 * A new worktree for a session: its own branch from the freshly fetched
 * default branch, or the local one when it is ahead, in a sibling folder
 * like `../shop-sidebar-resize`, with the main folder's ignored files
 * cloned in. Its path, and a warning when the fetch failed.
 */
export async function createWorktree(projectId: string, title: string) {
  const project = await getProject(projectId);
  if (!project.git) throw new Error(`${project.name} is not a git repo`);
  // The folder already says the project: `shop-ui-polish`, not
  // `shop-shop-ui-polish`.
  const prefix = `${slugify(project.name, '')}-`;
  let slug = slugify(title, 'session');
  if (slug.startsWith(prefix) && slug.length > prefix.length)
    slug = slug.slice(prefix.length);
  const taken = async (name: string) =>
    existsSync(`${project.path}-${name}`) ||
    (await git.hasBranch(project.path, name));
  let branch = slug;
  for (let i = 2; await taken(branch); i++) branch = `${slug}-${i}`;
  // No origin: start from what is checked out locally.
  let base = 'HEAD';
  let warning: string | undefined;
  const tracked = await git.originDefault(project.path);
  if (tracked) {
    base = tracked;
    const local = tracked.replace(/^origin\//, '');
    // A fetch normally takes a second or two; the session shouldn't wait
    // long on a remote that is down.
    await git.fetchBranch(project.path, 'origin', local, 10_000).catch((e) => {
      warning = `Couldn't fetch ${local}: ${fetchProblem(e)}. The worktree starts from the last fetched copy.`;
    });
    // Work merged locally but not pushed yet counts: new sessions start on it.
    if (await git.isAncestor(project.path, base, local)) base = local;
  }
  const path = `${project.path}-${branch}`;
  // No tracking: the branch pushes to its own name, not to main.
  await git.addWorktree(project.path, { path, branch, base });
  await copyIgnored(project.path, path).catch((e) =>
    console.warn(`Copying ignored files into ${path} failed:`, e),
  );
  await refreshProjects();
  return { path, warning };
}

function fetchProblem(e: unknown) {
  const said = e instanceof Error ? e.message : String(e);
  if (
    /could not read (username|password)|authentication failed|permission denied/i.test(
      said,
    )
  )
    return 'origin needs a sign-in';
  if (e instanceof git.NoAnswer) return 'origin is not answering';
  return said.split('\n')[0].replace(/^fatal: /, '');
}

/** What removing a worktree would lose, in words; null: nothing. */
export async function worktreeRisk(path: string, pr: PullRequest | null) {
  const changed = await git.changedPaths(path);
  if (changed.length)
    return `${changed.length} uncommitted file${changed.length > 1 ? 's' : ''}`;
  // Squash merges leave the commits out of main, and the merged branch is
  // often deleted on the remote, so the PR's head is the other proof.
  const head = await git.head(path);
  if (head && pr?.head === head) return null;
  // Merged into a local branch, say `main`, but not pushed: still safe.
  const unsaved = await git.commitsOnlyHere(
    path,
    await git.currentBranch(path),
  );
  if (unsaved)
    return `${unsaved} commit${unsaved > 1 ? 's' : ''} on no other branch, local or pushed`;
  return null;
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
  await git.removeWorktree(project.path, cwd);
  if (w.branch) await git.deleteBranch(project.path, w.branch).catch(() => {});
  await refreshProjects();
  return null;
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
