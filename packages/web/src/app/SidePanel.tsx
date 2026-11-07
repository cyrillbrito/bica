import { RiFileList3Line, RiGitBranchLine } from '@remixicon/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PillTab, PillTabList } from '@/components/base/tabs/pill-tab';
import { Badge } from '@/components/base/badges/badge';
import { CloseButton } from '@/components/base/buttons/close-button';
import { CHANGES } from '@/fixtures';
import { FilesTab } from '@/files/FilesTab';
import { GitTab } from '@/git/GitTab';
import { cx } from '@/utils/cx';
import { useUi } from './ui';

/**
 * Files and Git for the open workspace, as a card beside the centre, like
 * the chat history rail beside BoardUI's chat. The tab is in the address.
 */
export function SidePanel({
  workspace,
  drawer = false,
  className,
}: {
  workspace: string;
  drawer?: boolean;
  className?: string;
}) {
  const ui = useUi();
  const tab = useSearch({ strict: false, select: (s) => s.panel }) ?? 'git';
  const navigate = useNavigate();
  const pick = (panel: 'files' | 'git') =>
    void navigate({ to: '.', search: (prev) => ({ ...prev, panel }) });

  return (
    <aside
      className={cx(
        'h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-3xl bg-background-secondary-default',
        drawer && 'shadow-sidebar',
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-separator-border px-3">
        <PillTabList>
          <PillTab
            icon={RiGitBranchLine}
            isSelected={tab === 'git'}
            onSelect={() => pick('git')}
          >
            <span className="flex items-center gap-1.5">
              Git
              <Badge color={tab === 'git' ? 'primary' : 'neutral'}>
                {CHANGES.length}
              </Badge>
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
        {drawer && (
          <CloseButton
            aria-label="Close side panel"
            onClick={() => ui.setPanel(false)}
          />
        )}
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
