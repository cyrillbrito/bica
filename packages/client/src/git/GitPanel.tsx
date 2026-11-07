import { useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { For, Show, createSignal } from 'solid-js';

import { copyText } from '../ui/clipboard';
import { closeDrawer } from '../ui/layout';
import type { GitChange, GitStatus, WorkspaceRef } from '@bica/shared/protocol';
import {
  commit,
  discard,
  pull,
  push,
  stage,
  suggestMessage,
  unstage,
} from './git';
import { openHref, type View } from '../files/files';
import ChangeList from '../files/ChangeList';
import { keepOpenItem } from '../files/OpenFile';
import CommitBox, { type CommitAction } from './CommitBox';
import History from './History';
import { Button, IconButton } from '../ui/Button';
import { RollingNumber } from '../ui/RollingNumber';
import { toast } from '../ui/Toast';
import Chevron from '../ui/Chevron';
import Divider, { dividerClass } from '../ui/Divider';
import { contextMenu, type MenuEntry } from '../ui/ContextMenu';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BranchIcon,
  CopyIcon,
  FilesIcon,
  MinusIcon,
  PlusIcon,
  DeleteIcon,
  DiscardIcon,
} from '../ui/icons';
import { errorText } from '../ui/errors';

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Asks before throwing changes away; new files get deleted. */
export function confirmDiscard(changes: GitChange[]) {
  if (!changes.length) return false;
  const untracked = changes.filter((c) => c.status === 'U').length;
  const question =
    changes.length === 1
      ? untracked
        ? `Delete ${changes[0]!.path}?`
        : `Discard changes to ${changes[0]!.path}?`
      : `Discard changes to ${plural(changes.length, 'file')}?` +
        (untracked
          ? ` ${plural(untracked, 'untracked file')} will be deleted.`
          : '');
  return confirm(`${question} This can't be undone.`);
}

/**
 * The workspace's repo, then each submodule with something to do, as its
 * own section: separate repos make separate commits.
 */
export default function GitPanel(props: {
  workspace: WorkspaceRef;
  status: GitStatus;
  open?: { path: string; view: View };
}) {
  const many = () => props.status.submodules.length > 0;
  return (
    <div class="flex-1 overflow-y-auto overscroll-contain pb-[max(--spacing(2),env(safe-area-inset-bottom))]">
      <Repo
        workspace={props.workspace}
        repo=""
        title={many() ? props.workspace.cwd.split('/').pop() : undefined}
        status={props.status}
        open={props.open}
      />
      <For each={props.status.submodules} keyed={(s) => s.path}>
        {(sub) => (
          <div class="border-t border-line">
            <Repo
              workspace={props.workspace}
              repo={sub().path}
              title={sub().path}
              status={sub()}
              open={props.open}
            />
          </div>
        )}
      </For>
    </div>
  );
}

