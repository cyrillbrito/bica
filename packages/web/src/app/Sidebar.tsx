import { useState, type ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCloseLine,
  RiFolder3Line,
  RiFolderOpenLine,
  RiGitBranchLine,
  RiGitPullRequestLine,
  RiSearchLine,
  RiSettings4Line,
  RiSideBarFill,
  RiSparkling2Line,
  RiTerminalBoxLine,
  type RemixiconComponentType,
} from '@remixicon/react';
import { ThemeToggle } from '@/components/application/theme/theme-toggle';
import { Kbd } from '@/components/base/kbd/kbd';
import {
  PROJECTS,
  PROVIDERS,
  SESSIONS,
  TERMINALS,
  WORKSPACES,
  type Session,
  type Workspace,
} from '@/fixtures';
import { StatusIcon } from '@/sessions/StatusIcon';
import { cx } from '@/utils/cx';
import { useUi } from './ui';

type Icon = RemixiconComponentType;

/**
 * BoardUI's nav row, with the neutral selection of its chat history rail
 * and AI Chat template rather than the blue gradient: the sidebar holds many
 * rows, and blue stays for what needs attention.
 */
function rowClass(selected: boolean) {
  return cx(
    'flex w-full min-w-0 items-center gap-2 rounded-2lg p-2 outline-none',
    'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-border-focus-ring',
    selected
      ? 'bg-background-secondary-hover'
      : 'hover:bg-background-secondary-hover',
  );
}

function labelClass(selected: boolean) {
  return cx(
    'min-w-0 flex-1 truncate text-start text-body-medium',
    selected ? 'text-text-primary' : 'text-text-secondary',
  );
}

function iconClass(selected: boolean, tertiary = false) {
  return cx(
    'size-5 shrink-0',
    selected
      ? 'text-foreground-icon-primary'
      : tertiary
        ? 'text-foreground-icon-tertiary'
        : 'text-foreground-icon-secondary',
  );
}

function NavRow({
  to,
  icon: I,
  label,
  selected,
  trailing,
  onClick,
}: {
  to?: string;
  icon: Icon;
  label: string;
  selected: boolean;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <I aria-hidden className={iconClass(selected)} />
      <span className={labelClass(selected)}>{label}</span>
      {trailing}
    </>
  );
  if (!to)
    return (
      <button
        type="button"
        onClick={onClick}
        className={cx(rowClass(selected), 'cursor-pointer')}
      >
        {inner}
      </button>
    );
  return (
    <Link to={to} onClick={onClick} className={rowClass(selected)}>
      {inner}
    </Link>
  );
}

function SessionRow({
  session,
  selected,
  onNavigate,
}: {
  session: Session;
  selected: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      to="/s/$id"
      params={{ id: session.id }}
      onClick={onNavigate}
      className={rowClass(selected)}
    >
      <StatusIcon session={session} />
      <span
        className={cx(
          labelClass(selected),
          session.unread && !selected && 'text-text-primary',
        )}
      >
        {session.title}
      </span>
      <span className="shrink-0 rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-caption-1-medium text-text-tertiary">
        {session.time}
      </span>
    </Link>
  );
}

function PrChip({ pr }: { pr: NonNullable<Workspace['pr']> }) {
  return (
    <span
      className={cx(
        'flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-caption-1-medium',
        pr.state === 'open'
          ? 'bg-status-lime-background text-status-lime-text'
          : 'bg-background-tertiary-default text-text-secondary',
      )}
    >
      <RiGitPullRequestLine aria-hidden className="size-3.5" />
      {pr.number}
    </span>
  );
}

