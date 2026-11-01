import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

import type {
  FileText,
  GitChange,
  GitStatus,
  WorkspaceRef,
} from '@bica/shared/protocol';
import { live, type Live } from '../live';
import { getProject } from '../projects/projects';
import { onToolRan } from '../tools/tool-ran';
import * as git from './commands';

const MAX_FILE = 2 * 1024 * 1024;
// Media is shown as itself, not as text, so it gets a looser cap.
const MAX_MEDIA = 25 * 1024 * 1024;
// Plain folders are walked by hand; stop somewhere sane.
const MAX_FILES = 20_000;
const SKIP_DIRS = new Set(['.git', 'node_modules']);
// No file watcher: open views poll, and only while someone looks.
const STATUS_MS = 1500;
const FILES_MS = 4000;

/** The folder behind a ref, refusing anything that isn't a workspace. */
export async function open({ projectId, cwd }: WorkspaceRef) {
  const project = await getProject(projectId);
  const workspace = project.workspaces.find((w) => w.path === cwd);
  if (!workspace)
    throw new Error(`${cwd} is not a workspace of ${project.name}`);
  // The folder itself: each chat folder is its own repo, its project isn't.
  return { cwd, git: await isRepo(cwd) };
}

/** A path inside the workspace; the browser only sends relative ones. */
export function inside(cwd: string, path: string) {
  const full = resolve(cwd, path);
  if (isAbsolute(path) || !full.startsWith(cwd + sep))
    throw new Error(`${path} is outside the workspace`);
  return full;
}

function isRepo(dir: string) {
  return stat(join(dir, '.git')).then(
    () => true,
    () => false,
  );
}

/** The workspace's own repo, or one of its submodules by relative path. */
async function repoDir(cwd: string, repo?: string) {
  if (!repo) return cwd;
  const dir = inside(cwd, repo);
  if (!(await isRepo(dir))) throw new Error(`${repo} is not a repository`);
  return dir;
}

/** Workspace paths as paths inside one of its repos. */
function within(cwd: string, dir: string, paths: string[]) {
  return paths.map((p) => {
    const rel = relative(dir, inside(cwd, p));
    if (rel.startsWith('..')) throw new Error(`${p} is not in this repository`);
    return rel.split(sep).join('/');
  });
}

/** Submodules that are checked out. */
async function submodulePaths(cwd: string) {
  const paths = await git.submodulePaths(cwd);
  const found = await Promise.all(paths.map((p) => isRepo(join(cwd, p))));
  return paths.filter((_, i) => found[i]);
}

// ---------- live topics: one poller per workspace, shared by watchers ----------

// Kept once made: an unwatched one is just an object with no timer.
const statuses = new Map<string, Live<GitStatus>>();
const fileLists = new Map<string, Live<string[]>>();

function polled<T>(
  map: Map<string, Live<T>>,
  cwd: string,
  ms: number,
  read: () => Promise<T>,
) {
  let topic = map.get(cwd);
  if (!topic) {
    topic = live(read, (refresh) => {
      const timer = setInterval(refresh, ms);
      return () => clearInterval(timer);
    });
    map.set(cwd, topic);
  }
  return topic;
}

/** Re-read now instead of at the next tick, after we changed something. */
async function poke(cwd: string) {
  await Promise.all([
    statuses.get(cwd)?.refresh(),
    fileLists.get(cwd)?.refresh(),
  ]);
}

// An agent's edit shows as soon as its tool call ends.
onToolRan((dir) => {
  for (const cwd of new Set([...statuses.keys(), ...fileLists.keys()]))
    if (dir === cwd || dir.startsWith(cwd + sep)) void poke(cwd);
});

export async function watchStatus(
  ref: WorkspaceRef,
  listener: (status: GitStatus | null) => void,
) {
  const { cwd, git: isGit } = await open(ref);
  if (!isGit) {
    listener(null);
    return () => {};
  }
  return polled(statuses, cwd, STATUS_MS, () => readStatus(cwd)).watch(
    listener,
  );
}

/**
 * The workspace's status, plus each submodule worth showing (changes, or
 * commits to push or pull) as its own repo. Paths are from the workspace.
 */
