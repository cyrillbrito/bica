// Port of BoardUI's application/dashboard/dashboard-sidebar.tsx (MIT): the
// floating panel, collapse to a 60px rail, Quick Search (⌘L) that filters the
// rows, nav rows with the blue selected fill, and the footer. The team and
// user menus are simpler stand-ins built on Dropdown, and the theme toggle is
// a plain segmented control (BoardUI's has a view-transition reveal).
import type { JSX } from '@solidjs/web';
import {
  For,
  Show,
  createContext,
  createSignal,
  onSettled,
  useContext,
} from 'solid-js';

import { Avatar, Badge, Kbd } from '../ui/display';
import { CloseButton } from '../ui/buttons';
import { ChevronUpDownSmall } from '../ui/chevrons';
import { cx } from '../ui/cx';
import { Glyph, type IconComponent } from '../ui/icon';
import {
  RiCloseLine,
  RiCustomerServiceLine,
  RiLogoutBoxRLine,
  RiMoonLine,
  RiSearchLine,
  RiSettings4Line,
  RiSideBarFill,
  RiSunLine,
  RiUserLine,
} from '../ui/icons';
import {
  Dropdown,
  DropdownDivider,
  DropdownGroup,
  DropdownItem,
} from '../ui/menus';

/** What the rows below read: whether the rail is collapsed, and the query. */
const SidebarContext = createContext<{
  collapsed: () => boolean;
  query: () => string;
}>();

export const useSidebar = () => useContext(SidebarContext);

/** A label or badge that blurs and shrinks away as the rail collapses. */
export function Collapsible(props: { class?: string; children: JSX.Element }) {
  const sidebar = useSidebar();
  return (
    <span
      class={cx(
        'flex min-w-0 items-center overflow-hidden transition-[max-width,opacity,filter] duration-300 ease-in-out',
        sidebar.collapsed()
          ? 'max-w-0 opacity-0 blur-[3px]'
          : 'max-w-full opacity-100 blur-0',
        props.class,
      )}
    >
      {props.children}
    </span>
  );
}

