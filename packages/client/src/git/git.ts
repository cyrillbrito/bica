import type {
  FileText,
  GitChange,
  GitStatus,
  WorkspaceRef,
} from '@bica/shared/protocol';
import { request, useLiveTopic, useTopic } from '../socket/socket';
import { pageOf, paths } from '../router';

export function useGitStatus(ref: () => WorkspaceRef) {
  return useTopic('git.status', ref);
}

/** Only the server's current status, never the copy saved on this device. */
export function useLiveGitStatus(ref: () => WorkspaceRef) {
  return useLiveTopic('git.status', ref);
}

/** The workspace's own repo first, then each submodule worth showing. */
export function repos(status: GitStatus) {
  return [{ ...status, path: '' }, ...status.submodules];
}

// repo: a submodule's path; '' or absent, the workspace's own repo.
export function stage(ref: WorkspaceRef, paths?: string[], repo?: string) {
  return request('git.stage', { ...ref, paths, repo: repo || undefined });
}

export function unstage(ref: WorkspaceRef, paths?: string[], repo?: string) {
  return request('git.unstage', { ...ref, paths, repo: repo || undefined });
}

export function commit(
  ref: WorkspaceRef,
  message: string,
  options: { all?: boolean; amend?: boolean; repo?: string } = {},
) {
  return request('git.commit', {
    ...ref,
    message,
    ...options,
    repo: options.repo || undefined,
  });
}

export function discard(ref: WorkspaceRef, paths: string[], repo?: string) {
  return request('git.discard', { ...ref, paths, repo: repo || undefined });
}

export function push(ref: WorkspaceRef, repo?: string) {
  return request('git.push', { ...ref, repo: repo || undefined });
}

export function pull(ref: WorkspaceRef, repo?: string) {
  return request('git.pull', { ...ref, repo: repo || undefined });
}

export function suggestMessage(
  ref: WorkspaceRef,
  options: { all?: boolean; fresh?: boolean; repo?: string } = {},
) {
  return request('git.suggest', {
    ...ref,
    ...options,
    repo: options.repo || undefined,
  });
}

/** One side of a diff; media read over HTTP comes as a Blob. */
export type Side =
  | FileText
  | { text: null; reason: 'media'; mimeType: string; blob: Blob };

/**
 * Both sides of a diff by their blob hashes from status. The browser
 * caches each for good (server/src/git/blob.ts), so a side seen before
 * costs no request.
 */
export async function readBlobs(
  ref: WorkspaceRef,
  path: string,
  blobs: NonNullable<GitChange['blobs']>,
  // Unstaged: the new side is the file on disk, which may change again.
  unstaged: boolean,
  oldPath?: string,
  repo?: string,
) {
  const side = async (
    hash: string | null,
    at: string,
    onDisk = false,
  ): Promise<Side> => {
    if (!hash) return { text: null, reason: 'missing' };
    const q = new URLSearchParams({
      project: ref.projectId,
      cwd: ref.cwd,
      path: at,
    });
    if (repo) q.set('repo', repo);
    if (onDisk) q.set('disk', '');
    const res = await fetch(`/blob/${hash}?${q}`);
    // Deleted since status; the next one says so.
    if (res.status === 404) return { text: null, reason: 'missing' };
    if (!res.ok) throw new Error(`Couldn't read ${at}`);
    const unshown = res.headers.get('X-Bica-Unshown');
    if (unshown === 'binary' || unshown === 'too large')
      return { text: null, reason: unshown };
    if (res.headers.get('Content-Type')?.startsWith('text/plain'))
      return { text: await res.text() };
    const blob = await res.blob();
    return {
      text: null,
      reason: 'media',
      mimeType: blob.type,
      blob,
    };
  };
  const [old, next] = await Promise.all([
    side(blobs.old, oldPath ?? path),
    side(blobs.new, path, unstaged),
  ]);
  return { old, new: next };
}

export function readDiff(
  ref: WorkspaceRef,
  path: string,
  staged: boolean,
  oldPath?: string,
  repo?: string,
) {
  return request('git.diff', {
    ...ref,
    path,
    staged,
    oldPath,
    repo: repo || undefined,
  });
}

/** A page of the branch's commits, newest first. */
export function readLog(
  ref: WorkspaceRef,
  options: { skip?: number; count: number; repo?: string },
) {
  return request('git.log', {
    ...ref,
    ...options,
    repo: options.repo || undefined,
  });
}

export function showCommit(ref: WorkspaceRef, hash: string, repo?: string) {
  return request('git.show', { ...ref, hash, repo: repo || undefined });
}

/** A commit open full size, or one of its files' diffs with `path`. */
export type OpenCommit = { hash: string; repo?: string; path?: string };

/** ?c=hash, with &cr=repo for a submodule and &cd=path for a file. */
export function commitFromSearch(search: string): OpenCommit | undefined {
  const q = new URLSearchParams(search);
  const hash = q.get('c');
  if (!hash) return undefined;
  return {
    hash,
    repo: q.get('cr') ?? undefined,
    path: q.get('cd') ?? undefined,
  };
}

export function sameCommit(a?: OpenCommit, b?: OpenCommit) {
  return a?.hash === b?.hash && a?.repo === b?.repo && a?.path === b?.path;
}

/**
 * Where opening a commit goes: over the chat when a session is open, like
 * a file, the workspace page otherwise. Read at click time.
 */
export function commitHref(ref: WorkspaceRef, open: OpenCommit) {
  const page = pageOf(location);
  const q = new URLSearchParams(page.kind === 's' ? {} : { w: ref.cwd });
  q.set('c', open.hash);
  if (open.repo) q.set('cr', open.repo);
  if (open.path) q.set('cd', open.path);
  const at = page.kind === 's' ? paths.s(page.id) : paths.p(ref.projectId);
  return `${String(at)}?${q}`;
}
