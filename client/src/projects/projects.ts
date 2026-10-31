import { useLocation } from '@solidjs/router';
import { createMemo, createSignal } from 'solid-js';

import type { Project, ProjectEdit, Workspace } from '@bica/shared/protocol';
import { useSessions } from '../sessions/sessions';
import { request, useTopic } from '../socket/socket';
import { useTerminals } from '../terminals/terminals';

export function useProjects() {
  return useTopic('projects', () => ({}));
}

export function addProject(path: string) {
  return request('project.add', { path });
}

export function reorderProjects(ids: string[]) {
  return request('project.reorder', { ids });
}

export function pinProject(id: string, pinned: boolean) {
  return request('project.pin', { id, pinned });
}

export function updateProject(id: string, edit: ProjectEdit) {
  return request('project.update', { id, ...edit });
}

export function listDirs(path?: string) {
  return request('fs.dirs', { path });
}

function baseName(path: string) {
  return path.split('/').filter(Boolean).pop() ?? path;
}

export const folderName = baseName;

/** The built-in project for chats: each starts in a new empty folder. */
export const CHATS_ID = 'chats';

// The main folder is just "project": a label like "main" reads as the branch
// and clashes with the branch line below it.
/** "project" for the main folder, "project / folder" for a worktree. */
export function workspaceName(project: Project, path: string) {
  const workspace = project.workspaces.find((w) => w.path === path);
  if (workspace?.main || path === project.path) return project.name;
  return `${project.name} / ${folderName(path)}`;
}

export interface Target {
  projectId: string;
  cwd?: string;
  // Start in a new worktree of the project instead.
  worktree?: boolean;
}

const KEY = 'bica.project';
const CWD_KEY = 'bica.cwd';
const WORKTREE_KEY = 'bica.worktree';

// Where new sessions start; remembered across visits.
const [currentTarget, setTarget] = createSignal<Target | undefined>(
  !localStorage.getItem(KEY)
    ? undefined
    : {
        projectId: localStorage.getItem(KEY)!,
        cwd: localStorage.getItem(CWD_KEY) ?? undefined,
        worktree: !!localStorage.getItem(WORKTREE_KEY),
      },
  { name: 'currentTarget' },
);

export { currentTarget };

export function setCurrentTarget(target: Target) {
  localStorage.setItem(KEY, target.projectId);
  if (target.cwd) localStorage.setItem(CWD_KEY, target.cwd);
  else localStorage.removeItem(CWD_KEY);
  if (target.worktree) localStorage.setItem(WORKTREE_KEY, '1');
  else localStorage.removeItem(WORKTREE_KEY);
  setTarget(target);
}

/** The remembered target if it still exists, else the first project's main folder. */
export function resolveTarget(projects: Project[], target?: Target) {
  const project =
    projects.find((p) => p.id === target?.projectId) ?? projects[0];
  if (!project) return undefined;
  const workspace: Workspace =
    (project.id === target?.projectId &&
      project.workspaces.find((w) => w.path === target.cwd)) ||
    project.workspaces.find((w) => w.path === project.path) ||
    project.workspaces[0]!;
  // A chat always gets a new folder.
  const worktree =
    project.id === CHATS_ID ||
    (project.id === target?.projectId && !!target.worktree);
  return { project, workspace, worktree };
}

/**
 * The workspace the current page is about: the workspace page's, or the
 * workspace the open session or terminal runs in.
 */
export function useCurrentWorkspace() {
  const location = useLocation();
  const projects = useProjects();
  const sessions = useSessions();
  const terminals = useTerminals();
  return createMemo(
    () => {
      const [, kind, id] = location.pathname.split('/');
      let projectId: string | null | undefined;
      let cwd: string | null | undefined;
      if (kind === 'p' && id) {
        projectId = decodeURIComponent(id);
        cwd = new URLSearchParams(location.search).get('w');
      } else if (kind === 's' && id) {
        const s = sessions().find((s) => s.id === decodeURIComponent(id));
        projectId = s?.projectId;
        cwd = s?.cwd;
      } else if (kind === 't' && id) {
        const t = terminals().find((t) => t.id === decodeURIComponent(id));
        projectId = t?.projectId;
        cwd = t?.cwd;
      }
      const project = projects().find((p) => p.id === projectId);
      if (!project) return undefined;
      const workspace =
        project.workspaces.find((w) => w.path === (cwd ?? project.path)) ??
        undefined;
      if (!workspace) return undefined;
      return {
        project,
        workspace,
        ref: { projectId: project.id, cwd: workspace.path },
      };
    },
    {
      name: 'currentWorkspace',
      // Keep the panel mounted while the same workspace stays open.
      equals: (a, b) =>
        a?.ref.projectId === b?.ref.projectId &&
        a?.ref.cwd === b?.ref.cwd &&
        a?.project === b?.project,
    },
  );
}