export function NavItem(props: {
  icon: IconComponent;
  label: string;
  badge?: string | number;
  selected?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const sidebar = useSidebar();
  return (
    <Show when={props.label.toLowerCase().includes(sidebar.query())}>
      <a
        href={props.href ?? '#'}
        onClick={(e) => {
          if (!props.onClick) return;
          e.preventDefault();
          props.onClick();
        }}
        aria-current={props.selected ? 'page' : undefined}
        title={sidebar.collapsed() ? props.label : undefined}
        class={cx(
          'flex items-center justify-between overflow-hidden rounded-2lg p-2 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
          'transition-[width,background-color] duration-300 ease-in-out',
          sidebar.collapsed() ? 'w-9' : 'w-full',
          props.selected
            ? 'bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected'
            : 'hover:bg-background-secondary-hover',
        )}
      >
        <span class="flex min-w-0 items-center gap-2">
          <Glyph
            of={props.icon}
            class={cx(
              'size-5 shrink-0',
              props.selected ? 'text-white' : 'text-foreground-icon-secondary',
            )}
          />
          <Collapsible>
            <span
              class={cx(
                'text-body-medium whitespace-nowrap',
                props.selected ? 'text-white' : 'text-text-secondary',
              )}
            >
              {props.label}
            </span>
          </Collapsible>
        </span>
        <Show when={props.badge !== undefined}>
          <Collapsible>
            <Badge color={props.selected ? 'primary' : 'neutral'}>
              {props.badge}
            </Badge>
          </Collapsible>
        </Show>
      </a>
    </Show>
  );
}

function ThemeToggle(props: {
  theme: 'light' | 'dark';
  onTheme: (t: 'light' | 'dark') => void;
}) {
  const sidebar = useSidebar();
  const options = [
    { id: 'light' as const, label: 'Light', icon: RiSunLine },
    { id: 'dark' as const, label: 'Dark', icon: RiMoonLine },
  ];
  return (
    <Show
      when={!sidebar.collapsed()}
      fallback={
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={() =>
            props.onTheme(props.theme === 'dark' ? 'light' : 'dark')
          }
          class="flex size-9 cursor-pointer items-center justify-center rounded-full bg-theme-toggle-sidebar-background text-foreground-icon-secondary"
        >
          <Glyph
            of={props.theme === 'dark' ? RiMoonLine : RiSunLine}
            class="size-5"
          />
        </button>
      }
    >
      <div
        role="radiogroup"
        aria-label="Theme"
        class="flex w-full rounded-full bg-theme-toggle-sidebar-background p-0.5"
      >
        <For each={options}>
          {(o) => (
            <button
              type="button"
              role="radio"
              aria-checked={props.theme === o.id ? 'true' : 'false'}
              onClick={() => props.onTheme(o.id)}
              class={cx(
                'flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-body-medium transition-colors duration-150',
                'outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                props.theme === o.id
                  ? 'bg-theme-toggle-sidebar-selected-background text-text-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <Glyph of={o.icon} class="size-4" />
              {o.label}
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}

export function Sidebar(props: {
  /** The workspace shown at the top. */
  workspace: { name: string; initials: string; detail: string };
  /** Inside the phone drawer: always open, a close button instead of collapse. */
  mobile?: boolean;
  onClose?: () => void;
  onSettings?: () => void;
  theme?: 'light' | 'dark';
  onTheme?: (t: 'light' | 'dark') => void;
  searchLabel?: string;
  /** Rows placed under the search, which may read `useSidebar()`. */
  children: JSX.Element;
  /** A fixed row above the footer, such as a new session button. */
  action?: JSX.Element;
  class?: string;
}) {
  const [collapsedState, setCollapsed] = createSignal(false);
  const [searching, setSearching] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const collapsed = () => !props.mobile && collapsedState();
  let input: HTMLInputElement | undefined;
  let trigger: HTMLButtonElement | undefined;

  const startSearch = () => {
    setCollapsed(false);
    setSearching(true);
    requestAnimationFrame(() => input?.focus());
  };
  const endSearch = (restoreFocus: boolean) => {
    setQuery('');
    setSearching(false);
    if (restoreFocus) requestAnimationFrame(() => trigger?.focus());
  };

  onSettled(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'l' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        startSearch();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  return (
    <SidebarContext
      value={{ collapsed, query: () => query().trim().toLowerCase() }}
    >
      <aside
        class={cx(
          'flex h-full shrink-0 flex-col justify-between overflow-hidden',
          'rounded-3xl border border-border-button-white bg-background-secondary-default shadow-sidebar',
          'transition-[width] duration-300 ease-in-out',
          collapsed() ? 'w-[60px] px-[11px] py-3' : 'w-[280px] p-3',
          props.class,
        )}
      >
        <div class="-m-2 flex min-h-0 w-[calc(100%+16px)] flex-1 flex-col gap-3 overflow-y-auto p-2 [scrollbar-width:none]">
          {/* Workspace menu and the collapse control */}
          <div
            class={cx(
              'flex w-full transition-[gap] duration-300 ease-in-out',
              collapsed()
                ? 'flex-col-reverse items-start justify-center gap-2.5'
                : 'flex-row items-center justify-between',
            )}
          >
            <Dropdown
              aria-label="Workspace"
              triggerClass="-m-1 flex min-w-0 items-center gap-2 rounded-2lg p-1 text-start hover:bg-background-secondary-hover data-[open]:bg-background-secondary-hover"
              trigger={
                <>
                  <Avatar
                    size="sm"
                    color="blue"
                    initials={props.workspace.initials}
                    class="size-7 rounded-lg"
                  />
                  <Collapsible class="gap-1">
                    <span class="truncate text-body-medium text-text-primary">
                      {props.workspace.name}
                    </span>
                    <ChevronUpDownSmall class="size-4 shrink-0 text-foreground-icon-secondary" />
                  </Collapsible>
                </>
              }
            >
              <DropdownGroup label={props.workspace.detail}>
                <DropdownItem icon={RiUserLine}>Profile</DropdownItem>
                <DropdownItem
                  icon={RiSettings4Line}
                  onSelect={() => props.onSettings?.()}
                >
                  Settings
                </DropdownItem>
              </DropdownGroup>
              <DropdownDivider />
              <DropdownItem icon={RiLogoutBoxRLine}>Sign out</DropdownItem>
            </Dropdown>
            <Show
              when={!props.mobile}
              fallback={
                <button
                  type="button"
                  aria-label="Close sidebar"
                  onClick={() => props.onClose?.()}
                  class="flex size-8 cursor-pointer items-center justify-center text-foreground-icon-secondary"
                >
                  <RiCloseLine class="size-5" />
                </button>
              }
            >
              <button
                type="button"
                aria-label={collapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={collapsed() ? 'false' : 'true'}
                onClick={() => {
                  if (!collapsed()) endSearch(false);
                  setCollapsed(!collapsed());
                }}
                class={cx(
                  'cursor-pointer rounded-md text-foreground-icon-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  collapsed() && 'flex w-9 items-center justify-center',
                )}
              >
                <RiSideBarFill
                  class={cx(
                    'size-5 transition-transform duration-300',
                    !collapsed() && '-scale-x-100',
                  )}
                />
              </button>
            </Show>
          </div>

          {/* Quick search */}
          <Show
            when={searching() && !collapsed()}
            fallback={
              <button
                ref={trigger}
                type="button"
                aria-label="Quick Search"
                title={collapsed() ? 'Quick Search' : undefined}
                onClick={startSearch}
                class={cx(
                  'flex cursor-pointer items-center gap-2 rounded-full bg-background-tertiary-default p-2 hover:bg-background-tertiary-hover/55',
                  'outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  'transition-[width,background-color] duration-300 ease-in-out',
                  collapsed() ? 'w-9' : 'w-full',
                )}
              >
                <span
                  class={cx(
                    'flex min-w-0 items-center gap-2',
                    !collapsed() && 'flex-1',
                  )}
                >
                  <RiSearchLine class="size-5 shrink-0 text-foreground-icon-secondary" />
                  <Collapsible>
                    <span class="text-body-medium whitespace-nowrap text-text-secondary">
                      {props.searchLabel ?? 'Quick Search'}
                    </span>
                  </Collapsible>
                </span>
                <Collapsible>
                  <Kbd>⌘L</Kbd>
                </Collapsible>
              </button>
            }
          >
            <div class="flex w-full items-center gap-2 rounded-full bg-background-tertiary-default py-2 pe-2.5 ps-2 ring-2 ring-inset ring-border-button-active">
              <RiSearchLine class="size-5 shrink-0 text-foreground-icon-secondary" />
              <input
                ref={input}
                type="search"
                aria-label="Filter the sidebar"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return;
                  e.preventDefault();
                  endSearch(true);
                }}
                onBlur={() => !query() && endSearch(false)}
                placeholder="Search…"
                class="min-w-0 flex-1 bg-transparent text-body-medium text-text-primary outline-none placeholder:text-text-tertiary"
              />
              <CloseButton
                size="2xs"
                aria-label="Clear search"
                onClick={() => endSearch(true)}
                class="bg-background-tertiary-hover"
              />
            </div>
          </Show>

          {props.children}
        </div>

        <div class="flex w-full shrink-0 flex-col gap-3 pt-3">
          {props.action}
          <Show when={props.onTheme}>
            <ThemeToggle
              theme={props.theme ?? 'light'}
              onTheme={(t) => props.onTheme?.(t)}
            />
          </Show>
          <nav class="flex w-full flex-col gap-1">
            <NavItem icon={RiCustomerServiceLine} label="Support" />
            <NavItem
              icon={RiSettings4Line}
              label="Settings"
              onClick={() => props.onSettings?.()}
            />
          </nav>
        </div>
      </aside>
    </SidebarContext>
  );
}
