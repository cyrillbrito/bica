// A workspace the browser names by ref: checked against the project before
// git or file code touches its folder.
import { stat } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';

import type { WorkspaceRef } from '@bica/shared/protocol';
import { getProject } from './projects';

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

export function isRepo(dir: string) {
  return stat(join(dir, '.git')).then(
    () => true,
    () => false,
  );
}
