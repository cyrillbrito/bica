import { existsSync } from 'node:fs';
import { mkdir, readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import type {
  DirListing,
  Project,
  ProjectEdit,
  PullRequest,
  Workspace,
} from '@bica/shared/protocol';
import * as git from '../git/commands';
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

// Git is the source of truth: every worktree of the repo, wherever made.
async function workspacesOf(path: string, repo: boolean): Promise<Workspace[]> {
  const folder = [{ path, branch: null, main: true, pr: null }];
  if (!repo) return folder;
  try {
    const list = (await git.worktrees(path)).map((w): Workspace => ({
      ...w,
      pr: null,
    }));
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
  if (!(await git.isInsideRepo(path))) await git.initRepo(path);
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
  await projects.refresh();
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

/** Deletes a worktree's folder and its local branch, whatever is in them. */
export async function removeGitWorktree(projectId: string, path: string) {
  const project = await getProject(projectId);
  const w = project.workspaces.find((w) => w.path === path && !w.main);
  if (!w) throw new Error(`${path} is not a worktree of ${project.name}`);
  // The caller already checked for work.
  await git.removeWorktree(project.path, path);
  if (w.branch) await git.deleteBranch(project.path, w.branch).catch(() => {});
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
