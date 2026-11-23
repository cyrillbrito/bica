import type { ReactNode } from 'react';
import {
  RiExpandDiagonalLine,
  RiFileList3Line,
  RiGitBranchLine,
  RiSideBarFill,
  RiTerminalLine,
} from '@remixicon/react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { PillTab, PillTabList } from '@/components/base/tabs/pill-tab';
import { Badge } from '@/components/base/badges/badge';
import { CloseButton } from '@/components/base/buttons/close-button';
import { CHANGES, TERMINALS } from '@/fixtures';
import { FilesTab } from '@/files/FilesTab';
import { GitTab } from '@/git/GitTab';
import { cx } from '@/utils/cx';
import { panel, rail } from './panel';
import { useUi } from './ui';

const iconButton =
  'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-secondary transition-colors hover:bg-background-secondary-hover';

function RailButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(iconButton, 'relative size-9')}
    >
      {children}
    </button>
  );
}

/**
 * Git and Files for the open workspace. Docked, it sits flat on the page
 * beside the centre card, as the changes panel does in BoardUI's AI Chat
 * template, and folds into a 60px rail from its own header, the way
 * BoardUI's sidebar does on the other side. Below xl it is a drawer card.
 */
export function SidePanel({
  workspace,
  drawer = false,
  collapsed = false,
  className,
}: {
  workspace: string;
  drawer?: boolean;
  collapsed?: boolean;
  className?: string;
}) {
  const ui = useUi();
  const tab = useSearch({ strict: false, select: (s) => s.panel }) ?? 'git';
  const onWorkspacePage = useLocation({
    select: (l) => l.pathname.startsWith('/p/'),
  });
  const navigate = useNavigate();
  const pick = (panel: 'files' | 'git') => {
    ui.setPanelCollapsed(false);
    void navigate({ to: '.', search: (prev) => ({ ...prev, panel }) });
  };
  const terminal = TERMINALS.find((t) => t.workspace === workspace);

  if (collapsed && !drawer)
    return (
      <aside aria-label="Side panel" className={cx(rail, className)}>
        <RailButton
          label="Expand side panel"
          onClick={() => ui.setPanelCollapsed(false)}
        >
          <RiSideBarFill
            aria-hidden
            className="size-5 -scale-x-100 rtl:scale-x-100"
          />
        </RailButton>
        <div className="my-1 h-px w-6 bg-separator-border" />
        <RailButton label="Git" onClick={() => pick('git')}>
          <RiGitBranchLine aria-hidden className="size-5" />
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-background-tertiary-default px-1 text-caption-2-semibold text-text-secondary">
            {CHANGES.length}
          </span>
        </RailButton>
        <RailButton label="Files" onClick={() => pick('files')}>
          <RiFileList3Line aria-hidden className="size-5" />
        </RailButton>
      </aside>
    );

  return (
    <aside
      aria-label="Side panel"
      className={cx(
        panel,
        'h-full shrink-0 flex-col overflow-hidden',
        !drawer && 'w-[340px]',
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-1 px-3 pt-3">
        {!drawer && (
          <button
            type="button"
            aria-label="Collapse side panel"
            title="Collapse side panel ⌥⌘B"
            onClick={() => ui.setPanelCollapsed(true)}
            className={iconButton}
          >
            <RiSideBarFill aria-hidden className="size-5 rtl:-scale-x-100" />
          </button>
        )}
        <PillTabList className="min-w-0 flex-1">
          <PillTab
            icon={RiGitBranchLine}
            isSelected={tab === 'git'}
            onSelect={() => pick('git')}
          >
            <span className="flex items-center gap-1.5">
              Changes
              <Badge color="neutral">{CHANGES.length}</Badge>
            </span>
          </PillTab>
          <PillTab
            icon={RiFileList3Line}
            isSelected={tab === 'files'}
            onSelect={() => pick('files')}
          >
            Files
          </PillTab>
        </PillTabList>
        <div className="flex items-center">
          {terminal && (
            <Link
              to="/t/$id"
              params={{ id: terminal.id }}
              onClick={() => ui.setPanel(false)}
              aria-label="Open terminal"
              title="Open terminal"
              className={iconButton}
            >
              <RiTerminalLine aria-hidden className="size-5" />
            </Link>
          )}
          {!onWorkspacePage && (
            <Link
              to="/p/$id"
              params={{ id: workspace }}
              search={{ panel: tab }}
              onClick={() => ui.setPanel(false)}
              aria-label="Open the workspace page"
              title="Open the workspace page"
              className={iconButton}
            >
              <RiExpandDiagonalLine aria-hidden className="size-5" />
            </Link>
          )}
          {drawer && (
            <CloseButton
              aria-label="Close side panel"
              onClick={() => ui.setPanel(false)}
            />
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'files' ? (
          <FilesTab workspace={workspace} />
        ) : (
          <GitTab workspace={workspace} />
        )}
      </div>
    </aside>
  );
}
