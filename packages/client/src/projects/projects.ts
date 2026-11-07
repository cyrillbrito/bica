import { useLocation } from '@solidjs/router';
import { createMemo } from 'solid-js';

import { CHATS_ID } from '@bica/shared/projects';
import type {
  Project,
  ProjectEdit,
  SessionSummary,
  Workspace,
} from '@bica/shared/protocol';
import { useSessions } from '../sessions/sessions';
import { request, useTopic } from '../socket/socket';
import { useTerminals } from '../terminals/terminals';
import { stored } from '../ui/stored';
import { pageOf } from '../router';

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

export { CHATS_ID };

// The main folder is just "project": a label like "main" reads as the branch
// and clashes with the branch line below it.
/** "project" for the main folder, "project / folder" for a worktree. */
export function workspaceName(project: Project, path: string) {
  const workspace = project.workspaces.find((w) => w.path === path);
  if (workspace?.main || path === project.path) return project.name;
  return `${project.name} / ${folderName(path)}`;
}

/** Where a session runs or ran: its workspace, or the branch of a worktree since removed. */
export function whereOf(
  projects: Project[],
  s: Pick<SessionSummary, 'projectId' | 'cwd' | 'cleanedUp'>,
) {
  const project = projects.find((p) => p.id === s.projectId);
  if (!project) return undefined;
  if (s.cleanedUp?.branch) return `${project.name} / ${s.cleanedUp.branch}`;
  if (project.id === CHATS_ID || !s.cwd) return project.name;
  return workspaceName(project, s.cwd);
}

export interface Target {
  projectId: string;
  cwd?: string;
  // Start in a new worktree of the project instead.
  worktree?: boolean;
}

// Where new sessions start; remembered across visits.
const [target, saveTarget] = stored<Target | null>('target', null);

export function currentTarget() {
  return target() ?? undefined;
}

export const setCurrentTarget: (t: Target) => void = saveTarget;

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
      const page = pageOf(location);
      const here =
        page.kind === 'p'
          ? page
          : page.kind === 's'
            ? sessions().find((s) => s.id === page.id)
            : page.kind === 't'
              ? terminals().find((t) => t.id === page.id)
              : undefined;
      const projectId = here?.projectId;
      const cwd = here?.cwd;
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
