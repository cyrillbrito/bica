import { useLocation, useNavigate } from '@solidjs/router';
import { Show } from 'solid-js';

import { isWorkspacePage } from '../router';
import { IconButton } from '../ui/Button';
import { copyText } from '../ui/clipboard';
import { contextMenu, type MenuEntry } from '../ui/ContextMenu';
import { CloseIcon, CopyIcon, FilesIcon } from '../ui/icons';
import { closeDrawer } from '../ui/layout';
import { closeKept, openFromSearch, workspaceHref, type Kept } from './files';

// Every file shares the workspace page's path, so the router's
// aria-current can't tell them apart.
export function isOpenKept(
  k: Kept,
  location: { pathname: string; search: string },
) {
  return (
    isWorkspacePage(location, k.projectId, k.cwd) &&
    openFromSearch(location.search)?.path === k.path
  );
}

// The shortest run of parent folders that tells same-named files apart:
// "web/src" for packages/web/src/index.ts next to packages/server/src/index.ts.
function parentHint(path: string, paths: string[]) {
  const parts = path.split('/');
  const others = paths.filter((p) => p !== path);
  for (let n = 1; n < parts.length; n++) {
    const tail = parts.slice(-n).join('/');
    if (!others.some((o) => o === tail || o.endsWith(`/${tail}`)))
      return parts.slice(-n, -1).join('/');
  }
  return parts.slice(0, -1).join('/');
}

// A file kept open in the sidebar, under its workspace.
export default function KeptFileRow(p: { file: Kept; files: Kept[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isOpenFile = (k: Kept) => isOpenKept(k, location);

  const closeFile = (k: Kept) => {
    if (isOpenFile(k)) navigate(workspaceHref(k));
    closeKept(k, k.path);
  };

  const fileMenu = (k: Kept): MenuEntry[] => [
    { label: 'Close', icon: <CloseIcon />, onSelect: () => closeFile(k) },
    'separator',
    {
      label: 'Copy path',
      icon: <CopyIcon />,
      onSelect: () => void copyText(k.path),
    },
  ];

  // `files`: the workspace's other kept files, to tell same-named ones apart.

  const k = () => p.file;
  const name = () => k().path.split('/').pop()!;
  const hint = () => {
    const same = p.files
      .map((f) => f.path)
      .filter((path) => path.split('/').pop() === name());
    return same.length > 1 ? parentHint(k().path, same) : undefined;
  };
  return (
    <li data-flip={`f:${k().cwd}:${k().path}`}>
      <div
        class="group/file context-target relative rounded-md"
        {...contextMenu(() => fileMenu(k()))}
      >
        <a
          class={[
            'flex items-center gap-2 rounded-md py-[3px] pr-8 pl-2 transition-colors hover:bg-hover touch:py-3 touch:pr-11',
            isOpenFile(k()) && 'bg-active',
          ]}
          href={workspaceHref(k(), k())}
          title={k().path}
          onClick={closeDrawer}
        >
          <span class="-mx-0.75 text-muted">
            <FilesIcon />
          </span>
          <span class="min-w-0 flex-1 truncate">
            {name()}
            <Show when={hint()}>
              <span class="ml-1.5 text-meta text-muted">{hint()}</span>
            </Show>
          </span>
        </a>
        <IconButton
          size="sm"
          class="absolute inset-y-0 right-0.5 my-auto opacity-0 group-hover/file:opacity-100 focus-visible:opacity-100 touch:opacity-100"
          title={`Close ${name()}`}
          onClick={() => closeFile(k())}
        >
          <CloseIcon />
        </IconButton>
      </div>
    </li>
  );
}
