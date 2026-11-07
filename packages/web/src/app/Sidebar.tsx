import { useState, type ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCloseLine,
  RiFolder3Line,
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

/** BoardUI's nav row: 36px, radius 2lg, the blue gradient when selected. */
function rowClass(selected: boolean) {
  return cx(
    'flex w-full min-w-0 items-center gap-2 rounded-2lg p-2 outline-none',
    'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-border-focus-ring',
    selected
      ? 'bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected'
      : 'hover:bg-background-secondary-hover',
  );
}

function labelClass(selected: boolean, muted = false) {
  return cx(
    'min-w-0 flex-1 truncate text-start text-body-medium',
    selected
      ? 'text-white'
      : muted
        ? 'text-text-tertiary'
        : 'text-text-secondary',
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
      <I
        aria-hidden
        className={cx(
          'size-5 shrink-0',
          selected ? 'text-white' : 'text-foreground-icon-secondary',
        )}
      />
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
      <StatusIcon session={session} selected={selected} />
      <span
        className={cx(
          labelClass(selected),
          session.unread && !selected && 'text-text-primary',
        )}
      >
        {session.title}
      </span>
      <span
        className={cx(
          'shrink-0 text-caption-1-medium',
          selected ? 'text-white/80' : 'text-text-tertiary',
        )}
      >
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
          <RiGitBranchLine
            aria-hidden
            className={cx(
              'size-5 shrink-0',
              here ? 'text-white' : 'text-foreground-icon-tertiary',
            )}
          />
          {workspace.ticket && (
            <span
              className={cx(
                'shrink-0 rounded-sm px-1 text-caption-1-semibold',
                here
                  ? 'bg-white/20 text-white'
                  : 'bg-status-blue-background text-status-blue-text',
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
              className={cx(
                'size-5 shrink-0',
                path === `/t/${t.id}`
                  ? 'text-white'
                  : 'text-foreground-icon-tertiary',
              )}
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
          <RiFolder3Line
            aria-hidden
            className={cx(
              'size-5 shrink-0',
              here ? 'text-white' : 'text-foreground-icon-secondary',
            )}
          />
          <span
            className={cx(
              labelClass(here),
              !here && 'text-body-semibold text-text-primary',
            )}
          >
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

export function Sidebar({
  mobile = false,
  className,
}: {
  mobile?: boolean;
  className?: string;
}) {
  const ui = useUi();
  const path = useLocation({ select: (l) => l.pathname });
  const close = () => ui.setNav(false);
  const chats = WORKSPACES.find((w) => w.id === 'chats')!;

  return (
    <aside
      className={cx(
        'flex h-full w-[280px] shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border border-border-button-white bg-background-secondary-default p-3 shadow-sidebar',
        className,
      )}
    >
      <div className="flex items-center justify-between ps-1">
        <Link to="/" onClick={close} className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-b from-accent-500 to-accent-700 text-body-semibold text-white shadow-nav-selected">
            B
          </span>
          <span className="text-headline-semibold text-text-primary">Bica</span>
        </Link>
        <button
          type="button"
          aria-label={mobile ? 'Close sidebar' : 'Hide sidebar'}
          onClick={() => (mobile ? close() : ui.setSidebarHidden(true))}
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
