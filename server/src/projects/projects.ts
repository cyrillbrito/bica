import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';

import type {
  DirListing,
  Project,
  ProjectEdit,
  PullRequest,
  Workspace,
} from '@bica/shared/protocol';
import { copyIgnored } from './copy-ignored';
import { pullRequests } from './github';
import { live } from '../live';
import { BICA_HOME, jsonFile } from '../storage';

// Chats: sessions with no project, each in a fresh empty folder of its own.
export const CHATS_ID = 'chats';
const CHATS: Stored = {
  id: CHATS_ID,
  name: 'Chats',
  path: join(BICA_HOME, 'chats'),
};
// Worktrees made in a terminal show up within this long.
const POLL_MS = 5000;

type Stored = Omit<Project, 'git' | 'workspaces'>;

// Read every time, so a hand edit applies without a restart.
const file = jsonFile<Stored[]>('projects.json', {
  initial: () => [],
  reread: true,
});

async function load() {
  return file.read();
}

// Checked on every read: a folder can become (or stop being) a repo.
function isGit(path: string) {
  return existsSync(join(path, '.git'));
}

// The folder itself stays a workspace, so the list is never empty.
async function chatsProject(): Promise<Project> {
  const entries = await readdir(CHATS.path, { withFileTypes: true }).catch(
    () => [],
  );
  const chats = entries
    .filter((e) => e.isDirectory())
    .map((e) => ({
      path: join(CHATS.path, e.name),
      branch: null,
      main: false,
      pr: null,
    }));
  return {
    ...CHATS,
    git: false,
    workspaces: [
      { path: CHATS.path, branch: null, main: true, pr: null },
      ...chats,
    ],
  };
}

async function withWorkspaces(p: Stored): Promise<Project> {
  if (p.id === CHATS_ID) return chatsProject();
  const git = isGit(p.path);
  const workspaces = await workspacesOf(p.path, git);
  if (!git) return { ...p, git, workspaces };
  // Worktrees share one repo, so one lookup covers them all.
  const prs = pullRequests(p.path, () => void projects.refresh());
  return {
    ...p,
    git,
    workspaces: workspaces.map((w) => ({
      ...w,
      pr: (w.branch && prs.get(w.branch)) || null,
    })),
  };
}

export async function listProjects(): Promise<Project[]> {
  return Promise.all([...(await load()), CHATS].map(withWorkspaces));
}

const exec = promisify(execFile);

// Git is the source of truth: every worktree of the repo, wherever made.
async function workspacesOf(path: string, git: boolean): Promise<Workspace[]> {
  const folder = [{ path, branch: null, main: true, pr: null }];
  if (!git) return folder;
  try {
    const { stdout } = await exec('git', ['worktree', 'list', '--porcelain'], {
      cwd: path,
    });
    const list = stdout.split('\n\n').flatMap((block, i): Workspace[] => {
      const lines = block.split('\n');
      const field = (key: string) =>
        lines.find((l) => l.startsWith(`${key} `))?.slice(key.length + 1);
      const flag = (key: string) => lines.some((l) => l.split(' ')[0] === key);
      const worktree = field('worktree');
      // Bare repos have no files; prunable ones were deleted by hand.
      if (!worktree || flag('bare') || flag('prunable')) return [];
      return [
        {
          path: worktree,
          branch: field('branch')?.replace(/^refs\/heads\//, '') ?? null,
          // Git lists the main worktree first.
          main: i === 0,
          pr: null,
        },
      ];
    });
    return list.length ? list : folder;
  } catch {
    return folder;
  }
}

/** One project, reading only its own worktrees. */
export async function getProject(id: string) {
  const stored = [...(await load()), CHATS].find((p) => p.id === id);
  if (!stored) throw new Error(`No project ${id}`);
  return withWorkspaces(stored);
}

/** A new empty folder for a chat, like `~/.bica/chats/2025-06-12-recipe-ideas`. Its path. */
export async function createChatFolder(title: string) {
  const name = `${new Date().toISOString().slice(0, 10)}-${slugify(title, 'chat')}`;
  let path = join(CHATS.path, name);
  for (let i = 2; existsSync(path); i++)
    path = join(CHATS.path, `${name}-${i}`);
  await mkdir(path, { recursive: true });
  await initRepo(path);
  await projects.refresh();
  return path;
}

/**
 * Gives a folder without git a repo, so its changes show in the Git tab.
 * A folder inside another repo is left alone.
 */
async function initRepo(path: string) {
  const inRepo = await exec('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: path,
  }).then(
    () => true,
    () => false,
  );
  if (!inRepo) await exec('git', ['init', '-q'], { cwd: path });
}

function slugify(title: string, fallback: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || fallback
  );
}

const projects = live(listProjects, (refresh) => {
  const timer = setInterval(refresh, POLL_MS);
  return () => clearInterval(timer);
});

export const watchProjects = projects.watch;

export async function addProject(path: string) {
  const real = await realpath(path);
  const list = await load();
  const existing = list.find((p) => p.path === real);
  if (existing) return existing.id;
  // A worktree already shows as a folder of its repo's project.
  for (const p of list)
    if (
      isGit(p.path) &&
      (await workspacesOf(p.path, true)).some((w) => w.path === real)
    )
      return p.id;
  await initRepo(real);
  const project = {
    id: Date.now().toString(36),
    name: basename(real),
    path: real,
  };
  await file.update((list) => void list.push(project));
  await projects.refresh();
  return project.id;
}

