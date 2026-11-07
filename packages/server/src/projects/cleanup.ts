import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { Project, SessionSummary, Workspace } from '@bica/shared/protocol';
import { isBusy } from '@bica/shared/status';
import * as git from '../git/commands';
import { removeWorktree } from './worktrees';
import { listSessions } from '../sessions/store';
import { listProjects } from './projects';

const DAY = 24 * 60 * 60_000;
// A day's grace after the merge, for a follow-up to the agent.
const MERGED_IDLE = DAY;
// Long enough that a feature paused over a weekend survives.
const UNUSED_IDLE = 7 * DAY;

/**
 * Removes finished worktrees on its own, every hour: one whose pull request
 * merged a day ago, or one unused for a week whose commits are all in the
 * default branch. Uncommitted files, a running session, or recent use keep
 * it. Silent: its sessions go to Archived, noting the branch and pull
 * request.
 */
export function startWorktreeCleanup() {
  // On the hour, so a restart never pushes it back, and Bun.cron never
  // starts a sweep before the last one ends.
  Bun.cron('@hourly', () => cleanUpWorktrees());
}

/** One sweep; `now` is a parameter so tests can move time forward. */
export async function cleanUpWorktrees(now = Date.now()) {
  try {
    const found = await finishedWorktrees(
      await listProjects(),
      await listSessions(),
      now,
    );
    for (const { projectId, path, why } of found) {
      // Its own check again: never lose uncommitted files or lone commits.
      const risk = await removeWorktree(projectId, path, false);
      if (!risk) console.log(`Removed worktree ${path}: ${why}`);
    }
  } catch (e) {
    // Caught: a rejection from Bun.cron's callback would end the server.
    console.warn('Worktree cleanup failed:', e);
  }
}

/** The worktrees a sweep at `now` would remove, and why. Reads only. */
export async function finishedWorktrees(
  projects: Project[],
  sessions: SessionSummary[],
  now: number,
) {
  const found: { projectId: string; path: string; why: string }[] = [];
  for (const project of projects) {
    if (!project.git) continue;
    for (const w of project.workspaces) {
      // Only where Bica puts worktrees, next to the project. Other tools'
      // worktrees, such as a build cache's, can hold ignored files they need.
      if (w.main || !w.path.startsWith(`${project.path}-`)) continue;
      const here = sessions.filter((s) => s.cwd === w.path);
      if (here.some((s) => isBusy(s.status))) continue;
      const used = Math.max(
        ...here.map((s) => s.updatedAt),
        await lastGitUse(w.path),
      );
      const why = await reason(project, w, now - used);
      if (why) found.push({ projectId: project.id, path: w.path, why });
    }
  }
  return found;
}

async function reason(project: Project, w: Workspace, idle: number) {
  if (w.pr?.state === 'merged' && idle >= MERGED_IDLE)
    return `pull request #${w.pr.number} merged`;
  if (idle >= UNUSED_IDLE && (await allInDefaultBranch(project, w.path)))
    return 'unused, and all its commits are in the default branch';
  return null;
}

// Commits, checkouts, and resets touch the reflog; a fresh worktree's
// folder says when it was made.
async function lastGitUse(path: string) {
  const times = [(await stat(path)).birthtimeMs];
  const dir = await git.gitDir(path);
  if (dir)
    await stat(join(dir, 'logs/HEAD')).then(
      (s) => times.push(s.mtimeMs),
      () => {},
    );
  return Math.max(...times);
}

async function allInDefaultBranch(project: Project, path: string) {
  // A status that can't be read counts as clean; the merge check decides.
  if ((await git.changedPaths(path).catch(() => [])).length) return false;
  const remote = await git.originDefault(project.path);
  const main = project.workspaces.find((w) => w.main)?.branch;
  const bases = [remote, remote?.replace(/^origin\//, ''), main].filter(
    (b): b is string => !!b,
  );
  for (const base of new Set(bases))
    if (await git.isAncestor(path, 'HEAD', base)) return true;
  return false;
}
