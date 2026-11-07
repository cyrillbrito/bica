import { existsSync } from 'node:fs';
import { mkdir, readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import type {
  DirListing,
  Project,
  ProjectEdit,
  Workspace,
} from '@bica/shared/protocol';
import { CHATS_ID } from '@bica/shared/projects';
import * as git from '../git/commands';
import { pullRequests } from './github';
import { live } from '../live';
import { BICA_HOME, jsonFile } from '../storage';

export { CHATS_ID };

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

export function slugify(title: string, fallback: string) {
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

export function refreshProjects() {
  return projects.refresh();
}

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
