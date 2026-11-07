import { useState, type ReactNode } from 'react';
import {
  Autocomplete,
  Dialog,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  Modal,
  ModalOverlay,
  SearchField,
  useFilter,
} from 'react-aria-components';
import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  RiAddLine,
  RiArchiveLine,
  RiArrowRightSLine,
  RiEditLine,
  RiFolder3Line,
  RiGitBranchLine,
  RiGitForkLine,
  RiKeyboardLine,
  RiLayoutRightLine,
  RiMoonLine,
  RiPaletteLine,
  RiPlugLine,
  RiSearchLine,
  RiSettings4Line,
  RiSideBarLine,
  RiSparkling2Line,
  RiSparklingLine,
  RiStopLine,
  RiSunLine,
  RiTerminalBoxLine,
  type RemixiconComponentType,
} from '@remixicon/react';
import { applyThemeWithTransition } from '@/components/application/theme/theme-toggle';
import { Kbd } from '@/components/base/kbd/kbd';
import {
  MENU_ITEM,
  MENU_ITEM_ACTIVE,
} from '@/components/base/dropdown/menu-styles';
import {
  SESSIONS,
  TERMINALS,
  WORKSPACES,
  sessionById,
  workspaceLabel,
  type Session,
} from '@/fixtures';
import { StatusIcon } from '@/sessions/StatusIcon';
import { cx } from '@/utils/cx';
import { useUi } from './ui';

type Icon = RemixiconComponentType;

type Command = {
  id: string;
  label: string;
  /** Extra words the search matches, so "chat" finds New session. */
  keywords?: string;
  icon?: Icon;
  session?: Session;
  hint?: string;
  shortcut?: string;
  /** Opens a second page instead of running. */
  page?: Page;
  run?: () => void;
};

type Page = 'root' | 'new-in' | 'theme';

const PAGE_LABEL: Record<Page, string> = {
  root: '',
  'new-in': 'New session in',
  theme: 'Theme',
};

function Row({ command }: { command: Command }) {
  const I = command.icon;
  return (
    <MenuItem
      id={command.id}
      textValue={`${command.label} ${command.keywords ?? ''} ${command.hint ?? ''}`}
      className={({ isFocused }) =>
        cx(MENU_ITEM, 'cursor-default', isFocused && MENU_ITEM_ACTIVE)
      }
    >
      {command.session ? (
        <StatusIcon session={command.session} />
      ) : (
        I && (
          <I
            aria-hidden
            className="size-5 shrink-0 text-foreground-icon-secondary"
          />
        )
      )}
      <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">
        {command.label}
        {command.page && '…'}
      </span>
      {command.hint && (
        <span className="hidden max-w-[40%] truncate text-body-2-regular text-text-tertiary sm:inline">
          {command.hint}
        </span>
      )}
      {command.shortcut && <Kbd className="px-1.5">{command.shortcut}</Kbd>}
      {command.page && (
        <RiArrowRightSLine
          aria-hidden
          className="size-4 shrink-0 text-foreground-icon-tertiary rtl:-scale-x-100"
        />
      )}
    </MenuItem>
  );
}

function Section({ title, items }: { title: string; items: Command[] }) {
  if (items.length === 0) return null;
  return (
    <MenuSection className="flex flex-col gap-0.5 pb-2">
      <Header className="px-2 pt-1 pb-1 text-body-2-medium text-text-tertiary">
        {title}
      </Header>
      {items.map((c) => (
        <Row key={c.id} command={c} />
      ))}
    </MenuSection>
  );
}

/**
 * ⌘K: one search box for going anywhere and doing anything. React Aria's
 * Autocomplete gives the arrow keys and filtering; BoardUI's menu recipe the
 * look, since its free tier has no palette.
 */
