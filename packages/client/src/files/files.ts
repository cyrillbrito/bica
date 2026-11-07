import { toast } from '../ui/Toast';
import { stored } from '../ui/stored';
import { pageOf, paths } from '../router';
import { fixtureKept, testing } from '../fixtures';
import type { WorkspaceRef } from '@bica/shared/protocol';
import { request, useTopic } from '../socket/socket';

/** What the main area shows: a file, or one side of a git change. */
export type View = 'file' | 'staged' | 'changes';

export function useFiles(ref: () => WorkspaceRef) {
  return useTopic('files', ref);
}

/** On the dev machine, so it only helps when you sit at it. */
export function openInEditor(ref: WorkspaceRef, path?: string) {
  return request('editor.open', { ...ref, path }).catch((e: unknown) =>
    toast.error(e),
  );
}

export function openPath(path: string, cwd?: string, reveal?: boolean) {
  return request('path.open', { path, cwd, reveal }).catch((e: unknown) =>
    toast.error(e),
  );
}

/**
 * Shows a path from a chat message in Bica, so it works away from the dev
 * machine too: a file in its workspace, over the chat when it is the
 * session's own. Files outside every workspace open in a new tab.
 */
export async function showPath(
  path: string,
  cwd: string | undefined,
  navigate: (href: string) => void,
) {
  const found = await request('path.find', { path, cwd }).catch(
    (e: unknown) => void toast.error(e),
  );
  if (!found) return;
  const { workspace } = found;
  if (workspace) {
    const open: Open = { path: found.path, view: 'file' };
    if (found.folder) navigate(workspaceHref(workspace));
    else if (workspace.cwd === cwd) navigate(openHref(workspace, open));
    else navigate(workspaceHref(workspace, open));
  } else if (found.url) {
    // Safari blocks a tab opened this long after the click; a tap on the
    // toast is a fresh one.
    const url = found.url;
    if (!window.open(url, '_blank'))
      toast(
        { title: 'Outside every workspace', description: found.path },
        {
          action: { label: 'Open', onClick: () => window.open(url, '_blank') },
        },
      );
  } else
    toast(
      { title: 'A folder outside every workspace', description: found.path },
      {
        action: {
          label: 'Show in Finder',
          onClick: () => void openPath(found.path),
        },
      },
    );
}

/** Saves a workspace file through the browser, at any size. */
export async function downloadFile(ref: WorkspaceRef, path: string) {
  try {
    const link = document.createElement('a');
    link.href = `${await request('file.link', { ...ref, path })}?download`;
    link.download = '';
    link.click();
  } catch (e) {
    toast.error(e);
  }
}

export function readFile(ref: WorkspaceRef, path: string) {
  return request('file.read', { ...ref, path });
}

export function workspaceHref(ref: WorkspaceRef, open?: Open) {
  const q = new URLSearchParams({ w: ref.cwd });
  if (open) setOpen(q, open);
  return `${String(paths.p(ref.projectId))}?${q}`;
}

export type Open = { path: string; view: View };

export function sameOpen(a?: Open, b?: Open) {
  return a?.path === b?.path && a?.view === b?.view;
}

function setOpen(q: URLSearchParams, open: Open) {
  q.set(open.view === 'file' ? 'f' : 'd', open.path);
  if (open.view !== 'file') q.set('s', open.view);
}

/** A session page with a file open over its chat. */
export function sessionFileHref(id: string, open: Open) {
  const q = new URLSearchParams();
  setOpen(q, open);
  return `${String(paths.s(id))}?${q}`;
}

/**
 * Where opening a file from the side panel goes: over the chat when a
 * session is open, so closing it lands back in the session; the workspace page
 * otherwise. Read at click time, so the plain location is enough.
 */
export function openHref(ref: WorkspaceRef, open: Open) {
  const page = pageOf(location);
  return page.kind === 's'
    ? sessionFileHref(page.id, open)
    : workspaceHref(ref, open);
}

export type Kept = WorkspaceRef & Open;

// ponytail: per device in localStorage; move to the server if laptop and
// phone should share them.
const [keptHere, setKept] = stored<Kept[]>('kept', []);
/** Reactive: files kept open on this device (test data stands in, see fixtures/). */
export function kept() {
  return fixtureKept() ?? keptHere();
}

function samePlace(a: Kept, ref: WorkspaceRef, path: string) {
  return a.projectId === ref.projectId && a.cwd === ref.cwd && a.path === path;
}

export function isKept(ref: WorkspaceRef, path: string) {
  return kept().some((k) => samePlace(k, ref, path));
}

function saveKept(list: Kept[]) {
  // Test data must never land in this device's real list.
  if (testing()) return;
  setKept(list);
}

export function keepOpen(ref: WorkspaceRef, open: Open) {
  return saveKept([
    ...kept().filter((k) => !samePlace(k, ref, open.path)),
    { projectId: ref.projectId, cwd: ref.cwd, ...open },
  ]);
}

export function closeKept(ref: WorkspaceRef, path: string) {
  return saveKept(kept().filter((k) => !samePlace(k, ref, path)));
}

/**
 * The file open on a workspace page: ?f=path, or ?d=path&s=staged|changes.
 */
export function openFromSearch(search: string) {
  const q = new URLSearchParams(search);
  const file = q.get('f');
  if (file) return { path: file, view: 'file' as View };
  const path = q.get('d');
  if (!path) return undefined;
  const s = q.get('s');
  const view: View = s === 'staged' ? s : 'changes';
  return { path, view };
}
