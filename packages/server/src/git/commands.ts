import { $ } from 'bun';

// Every git command Bica runs, one function each, so they read in one place.
// Nothing else in the server runs git (lint: bica/git-commands); tests may,
// to set up their repos.

// ---------- runners ----------

/**
 * Runs git in `cwd` and returns what it printed. A failure throws git's own
 * words, such as "nothing to commit", which it sometimes prints to stdout.
 */
// --no-optional-locks: our polling must never block the agent's git.
async function run(cwd: string, args: string[]) {
  const result = await $`git --no-optional-locks ${args}`
    .cwd(cwd)
    .quiet()
    .nothrow();
  if (result.exitCode === 0) return result.text();
  const said = [result.stderr, result.stdout]
    .map((out) => out.toString().trim())
    .find(Boolean);
  throw new Error(said || `git ${args[0]} failed`);
}

function succeeds(cwd: string, args: string[]) {
  return run(cwd, args).then(
    () => true,
    () => false,
  );
}

function split(out: string, by: '\0' | '\n') {
  return out.split(by).filter(Boolean);
}

/** A network command that ran out of time: the remote never answered. */
export class NoAnswer extends Error {}

// Never waits on a password prompt nobody can see.
async function network(cwd: string, args: string[], timeout: number) {
  const p = Bun.spawn(['git', ...args], {
    cwd,
    timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const [stderr, code] = await Promise.all([p.stderr.text(), p.exited]);
  if (p.signalCode)
    throw new NoAnswer(`git ${args[0]} got no answer in ${timeout / 1000} s`);
  if (code !== 0) throw new Error(stderr.trim() || `git ${args[0]} failed`);
}

/** Raw bytes; 'too large' past `max`, null when git fails. */
async function bytes(cwd: string, args: string[], max: number) {
  const p = Bun.spawn(['git', ...args], {
    cwd,
    maxBuffer: max,
    stderr: 'ignore',
  });
  const [out, code] = await Promise.all([p.stdout.bytes(), p.exited]);
  // Killed only for going over `max`.
  if (p.signalCode) return 'too large';
  return code === 0 ? Buffer.from(out) : null;
}

// ---------- repos ----------

export function isInsideRepo(dir: string) {
  return succeeds(dir, ['rev-parse', '--is-inside-work-tree']);
}

export async function initRepo(dir: string) {
  await run(dir, ['init', '-q']);
}

/** The repo's own `.git` folder, even from a worktree; null outside one. */
export function gitDir(cwd: string) {
  return run(cwd, ['rev-parse', '--absolute-git-dir']).then(
    (out) => out.trim(),
    () => null,
  );
}

/** Where `.gitmodules` puts each submodule, checked out or not. */
export async function submodulePaths(cwd: string) {
  const out = await run(cwd, [
    'config',
    '--file',
    '.gitmodules',
    '-z',
    '--get-regexp',
    '^submodule\\..*\\.path$',
  ]).catch(() => '');
  // "submodule.<name>.path\n<path>"
  return split(out, '\0').map((r) => r.slice(r.indexOf('\n') + 1));
}

// ---------- status ----------

/** A letter from git's XY status pair; '.' is unchanged. */
export type StatusLetter = '.' | 'M' | 'T' | 'A' | 'D' | 'R' | 'C';

export type StatusEntry =
  | { kind: 'untracked'; path: string }
  | { kind: 'conflict'; path: string }
  | {
      kind: 'changed';
      path: string;
      // Set for a rename or copy.
      oldPath?: string;
      staged: StatusLetter;
      unstaged: StatusLetter;
      // A submodule's hashes are commits, not files.
      submodule: null | { movedCommit: boolean };
      // Null for a side that has no file.
      headHash: string | null;
      indexHash: string | null;
    };

export interface RepoStatus {
  // Null when detached.
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: StatusEntry[];
}

// Git writes all zeros for a side that has no file.
function hash(h: string) {
  return /^0+$/.test(h) ? null : h;
}

/** Branch, upstream, and every changed path, untracked files one by one. */
export async function status(cwd: string): Promise<RepoStatus> {
  const out = await run(cwd, [
    'status',
    '--porcelain=v2',
    '--branch',
    '--untracked-files=all',
    '-z',
  ]);
  const result: RepoStatus = {
    branch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    entries: [],
  };
  const records = out.split('\0');
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    if (r.startsWith('# branch.head ')) {
      const head = r.slice(14);
      result.branch = head === '(detached)' ? null : head;
    } else if (r.startsWith('# branch.upstream '))
      result.upstream = r.slice(18);
    else if (r.startsWith('# branch.ab ')) {
      const [a, b] = r.slice(12).split(' ');
      result.ahead = Number(a);
      result.behind = -Number(b);
    } else if (r.startsWith('? '))
      result.entries.push({ kind: 'untracked', path: r.slice(2) });
    else if (r.startsWith('1 ') || r.startsWith('2 ')) {
      // "1 XY sub mH mI mW hH hI path", renames add a score and "\0origPath".
      // sub: "S<commit changed><modified><untracked>" for a submodule.
      const f = r.split(' ');
      const xy = f[1]!;
      const sub = f[2]!;
      const renamed = r[0] === '2';
      result.entries.push({
        kind: 'changed',
        path: f.slice(renamed ? 9 : 8).join(' '),
        ...(renamed ? { oldPath: records[++i]! } : {}),
        staged: xy[0] as StatusLetter,
        unstaged: xy[1] as StatusLetter,
        submodule: sub[0] === 'S' ? { movedCommit: sub[1] === 'C' } : null,
        headHash: hash(f[6]!),
        indexHash: hash(f[7]!),
      });
    } else if (r.startsWith('u '))
      result.entries.push({
        kind: 'conflict',
        path: r.split(' ').slice(10).join(' '),
      });
  }
  return result;
}

/** Changed paths as `status --porcelain` lists them, a new folder as one. */
export async function changedPaths(cwd: string) {
  return split(await run(cwd, ['status', '--porcelain']), '\n');
}

export type LineCount = [added: number, removed: number];

/** Lines added and removed per path, staged or not; binaries are left out. */
export async function lineCounts(cwd: string, staged: boolean) {
  const out = await run(cwd, [
    'diff',
    '--numstat',
    '-z',
    '--no-ext-diff',
    ...(staged ? ['--cached'] : []),
  ]).catch(() => '');
  return parseNumstat(out);
}

// "added\tremoved\tpath\0", renames "added\tremoved\t\0old\0new\0".
function parseNumstat(out: string) {
  const counts = new Map<string, LineCount>();
  const parts = out.split('\0');
  for (let i = 0; i < parts.length; i++) {
    const [added, removed, path] = parts[i]!.split('\t');
    if (path === undefined) continue;
    const target = path === '' ? ((i += 2), parts[i]!) : path;
    if (added !== '-') counts.set(target, [Number(added), Number(removed)]);
  }
  return counts;
}

/** HEAD's commits, newest first, from `skip` on; none before the first commit. */
export async function recentCommits(cwd: string, count: number, skip = 0) {
  const out = await run(cwd, [
    'log',
    `-n${count}`,
    `--skip=${skip}`,
    '--format=%H%x1f%s%x1f%ct',
  ]).catch(() => '');
  return split(out, '\n').map((line) => {
    const [hash, subject, time] = line.split('\x1f');
    return { hash: hash!, subject: subject ?? '', time: Number(time) * 1000 };
  });
}

/** Commits of `from` on no remote branch, newest first, at most `count`. */
export async function unpushedCommits(
  cwd: string,
  count: number,
  from = 'HEAD',
) {
  const out = await run(cwd, [
    'rev-list',
    `-n${count}`,
    from,
    '--not',
    '--remotes',
  ]).catch(() => '');
  return new Set(split(out, '\n'));
}

/** One commit's message and author; null when there is no such commit. */
export async function commitInfo(cwd: string, hash: string) {
  // The body comes last: it may hold anything, the separator included.
  const out = await run(cwd, [
    'show',
    '-s',
    '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%b',
    hash,
    '--',
  ]).catch(() => null);
  if (!out) return null;
  const [full, parents, author, email, time, subject, ...body] =
    out.split('\x1f');
  return {
    hash: full!,
    parents: parents!.split(' ').filter(Boolean),
    author: author!,
    email: email!,
    time: Number(time) * 1000,
    subject: subject!,
    body: body.join('\x1f').trim(),
  };
}

export interface CommitFile {
  path: string;
  oldPath?: string;
  status: 'A' | 'D' | 'M' | 'R';
  // Null for a side that has no file.
  oldHash: string | null;
  newHash: string | null;
  submodule: boolean;
  lines?: LineCount;
}

/**
 * The files a commit changed against `parent`, or against nothing for a
 * root commit, with renames found and lines counted.
 */
export async function commitFiles(
  cwd: string,
  commit: string,
  parent: string | null,
) {
  const range = parent ? [parent, commit] : ['--root', commit];
  const args = ['diff-tree', '-r', '-z', '-M', '--no-commit-id'];
  const [raw, numstat] = await Promise.all([
    run(cwd, [...args, '--raw', '--no-abbrev', ...range]),
    run(cwd, [...args, '--numstat', ...range]),
  ]);
  const files: CommitFile[] = [];
  const parts = raw.split('\0');
  for (let i = 0; i < parts.length; i++) {
    // ":<old mode> <new mode> <old hash> <new hash> <status>\0<path>", and
    // renames and copies "\0<old path>\0<new path>".
    const r = parts[i]!;
    if (!r.startsWith(':')) continue;
    const [oldMode, newMode, oldHash, newHash, letter] = r.slice(1).split(' ');
    const moved = letter![0] === 'R' || letter![0] === 'C';
    const from = parts[++i]!;
    const path = moved ? parts[++i]! : from;
    files.push({
      path,
      ...(moved ? { oldPath: from } : {}),
      status:
        letter![0] === 'A' || letter![0] === 'D' || letter![0] === 'R'
          ? letter![0]
          : letter![0] === 'C'
            ? 'A'
            : 'M',
      oldHash: hash(oldHash!),
      newHash: hash(newHash!),
      submodule: oldMode === '160000' || newMode === '160000',
    });
  }
  const counts = parseNumstat(numstat);
  for (const f of files) {
    const n = counts.get(f.path);
    if (n) f.lines = n;
  }
  return files;
}

/** Subjects of the newest commits, merges left out. */
export async function commitSubjects(cwd: string, count: number) {
  const out = await run(cwd, [
    'log',
    `-n${count}`,
    '--no-merges',
    '--format=%s',
  ]).catch(() => '');
  return split(out, '\n');
}

/**
 * A diff as text: `staged` against HEAD, `unstaged` against the index, or
 * `all` against HEAD. `stat`: the summary instead of the patch. '' on failure.
 */
export function diffText(
  cwd: string,
  changes: 'staged' | 'unstaged' | 'all',
  stat = false,
) {
  const base = { staged: ['--cached'], unstaged: [], all: ['HEAD'] }[changes];
  return run(cwd, [
    'diff',
    '--no-color',
    '--no-ext-diff',
    ...base,
    ...(stat ? ['--stat=100'] : []),
  ]).catch(() => '');
}

// ---------- files ----------

/** Tracked files, plus submodules on their own, untracked, and deleted. */
export async function fileList(cwd: string) {
  const list = (args: string[]) =>
    run(cwd, ['ls-files', '-z', ...args]).then((o) => split(o, '\0'));
  const [staged, untracked, deleted] = await Promise.all([
    list(['--cached', '--stage']),
    list(['--others', '--exclude-standard']),
    list(['--deleted']),
  ]);
  // "<mode> <hash> <stage>\t<path>"; mode 160000 is a submodule.
  const files: string[] = [];
  const submodules: string[] = [];
  for (const entry of staged) {
    const path = entry.slice(entry.indexOf('\t') + 1);
    (entry.startsWith('160000 ') ? submodules : files).push(path);
  }
  return { files, submodules: [...new Set(submodules)], untracked, deleted };
}

/** Tracked files, as paths. */
export async function trackedFiles(cwd: string) {
  return split(await run(cwd, ['ls-files', '-z']), '\0');
}

/** Which of `paths` git doesn't track and doesn't ignore. */
export async function untrackedAmong(cwd: string, paths: string[]) {
  const out = await run(cwd, [
    'ls-files',
    '-z',
    '--others',
    '--exclude-standard',
    '--',
    ...paths,
  ]);
  return new Set(split(out, '\0'));
}

/** Ignored files and folders; a wholly ignored folder is listed alone. */
export async function ignoredPaths(cwd: string) {
  const out = await run(cwd, [
    'ls-files',
    '-z',
    '--others',
    '--ignored',
    '--exclude-standard',
    '--directory',
  ]);
  return split(out, '\0').map((p) => p.replace(/\/$/, ''));
}

/** A blob's bytes by hash; null when there is none. */
export function blob(cwd: string, hash: string, max: number) {
  return bytes(cwd, ['cat-file', 'blob', hash], max);
}

/** A file as HEAD or the index has it; null when that side has none. */
export function fileAt(
  cwd: string,
  path: string,
  side: 'HEAD' | 'index',
  max: number,
) {
  return bytes(cwd, ['show', `${side === 'HEAD' ? 'HEAD' : ''}:${path}`], max);
}

// ---------- changes ----------

/** Stages `paths`, or everything, untracked files included. */
export async function stage(cwd: string, paths?: string[]) {
  await run(cwd, paths ? ['add', '--', ...paths] : ['add', '--all']);
}

export async function unstage(cwd: string, paths?: string[]) {
  await run(cwd, ['restore', '--staged', '--', ...(paths ?? ['.'])]);
}

/** Commits the index; no message with `amend` keeps the old one. */
export async function commit(
  cwd: string,
  { message, amend = false }: { message: string; amend?: boolean },
) {
  await run(cwd, [
    'commit',
    '--quiet',
    ...(amend ? ['--amend'] : []),
    ...(message ? ['-m', message] : ['--no-edit']),
  ]);
}

/** Puts tracked files back to what the index has. */
export async function restore(cwd: string, paths: string[]) {
  await run(cwd, ['restore', '--worktree', '--', ...paths]);
}

export async function deleteUntracked(cwd: string, paths: string[]) {
  await run(cwd, ['clean', '--force', '--quiet', '--', ...paths]);
}

// ---------- commits and branches ----------

/** The commit checked out; null before the first one. */
export function head(cwd: string) {
  return run(cwd, ['rev-parse', 'HEAD']).then(
    (out) => out.trim(),
    () => null,
  );
}

/** Null when detached. */
export async function currentBranch(cwd: string) {
  return (await run(cwd, ['branch', '--show-current'])).trim() || null;
}

export function hasBranch(cwd: string, name: string) {
  return succeeds(cwd, ['show-ref', '--verify', '-q', `refs/heads/${name}`]);
}

export async function deleteBranch(cwd: string, name: string) {
  await run(cwd, ['branch', '-D', name]);
}

/** Whether `ancestor` is in `of`'s history; false when either is unknown. */
export function isAncestor(cwd: string, ancestor: string, of: string) {
  return succeeds(cwd, ['merge-base', '--is-ancestor', ancestor, of]);
}

/** Commits in HEAD on no other branch, local or pushed, but `branch`. */
export async function commitsOnlyHere(cwd: string, branch: string | null) {
  const out = await run(cwd, [
    'rev-list',
    '--count',
    'HEAD',
    '--not',
    '--remotes',
    ...(branch ? [`--exclude=${branch}`] : []),
    '--branches',
  ]);
  return Number(out.trim());
}

/** The commit a submodule entry points at in HEAD or the index; null if none. */
export function submoduleCommit(
  cwd: string,
  path: string,
  side: 'HEAD' | 'index',
) {
  // "160000 commit <hash>\t" (ls-tree) or "160000 <hash> 0\t" (ls-files).
  const args =
    side === 'HEAD'
      ? ['ls-tree', 'HEAD', '--', path]
      : ['ls-files', '--stage', '--', path];
  return run(cwd, args).then(
    (o) => {
      if (!o.startsWith('160000 ')) return null;
      const [, a, b] = o.split(/\s/);
      return a === 'commit' ? b! : a!;
    },
    () => null,
  );
}

// ---------- worktrees ----------

export interface Worktree {
  path: string;
  branch: string | null;
  main: boolean;
}

/** Every worktree of the repo, the main one first; bare and deleted ones left out. */
export async function worktrees(cwd: string): Promise<Worktree[]> {
  const out = await run(cwd, ['worktree', 'list', '--porcelain']);
  return out.split('\n\n').flatMap((block, i): Worktree[] => {
    const lines = block.split('\n');
    const field = (key: string) =>
      lines.find((l) => l.startsWith(`${key} `))?.slice(key.length + 1);
    const flag = (key: string) => lines.some((l) => l.split(' ')[0] === key);
    const path = field('worktree');
    // Prunable ones were deleted by hand.
    if (!path || flag('bare') || flag('prunable')) return [];
    return [
      {
        path,
        branch: field('branch')?.replace(/^refs\/heads\//, '') ?? null,
        // Git lists the main worktree first.
        main: i === 0,
      },
    ];
  });
}

/** A new worktree on a new branch from `base`, tracking nothing. */
export async function addWorktree(
  cwd: string,
  { path, branch, base }: { path: string; branch: string; base: string },
) {
  await run(cwd, [
    'worktree',
    'add',
    '-q',
    '--no-track',
    '-b',
    branch,
    path,
    base,
  ]);
}

/** Removes a worktree whatever is in it; git refuses submodules without force. */
export async function removeWorktree(cwd: string, path: string) {
  await run(cwd, ['worktree', 'remove', '--force', path]);
}

// ---------- remotes ----------

export async function remotes(cwd: string) {
  return split(await run(cwd, ['remote']), '\n');
}

/** Where a remote fetches from; null when there is no such remote. */
export function remoteUrl(cwd: string, name: string) {
  return run(cwd, ['remote', 'get-url', name]).then(
    (out) => out.trim() || null,
    () => null,
  );
}

/** Origin's default branch as last fetched, like "origin/main"; null if unknown. */
export function originDefault(cwd: string) {
  return run(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).then(
    (out) => out.trim() || null,
    () => null,
  );
}

export function fetchBranch(
  cwd: string,
  remote: string,
  branch: string,
  timeout: number,
) {
  return network(cwd, ['fetch', '-q', remote, branch], timeout);
}

// Pushes and pulls can be big; two minutes before calling one stuck.
const TRANSFER_MS = 120_000;

/** Pushes the branch to its upstream, or sets `upstream` first. */
export function push(
  cwd: string,
  upstream?: { remote: string; branch: string },
) {
  return network(
    cwd,
    upstream
      ? ['push', '--set-upstream', upstream.remote, upstream.branch]
      : ['push'],
    TRANSFER_MS,
  );
}

export function pullFastForward(cwd: string) {
  return network(cwd, ['pull', '--ff-only'], TRANSFER_MS);
}
