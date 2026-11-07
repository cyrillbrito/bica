import { useLocation, useNavigate } from '@solidjs/router';
import { For, Show, createMemo, createSignal, onCleanup } from 'solid-js';

import type { SessionSummary } from '@bica/shared/protocol';
import { isBusy, needsYou } from '@bica/shared/status';
import { kept } from '../../files/files';
import PlanUsage from '../../models/PlanUsage';
import { openProjectPicker } from '../../projects/ProjectPicker';
import {
  CHATS_ID,
  reorderProjects,
  useProjects,
  whereOf,
} from '../../projects/projects';
import { paths } from '../../router';
import { useHub, useSessions } from '../../sessions/sessions';
import StatusDot from '../../sessions/StatusDot';
import { useTerminals } from '../../terminals/terminals';
import { useBadge, useChimes } from '../../sessions/alerts';
import { IconButton } from '../../ui/Button';
import { contextMenu, openContextMenu } from '../../ui/ContextMenu';
import Divider, { dividerClass } from '../../ui/Divider';
import { createFlip } from '../../ui/flip';
import {
  ArchiveIcon,
  ChevronsUpDownIcon,
  CloseIcon,
  CommandIcon,
  HubIcon,
  InboxIcon,
  PlusIcon,
  RestoreIcon,
} from '../../ui/icons';
import { closeDrawer } from '../../ui/layout';
import { Logo } from '../../ui/Logo';
import { Segmented, SegmentCount, segmentClass } from '../../ui/Segmented';
import { createSortable, type Drag } from '../../ui/sortable';
import { stored } from '../../ui/stored';
import { toast } from '../../ui/Toast';
import { openPalette } from '../palette/CommandPalette';
import { SidebarContext, type SidebarRows } from './context';
import { bySection, workspaceGroups, type Group } from './groups';
import { createSidebarMenus } from './menus';
import { createSelection } from './selection';
import SessionRow from './SessionRow';
import {
  ParkedRow,
  plainWorkspace,
  WorkspaceHeader,
  WorkspaceRows,
} from './WorkspaceRows';

// Where a dragged project would land, between two projects.
const DROP_LINE =
  "before:absolute before:inset-x-2 before:h-0.5 before:rounded-full before:bg-muted before:content-['']";

// The inbox tabs on top, after affectUI's Agent Inbox. Active: what needs
// you or still runs, everything in play. A session that moved in the last
// 10 minutes stays too, since you likely just read it.
type Filter = 'all' | 'active';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
];
const RECENT = 10 * 60_000;
const [parkedOpen, setParkedOpen] = stored('parkedOpen', true);