export function CommandPalette() {
  const ui = useUi();
  const navigate = useNavigate();
  const path = useLocation({ select: (l) => l.pathname });
  const { contains } = useFilter({ sensitivity: 'base' });
  const [page, setPage] = useState<Page>('root');
  const [query, setQuery] = useState('');

  const close = () => {
    ui.setPalette(false);
    setPage('root');
    setQuery('');
  };
  const go = (to: string) => void navigate({ to });

  const openSession = path.startsWith('/s/')
    ? sessionById(path.slice(3))
    : undefined;
  const sessionCommand = (s: Session): Command => ({
    id: `s:${s.id}`,
    label: s.title,
    session: s,
    hint:
      s.workspace === 'hub'
        ? 'Hub'
        : workspaceLabel(WORKSPACES.find((w) => w.id === s.workspace)!),
    run: () => go(`/s/${s.id}`),
  });
  const needsYou = SESSIONS.filter(
    (s) => s.status === 'waiting' || s.status === 'error' || s.unread,
  );
  const recent = SESSIONS.filter((s) => !needsYou.includes(s));

  const settings = (id: string) => () =>
    void navigate({
      to: '.',
      search: (prev) => ({ ...prev, settings: id as never }),
    });

  const actions: Command[] = [
    {
      id: 'new',
      label: 'New session',
      keywords: 'chat start prompt',
      icon: RiAddLine,
      run: () => go('/'),
    },
    {
      id: 'new-in',
      label: 'New session in',
      keywords: 'worktree workspace',
      icon: RiGitBranchLine,
      shortcut: '⇧⌘O',
      page: 'new-in',
    },
    {
      id: 'hub',
      label: 'Hub',
      keywords: 'coordinate',
      icon: RiSparkling2Line,
      run: () => go('/s/hub'),
    },
    ...TERMINALS.map((t) => ({
      id: `t:${t.id}`,
      label: t.name,
      keywords: 'terminal shell',
      icon: RiTerminalBoxLine,
      hint: t.command,
      run: () => go(`/t/${t.id}`),
    })),
    {
      id: 'sidebar',
      label: 'Collapse or expand the sidebar',
      icon: RiSideBarLine,
      shortcut: '⌘B',
      run: () => ui.setSidebarCollapsed(!ui.sidebarCollapsed),
    },
    {
      id: 'panel',
      label: 'Collapse or expand the side panel',
      icon: RiLayoutRightLine,
      shortcut: '⌥⌘B',
      run: () => ui.setPanelCollapsed(!ui.panelCollapsed),
    },
    {
      id: 'theme',
      label: 'Theme',
      keywords: 'dark light appearance',
      icon: RiPaletteLine,
      page: 'theme',
    },
    {
      id: 'settings',
      label: 'Settings',
      keywords: 'preferences',
      icon: RiSettings4Line,
      shortcut: '⌘,',
      run: settings('general'),
    },
    {
      id: 'providers',
      label: 'Providers',
      keywords: 'sign in login api key account',
      icon: RiPlugLine,
      run: settings('providers'),
    },
    {
      id: 'models',
      label: 'Models',
      keywords: 'default fast picker',
      icon: RiSparklingLine,
      run: settings('models'),
    },
    {
      id: 'shortcuts',
      label: 'Keyboard shortcuts',
      icon: RiKeyboardLine,
      shortcut: '⌘/',
      run: settings('shortcuts'),
    },
  ];

  const thisSession: Command[] = openSession
    ? [
        { id: 'rename', label: 'Rename', icon: RiEditLine },
        { id: 'fork', label: 'Fork', icon: RiGitForkLine },
        { id: 'stop', label: 'Stop', icon: RiStopLine },
        { id: 'archive', label: 'Archive', icon: RiArchiveLine },
      ]
    : [];

  const workspaces: Command[] = WORKSPACES.filter((w) => w.id !== 'chats').map(
    (w) => ({
      id: `w:${w.id}`,
      label: workspaceLabel(w),
      icon: w.main ? RiFolder3Line : RiGitBranchLine,
      run: () => go(`/p/${w.id}`),
    }),
  );

  const themes: Command[] = [
    {
      id: 'light',
      label: 'Light',
      icon: RiSunLine,
      run: () => void applyThemeWithTransition('light'),
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: RiMoonLine,
      run: () => void applyThemeWithTransition('dark'),
    },
  ];

  const all = [
    ...needsYou.map(sessionCommand),
    ...recent.map(sessionCommand),
    ...thisSession,
    ...actions,
    ...workspaces,
    ...themes,
  ];

  const onAction = (key: React.Key) => {
    const command = all.find((c) => c.id === key);
    if (!command) return;
    if (command.page) {
      setPage(command.page);
      setQuery('');
      return;
    }
    command.run?.();
    close();
  };

  let body: ReactNode;
  if (page === 'new-in')
    body = <Section title="Workspaces" items={workspaces} />;
  else if (page === 'theme') body = <Section title="Theme" items={themes} />;
  else
    body = (
      <>
        <Section title="Needs you" items={needsYou.map(sessionCommand)} />
        <Section title="Recent" items={recent.map(sessionCommand)} />
        <Section title="This session" items={thisSession} />
        <Section title="Actions" items={actions} />
        {query && <Section title="Workspaces" items={workspaces} />}
      </>
    );

  return (
    <ModalOverlay
      isOpen={ui.palette}
      onOpenChange={(open) => !open && close()}
      isDismissable
      className="fixed inset-0 z-100 flex items-start justify-center bg-black/40 p-2 pt-[10vh] transition-opacity duration-150 data-[entering]:opacity-0 data-[exiting]:opacity-0 sm:p-4 sm:pt-[12vh]"
    >
      <Modal className="w-full max-w-[640px] outline-none">
        <Dialog
          aria-label="Command palette"
          className="flex max-h-[70vh] flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-dropdown outline-none"
        >
          <Autocomplete
            filter={contains}
            inputValue={query}
            onInputChange={setQuery}
          >
            <SearchField
              aria-label="Search"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !query && page !== 'root')
                  setPage('root');
                if (e.key === 'Escape' && page !== 'root') {
                  e.preventDefault();
                  setPage('root');
                } else e.continuePropagation();
              }}
              className="flex items-center gap-2 border-b border-separator-border px-4 py-3"
            >
              <RiSearchLine
                aria-hidden
                className="size-5 shrink-0 text-foreground-icon-secondary"
              />
              {page !== 'root' && (
                <button
                  type="button"
                  onClick={() => setPage('root')}
                  className="shrink-0 cursor-pointer rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-body-2-medium text-text-secondary"
                >
                  {PAGE_LABEL[page]}
                </button>
              )}
              <Input
                placeholder={
                  page === 'root'
                    ? 'Search sessions, workspaces, and actions'
                    : 'Search'
                }
                className="min-w-0 flex-1 bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:hidden"
              />
              <Kbd className="hidden px-1.5 sm:inline-flex">Esc</Kbd>
            </SearchField>
            <Menu
              aria-label="Commands"
              onAction={onAction}
              renderEmptyState={() => (
                <p className="px-2 py-6 text-center text-body-regular text-text-tertiary">
                  Nothing matches
                </p>
              )}
              className="min-h-0 flex-1 overflow-y-auto p-2.5 outline-none"
            >
              {body}
            </Menu>
          </Autocomplete>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
