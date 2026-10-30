import { useLocation, useSearchParams } from '@solidjs/router';
import { Dynamic } from '@solidjs/web';
import {
  Errored,
  For,
  Loading,
  Show,
  createMemo,
  createSignal,
  type Component,
} from 'solid-js';

import type { WorkspaceRef } from '@bica/shared/protocol';
import { openFromSearch, type Open } from '../files/files';
import { filesTab } from '../files/FilesTab';
import { gitTab } from '../git/GitTab';
import { useCurrentWorkspace } from '../projects/projects';
import { IconButton } from '../ui/Button';
import Empty from '../ui/Empty';
import Failed from '../ui/Failed';
import { CloseIcon } from '../ui/icons';
import { closeDrawer } from '../ui/layout';
import { moveFocus } from '../ui/listKeys';

/** What a tab's content gets: where the panel stands. */
type PanelTabProps = {
  workspace: WorkspaceRef;
  /** The file or diff open in the main area. */
  open: Open | undefined;
};

// Each feature defines its tab next to its code and doesn't import this:
// only routes/ and App.tsx import app/ (docs/architecture.md). The list below
// checks each one against it.
type PanelTab = {
  id: string;
  label: string;
  icon: Component;
  /** Header buttons while the tab is picked. */
  actions?: Component;
  content: Component<PanelTabProps>;
};

// In the order they show.
const TABS: PanelTab[] = [filesTab, gitTab];
// Where an unknown ?panel= falls back to, such as an old link to a removed tab.
const FALLBACK = gitTab.id;

// Links that drop ?panel= show the last tab picked: switching workspaces, you
// usually want the same kind of view.
const [lastPicked, setLastPicked] = createSignal(FALLBACK, {
  name: 'panelLastPicked',
});

export default function SidePanel() {
  const location = useLocation();
  const [search, setSearch] = useSearchParams<{ panel: string }>();
  const current = useCurrentWorkspace();
  const shown = createMemo(
    () => {
      const want = search.panel ?? lastPicked();
      return (
        TABS.find((t) => t.id === want) ?? TABS.find((t) => t.id === FALLBACK)!
      );
    },
    { name: 'panelShown' },
  );
  // In the URL, so a reload or a link opens the same tab; replaced, so
  // switching tabs doesn't fill Back.
  const pick = (id: string) => {
    setLastPicked(id);
    setSearch({ panel: id }, { replace: true });
  };
  // Project and session pages open files; elsewhere nothing is selected.
  const open = createMemo(
    () =>
      /^\/[ps]\//.test(location.pathname)
        ? openFromSearch(location.search)
        : undefined,
    { name: 'panelOpen' },
  );

  return (
    <aside
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-line bg-panel xl:border-l"
      aria-label="Workspace"
    >
      <header class="flex h-12 shrink-0 items-center gap-1 border-b border-line px-2 touch:h-14">
        {/* Arrow keys move between the tabs, and only the picked one is in
            the Tab order, as the ARIA tabs pattern has it. */}
        <div
          class="flex items-center gap-1"
          role="tablist"
          aria-label="Side panel"
        >
          <For each={TABS}>
            {(t) => (
              <button
                id={`side-tab-${t.id}`}
                class="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-muted transition-colors hover:text-fg aria-selected:bg-active aria-selected:text-fg touch:h-11"
                role="tab"
                aria-selected={shown() === t ? 'true' : 'false'}
                aria-controls="side-panel"
                tabindex={shown() === t ? 0 : -1}
                onClick={() => pick(t.id)}
                onKeyDown={(e) =>
                  moveFocus(
                    e,
                    [
                      ...e.currentTarget.parentElement!.querySelectorAll<HTMLElement>(
                        '[role=tab]',
                      ),
                    ],
                    true,
                  )?.click()
                }
              >
                <Dynamic component={t.icon} /> {t.label}
              </button>
            )}
          </For>
        </div>
        <div class="ml-auto flex items-center gap-1">
          <Show when={shown().actions}>
            {(actions) => <Dynamic component={actions()} />}
          </Show>
          <IconButton class="xl:hidden" title="Close" onClick={closeDrawer}>
            <CloseIcon />
          </IconButton>
        </div>
      </header>
      <Errored fallback={(error) => <Failed error={error()} />}>
        {/* Keyed so a new page's or tab's data blanks the panel instead of
            holding the old one (see Page in App.tsx). */}
        <Loading
          on={[location.pathname, current()?.workspace.path, shown().id]}
        >
          <Show
            when={current()}
            fallback={<Empty>Open a project or session to see its files</Empty>}
          >
            {(c) => (
              <div
                id="side-panel"
                class="flex min-h-0 min-w-0 flex-1 flex-col"
                role="tabpanel"
                aria-labelledby={`side-tab-${shown().id}`}
              >
                <Dynamic
                  component={shown().content}
                  workspace={c().ref}
                  open={open()}
                />
              </div>
            )}
          </Show>
        </Loading>
      </Errored>
    </aside>
  );
}