async function readStatus(cwd: string, prefix = ''): Promise<GitStatus> {
  const [status, subs] = await Promise.all([
    readRepo(cwd, prefix),
    submodulePaths(cwd),
  ]);
  for (const sub of subs) {
    const inner = await readStatus(join(cwd, sub), `${prefix}${sub}/`).catch(
      () => null,
    );
    if (!inner) continue;
    const { submodules: nested, ...own } = inner;
    if (own.staged.length || own.unstaged.length || own.ahead || own.behind)
      status.submodules.push({
        ...own,
        path: `${prefix}${sub}`,
        submodules: [],
      });
    status.submodules.push(...nested);
  }
  return status;
}

/** One repo's own status, without looking into its submodules. */
async function readRepo(cwd: string, prefix = ''): Promise<GitStatus> {
  const [repo, stagedLines, unstagedLines, recent] = await Promise.all([
    git.status(cwd),
    git.lineCounts(cwd, true),
    git.lineCounts(cwd, false),
    git.recentCommits(cwd, RECENT),
  ]);
  const status: GitStatus = {
    branch: repo.branch,
    upstream: repo.upstream,
    ahead: repo.ahead,
    behind: repo.behind,
    staged: [],
    unstaged: [],
    recent,
    submodules: [],
  };
  const worktreeVersion = async (path: string) => {
    const s = await stat(join(cwd, path)).catch(() => null);
    return s ? `${s.mtimeMs}:${s.size}` : 'gone';
  };
  // Changes whose new side is the file on disk, hashed once the list is known.
  const onDisk: { change: GitChange; old: string | null }[] = [];
  for (const e of repo.entries) {
    if (e.kind === 'untracked') {
      const change: GitChange = {
        path: e.path,
        status: 'U',
        version: await worktreeVersion(e.path),
      };
      status.unstaged.push(change);
      onDisk.push({ change, old: null });
    } else if (e.kind === 'conflict')
      status.unstaged.push({
        path: e.path,
        status: '!',
        version: await worktreeVersion(e.path),
      });
    else {
      const { path, oldPath, submodule } = e;
      if (e.staged !== '.')
        status.staged.push({
          path,
          ...(oldPath ? { oldPath } : {}),
          status: e.staged as GitChange['status'],
          version: e.indexHash ?? 'none',
          ...(submodule
            ? {}
            : { blobs: { old: e.headHash, new: e.indexHash } }),
        });
      // A dirty submodule lists its files as its own repo; here it is a
      // change only when it points at another commit.
      if (
        e.unstaged !== '.' &&
        (!submodule || submodule.movedCommit || e.unstaged === 'D')
      ) {
        const change: GitChange = {
          path,
          // A: added with `git add -N`, tracked but with nothing staged.
          status: e.unstaged === 'D' || e.unstaged === 'A' ? e.unstaged : 'M',
          version: await worktreeVersion(path),
        };
        status.unstaged.push(change);
        if (!submodule) onDisk.push({ change, old: e.indexHash });
      }
    }
  }
  if (onDisk.length <= MAX_COUNTED)
    await Promise.all(
      onDisk.map(async ({ change, old }) => {
        const hash = await diskBlob(join(cwd, change.path));
        if (hash !== undefined) change.blobs = { old, new: hash };
      }),
    );
  const count = (lines: Map<string, git.LineCount>) => (c: GitChange) => {
    const n = lines.get(c.path);
    if (n) [c.added, c.removed] = n;
  };
  status.staged.forEach(count(stagedLines));
  status.unstaged.forEach(count(unstagedLines));
  // Git doesn't count untracked files; a new file is all added lines.
  const untracked = status.unstaged.filter((c) => c.status === 'U');
  if (untracked.length <= MAX_COUNTED)
    await Promise.all(
      untracked.map(async (c) => {
        const lines = await countLines(join(cwd, c.path));
        if (lines !== undefined) [c.added, c.removed] = [lines, 0];
      }),
    );
  if (prefix)
    for (const c of [...status.staged, ...status.unstaged]) {
      c.path = prefix + c.path;
      if (c.oldPath) c.oldPath = prefix + c.oldPath;
    }
  return status;
}

