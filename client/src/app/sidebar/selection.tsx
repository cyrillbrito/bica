import { useLocation, useNavigate } from '@solidjs/router';
import { createMemo, createSignal } from 'solid-js';

import type { SessionSummary } from '@bica/shared/protocol';
import { isBusy } from '@bica/shared/status';
import { paths } from '../../router';
import { setArchived } from '../../sessions/sessions';
import type { MenuEntry } from '../../ui/ContextMenu';
import { ArchiveIcon, CloseIcon, RestoreIcon } from '../../ui/icons';
import { closeDrawer } from '../../ui/layout';

/**
 * Sessions picked with ⌘ or shift click, for acting on many at once.
 * `rowOrder` is the rows in the order they're drawn, archived or not, since a
 * range never mixes the two lists.
 */
export function createSelection(props: {
  sessions: () => SessionSummary[];
  rowOrder: (archived: boolean) => SessionSummary[];
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [ids, setIds] = createSignal<string[]>([], {
    name: 'selectedSessions',
  });
  // Ids of sessions gone from the list drop out on their own.
  const selected = createMemo(
    () => props.sessions().filter((s) => ids().includes(s.id)),
    { name: 'selectedSummaries' },
  );
  const isSelected = (id: string) => ids().includes(id);
  const clear = () => setIds([]);
  const isOpen = (id: string) => location.pathname === paths.s(id)();
  // Where a shift click range starts: the last row clicked without shift.
  let anchor: string | undefined;

  const clickRow = (e: MouseEvent, s: SessionSummary, archivedRow = false) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      // The open session counts as picked when the first ⌘ click starts a selection.
      const open = props
        .sessions()
        .find((o) => isOpen(o.id) && !!o.archivedAt === archivedRow);
      setIds((ids) => {
        const base = !ids.length && open && open.id !== s.id ? [open.id] : ids;
        return base.includes(s.id)
          ? base.filter((id) => id !== s.id)
          : [...base, s.id];
      });
      anchor = s.id;
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      const order = props.rowOrder(archivedRow).map((o) => o.id);
      const open = order.find(isOpen);
      const from = order.indexOf(anchor ?? open ?? s.id);
      const to = order.indexOf(s.id);
      if (from < 0) {
        setIds([s.id]);
        anchor = s.id;
        return;
      }
      setIds(order.slice(Math.min(from, to), Math.max(from, to) + 1));
      return;
    }
    clear();
    anchor = s.id;
    closeDrawer();
  };

  const archive = async (list: SessionSummary[]) => {
    const ready = list.filter((s) => !s.archivedAt && !isBusy(s.status));
    const skipped = list.filter(
      (s) => !s.archivedAt && isBusy(s.status),
    ).length;
    clear();
    if (ready.some((s) => isOpen(s.id))) navigate(paths());
    await setArchived(
      ready,
      true,
      skipped ? `Skipped ${skipped} still running` : undefined,
    );
  };

  const unarchive = async (list: SessionSummary[]) => {
    clear();
    await setArchived(
      list.filter((s) => s.archivedAt),
      false,
    );
  };

  const menu = (list: SessionSummary[]): MenuEntry[] => {
    const active = list.filter((s) => !s.archivedAt);
    const gone = list.length - active.length;
    return [
      ...(active.length
        ? ([
            {
              label: `Archive ${active.length} sessions`,
              icon: <ArchiveIcon />,
              disabled:
                active.every((s) => isBusy(s.status)) && 'All still running',
              onSelect: () => void archive(list),
            },
          ] satisfies MenuEntry[])
        : []),
      ...(gone
        ? ([
            {
              label: `Unarchive ${gone} sessions`,
              icon: <RestoreIcon />,
              onSelect: () => void unarchive(list),
            },
          ] satisfies MenuEntry[])
        : []),
      'separator',
      { label: 'Clear selection', icon: <CloseIcon />, onSelect: clear },
    ];
  };

  return {
    ids,
    selected,
    isSelected,
    clear,
    clickRow,
    archive,
    unarchive,
    menu,
  };
}