function Repo(props: {
  workspace: WorkspaceRef;
  // A submodule's path; '' for the workspace's own repo.
  repo: string;
  // Shown, and collapsible, when there is more than one repo.
  title?: string;
  status: GitStatus;
  open?: { path: string; view: View };
}) {
  const navigate = useNavigate();
  const [folded, setFolded] = createSignal(false);
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal<string | false>(false);
  const [closed, setClosed] = createSignal<Record<string, boolean>>({});

  const staged = () => props.status.staged;
  const unstaged = () => props.status.unstaged;
  // Nothing staged: Commit takes everything, like `git commit --all` plus new files.
  const commitAll = () => !staged().length && unstaged().length > 0;
  const toCommit = () => (commitAll() ? unstaged() : staged());

  // Long work you want to hear back from (commit, push, pull) also gets a
  // toast whose spinner turns into a check or a cross.
  const run = async (
    label: string,
    work: (ref: WorkspaceRef, repo: string) => Promise<unknown>,
    say?: { loading: string; success: string; error: string },
  ) => {
    setBusy(label);
    try {
      const p = work(props.workspace, props.repo);
      await (say
        ? toast.promise(p, {
            loading: say.loading,
            success: say.success,
            error: (e) => ({
              title: say.error,
              description: errorText(e),
            }),
          })
        : p);
      setError('');
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onCommit = async (text: string, action?: string) => {
    const amend = action === 'amend';
    // Amend rewords or adds what's staged; it never sweeps in everything.
    const all = commitAll() && !amend;
    const n = toCommit().length;
    const subject = text.split('\n')[0] || 'the last commit';
    const ok = await run(
      amend ? 'amend' : 'commit',
      (ref, repo) => commit(ref, text, { all, amend, repo }),
      {
        loading: amend
          ? 'Amending the last commit…'
          : `Committing ${plural(n, 'file')}…`,
        success: amend ? `Amended: ${subject}` : `Committed: ${subject}`,
        error: amend ? 'Amend failed' : 'Commit failed',
      },
    );
    if (ok && action === 'push') await run('push', push, pushSay());
    return ok;
  };

  const commitActions = (): CommitAction[] => [
    {
      id: 'push',
      label: 'Commit and push',
      icon: <ArrowUpIcon />,
      disabled: !toCommit().length && 'Nothing to commit',
    },
    {
      id: 'amend',
      label: 'Amend last commit',
      icon: <PlusIcon />,
      keepsMessage: true,
      disabled: !props.status.recent.length && 'No commit to amend',
    },
  ];

  const toggle = (view: Exclude<View, 'file'>, paths?: string[]) =>
    run('stage', (ref, repo) =>
      view === 'staged' ? unstage(ref, paths, repo) : stage(ref, paths, repo),
    );

  const onDiscard = (changes: GitChange[]) => {
    if (!confirmDiscard(changes)) return;
    const paths = changes.map((c) => c.path);
    void run('discard', (ref, repo) => discard(ref, paths, repo));
  };

  const pushSay = () => {
    const s = props.status;
    return s.upstream
      ? {
          loading: `Pushing to ${s.upstream}…`,
          success: `Pushed to ${s.upstream}`,
          error: 'Push failed',
        }
      : {
          loading: `Publishing ${s.branch}…`,
          success: `Published ${s.branch}`,
          error: 'Publish failed',
        };
  };

  const Sync = () => {
    const s = () => props.status;
    const canPush = () => s().ahead > 0 || (!s().upstream && !!s().branch);
    return (
      <div class="flex h-9 items-center gap-1.5 pr-1 pl-2.5 touch:h-11">
        <span class="text-muted">
          <BranchIcon />
        </span>
        <span
          class="min-w-0 flex-1 truncate font-medium"
          title={s().upstream ? `Tracking ${s().upstream}` : 'No upstream'}
        >
          {s().branch ?? 'Detached HEAD'}
        </span>
        <Show when={s().behind > 0}>
          <Button
            variant="outline"
            size="sm"
            title={`Pull ${plural(s().behind, 'commit')} (fast-forward)`}
            loading={busy() === 'pull'}
            disabled={!!busy() && busy() !== 'pull'}
            onClick={() =>
              void run('pull', pull, {
                loading: `Pulling ${plural(s().behind, 'commit')}…`,
                success: `Pulled ${plural(s().behind, 'commit')}`,
                error: 'Pull failed',
              })
            }
          >
            <ArrowDownIcon />
            <RollingNumber value={s().behind} />
          </Button>
        </Show>
        <Show when={canPush()}>
          <Button
            variant="outline"
            size="sm"
            title={
              s().upstream
                ? `Push ${plural(s().ahead, 'commit')} to ${s().upstream}`
                : 'Publish this branch'
            }
            loading={busy() === 'push'}
            disabled={!!busy() && busy() !== 'push'}
            onClick={() => void run('push', push, pushSay())}
          >
            <ArrowUpIcon />
            {s().upstream ? <RollingNumber value={s().ahead} /> : 'Publish'}
          </Button>
        </Show>
      </div>
    );
  };

  const CommitBoxHere = () => (
    <CommitBox
      class="px-2"
      label={
        !toCommit().length
          ? ''
          : commitAll()
            ? `Commit all ${plural(unstaged().length, 'file')}`
            : `Commit ${plural(staged().length, 'file')}`
      }
      hint={
        commitAll()
          ? 'Nothing is staged: stage and commit every change.'
          : undefined
      }
      busy={busy()}
      suggest={(fresh) =>
        suggestMessage(props.workspace, {
          all: commitAll(),
          fresh,
          repo: props.repo,
        })
      }
      onCommit={onCommit}
      actions={commitActions}
      error={error()}
    />
  );

  const SectionHeader = (p: {
    id: string;
    title: string;
    count?: number;
    // Lines added and removed across the section, rolling as they change.
    lines?: { added: number; removed: number };
    menu?: () => MenuEntry[];
    children?: JSX.Element;
  }) => (
    <h3
      class="context-target sticky top-0 z-10 flex h-7 items-center gap-1 bg-panel pr-1 touch:h-11"
      {...(p.menu ? contextMenu(p.menu) : {})}
    >
      <button
        class={[dividerClass, 'min-w-0 flex-1 pr-1 pl-1.5 text-left']}
        aria-expanded={closed()[p.id] ? 'false' : 'true'}
        onClick={() => setClosed((c) => ({ ...c, [p.id]: !c[p.id] }))}
      >
        <Divider label={p.title} count={p.count} open={!closed()[p.id]} />
      </button>
      <Show when={p.lines && (p.lines.added || p.lines.removed)}>
        <span
          class="flex shrink-0 gap-1 pr-0.5 text-meta tabular-nums"
          title="Lines added and removed"
        >
          <span class="text-running">
            +
            <RollingNumber
              value={p.lines!.added}
              format={(n) => n.toLocaleString()}
            />
          </span>
          <span class="text-danger">
            −
            <RollingNumber
              value={p.lines!.removed}
              format={(n) => n.toLocaleString()}
            />
          </span>
        </span>
      </Show>
      {p.children}
    </h3>
  );

  const Section = (p: {
    title: string;
    view: Exclude<View, 'file'>;
    changes: GitChange[];
  }) => {
    const isStaged = () => p.view === 'staged';
    const rowMenu = (changes: GitChange[]): MenuEntry[] => {
      const one = changes.length === 1 ? changes[0] : undefined;
      const paths = changes.map((c) => c.path);
      const n = one ? '' : ` ${plural(changes.length, 'file')}`;
      return [
        {
          label: (isStaged() ? 'Unstage' : 'Stage') + n,
          icon: isStaged() ? <MinusIcon /> : <PlusIcon />,
          onSelect: () => void toggle(p.view, paths),
        },
        ...(one
          ? [
              {
                label: 'Open file',
                icon: <FilesIcon />,
                disabled: one.status === 'D' && 'Deleted',
                onSelect: () => {
                  closeDrawer();
                  navigate(
                    openHref(props.workspace, {
                      path: one.path,
                      view: 'file',
                    }),
                  );
                },
              },
            ]
          : []),
        ...keepOpenItem(
          navigate,
          props.workspace,
          one && { path: one.path, view: p.view },
        ),
        {
          label: one ? 'Copy path' : 'Copy paths',
          icon: <CopyIcon />,
          onSelect: () => void copyText(paths.join('\n')),
        },
        ...(isStaged()
          ? []
          : [
              'separator' as const,
              {
                label:
                  one?.status === 'U'
                    ? 'Delete file'
                    : `Discard changes${one ? '' : ` to${n}`}`,
                icon: one?.status === 'U' ? <DeleteIcon /> : <DiscardIcon />,
                danger: true,
                disabled:
                  changes.some((c) => c.status === '!') &&
                  'Resolve the conflict first',
                onSelect: () => onDiscard(changes),
              },
            ]),
      ];
    };
    return (
      <section class="px-1">
        <SectionHeader
          id={p.view}
          title={p.title}
          count={p.changes.length}
          lines={{
            added: p.changes.reduce((n, c) => n + (c.added ?? 0), 0),
            removed: p.changes.reduce((n, c) => n + (c.removed ?? 0), 0),
          }}
          menu={() => [
            {
              label: isStaged() ? 'Unstage all' : 'Stage all',
              icon: isStaged() ? <MinusIcon /> : <PlusIcon />,
              onSelect: () => void toggle(p.view),
            },
            ...(isStaged()
              ? []
              : [
                  {
                    label: 'Discard all changes',
                    icon: <DiscardIcon />,
                    danger: true,
                    onSelect: () =>
                      onDiscard(p.changes.filter((c) => c.status !== '!')),
                  },
                ]),
          ]}
        >
          <IconButton
            size="sm"
            title={isStaged() ? 'Unstage all' : 'Stage all'}
            disabled={!!busy()}
            onClick={() => void toggle(p.view)}
          >
            {isStaged() ? <MinusIcon /> : <PlusIcon />}
          </IconButton>
        </SectionHeader>
        <Show when={!closed()[p.view]}>
          <div class="pb-2">
            <ChangeList
              changes={p.changes}
              open={props.open?.view === p.view ? props.open.path : undefined}
              onOpen={(c) => {
                closeDrawer();
                navigate(
                  openHref(props.workspace, {
                    path: c.path,
                    view: p.view,
                  }),
                );
              }}
              menu={rowMenu}
            />
          </div>
        </Show>
      </section>
    );
  };

  const Commits = () => (
    <section class="px-1">
      <SectionHeader id="recent" title="Commits" />
      <Show when={!closed().recent}>
        <History
          workspace={props.workspace}
          repo={props.repo}
          status={props.status}
        />
      </Show>
    </section>
  );

  const RepoHeader = (p: { title: string }) => (
    <h2 class="flex h-9 items-center px-1 pt-1 touch:h-11">
      <button
        class="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left font-medium transition-colors hover:bg-hover touch:h-10"
        aria-expanded={folded() ? 'false' : 'true'}
        onClick={() => setFolded((f) => !f)}
      >
        <Chevron open={!folded()} />
        <span class="truncate">{p.title}</span>
        <Show when={folded()}>
          <span class="ml-auto shrink-0 text-meta font-normal text-muted tabular-nums">
            {plural(staged().length + unstaged().length, 'change')}
          </span>
        </Show>
      </button>
    </h2>
  );

  return (
    <div>
      <Show when={props.title}>
        {(title) => <RepoHeader title={title()} />}
      </Show>
      <Show when={!folded()}>
        <Body />
      </Show>
    </div>
  );

  function Body() {
    return (
      <>
        <div class="flex flex-col gap-1 pt-1 pb-3">
          <Sync />
          <CommitBoxHere />
        </div>
        <Show when={staged().length}>
          <Section title="Staged" view="staged" changes={staged()} />
        </Show>
        <Show when={unstaged().length}>
          <Section title="Changes" view="changes" changes={unstaged()} />
        </Show>
        <Show when={!staged().length && !unstaged().length}>
          <p class="px-4 pt-2 pb-5 text-center text-meta text-muted">
            Working tree clean
          </p>
        </Show>
        <Show when={props.status.recent.length}>
          <Commits />
        </Show>
      </>
    );
  }
}
