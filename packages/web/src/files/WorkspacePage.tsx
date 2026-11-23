import { useState, useSyncExternalStore } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router';
import { File, MultiFileDiff } from '@pierre/diffs/react';
import {
  RiCloseLine,
  RiDownloadLine,
  RiExternalLinkLine,
  RiPushpinLine,
} from '@remixicon/react';
import { useThemeMode } from '@/components/application/theme/theme-toggle';
import { IconButton } from '@/components/base/buttons/icon-button';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/base/segmented-control/segmented-control';
import { Page } from '@/app/Page';
import { NotFound } from '@/app/NotFound';
import {
  CHANGES,
  SESSIONS,
  fileContents,
  workspaceById,
  workspaceLabel,
  type Workspace,
} from '@/fixtures';
import { BranchRow, CommitList, PullRequestCard } from '@/git/GitTab';
import { Composer } from '@/sessions/Composer';
import { StatusIcon } from '@/sessions/StatusIcon';
import { ChangeRow, LineCounts } from './ChangeRow';

/** A ring with a segment per changed file, filled once staged. */
function ChangeRing() {
  const r = 22;
  const c = 2 * Math.PI * r;
  const gap = 4;
  const seg = c / CHANGES.length;
  return (
    <svg
      viewBox="0 0 56 56"
      className="size-14 shrink-0 -rotate-90"
      aria-hidden
    >
      {CHANGES.map((ch, i) => (
        <circle
          key={ch.path}
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={
            ch.staged ? 'stroke-accent-500' : 'stroke-background-tertiary-hover'
          }
          strokeDasharray={`${seg - gap} ${c - seg + gap}`}
          strokeDashoffset={-i * seg}
        />
      ))}
    </svg>
  );
}

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-3xl border border-separator-border p-3 sm:p-4">
      {title && (
        <h2 className="px-1 text-headline-medium text-text-primary">{title}</h2>
      )}
      {children}
    </section>
  );
}

function Overview({ workspace }: { workspace: Workspace }) {
  const sessions = SESSIONS.filter((s) => s.workspace === workspace.id);
  const added = CHANGES.reduce((n, c) => n + c.added, 0);
  const removed = CHANGES.reduce((n, c) => n + c.removed, 0);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-6 sm:px-4">
      <Composer
        busy={false}
        placeholder={`New session in ${workspaceLabel(workspace)}`}
        branch={workspace.branch}
        onSend={() => {}}
      />
      {sessions.length > 0 && (
        <Card title="Sessions">
          <div className="flex flex-col">
            {sessions.map((s) => (
              <Link
                key={s.id}
                to="/s/$id"
                params={{ id: s.id }}
                className="flex items-center gap-2 rounded-2lg p-2 hover:bg-background-secondary-hover"
              >
                <StatusIcon session={s} />
                <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">
                  {s.title}
                </span>
                <span className="text-caption-1-medium text-text-tertiary">
                  {s.time}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <div className="flex items-center gap-4 p-1">
          <ChangeRing />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-title-3-medium text-text-primary">
              {CHANGES.length} changed files
            </span>
            <span className="flex items-center gap-2 text-body-2-regular text-text-secondary">
              {CHANGES.filter((c) => c.staged).length} staged
              <LineCounts added={added} removed={removed} />
            </span>
          </div>
        </div>
        <BranchRow workspace={workspace} />
        <PullRequestCard workspace={workspace} />
        <div className="flex flex-col">
          {CHANGES.map((c) => (
            <ChangeRow key={c.path} change={c} workspace={workspace.id} />
          ))}
        </div>
      </Card>
      <Card title="Latest commits">
        <CommitList limit={4} />
      </Card>
    </div>
  );
}

const WIDE = '(min-width: 768px)';

/** Side by side needs room; a phone always gets unified. */
function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(WIDE);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => matchMedia(WIDE).matches,
  );
}

/** One file or diff full size, from Pierre, in BoardUI's light or dark. */
function FileView({
  workspace,
  path,
  diff,
}: {
  workspace: Workspace;
  path: string;
  diff: boolean;
}) {
  const navigate = useNavigate();
  const theme = useThemeMode();
  const [split, setSplit] = useState(true);
  const wide = useWide();
  const contents = fileContents(path);
  const options = {
    theme: { light: 'pierre-light', dark: 'pierre-dark' },
    themeType: theme,
    disableFileHeader: true,
  } as const;
  const show = (mode: 'file' | 'diff') =>
    void navigate({
      to: '/p/$id',
      params: { id: workspace.id },
      search: (prev) => ({ panel: prev.panel, [mode]: path }),
    });
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-separator-border px-3 py-2">
        <SegmentedControl
          aria-label="File or diff"
          selectedKeys={[diff ? 'diff' : 'file']}
          onSelectionChange={(keys) => {
            const [key] = [...keys];
            if (key) show(key as 'file' | 'diff');
          }}
        >
          <SegmentedControlItem id="file">File</SegmentedControlItem>
          <SegmentedControlItem id="diff">Diff</SegmentedControlItem>
        </SegmentedControl>
        {diff && (
          <SegmentedControl
            aria-label="Diff layout"
            selectedKeys={[split ? 'split' : 'unified']}
            onSelectionChange={(keys) => setSplit([...keys][0] === 'split')}
            className="hidden md:flex"
          >
            <SegmentedControlItem id="split">Side by side</SegmentedControlItem>
            <SegmentedControlItem id="unified">Unified</SegmentedControlItem>
          </SegmentedControl>
        )}
        <div className="flex-1" />
        <IconButton icon={RiPushpinLine} size="small" aria-label="Keep open" />
        <IconButton
          icon={RiExternalLinkLine}
          size="small"
          aria-label="Open in editor"
        />
        <IconButton icon={RiDownloadLine} size="small" aria-label="Download" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-panel">
        {diff ? (
          <MultiFileDiff
            className="code-view"
            oldFile={{ name: path, contents: contents.old }}
            newFile={{ name: path, contents: contents.new }}
            options={{
              ...options,
              diffStyle: split && wide ? 'split' : 'unified',
              parseDiffOptions: { ignoreWhitespace: true, context: 6 },
            }}
          />
        ) : (
          <File
            className="code-view"
            file={{ name: path, contents: contents.new }}
            options={options}
          />
        )}
      </div>
    </div>
  );
}

export function WorkspacePage() {
  const { id } = useParams({ from: '/p/$id' });
  const { file, diff } = useSearch({ from: '/p/$id' });
  const workspace = workspaceById(id);
  if (!workspace) return <NotFound />;
  const path = diff ?? file;
  return (
    <Page
      title={path ?? workspaceLabel(workspace)}
      crumb={path ? workspaceLabel(workspace) : undefined}
      workspace={workspace.id}
      actions={
        path && (
          <Link
            to="/p/$id"
            params={{ id: workspace.id }}
            search={(prev) => ({ panel: prev.panel })}
            aria-label="Close file"
            className="flex size-8 items-center justify-center rounded-lg text-foreground-icon-secondary hover:bg-background-secondary-hover"
          >
            <RiCloseLine aria-hidden className="size-5" />
          </Link>
        )
      }
      bodyClassName={path ? '' : 'overflow-y-auto'}
    >
      {path ? (
        <FileView key={path} workspace={workspace} path={path} diff={!!diff} />
      ) : (
        <Overview workspace={workspace} />
      )}
    </Page>
  );
}