/** The sidebar's order is the file's order. */
export async function reorderProjects(ids: string[]) {
  const rank = (p: Stored) => {
    const i = ids.indexOf(p.id);
    return i < 0 ? ids.length : i;
  };
  await file.update((list) => void list.sort((a, b) => rank(a) - rank(b)));
  await projects.refresh();
}

export async function pinProject(id: string, pinned: boolean) {
  await file.update((list) => {
    const p = list.find((p) => p.id === id);
    if (!p) throw new Error(`No project ${id}`);
    if (pinned) p.pinned = true;
    else delete p.pinned;
  });
  await projects.refresh();
}

/** Edits from the Edit project dialog. */
export async function updateProject(id: string, edit: ProjectEdit) {
  const name = edit.name.trim();
  if (!name) throw new Error('A project needs a name');
  await file.update((list) => {
    const p = list.find((p) => p.id === id);
    if (!p) throw new Error(`No project ${id}`);
    p.name = name;
  });
  await projects.refresh();
}

/**
 * A new worktree for a session: its own branch from the freshly fetched
 * default branch, or the local one when it is ahead, in a sibling folder
 * like `../shop-sidebar-resize`, with the main folder's ignored files
 * cloned in. Its path.
 */
export async function createWorktree(projectId: string, title: string) {
  const project = await getProject(projectId);
  if (!project.git) throw new Error(`${project.name} is not a git repo`);
  const git = (args: string[]) => exec('git', args, { cwd: project.path });
  // The folder already says the project: `shop-ui-polish`, not
  // `shop-shop-ui-polish`.
  const prefix = `${slugify(project.name, '')}-`;
  let slug = slugify(title, 'session');
  if (slug.startsWith(prefix) && slug.length > prefix.length)
    slug = slug.slice(prefix.length);
  const taken = async (name: string) =>
    existsSync(`${project.path}-${name}`) ||
    (await git(['show-ref', '--verify', '-q', `refs/heads/${name}`]).then(
      () => true,
      () => false,
    ));
  let branch = slug;
  for (let i = 2; await taken(branch); i++) branch = `${slug}-${i}`;
  // No origin, or offline: start from what is checked out locally.
  let base = 'HEAD';
  try {
    base = (
      await git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
    ).stdout.trim();
    const local = base.replace(/^origin\//, '');
    await git(['fetch', '-q', 'origin', local]);
    // Work merged locally but not pushed yet counts: new sessions start on it.
    await git(['merge-base', '--is-ancestor', base, local]);
    base = local;
  } catch {}
  const path = `${project.path}-${branch}`;
  // No tracking: the branch pushes to its own name, not to main.
  await git(['worktree', 'add', '-q', '--no-track', '-b', branch, path, base]);
  await copyIgnored(project.path, path).catch((e) =>
    console.warn(`Copying ignored files into ${path} failed:`, e),
  );
  await projects.refresh();
  return path;
}

/** What removing a worktree would lose, in words; null: nothing. */
export async function worktreeRisk(path: string, pr: PullRequest | null) {
  const git = (args: string[]) =>
    exec('git', args, { cwd: path }).then((r) => r.stdout.trim());
  const changed = (await git(['status', '--porcelain']))
    .split('\n')
    .filter(Boolean);
  if (changed.length)
    return `${changed.length} uncommitted file${changed.length > 1 ? 's' : ''}`;
  // Squash merges leave the commits out of main, and the merged branch is
  // often deleted on the remote, so the PR's head is the other proof.
  const head = await git(['rev-parse', 'HEAD']);
  if (pr?.head === head) return null;
  // Merged into a local branch, say `main`, but not pushed: still safe.
  const branch = await git(['branch', '--show-current']);
  const unsaved = Number(
    await git([
      'rev-list',
      '--count',
      'HEAD',
      '--not',
      '--remotes',
      ...(branch ? [`--exclude=${branch}`] : []),
      '--branches',
    ]),
  );
  if (unsaved)
    return `${unsaved} commit${unsaved > 1 ? 's' : ''} on no other branch, local or pushed`;
  return null;
}

/** Deletes a worktree's folder and its local branch, whatever is in them. */
export async function removeGitWorktree(projectId: string, path: string) {
  const project = await getProject(projectId);
  const w = project.workspaces.find((w) => w.path === path && !w.main);
  if (!w) throw new Error(`${path} is not a worktree of ${project.name}`);
  const git = (args: string[]) => exec('git', args, { cwd: project.path });
  // Force: the caller already checked for work, and git refuses submodules without it.
  await git(['worktree', 'remove', '--force', path]);
  if (w.branch) await git(['branch', '-D', w.branch]).catch(() => {});
  await projects.refresh();
}

/** Folders inside `path` (home by default), for picking a project. */
export async function listDirs(path?: string): Promise<DirListing> {
  const dir = await realpath(path || homedir());
  const entries = await readdir(dir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, path: join(dir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({ ...d, git: isGit(d.path) }));
  const parent = dirname(dir);
  return { path: dir, parent: parent === dir ? null : parent, dirs };
}
