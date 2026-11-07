import { useState, type ReactNode } from 'react';
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiArrowUpLine,
  RiCheckboxCircleFill,
  RiExternalLinkLine,
  RiGitBranchLine,
  RiGitCommitLine,
  RiGitPullRequestLine,
  RiSparklingLine,
  RiSubtractLine,
} from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Chip } from '@/components/base/badges/chip';
import {
  Dropdown,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from '@/components/base/dropdown/dropdown';
import { TextareaBase } from '@/components/base/textarea/textarea';
import { TextField } from '@/components/base/input/input';
import { useUi } from '@/app/ui';
import { CHANGES, COMMITS, workspaceById, type Workspace } from '@/fixtures';
import { ChangeRow } from '@/files/ChangeRow';
import { cx } from '@/utils/cx';

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="flex items-center gap-1.5 px-2 text-body-2-medium text-text-secondary">
        {title}
        {count !== undefined && (
          <span className="text-text-tertiary">{count}</span>
        )}
      </h3>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function RowAction({
  label,
  icon: I,
}: {
  label: string;
  icon: typeof RiAddLine;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary hover:bg-background-primary-default"
    >
      <I aria-hidden className="size-4" />
    </button>
  );
}

export function BranchRow({ workspace }: { workspace: Workspace }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-background-primary-default p-2 ps-3 shadow-xs">
      <RiGitBranchLine
        aria-hidden
        className="size-5 shrink-0 text-foreground-icon-secondary"
      />
      <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">
        {workspace.branch}
      </span>
      {workspace.behind > 0 && (
        <Button variant="secondary" size="small" leadingIcon={RiArrowDownLine}>
          Pull {workspace.behind}
        </Button>
      )}
      <Button
        variant={workspace.ahead > 0 ? 'primary' : 'secondary'}
        size="small"
        leadingIcon={RiArrowUpLine}
        disabled={workspace.ahead === 0}
      >
        {workspace.ahead > 0 ? `Push ${workspace.ahead}` : 'Pushed'}
      </Button>
    </div>
  );
}

export function PullRequestCard({ workspace }: { workspace: Workspace }) {
  const pr = workspace.pr;
  if (!pr) return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-background-primary-default p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <RiGitPullRequestLine
          aria-hidden
          className="size-5 shrink-0 text-lime-600"
        />
        <span className="flex-1 text-body-medium text-text-primary">
          Pull request #{pr.number}
        </span>
        <Chip
          variant="caption"
          color={pr.state === 'open' ? 'lime' : 'neutral'}
        >
          {pr.state === 'open' ? 'Open' : 'Draft'}
        </Chip>
      </div>
      <div className="flex items-center gap-1.5 text-body-2-regular text-text-secondary">
        <RiCheckboxCircleFill aria-hidden className="size-4 text-lime-600" />3
        of 3 checks passed · 1 approval
      </div>
      <a
        href="#"
        className="flex items-center gap-1 text-body-2-medium text-accent-600 hover:underline dark:text-accent-400"
      >
        Open on GitHub
        <RiExternalLinkLine aria-hidden className="size-3.5" />
      </a>
    </div>
  );
}

function CommitBox() {
  const [message, setMessage] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <TextField
        aria-label="Commit message"
        value={message}
        onChange={setMessage}
      >
        <TextareaBase
          rows={2}
          autoResize
          maxRows={6}
          placeholder="Message, or leave empty to have it written"
        />
      </TextField>
      <div className="flex gap-px">
        <Button
          variant="primary"
          size="small"
          leadingIcon={message ? RiGitCommitLine : RiSparklingLine}
          className="flex-1 rounded-e-none"
        >
          {message ? 'Commit' : 'Write and commit'}
        </Button>
        <Dropdown>
          <DropdownTrigger
            aria-label="More commit actions"
            className="flex h-8 w-8 items-center justify-center rounded-e-lg bg-button-primary text-white"
          >
            <RiArrowDownSLine aria-hidden className="size-4" />
          </DropdownTrigger>
          <DropdownPopover
            aria-label="Commit actions"
            placement="bottom end"
            className="w-56"
          >
            <DropdownItem>
              <RiArrowUpLine
                aria-hidden
                className="size-5 text-foreground-icon-secondary"
              />
              <span className="text-body-medium text-text-primary">
                Commit and push
              </span>
            </DropdownItem>
            <DropdownItem>
              <RiArrowGoBackLine
                aria-hidden
                className="size-5 text-foreground-icon-secondary"
              />
              <span className="text-body-medium text-text-primary">Amend</span>
            </DropdownItem>
            <DropdownItem
              onSelect={() => setMessage('feat: mock the Git tab in BoardUI')}
            >
              <RiSparklingLine
                aria-hidden
                className="size-5 text-foreground-icon-secondary"
              />
              <span className="text-body-medium text-text-primary">
                Write message
              </span>
            </DropdownItem>
          </DropdownPopover>
        </Dropdown>
      </div>
    </div>
  );
}

export function CommitList({ limit }: { limit?: number }) {
  return (
    <ol className="flex flex-col">
      {COMMITS.slice(0, limit).map((c) => (
        <li
          key={c.hash}
          className="flex items-start gap-2 rounded-2lg px-2 py-1.5 hover:bg-background-secondary-hover"
        >
          {c.pushed ? (
            <RiGitCommitLine
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-foreground-icon-tertiary"
            />
          ) : (
            <RiArrowUpLine
              aria-label="Not pushed"
              className="mt-0.5 size-4 shrink-0 text-accent-500"
            />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body-2-medium text-text-primary">
              {c.subject}
            </span>
            <span className="text-caption-1-regular text-text-tertiary">
              {c.hash} · {c.when}
              {!c.pushed && ' · Not pushed'}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Stage, commit, and push, modelled on VS Code's source control. */
export function GitTab({ workspace }: { workspace: string }) {
  const ui = useUi();
  const w = workspaceById(workspace);
  if (!w) return null;
  const staged = CHANGES.filter((c) => c.staged);
  const changes = CHANGES.filter((c) => !c.staged);
  const close = () => ui.setPanel(false);
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <BranchRow workspace={w} />
      <PullRequestCard workspace={w} />
      <CommitBox />
      <Section title="Staged" count={staged.length}>
        {staged.map((c) => (
          <ChangeRow
            key={c.path}
            change={c}
            workspace={workspace}
            onOpen={close}
            action={<RowAction label="Unstage" icon={RiSubtractLine} />}
          />
        ))}
      </Section>
      <Section title="Changes" count={changes.length}>
        {changes.map((c) => (
          <ChangeRow
            key={c.path}
            change={c}
            workspace={workspace}
            onOpen={close}
            action={
              <>
                <RowAction label="Discard" icon={RiArrowGoBackLine} />
                <RowAction label="Stage" icon={RiAddLine} />
              </>
            }
          />
        ))}
      </Section>
      <Section title="Commits">
        <div className={cx('flex flex-col')}>
          <CommitList />
        </div>
      </Section>
    </div>
  );
}