/** Git's own hash of a blob, so a file on disk matches its staged copy. */
function blobHash(bytes: Buffer) {
  return new Bun.CryptoHasher('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

// Status polls every few seconds; a file is only read again once it changes.
const diskHashes = new Map<string, { at: string; hash: string }>();

/** The hash of a file on disk; null: no file; undefined: too big to hash. */
async function diskBlob(full: string) {
  const s = await stat(full).catch(() => null);
  if (!s?.isFile()) {
    diskHashes.delete(full);
    return null;
  }
  // Text past MAX_FILE isn't shown anyway, so a growing log isn't re-read.
  const cap = MEDIA[extension(full) ?? ''] ? MAX_MEDIA : MAX_FILE;
  if (s.size > cap) return undefined;
  const at = `${s.mtimeMs}:${s.size}`;
  const known = diskHashes.get(full);
  if (known?.at === at) return known.hash;
  const bytes = await readFile(full).catch(() => null);
  if (!bytes) return null;
  const hash = blobHash(bytes);
  diskHashes.set(full, { at, hash });
  return hash;
}

/**
 * The bytes behind a blob hash from status: the file on disk while it
 * still has that hash, else git's stored copy. Neither, for the side on
 * disk: the file changed since, so its current bytes, with exact false so
 * nobody keeps them under the old hash. Null: no such file or blob; 'too
 * large' when it won't fit in memory.
 */
export async function readBlob(
  ref: WorkspaceRef,
  path: string,
  hash: string,
  { repoPath, onDisk }: { repoPath?: string; onDisk: boolean },
) {
  const { cwd } = await open(ref);
  const full = inside(cwd, path);
  const s = await stat(full).catch(() => null);
  const disk = s?.isFile() && s.size <= MAX_MEDIA ? await fromDisk(full) : null;
  if (disk && blobHash(disk) === hash) return { bytes: disk, exact: true };
  const repo = await repoDir(cwd, repoPath);
  const kept = await git.blob(repo, hash, MAX_MEDIA);
  if (kept === 'too large') return kept;
  if (kept) return { bytes: kept, exact: true };
  return disk && onDisk ? { bytes: disk, exact: false } : null;
}

// Untracked files read per poll for their line counts, at most.
const MAX_COUNTED = 200;
const MAX_COUNTED_SIZE = 512 * 1024;

async function countLines(full: string) {
  const s = await stat(full).catch(() => null);
  if (!s?.isFile() || s.size > MAX_COUNTED_SIZE) return undefined;
  const buffer = await readFile(full).catch(() => null);
  if (!buffer || buffer.subarray(0, 8000).includes(0)) return undefined;
  if (!buffer.length) return 0;
  let lines = buffer.at(-1) === 10 ? 0 : 1;
  for (const byte of buffer) if (byte === 10) lines++;
  return lines;
}

const RECENT = 5;

// repo: a submodule's path, or absent for the workspace's own. Paths are
// from the workspace; no paths means everything in the repo.
export async function stage(
  ref: WorkspaceRef,
  paths?: string[],
  repo?: string,
) {
  const { cwd } = await open(ref);
  const dir = await repoDir(cwd, repo);
  try {
    await git.stage(dir, paths && within(cwd, dir, paths));
  } finally {
    await poke(cwd);
  }
}

export async function unstage(
  ref: WorkspaceRef,
  paths?: string[],
  repo?: string,
) {
  const { cwd } = await open(ref);
  const dir = await repoDir(cwd, repo);
  try {
    await git.unstage(dir, paths && within(cwd, dir, paths));
  } finally {
    await poke(cwd);
  }
}

export async function commit(
  ref: WorkspaceRef,
  message: string,
  {
    all = false,
    amend = false,
    repo,
  }: { all?: boolean; amend?: boolean; repo?: string } = {},
) {
  const { cwd } = await open(ref);
  try {
    const dir = await repoDir(cwd, repo);
    if (all) await git.stage(dir);
    await git.commit(dir, { message, amend });
  } finally {
    await poke(cwd);
  }
}

/** Back to the index for tracked files; untracked ones are deleted. */
export async function discard(
  ref: WorkspaceRef,
  paths: string[],
  repo?: string,
) {
  const { cwd } = await open(ref);
  const dir = await repoDir(cwd, repo);
  const rels = within(cwd, dir, paths);
  try {
    if (rels.length) await discardIn(dir, rels);
  } finally {
    await poke(cwd);
  }
}

async function discardIn(cwd: string, paths: string[]) {
  const untracked = await git.untrackedAmong(cwd, paths);
  const tracked = paths.filter((p) => !untracked.has(p));
  if (tracked.length) await git.restore(cwd, tracked);
  if (untracked.size) await git.deleteUntracked(cwd, [...untracked]);
}

export async function push(ref: WorkspaceRef, repo?: string) {
  const { cwd } = await open(ref);
  const dir = await repoDir(cwd, repo);
  const status = await readRepo(dir);
  if (status.upstream) await git.push(dir);
  else {
    if (!status.branch) throw new Error('Not on a branch');
    const remotes = await git.remotes(dir);
    const name = remotes.includes('origin') ? 'origin' : remotes[0];
    if (!name) throw new Error('No remote to push to');
    await git.push(dir, { remote: name, branch: status.branch });
  }
  await poke(cwd);
}

export async function pull(ref: WorkspaceRef, repo?: string) {
  const { cwd } = await open(ref);
  await git.pullFastForward(await repoDir(cwd, repo));
  await poke(cwd);
}

/** Git explains itself on stdout ("nothing to commit") or stderr (hooks). */
// Lockfiles and the like: big, generated, and say nothing about intent.
const NOISE =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|composer\.lock|Gemfile\.lock)$|\.(min\.js|map|snap)$/;
const MAX_DIFF = 40_000;
const MAX_FILE_DIFF = 8_000;
const MAX_NEW_FILE_LINES = 80;

/**
 * The changes a commit would record, as text for a model: a stat summary
 * and the diff, trimmed per file and overall. all: every change, including
 * untracked files, as `commit --all` here would record them.
 */
export async function pendingChanges(
  ref: WorkspaceRef,
  all: boolean,
  repo?: string,
) {
  const { cwd: workspace } = await open(ref);
  // Everything below is about the one repo; sessions are found by workspace.
  const cwd = await repoDir(workspace, repo);
  const status = await readRepo(cwd);
  const changes = all ? [...status.staged, ...status.unstaged] : status.staged;
  const hasHead = status.recent.length > 0;
  const of = all ? (hasHead ? 'all' : 'unstaged') : 'staged';
  const [summary, patch] = await Promise.all([
    git.diffText(cwd, of, true),
    git.diffText(cwd, of),
  ]);
  const parts = patch
    .split(/^(?=diff --git )/m)
    .filter(Boolean)
    .map((part) => {
      const path = /^diff --git a\/(.*?) b\//.exec(part)?.[1] ?? '';
      if (NOISE.test(path))
        return `${part.split('\n')[0]}\n(generated file, diff left out)\n`;
      return part.length > MAX_FILE_DIFF
        ? `${part.slice(0, MAX_FILE_DIFF)}\n… (${part.length - MAX_FILE_DIFF} more characters of this file left out)\n`
        : part;
    });
  if (all) {
    // `git diff` leaves out untracked files; show the start of each.
    for (const c of status.unstaged.filter((c) => c.status === 'U')) {
      if (NOISE.test(c.path)) continue;
      const full = join(cwd, c.path);
      const s = await stat(full).catch(() => null);
      const buffer =
        s && s.size <= MAX_FILE ? await readFile(full).catch(() => null) : null;
      const text =
        buffer && !buffer.subarray(0, 8000).includes(0)
          ? buffer.toString('utf8').split('\n')
          : null;
      parts.push(
        `new file ${c.path}\n` +
          (text
            ? text
                .slice(0, MAX_NEW_FILE_LINES)
                .map((l) => `+${l}`)
                .join('\n') +
              (text.length > MAX_NEW_FILE_LINES
                ? `\n… (${text.length - MAX_NEW_FILE_LINES} more lines)`
                : '')
            : '(binary or large file)') +
          '\n',
      );
    }
  }
  let diffText = '';
  for (const part of parts) {
    if (diffText.length + part.length > MAX_DIFF) {
      diffText += `\n… (${parts.length - parts.indexOf(part)} more files left out)\n`;
      break;
    }
    diffText += part;
  }
  const lastCommit = status.recent[0]?.time ?? 0;
  return {
    cwd: workspace,
    branch: status.branch,
    files: changes.map((c) => `${c.status} ${c.path}`),
    stat: summary.trim(),
    diff: diffText,
    recentSubjects: await git.commitSubjects(cwd, 12),
    lastCommit,
  };
}

const MEDIA: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

// By extension, else by magic bytes: screenshots often land with odd names.
function extension(path: string) {
  return /\.([^./]+)$/.exec(path)?.[1]?.toLowerCase();
}

function mediaType(path: string, buffer: Buffer) {
  const ext = extension(path);
  if (ext && MEDIA[ext]) return MEDIA[ext];
  const head = buffer.subarray(0, 12).toString('latin1');
  if (head.startsWith('\x89PNG')) return 'image/png';
  if (head.startsWith('\xff\xd8\xff')) return 'image/jpeg';
  if (head.startsWith('GIF8')) return 'image/gif';
  if (head.startsWith('RIFF') && head.endsWith('WEBP')) return 'image/webp';
  if (head.startsWith('%PDF')) return 'application/pdf';
  return undefined;
}

/** How a file can be shown: as text, as media of a type, or not at all. */
export function kindOf(
  buffer: Buffer,
  path: string,
): 'text' | 'binary' | 'too large' | { mimeType: string } {
  const mimeType = mediaType(path, buffer);
  if (mimeType) return buffer.length > MAX_MEDIA ? 'too large' : { mimeType };
  if (buffer.length > MAX_FILE) return 'too large';
  // Git's own test: a NUL in the first 8000 bytes means binary.
  if (buffer.subarray(0, 8000).includes(0)) return 'binary';
  return 'text';
}

export function toText(buffer: Buffer | null, path: string): FileText {
  if (!buffer) return { text: null, reason: 'missing' };
  const kind = kindOf(buffer, path);
  if (kind === 'text') return { text: buffer.toString('utf8') };
  if (typeof kind === 'string') return { text: null, reason: kind };
  return {
    text: null,
    reason: 'media',
    mimeType: kind.mimeType,
    data: buffer.toString('base64'),
  };
}

function fromDisk(full: string) {
  return readFile(full).catch(() => null);
}

// Null when that side has no such file.
async function fromGit(cwd: string, path: string, side: 'HEAD' | 'index') {
  const bytes = await git.fileAt(cwd, path, side, MAX_MEDIA * 2);
  return bytes === 'too large' ? null : bytes;
}

export async function readText(ref: WorkspaceRef, path: string) {
  const { cwd } = await open(ref);
  return toText(await fromDisk(inside(cwd, path)), path);
}

export async function diff(
  ref: WorkspaceRef,
  path: string,
  staged: boolean,
  oldPath?: string,
  repoPath?: string,
) {
  const { cwd } = await open(ref);
  const full = inside(cwd, path);
  const repo = await repoDir(cwd, repoPath);
  const [rel, before] = within(cwd, repo, [path, oldPath ?? path]) as [
    string,
    string,
  ];
  // A submodule itself: show which commit it points at, as git diff does.
  if (await isRepo(full)) {
    const head = git.submoduleCommit(repo, before, 'HEAD');
    const index = git.submoduleCommit(repo, rel, 'index');
    const disk = git.head(full);
    const [a, b] = staged ? [head, index] : [index, disk];
    const text = async (hash: Promise<string | null>) =>
      toText(
        (await hash) ? Buffer.from(`Subproject commit ${await hash}\n`) : null,
        '',
      );
    return { old: await text(a), new: await text(b) };
  }
  const [a, b] = staged
    ? [fromGit(repo, before, 'HEAD'), fromGit(repo, rel, 'index')]
    : [fromGit(repo, rel, 'index'), fromDisk(full)];
  return { old: toText(await a, before), new: toText(await b, path) };
}

export async function watchFiles(
  ref: WorkspaceRef,
  listener: (paths: string[]) => void,
) {
  const { cwd, git: isGit } = await open(ref);
  return polled(fileLists, cwd, FILES_MS, () =>
    isGit ? gitFiles(cwd) : walk(cwd),
  ).watch(listener);
}

async function gitFiles(cwd: string): Promise<string[]> {
  const { files, submodules, untracked, deleted } = await git.fileList(cwd);
  // A submodule would otherwise show up as a file; list its own files instead.
  const nested = await Promise.all(
    submodules.map((sub) =>
      // Not checked out (no .git inside): nothing to show.
      stat(join(cwd, sub, '.git'))
        .then(() => gitFiles(join(cwd, sub)))
        .then((ps) => ps.map((p) => `${sub}/${p}`))
        .catch(() => []),
    ),
  );
  const gone = new Set(deleted);
  return [...new Set([...files, ...untracked])]
    .filter((p) => !gone.has(p))
    .concat(...nested)
    .sort();
}

async function walk(cwd: string) {
  const out: string[] = [];
  const visit = async (dir: string) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (out.length >= MAX_FILES) return;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await visit(full);
      } else if (e.isFile()) out.push(relative(cwd, full));
    }
  };
  await visit(cwd);
  return out.sort();
}
