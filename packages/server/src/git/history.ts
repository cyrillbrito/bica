import type {
  GitChange,
  GitCommitDetail,
  GitLog,
  WorkspaceRef,
} from '@bica/shared/protocol';
import { open } from '../projects/workspace';
import * as git from './commands';
import { repoDir } from './workspace';

// Paging past this many commits still marks the unpushed ones; a branch
// that far ahead of every remote is rare.
const MAX_UNPUSHED = 5000;

/** A page of HEAD's commits, each marked when no remote branch has it. */
export async function log(
  ref: WorkspaceRef,
  { skip = 0, count, repo }: { skip?: number; count: number; repo?: string },
): Promise<GitLog> {
  skip = Math.max(0, Math.floor(Number(skip)) || 0);
  count = Math.min(500, Math.max(1, Math.floor(Number(count)) || 1));
  const { cwd } = await open(ref);
  const dir = await repoDir(cwd, repo);
  // One more than asked says whether older ones follow.
  const [commits, remotes, commitUrl] = await Promise.all([
    git.recentCommits(dir, count + 1, skip),
    git.remotes(dir),
    commitUrlOf(dir),
  ]);
  // With no remote at all, nothing is marked: there is nowhere to push.
  const unpushed = remotes.length
    ? await git.unpushedCommits(dir, Math.min(skip + count, MAX_UNPUSHED))
    : new Set<string>();
  return {
    commits: commits
      .slice(0, count)
      .map((c) => ({ ...c, unpushed: unpushed.has(c.hash) })),
    more: commits.length > count,
    commitUrl,
  };
}

/** One commit and the files it changed, against its first parent. */
export async function show(
  ref: WorkspaceRef,
  hash: string,
  repo?: string,
): Promise<GitCommitDetail> {
  if (!/^[0-9a-f]{4,64}$/i.test(hash)) throw new Error('Not a commit hash');
  const { cwd } = await open(ref);
  const dir = await repoDir(cwd, repo);
  const info = await git.commitInfo(dir, hash);
  if (!info) throw new Error(`No commit ${hash}`);
  const [files, unpushed, remotes, commitUrl] = await Promise.all([
    git.commitFiles(dir, info.hash, info.parents[0] ?? null),
    git.unpushedCommits(dir, 1, info.hash),
    git.remotes(dir),
    commitUrlOf(dir),
  ]);
  // Paths from the workspace, as status gives them.
  const prefix = repo ? `${repo.replace(/\/$/, '')}/` : '';
  return {
    hash: info.hash,
    subject: info.subject,
    body: info.body,
    author: info.author,
    email: info.email,
    time: info.time,
    parents: info.parents,
    unpushed: remotes.length > 0 && unpushed.has(info.hash),
    commitUrl,
    // A submodule's entry is a commit, not a file; its own repo has the diff.
    files: files
      .filter((f) => !f.submodule)
      .map((f): GitChange => ({
        path: prefix + f.path,
        ...(f.oldPath ? { oldPath: prefix + f.oldPath } : {}),
        status: f.status,
        version: `${f.oldHash}:${f.newHash}`,
        blobs: { old: f.oldHash, new: f.newHash },
        ...(f.lines ? { added: f.lines[0], removed: f.lines[1] } : {}),
      })),
  };
}

async function commitUrlOf(dir: string) {
  const url = await git.remoteUrl(dir, 'origin');
  return url ? commitUrl(url) : null;
}

/**
 * Where GitHub or GitLab shows a commit of the repo at `remote`, minus the
 * hash; null for any other host. Takes the ssh and https forms git accepts:
 * `git@host:owner/repo.git`, `ssh://git@host:22/owner/repo`,
 * `https://user@host/owner/repo.git`.
 */
export function commitUrl(remote: string) {
  const m =
    /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)(?::\d+)?[:/](.+?)(?:\.git)?\/?$/i.exec(
      remote.trim(),
    );
  if (!m) return null;
  const [, host, path] = m as unknown as [string, string, string];
  // Self-hosted ones usually keep the name, as github.<company>.com does.
  const kind = /(^|[.-])github([.-]|$)/i.test(host)
    ? 'github'
    : /(^|[.-])gitlab([.-]|$)/i.test(host)
      ? 'gitlab'
      : null;
  if (!kind || !path.includes('/')) return null;
  const base = `https://${host.toLowerCase()}/${path}`;
  return kind === 'github' ? `${base}/commit/` : `${base}/-/commit/`;
}
