import { $ } from 'bun';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { Project, SessionSummary, Workspace } from '@bica/shared/protocol';
import { removeWorktree } from '../sessions/meta';
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
      if (here.some((s) => s.status === 'running' || s.status === 'retrying'))
        continue;
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

/** Git's output, trimmed; null when it fails. */
async function git(cwd: string, args: string[]) {
  const result = await $`git ${args}`.cwd(cwd).quiet().nothrow();
  return result.exitCode === 0 ? result.text().trim() : null;
}

// Commits, checkouts, and resets touch the reflog; a fresh worktree's
// folder says when it was made.
async function lastGitUse(path: string) {
  const times = [(await stat(path)).birthtimeMs];
  const dir = await git(path, ['rev-parse', '--absolute-git-dir']);
  if (dir)
    await stat(join(dir, 'logs/HEAD')).then(
      (s) => times.push(s.mtimeMs),
      () => {},
    );
  return Math.max(...times);
}

async function allInDefaultBranch(project: Project, path: string) {
  if (await git(path, ['status', '--porcelain'])) return false;
  const remote = await git(project.path, [
    'symbolic-ref',
    '--short',
    'refs/remotes/origin/HEAD',
  ]);
  const main = project.workspaces.find((w) => w.main)?.branch;
  const bases = [remote, remote?.replace(/^origin\//, ''), main].filter(
    (b): b is string => !!b,
  );
  for (const base of new Set(bases))
    if (
      (await git(path, ['merge-base', '--is-ancestor', 'HEAD', base])) !== null
    )
      return true;
  return false;
}