export default function Sidebar() {
  const sessions = useSessions();
  useChimes(sessions);
  useBadge(sessions);
  const projects = useProjects();
  const terminals = useTerminals();
  const navigate = useNavigate();
  const location = useLocation();
  const [renaming, setRenaming] = createSignal<string>();
  // Listed on its own at the top, not under a project.
  const hub = useHub();

  const groups = createMemo(
    () => {
      const list = sessions().filter(
        (s) => !s.archivedAt && s.id !== hub()?.id,
      );
      return workspaceGroups(projects(), terminals(), kept(), list);
    },
    { name: 'sidebarGroups' },
  );

  // Workspaces with nothing open (often a PR waiting on review) shrink to one
  // line in Parked, so the list above is only what's in progress.
  const isParked = (g: Group) =>
    !g.pinned && !g.sessions.length && !g.terminals.length && !g.files.length;
  const active = createMemo(() => groups().filter((g) => !isParked(g)), {
    name: 'activeGroups',
  });
  const parked = createMemo(() => groups().filter(isParked), {
    name: 'parkedGroups',
  });
  // The open session is being read; the server catches up a moment later.
  const isOpen = (s: SessionSummary) => location.pathname === paths.s(s.id)();
  const statusOf = (s: SessionSummary) =>
    s.status === 'done' && isOpen(s) ? 'idle' : s.status;
  // Ticks each minute so recent sessions leave Needs you on time.
  const [now, setNow] = createSignal(Date.now(), { name: 'sidebarMinute' });
  const minute = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(minute));
  const inFilter = (f: Filter, s: SessionSummary) =>
    f === 'all' ||
    needsYou(statusOf(s)) ||
    isBusy(s.status) ||
    now() - s.updatedAt < RECENT;

  const [filter, setFilter] = createSignal<Filter>('all', {
    name: 'sidebarFilter',
  });
  // Pointing at a tab fades the rows it would leave out.
  const [peek, setPeek] = createSignal<Filter | undefined>(undefined, {
    name: 'sidebarPeek',
  });
  const live = createMemo(
    () => sessions().filter((s) => !s.archivedAt && s.id !== hub()?.id),
    {
      name: 'liveSessions',
    },
  );
  const count = (f: Filter) => live().filter((s) => inFilter(f, s)).length;
  // A filter keeps only matching sessions, plus the open one, so the row
  // you are reading doesn't vanish under you once it's marked read.
  const sections = createMemo(
    () => {
      const f = filter();
      if (f === 'all') return bySection(active());
      return bySection(
        active()
          .map((g) => ({
            ...g,
            terminals: [],
            files: [],
            sessions: g.sessions.filter((s) => isOpen(s) || inFilter(f, s)),
          }))
          .filter((g) => g.sessions.length),
      );
    },
    { name: 'sidebarSections' },
  );
  // A dropped project's new order of projects, until the server has it.
  const [savingOrder, setSavingOrder] = createSignal<string[] | undefined>(
    undefined,
    { name: 'savingProjectOrder' },
  );
  // Chats and No project stay last.
  const movable = (key: string) => key !== CHATS_ID && key !== '';
  const ordered = createMemo(
    () => {
      const order = savingOrder();
      if (!order) return sections();
      const rank = new Map(order.map((key, i) => [key, i]));
      const last = order.length;
      return [...sections()].sort(
        (a, b) => (rank.get(a.key) ?? last) - (rank.get(b.key) ?? last),
      );
    },
    { name: 'orderedSections' },
  );
  const shownMovable = () =>
    ordered()
      .map((s) => s.key)
      .filter(movable);
  // Where a drop lands: before a project, or after the last one, since
  // Chats stays last. Undefined: right where it already is.
  const dropAt = (drag: Drag) => {
    const shown = shownMovable();
    const before =
      drag.before && movable(drag.before) ? drag.before : undefined;
    const after = before ? undefined : shown.at(-1);
    const at = shown.indexOf(drag.id);
    if (before === drag.id || before === shown[at + 1] || after === drag.id)
      return undefined;
    return before
      ? { key: before, side: 'before' as const }
      : after
        ? { key: after, side: 'after' as const }
        : undefined;
  };
  const sortable = createSortable({
    onDrop: (id, before) => {
      const at = dropAt({ id, before, top: 0, left: 0, width: 0 });
      if (!at) return;
      // Only the dragged project moves, so projects the list hides (parked,
      // filtered out) keep their places.
      const next = projects()
        .map((p) => p.id)
        .filter((p) => movable(p) && p !== id);
      const i = next.indexOf(at.key);
      next.splice(at.side === 'before' ? i : i + 1, 0, id);
      setSavingOrder(next);
      reorderProjects(next)
        .catch((e) => toast.error(e))
        .finally(() => setSavingOrder(undefined));
    },
  });
  const drop = createMemo(
    () => {
      const d = sortable.drag();
      return d && dropAt(d);
    },
    { name: 'projectDrop' },
  );
  const parkedSections = createMemo(() => bySection(parked()), {
    name: 'parkedSections',
  });

  const archived = createMemo(() => sessions().filter((s) => s.archivedAt), {
    name: 'archivedSessions',
  });
  const [archivedOpen, setArchivedOpen] = createSignal(false, {
    name: 'archivedOpen',
  });

  const selection = createSelection({
    sessions,
    // The rows in the order they're drawn.
    rowOrder: (archivedRows) =>
      archivedRows
        ? archived()
        : sections().flatMap((s) => s.groups.flatMap((g) => g.sessions)),
  });
  const menus = createSidebarMenus({ rename: setRenaming });

  const rows: SidebarRows = {
    statusOf,
    dimmed: (s) => {
      const f = peek();
      return !!f && !inFilter(f, s);
    },
    renaming,
    setRenaming,
    isSelected: selection.isSelected,
    clickRow: selection.clickRow,
    // Right click on one of several picked rows acts on all of them.
    rowMenu: (s) =>
      selection.selected().length > 1 && selection.isSelected(s.id)
        ? selection.menu(selection.selected())
        : menus.sessionMenu(s),
    whereOf: (s) => whereOf(projects(), s),
    workspaceMenu: menus.workspaceMenu,
    newSession: menus.newSession,
    removeWorkspace: menus.removeWorkspace,
  };

  // Rows glide when the list's order changes: a new session, one archived,
  // a workspace back from Parked, a filter picked. Not on every snapshot.
  let list: HTMLDivElement | undefined;
  const order = createMemo(
    () =>
      [
        filter(),
        archivedOpen(),
        ...ordered().flatMap((s) =>
          s.groups.flatMap((g) => [
            g.key,
            ...g.terminals.map((t) => t.id),
            ...g.files.map((k) => k.path),
            ...g.sessions.map((s) => s.id),
          ]),
        ),
        ...parked().map((g) => g.key),
        archived().length,
      ].join('\n'),
    { name: 'sidebarOrder' },
  );
  createFlip(() => list, order, sortable.dragging);

  return (
    <SidebarContext value={rows}>
      <nav
        class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-line bg-panel pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)]"
        aria-label="Sessions"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && selection.ids().length) {
            e.stopPropagation();
            selection.clear();
          }
        }}
      >
        <header class="flex h-12 shrink-0 items-center gap-1 px-2">
          <button
            class="flex h-8 min-w-0 items-center gap-2 rounded-lg pr-1.5 pl-2 transition-colors hover:bg-hover data-menu-open:bg-active touch:h-11"
            aria-haspopup="menu"
            title="Bica menu"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              openContextMenu(
                r.left,
                r.bottom + 4,
                menus.appMenu(),
                e.currentTarget,
              );
            }}
          >
            <Logo size={20} />
            <span class="font-semibold tracking-tight">Bica</span>
            <span class="text-muted [&_svg]:size-3.5">
              <ChevronsUpDownIcon />
            </span>
          </button>
          <span class="flex-1" />
          <IconButton
            title="Commands (⌘K)"
            onClick={() => {
              closeDrawer();
              openPalette();
            }}
          >
            <CommandIcon />
          </IconButton>
          <IconButton
            title="New session"
            onClick={() => {
              closeDrawer();
              navigate(paths());
            }}
          >
            <PlusIcon />
          </IconButton>
        </header>
        <Show when={live().length}>
          <div class="shrink-0 px-2 pb-2" onPointerLeave={() => setPeek()}>
            <Segmented class="w-full">
              <For each={FILTERS}>
                {(f) => (
                  <button
                    type="button"
                    class={[segmentClass, 'flex-1 px-1.5 whitespace-nowrap']}
                    data-on={filter() === f.id || undefined}
                    aria-pressed={filter() === f.id ? 'true' : 'false'}
                    onClick={() => setFilter(f.id)}
                    onPointerEnter={() => setPeek(f.id)}
                    onFocus={() => setPeek(f.id)}
                    onBlur={() => setPeek()}
                  >
                    {f.label}
                    {/* All's count says little and costs the room the others need. */}
                    <Show when={f.id !== 'all'}>
                      <SegmentCount value={count(f.id)} />
                    </Show>
                  </button>
                )}
              </For>
            </Segmented>
          </div>
        </Show>
        <div
          ref={(el) => (list = el)}
          class="flex-1 overflow-y-auto overscroll-contain pr-1 pl-2 pb-[max(--spacing(2),env(safe-area-inset-bottom))]"
        >
          {/* Chats is always listed, so it doesn't count as a project here. */}
          <Show
            when={
              projects().every((p) => p.id === CHATS_ID) && !sessions().length
            }
          >
            <button
              class="w-full rounded-lg px-2.5 py-2 text-left text-muted transition-colors hover:bg-hover hover:text-fg"
              onClick={openProjectPicker}
            >
              Add a project to start
            </button>
          </Show>
          <Show when={filter() !== 'all' && !sections().length}>
            <div class="appear flex flex-col items-center gap-2 px-4 pt-10 text-center text-muted">
              <span class="grid size-9 place-items-center rounded-full bg-hover">
                <InboxIcon />
              </span>
              Nothing in play
            </div>
          </Show>
          {/* Always here, so the hub is one tap away even before it exists. */}
          <a
            class="mt-2 flex items-center gap-2 rounded-md px-2 py-[3px] transition-colors hover:bg-hover aria-[current=page]:bg-active touch:py-3"
            href={paths.hub()}
            aria-current={
              location.pathname === paths.hub() ? 'page' : undefined
            }
            title="The hub: one session that coordinates the others"
            onClick={closeDrawer}
          >
            <span class="text-muted">
              <HubIcon />
            </span>
            <span class="flex-1 truncate font-semibold">Hub</span>
            <Show when={hub()}>
              {(h) => <StatusDot status={statusOf(h())} />}
            </Show>
          </a>
          <For each={ordered()} keyed={(s) => s.key}>
            {(s) => (
              <section
                ref={sortable.item(() => s().key)}
                // While a project drags, each shrinks to its header, so the
                // whole list fits and the drop line has short hops.
                class={[
                  'relative',
                  sortable.drag() ? 'my-2' : 'mt-1.5 mb-3',
                  sortable.drag()?.id === s().key && 'opacity-40',
                  drop()?.key === s().key &&
                    (drop()!.side === 'before'
                      ? DROP_LINE + ' before:-top-[5px]'
                      : DROP_LINE + ' before:-bottom-[5px]'),
                ]}
              >
                {/* A project's only workspace shares its line, unless its
                  branch is worth naming: then it gets its own row, as with
                  several, so every header is one line. */}
                <Show
                  when={s().groups.length > 1 || !plainWorkspace(s().groups[0])}
                  fallback={
                    <div class="group">
                      <WorkspaceHeader
                        group={s().groups[0]}
                        project={s().name}
                      />
                      <Show when={!sortable.drag()}>
                        <WorkspaceRows group={s().groups[0]} />
                      </Show>
                    </div>
                  }
                >
                  {/* Ellipsis needs a block: on the flex row it clipped mid-letter. */}
                  <h2
                    data-flip={`p:${s().key}`}
                    data-drag-handle={movable(s().key) || undefined}
                    class="context-target flex min-h-7 items-center pl-2 font-semibold"
                    title={s().name}
                    {...contextMenu(() => {
                      const main =
                        s().groups.find((g) => g.target && !g.worktree) ??
                        (s().groups.length === 1 ? s().groups[0] : undefined);
                      return main ? menus.workspaceMenu(main) : [];
                    })}
                  >
                    <span class="min-w-0 truncate">{s().name}</span>
                  </h2>
                  {/* Branches add no indent of their own: the icon and the
                    lighter type set them apart, and the guide line under
                    each shows which sessions are whose. */}
                  <Show when={!sortable.drag()}>
                    <For each={s().groups} keyed={(g) => g.key}>
                      {(g) => (
                        <div class="group [&+&]:mt-1">
                          <WorkspaceHeader group={g()} />
                          <WorkspaceRows group={g()} />
                        </div>
                      )}
                    </For>
                  </Show>
                </Show>
              </section>
            )}
          </For>
          {/* The dragged project's header, in the top layer so a drawer's
            transform can't offset it. */}
          <Show when={sortable.drag()}>
            {(d) => (
              <div
                popover="manual"
                ref={(el) =>
                  requestAnimationFrame(
                    () => el.isConnected && el.showPopover(),
                  )
                }
                class="pointer-events-none fixed m-0 flex min-h-8 items-center rounded-lg border-0 bg-surface px-2 font-semibold text-fg shadow-sheet ring-1 ring-line"
                style={{
                  inset: 'auto',
                  top: `${d().top}px`,
                  left: `${d().left}px`,
                  width: `${d().width}px`,
                }}
              >
                <span class="min-w-0 truncate">
                  {ordered().find((s) => s.key === d().id)?.name}
                </span>
              </div>
            )}
          </Show>
          <Show when={filter() === 'all' && parked().length}>
            <details
              class="group/parked expand mt-1 mb-3"
              open={parkedOpen()}
              onToggle={(e) => setParkedOpen(e.currentTarget.open)}
            >
              <summary
                data-flip="d:parked"
                class={[dividerClass, 'pr-1.5 pl-2']}
              >
                <Divider
                  label="Parked"
                  count={parked().length}
                  chevron="group-open/parked:rotate-90"
                />
              </summary>
              {/* Like the list above: a project with several parked workspaces
                names them once. */}
              <ul class="mt-0.5">
                <For each={parkedSections()} keyed={(s) => s.key}>
                  {(s) => (
                    <Show
                      when={s().groups.length > 1}
                      fallback={<ParkedRow group={s().groups[0]} project />}
                    >
                      <li
                        data-flip={`pl:${s().key}`}
                        class="px-2 pt-1 text-meta text-muted"
                      >
                        {s().name}
                      </li>
                      <For each={s().groups} keyed={(g) => g.key}>
                        {(g) => <ParkedRow group={g()} />}
                      </For>
                    </Show>
                  )}
                </For>
              </ul>
            </details>
          </Show>
          <Show when={filter() === 'all' && archived().length}>
            <details
              class="group/archived expand mt-1 mb-3"
              onToggle={(e) => setArchivedOpen(e.currentTarget.open)}
            >
              <summary
                data-flip="d:archived"
                class={[dividerClass, 'pr-1.5 pl-2']}
              >
                <Divider
                  label="Archived"
                  count={archived().length}
                  chevron="group-open/archived:rotate-90"
                />
              </summary>
              {/* Drawn only while open: it grows for good, and closed is the usual. */}
              <Show when={archivedOpen()}>
                <ul class="mt-0.5">
                  <For each={archived()} keyed={(s) => s.id}>
                    {(s) => <SessionRow session={s()} archived />}
                  </For>
                </ul>
              </Show>
            </details>
          </Show>
        </div>
        <Show when={selection.selected().length > 1}>
          <div class="appear flex h-12 shrink-0 items-center gap-1 border-t border-line pr-2 pl-4">
            <span class="flex-1 text-muted tabular-nums">
              {selection.selected().length} selected
            </span>
            <Show when={selection.selected().some((s) => !s.archivedAt)}>
              <IconButton
                title="Archive selected"
                onClick={() => void selection.archive(selection.selected())}
              >
                <ArchiveIcon />
              </IconButton>
            </Show>
            <Show when={selection.selected().some((s) => s.archivedAt)}>
              <IconButton
                title="Unarchive selected"
                onClick={() => void selection.unarchive(selection.selected())}
              >
                <RestoreIcon />
              </IconButton>
            </Show>
            <IconButton title="Clear selection (Esc)" onClick={selection.clear}>
              <CloseIcon />
            </IconButton>
          </div>
        </Show>
        <PlanUsage />
      </nav>
    </SidebarContext>
  );
}
