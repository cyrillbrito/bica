import { createMemo, untrack } from 'solid-js';

import type { GitChange } from '@bica/shared/protocol';
import FileTree, { type TreeStatus } from './FileTree';
import type { MenuEntry } from '../ui/ContextMenu';
import { stored } from '../ui/stored';

export const TREE_STATUS: Record<GitChange['status'], TreeStatus> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  U: 'untracked',
  '!': 'modified',
};

// Tree or flat list, per device, for every changes list at once.
const [asList, setAsList] = stored('changesAsList', false);
export { asList };
export function toggleAsList() {
  setAsList(!asList());
}

export default function ChangeList(props: {
  changes: GitChange[];
  open?: string;
  onOpen: (change: GitChange) => void;
  menu: (changes: GitChange[]) => MenuEntry[];
}) {
  const byPath = createMemo(
    () => new Map(props.changes.map((c) => [c.path, c])),
  );
  const pick = (paths: string[]) => paths.flatMap((p) => byPath().get(p) ?? []);
  return (
    <FileTree
      fit
      flat={asList()}
      paths={props.changes.map((c) => c.path)}
      status={props.changes.map((c) => ({
        path: c.path,
        status: TREE_STATUS[c.status],
      }))}
      selected={props.open}
      onOpen={(path) => {
        const c = byPath().get(path);
        if (c) props.onOpen(c);
      }}
      menu={(paths) => props.menu(pick(paths))}
      decoration={(path) => {
        // Called by the tree per row; it redraws when `paths` or `status` change.
        const c = untrack(byPath).get(path);
        if (!c?.added && !c?.removed) return null;
        const parts = [
          c.added && { text: `+${c.added}`, color: 'var(--color-running)' },
          c.removed && { text: `−${c.removed}`, color: 'var(--color-danger)' },
        ].filter((p) => !!p);
        return {
          text: parts.map((p) => p.text).join('\u00a0'),
          parts: parts.flatMap((p, i) => (i ? [{ text: '\u00a0' }, p] : [p])),
        };
      }}
    />
  );
}