/** One workspace: its header line, then terminals and sessions on a guide. */
function WorkspaceGroup({
  workspace,
  path,
  onNavigate,
}: {
  workspace: Workspace;
  path: string;
  onNavigate: () => void;
}) {
  const sessions = SESSIONS.filter((s) => s.workspace === workspace.id);
  const terminals = TERMINALS.filter((t) => t.workspace === workspace.id);
  const here = path === `/p/${workspace.id}`;
  return (
    <div className="flex flex-col gap-0.5">
      {!workspace.main && (
        <Link
          to="/p/$id"
          params={{ id: workspace.id }}
          onClick={onNavigate}
          className={rowClass(here)}
        >
          <RiGitBranchLine aria-hidden className={iconClass(here, true)} />
          {workspace.ticket && (
            <span
              className={cx(
                'shrink-0 rounded-sm px-1 text-caption-1-semibold',
                'bg-background-tertiary-default text-text-secondary',
              )}
            >
              {workspace.ticket}
            </span>
          )}
          <span className={labelClass(here)}>{workspace.branch}</span>
          {workspace.pr && <PrChip pr={workspace.pr} />}
        </Link>
      )}
      <div
        className={cx(
          'flex flex-col gap-0.5',
          !workspace.main && 'ms-4 border-s border-separator-border ps-1.5',
        )}
      >
        {terminals.map((t) => (
          <Link
            key={t.id}
            to="/t/$id"
            params={{ id: t.id }}
            onClick={onNavigate}
            className={rowClass(path === `/t/${t.id}`)}
          >
            <RiTerminalBoxLine
              aria-hidden
              className={iconClass(path === `/t/${t.id}`, true)}
            />
            <span className={labelClass(path === `/t/${t.id}`)}>{t.name}</span>
            {t.running && (
              <span className="size-1.5 shrink-0 rounded-full bg-lime-500" />
            )}
          </Link>
        ))}
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            selected={path === `/s/${s.id}`}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectGroup({
  id,
  name,
  path,
  onNavigate,
}: {
  id: string;
  name: string;
  path: string;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(true);
  const workspaces = WORKSPACES.filter((w) => w.project === id);
  const main = workspaces.find((w) => w.main);
  const here = !!main && path === `/p/${main.id}`;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="group/project flex items-center gap-1">
        <Link
          to="/p/$id"
          params={{ id: main?.id ?? '' }}
          onClick={onNavigate}
          className={cx(rowClass(here), 'flex-1')}
        >
          {open ? (
            <RiFolderOpenLine aria-hidden className={iconClass(here)} />
          ) : (
            <RiFolder3Line aria-hidden className={iconClass(here)} />
          )}
          <span className={cx(labelClass(here), 'text-text-primary')}>
            {name}
          </span>
        </Link>
        <button
          type="button"
          aria-label={open ? `Collapse ${name}` : `Expand ${name}`}
          onClick={() => setOpen(!open)}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary hover:bg-background-secondary-hover"
        >
          <RiArrowDownSLine
            aria-hidden
            className={cx(
              'size-4 transition-transform duration-200',
              !open && '-rotate-90 rtl:rotate-90',
            )}
          />
        </button>
      </div>
      {open &&
        workspaces.map((w) => (
          <WorkspaceGroup
            key={w.id}
            workspace={w}
            path={path}
            onNavigate={onNavigate}
          />
        ))}
    </div>
  );
}

function SectionLabel({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between ps-2 pt-1">
      <span className="text-body-2-medium text-text-tertiary">{children}</span>
      {action}
    </div>
  );
}

/** The plan meter at the foot, after the team card in BoardUI's sidebar. */
function UsageCard() {
  const plan = PROVIDERS[0]!;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border-button-default bg-background-primary-default p-3 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-body-2-medium text-text-primary">Claude Max</span>
        <span className="text-caption-1-medium text-text-tertiary">
          resets in 2h
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background-tertiary-default">
        <div
          className="h-full rounded-full bg-linear-to-r from-accent-400 to-accent-600"
          style={{ width: `${plan.usage}%` }}
        />
      </div>
      <span className="text-caption-1-regular text-text-secondary">
        {plan.usage}% of the 5-hour limit
      </span>
    </div>
  );
}

/** One icon of the collapsed rail: the row's 36px square, its label as a tooltip. */
function RailItem({
  to,
  label,
  selected = false,
  onClick,
  children,
}: {
  to?: string;
  label: string;
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = cx(
    rowClass(selected),
    'relative size-9 justify-center p-0 cursor-pointer',
  );
  if (!to)
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        className={className}
      >
        {children}
      </button>
    );
  return (
    <Link to={to} aria-label={label} title={label} className={className}>
      {children}
    </Link>
  );
}

/**
 * The 60px rail BoardUI's sidebar folds into. Sessions keep their status
 * icon, so a running or waiting session still shows while folded.
 */
function Rail({ path, className }: { path: string; className?: string }) {
  const ui = useUi();
  const sessions = SESSIONS.filter((s) => s.workspace !== 'hub');
  return (
    <aside
      aria-label="Sidebar"
      className={cx(
        'h-full w-[60px] shrink-0 flex-col items-center gap-2 overflow-hidden rounded-3xl border border-border-button-white bg-background-secondary-default px-[11px] py-3 shadow-sidebar',
        className,
      )}
    >
      <RailItem
        label="Expand sidebar"
        onClick={() => ui.setSidebarCollapsed(false)}
      >
        <RiSideBarFill aria-hidden className={iconClass(false)} />
      </RailItem>
      <RailItem label="Search ⌘K" onClick={() => ui.setPalette(true)}>
        <RiSearchLine aria-hidden className={iconClass(false)} />
      </RailItem>
      <RailItem to="/" label="New session" selected={path === '/'}>
        <RiAddLine aria-hidden className={iconClass(path === '/')} />
      </RailItem>
      <RailItem to="/s/hub" label="Hub" selected={path === '/s/hub'}>
        <RiSparkling2Line
          aria-hidden
          className={iconClass(path === '/s/hub')}
        />
      </RailItem>
      <div className="my-1 h-px w-6 shrink-0 bg-separator-border" />
      <div className="-mx-2 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-2 [scrollbar-width:none]">
        {sessions.map((s) => (
          <RailItem
            key={s.id}
            to={`/s/${s.id}`}
            label={s.title}
            selected={path === `/s/${s.id}`}
          >
            <StatusIcon session={s} />
          </RailItem>
        ))}
      </div>
      <ThemeToggle collapsed appearance="sidebar" />
      <Link
        to="."
        search={(prev) => ({ ...prev, settings: 'general' as const })}
        aria-label="Settings"
        title="Settings ⌘,"
        className={cx(rowClass(false), 'size-9 justify-center p-0')}
      >
        <RiSettings4Line aria-hidden className={iconClass(false)} />
      </Link>
    </aside>
  );
}

export function Sidebar({
  mobile = false,
  collapsed = false,
  className,
}: {
  mobile?: boolean;
  /** Folds to the 60px rail; ignored in the phone drawer. */
  collapsed?: boolean;
  className?: string;
}) {
  const ui = useUi();
  const path = useLocation({ select: (l) => l.pathname });
  const close = () => ui.setNav(false);
  const chats = WORKSPACES.find((w) => w.id === 'chats')!;

  if (collapsed && !mobile) return <Rail path={path} className={className} />;

  return (
    <aside
      aria-label="Sidebar"
      className={cx(
        'flex h-full w-[280px] shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border border-border-button-white bg-background-secondary-default p-3 shadow-sidebar',
        className,
      )}
    >
      <div className="flex items-center justify-between ps-1">
        <Link to="/" onClick={close} className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-background-tertiary-default text-body-semibold text-text-primary">
            B
          </span>
          <span className="text-headline-semibold text-text-primary">Bica</span>
        </Link>
        <button
          type="button"
          aria-label={mobile ? 'Close sidebar' : 'Collapse sidebar'}
          title={mobile ? undefined : 'Collapse sidebar ⌘B'}
          onClick={() => (mobile ? close() : ui.setSidebarCollapsed(true))}
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-secondary hover:bg-background-secondary-hover"
        >
          {mobile ? (
            <RiCloseLine aria-hidden className="size-5" />
          ) : (
            <RiSideBarFill
              aria-hidden
              className="size-5 -scale-x-100 rtl:scale-x-100"
            />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          close();
          ui.setPalette(true);
        }}
        className="flex w-full cursor-pointer items-center gap-2 rounded-full bg-background-tertiary-default p-2 transition-colors hover:bg-background-tertiary-hover/55"
      >
        <RiSearchLine
          aria-hidden
          className="size-5 shrink-0 text-foreground-icon-secondary"
        />
        <span className="flex-1 text-start text-body-medium text-text-secondary">
          Search
        </span>
        <Kbd>⌘K</Kbd>
      </button>

      <nav className="flex flex-col gap-1 px-0.5">
        <NavRow
          to="/"
          icon={RiAddLine}
          label="New session"
          selected={path === '/'}
          onClick={close}
        />
        <NavRow
          to="/s/hub"
          icon={RiSparkling2Line}
          label="Hub"
          selected={path === '/s/hub'}
          onClick={close}
        />
      </nav>

      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1.5 [scrollbar-width:thin]">
        <SectionLabel
          action={
            <button
              type="button"
              aria-label="Add project"
              className="flex size-6 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary hover:bg-background-secondary-hover"
            >
              <RiAddLine aria-hidden className="size-4" />
            </button>
          }
        >
          Projects
        </SectionLabel>
        {PROJECTS.map((p) => (
          <ProjectGroup
            key={p.id}
            id={p.id}
            name={p.name}
            path={path}
            onNavigate={close}
          />
        ))}
        <SectionLabel>Chats</SectionLabel>
        <WorkspaceGroup workspace={chats} path={path} onNavigate={close} />
      </div>

      <div className="flex shrink-0 flex-col gap-3">
        <ThemeToggle appearance="sidebar-segmented" />
        <Link
          to="."
          search={(prev) => ({ ...prev, settings: 'general' as const })}
          onClick={close}
          className={rowClass(false)}
        >
          <RiSettings4Line
            aria-hidden
            className="size-5 shrink-0 text-foreground-icon-secondary"
          />
          <span className={labelClass(false)}>Settings</span>
          <Kbd>⌘,</Kbd>
        </Link>
        <UsageCard />
      </div>
    </aside>
  );
}
