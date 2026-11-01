import type { FileTreeRowDecoration, GitStatusEntry } from '@pierre/trees';
import { createEffect, createMemo, onSettled, untrack } from 'solid-js';

import { openContextMenu, type MenuEntry } from '../ui/ContextMenu';
import { isTouch } from '../ui/layout';

type Tree = InstanceType<(typeof import('@pierre/trees'))['FileTree']>;
export type TreeStatus = GitStatusEntry['status'];

// Pierre uses the path as both the row's id and its label. A flat list hands
// it bare file names, so nothing nests; files with the same name get zero
// width spaces in front, which keeps the ids unique and the icons right.
const UNIQUE = '\u200b';

// "a/b/c.ts" → ["a/", "a/b/"].
function folders(path: string) {
  return path
    .split('/')
    .slice(0, -1)
    .map((_, i, parts) => `${parts.slice(0, i + 1).join('/')}/`);
}

/**
 * Paths as a Pierre tree, or as a flat list. A click on a file opens it;
 * cmd/ctrl and shift clicks select several, and the menu acts on all of them.
 * A selected folder stands for every file under it.
 */
export default function FileTree(props: {
  paths: string[];
  status?: { path: string; status: TreeStatus }[];
  // The open file; the tree selects it.
  selected?: string;
  onOpen: (path: string) => void;
  menu?: (paths: string[]) => MenuEntry[];
  decoration?: (path: string) => FileTreeRowDecoration | null;
  flat?: boolean;
  // Every row shown, for lists inside a scrolling panel. Otherwise the tree
  // fills its parent, scrolls, reveals only the open file and has search.
  fit?: boolean;
}) {
  // Read once here: Pierre and the effects below read it outside any owner, and
  // a parent may pass an expression the compiler wraps in a fresh memo per read.
  const selected = createMemo(() => props.selected, {
    name: 'fileTreeSelected',
  });
  let host: HTMLDivElement | undefined;
  let tree: Tree | undefined;
  let loading: Promise<Tree> | undefined;
  let stop: (() => void) | undefined;
  let flat = false;
  let shown = '';

  let ids = new Map<string, string>();
  let real = new Map<string, string>();
  const index = (paths: string[]) => {
    ids = new Map();
    real = new Map();
    const seen = new Map<string, number>();
    for (const path of paths) {
      const name = path.slice(path.lastIndexOf('/') + 1);
      const n = seen.get(name) ?? 0;
      seen.set(name, n + 1);
      const id = UNIQUE.repeat(n) + name;
      ids.set(path, id);
      real.set(id, path);
    }
  };
  const out = (path: string) => (flat ? (ids.get(path) ?? path) : path);
  const back = (id: string) => (flat ? (real.get(id) ?? id) : id);
  const status = () =>
    (props.status ?? []).map((s) => ({ ...s, path: out(s.path) }));
  const expanded = (t?: Tree) => {
    if (flat) return [];
    const s = selected();
    if (!props.fit) return s ? folders(s) : [];
    // All open, except folders closed by hand that are still there.
    const all = new Set(props.paths.flatMap(folders));
    return [...all].filter(
      (f) =>
        (t?.getItem(f) as { isExpanded?: () => boolean })?.isExpanded?.() ??
        true,
    );
  };

  // Files, with folders swapped for the files under them.
  const files = (ids: readonly string[]) => {
    const set = new Set(props.paths);
    return [
      ...new Set(
        ids.map(back).flatMap((id) => {
          if (set.has(id)) return [id];
          const dir = id.endsWith('/') ? id : `${id}/`;
          return props.paths.filter((p) => p.startsWith(dir));
        }),
      ),
    ];
  };

  const select = (t: Tree) => {
    const s = selected();
    const want = s ? out(s) : undefined;
    const have = t.getSelectedPaths();
    if (have.length === (want ? 1 : 0) && (!want || have[0] === want)) return;
    for (const p of have) t.getItem(p)?.deselect();
    if (want) t.getItem(want)?.select();
  };

  const fit = (t: Tree) => {
    if (props.fit && host)
      host.style.height = `${t.getVisibleCount() * t.getItemHeight()}px`;
  };

  const create = () =>
    (loading ??= import('@pierre/trees').then((m) => {
      flat = !!props.flat;
      shown = props.paths.join('\n');
      index(props.paths);
      const t = new m.FileTree({
        paths: props.paths.map(out),
        gitStatus: status(),
        initialSelectedPaths: selected() ? [out(selected()!)] : [],
        initialExpandedPaths: expanded(),
        flattenEmptyDirectories: true,
        search: !props.fit,
        stickyFolders: !props.fit,
        itemHeight: isTouch() ? 44 : 28,
        // Long names shorten; the line counts beside them don't.
        unsafeCSS:
          '[data-item-section="decoration"]{flex:1 0 auto}[data-item-section="decoration"]>span{flex-shrink:0}',
        onSelectionChange: (ids) => {
          if (ids.length !== 1) return;
          const path = back(ids[0]!);
          if (path === selected() || !props.paths.includes(path)) return;
          props.onOpen(path);
        },
        renderRowDecoration: ({ item }) =>
          item.kind === 'file' && props.decoration
            ? props.decoration(back(item.path))
            : null,
        composition: props.menu && {
          contextMenu: {
            triggerMode: 'both',
            buttonVisibility: isTouch() ? 'always' : 'when-needed',
            onOpen: (item, ctx) => {
              const chosen = t.getSelectedPaths();
              const ids = chosen.includes(item.path) ? chosen : [item.path];
              const r = ctx.anchorRect;
              // Ours, not Pierre's: one menu look across the app.
              queueMicrotask(() => ctx.close({ restoreFocus: false }));
              openContextMenu(r.left, r.bottom + 4, props.menu!(files(ids)));
            },
          },
        },
      });
      t.render({ containerWrapper: host! });
      stop = t.subscribe(() => fit(t));
      fit(t);
      tree = t;
      return t;
    }));

  const destroy = () => {
    stop?.();
    tree?.cleanUp();
    host?.replaceChildren();
    tree = loading = undefined;
  };
  onSettled(() => destroy);

  // Reads the paths too, so the tree waits for them: create reads them
  // after an await, where a list still loading throws unseen.
  createEffect(
    () => ({ want: !!props.flat, paths: props.paths }),
    ({ want }) => {
      if (tree && want !== flat) destroy();
      void untrack(create);
    },
  );
  createEffect(
    () => props.paths,
    (paths) => {
      const key = paths.join('\n');
      if (!tree || key === shown) return;
      shown = key;
      index(paths);
      const t = tree;
      untrack(() =>
        t.resetPaths(
          paths.map(out),
          props.fit ? { initialExpandedPaths: expanded(t) } : undefined,
        ),
      );
    },
  );
  // Also redraws the decorations, which Pierre can't watch.
  createEffect(status, (entries) => tree?.setGitStatus(entries));
  createEffect(selected, () => tree && untrack(() => select(tree!)));

  return (
    <div
      ref={(el) => (host = el)}
      class={['file-tree', props.fit ? 'shrink-0' : 'min-h-0 flex-1']}
    />
  );
}
