import { useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { Show, createEffect, createMemo, createSignal } from 'solid-js';

import type { GitCommitDetail, WorkspaceRef } from '@bica/shared/protocol';
import ChangeList from '../files/ChangeList';
import CodeView from '../files/CodeView';
import { SplitSwitch, WrapButton, split, wrap } from '../files/OpenFile';
import { IconButton } from '../ui/Button';
import { CopyButton } from '../ui/CopyButton';
import { copyText } from '../ui/clipboard';
import { errorText } from '../ui/errors';
import { BackIcon, CommitIcon, CopyIcon, ExternalIcon } from '../ui/icons';
import { Tag } from '../ui/Tag';
import { commitHref, showCommit, type OpenCommit } from './git';

export function shortHash(hash: string) {
  return hash.slice(0, 7);
}

/** A commit's page on GitHub or GitLab; absent until it is pushed. */
export function remotePage(c: {
  hash: string;
  unpushed?: boolean;
  commitUrl: string | null;
}) {
  return c.commitUrl && !c.unpushed ? c.commitUrl + c.hash : undefined;
}

export function openRemote(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * A commit full size: its message, author, date, and changed files, or one
 * file's diff against the commit's first parent. `actions` go at the end of
 * the header.
 */
export default function CommitView(props: {
  workspace: WorkspaceRef;
  open: OpenCommit;
  actions?: JSX.Element;
}) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = createSignal<GitCommitDetail>();
  const [failed, setFailed] = createSignal('');
  createEffect(
    () => ({
      ref: props.workspace,
      hash: props.open.hash,
      repo: props.open.repo,
    }),
    ({ ref, hash, repo }) => {
      let stale = false;
      showCommit(ref, hash, repo).then(
        (d) => {
          if (stale) return;
          setLoaded(d);
          setFailed('');
        },
        (e: unknown) => !stale && setFailed(errorText(e)),
      );
      return () => (stale = true);
    },
  );
  // The last commit stays on screen until the next one lands.
  const detail = createMemo(
    () => {
      const d = loaded();
      return d?.hash.startsWith(props.open.hash) ? d : undefined;
    },
    { name: 'openCommit' },
  );
  const file = createMemo(
    () => {
      const path = props.open.path;
      return path ? detail()?.files.find((f) => f.path === path) : undefined;
    },
    { name: 'openCommitFile' },
  );
  const short = () => shortHash(props.open.hash);
  const page = () => {
    const d = detail();
    return d && remotePage(d);
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <Show
        when={props.open.path}
        fallback={
          <header class="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
            <span class="text-muted [&_svg]:size-3.5">
              <CommitIcon />
            </span>
            <span class="min-w-0 flex-1 truncate font-mono text-meta">
              {short()}
            </span>
            <Show when={page()}>
              {(url) => (
                <IconButton
                  size="md"
                  title="Open on remote"
                  onClick={() => openRemote(url())}
                >
                  <ExternalIcon />
                </IconButton>
              )}
            </Show>
            <CopyButton
              size="md"
              title="Copy hash"
              text={() => detail()?.hash ?? props.open.hash}
            />
            {props.actions}
          </header>
        }
      >
        {(path) => (
          <header class="flex h-10 shrink-0 items-center gap-2 border-b border-line pr-3 pl-1.5">
            <IconButton
              size="md"
              title="Back to the commit"
              onClick={() =>
                navigate(
                  commitHref(props.workspace, {
                    ...props.open,
                    path: undefined,
                  }),
                )
              }
            >
              <BackIcon />
            </IconButton>
            <span class="min-w-0 flex-1 truncate font-mono text-meta">
              <Show when={file()?.oldPath}>
                {(old) => <span class="text-muted">{old()} → </span>}
              </Show>
              {path()}
            </span>
            <span class="shrink-0 font-mono text-meta text-muted">
              {short()}
            </span>
            <SplitSwitch />
            <WrapButton />
            {props.actions}
          </header>
        )}
      </Show>
      <Show
        when={props.open.path}
        fallback={
          <Show
            when={detail()}
            fallback={
              <Show when={failed()}>
                <p class="p-6 text-center text-muted">{failed()}</p>
              </Show>
            }
          >
            {(d) => (
              <Summary
                detail={d()}
                onOpen={(path) =>
                  navigate(commitHref(props.workspace, { ...props.open, path }))
                }
              />
            )}
          </Show>
        }
      >
        <Show
          when={file()}
          fallback={
            <Show when={failed() || detail()}>
              <p class="p-6 text-center text-muted">
                {failed() || 'This commit did not change that file'}
              </p>
            </Show>
          }
        >
          {(f) => (
            <CodeView
              workspace={props.workspace}
              path={f().path}
              // Both sides are stored blobs, as with a staged change.
              view="staged"
              oldPath={f().oldPath}
              repo={props.open.repo}
              version={f().version}
              blobs={f().blobs}
              split={split()}
              wrap={wrap()}
              preview={false}
            />
          )}
        </Show>
      </Show>
    </div>
  );
}

function Summary(props: {
  detail: GitCommitDetail;
  onOpen: (path: string) => void;
}) {
  const d = () => props.detail;
  const total = (key: 'added' | 'removed') =>
    d().files.reduce((n, f) => n + (f[key] ?? 0), 0);
  const date = () =>
    new Date(d().time).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  return (
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <article class="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-5 pb-[max(--spacing(6),env(safe-area-inset-bottom))] md:px-6">
        <div class="flex flex-col gap-2">
          <h1 class="text-display font-semibold text-balance break-words">
            {d().subject}
          </h1>
          <Show when={d().body}>
            <p class="text-ui break-words whitespace-pre-wrap text-fg/85">
              {d().body}
            </p>
          </Show>
          <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted">
            <span class="font-medium text-fg/85" title={d().email}>
              {d().author}
            </span>
            <time datetime={new Date(d().time).toISOString()}>{date()}</time>
            <span class="font-mono">{shortHash(d().hash)}</span>
            <Show when={d().unpushed}>
              <Tag tone="accent" title="On no remote branch yet">
                Not pushed
              </Tag>
            </Show>
            <Show when={d().parents.length > 1}>
              <span>Merge, against its first parent</span>
            </Show>
          </p>
        </div>
        <section>
          <h2 class="flex h-7 items-center gap-2 text-meta font-medium text-muted">
            <span>
              {d().files.length} {d().files.length === 1 ? 'file' : 'files'}{' '}
              changed
            </span>
            <span class="flex gap-1 tabular-nums">
              <Show when={total('added')}>
                <span class="text-running">
                  +{total('added').toLocaleString()}
                </span>
              </Show>
              <Show when={total('removed')}>
                <span class="text-danger">
                  −{total('removed').toLocaleString()}
                </span>
              </Show>
            </span>
          </h2>
          <Show
            when={d().files.length}
            fallback={<p class="py-2 text-meta text-muted">No file changes</p>}
          >
            <ChangeList
              changes={d().files}
              onOpen={(c) => props.onOpen(c.path)}
              menu={(changes) => [
                {
                  label: changes.length === 1 ? 'Copy path' : 'Copy paths',
                  icon: <CopyIcon />,
                  onSelect: () =>
                    void copyText(changes.map((c) => c.path).join('\n')),
                },
              ]}
            />
          </Show>
        </section>
      </article>
    </div>
  );
}
