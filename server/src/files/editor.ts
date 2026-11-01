import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { FoundPath, WorkspaceRef } from '@bica/shared/protocol';
import { listProjects } from '../projects/projects';
import { fileLink } from './download';
import { inside, open } from '../projects/workspace';

/**
 * Opens a workspace, or a file in it, in the editor on the dev machine. Bun
 * picks it from VISUAL or EDITOR (or `debug.editor` in bunfig.toml), and only
 * knows GUI editors such as VS Code and Sublime.
 */
export async function openInEditor(ref: WorkspaceRef, path?: string) {
  const { cwd } = await open(ref);
  Bun.openInEditor(path ? inside(cwd, path) : cwd);
}

/**
 * Opens a path from a chat message: a file in the editor, at `:line:column`
 * if given, and a folder (or any path with `reveal`) in Finder. Unlike
 * openInEditor it may point anywhere, since agents write reports outside
 * the workspace.
 */
export async function openPath(path: string, cwd?: string, reveal = false) {
  const { file, line, column, info } = await locate(path, cwd);
  if (reveal || info.isDirectory()) {
    const mac = process.platform === 'darwin';
    Bun.spawn(
      mac ? ['open', ...(reveal ? ['-R'] : []), file] : ['xdg-open', file],
    );
    return;
  }
  Bun.openInEditor(file, {
    line: line ? Number(line) : undefined,
    column: column ? Number(column) : undefined,
  });
}

/**
 * Where a path from a chat message opens in Bica: the workspace it is in,
 * the deepest one when worktrees nest, or a link that serves it.
 */
export async function findPath(path: string, cwd?: string): Promise<FoundPath> {
  const { file, info } = await locate(path, cwd);
  const folder = info.isDirectory();
  let found: FoundPath | undefined;
  for (const project of await listProjects())
    for (const w of project.workspaces)
      if (
        (file === w.path || file.startsWith(w.path + sep)) &&
        (!found?.workspace || w.path.length > found.workspace.cwd.length)
      )
        found = {
          workspace: { projectId: project.id, cwd: w.path },
          path: relative(w.path, file),
          folder,
        };
  return (
    found ?? {
      workspace: null,
      path: file,
      folder,
      url: folder ? undefined : fileLink(file),
    }
  );
}

/** A chat message's path, which may end in `:line:column`, on disk. */
async function locate(path: string, cwd?: string) {
  const [, name = path, line, column] = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(
    path,
  )!;
  let file = name;
  if (file === '~' || file.startsWith('~/')) file = homedir() + file.slice(1);
  else if (!isAbsolute(file)) {
    if (!cwd) throw new Error(`No folder to find ${name} in`);
    file = resolve(cwd, file);
  }
  const info = await stat(file).catch(() => undefined);
  if (!info) throw new Error(`Not found: ${name}`);
  return { file, line, column, info };
}
