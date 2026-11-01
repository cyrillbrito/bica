import { useLocation, useNavigate } from '@solidjs/router';
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onSettled,
} from 'solid-js';

import type {
  GitCommit,
  GitLog,
  GitStatus,
  WorkspaceRef,
} from '@bica/shared/protocol';
import { copyText } from '../ui/clipboard';
import { contextMenu, type MenuEntry } from '../ui/ContextMenu';
import { ArrowUpIcon, CopyIcon, ExternalIcon } from '../ui/icons';
import { closeDrawer } from '../ui/layout';
import { timeAgo } from '../ui/time';
import { openRemote, remotePage } from './CommitView';
import { commitFromSearch, commitHref, readLog } from './git';

const PAGE = 40;

/**
 * The branch's commits, newest first, loading more at the end of the list.
 * Commits no remote has yet carry an arrow.
 */
export default function History(props: {
  workspace: WorkspaceRef;
  // A submodule's path; '' for the workspace's own repo.
  repo: string;
  status: GitStatus;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [count, setCount] = createSignal(PAGE);
  const [loaded, setLoaded] = createSignal<{ at: string; log: GitLog }>();
  const at = () => `${props.workspace.cwd}\0${props.repo}`;
  // A commit, push, or pull changes these; the list loads again with them.
  const changed = createMemo(
    () => {
      const s = props.status;
      return `${s.recent[0]?.hash}:${s.ahead}:${s.behind}:${s.upstream}`;
    },
    { name: 'historyChanged' },
  );
  createEffect(
    () => ({
      ref: props.workspace,
      repo: props.repo,
      key: at(),
      count: count(),
      changed: changed(),
    }),
    ({ ref, repo, key, count }) => {
      let stale = false;
      // Test data holds it back for good; status's few commits stand in.
      readLog(ref, { count, repo }).then(
        (log) => !stale && setLoaded({ at: key, log }),
        () => {},
      );
      return () => (stale = true);
    },
  );
  const log = createMemo(
    () => {
      const l = loaded();
      return l?.at === at() ? l.log : undefined;
    },
    { name: 'historyLog' },
  );
  const commits = () => log()?.commits ?? props.status.recent;
  const openHash = createMemo(
    () => {
      const c = commitFromSearch(location.search);
      return c && (c.repo ?? '') === props.repo ? c.hash : undefined;
    },
    { name: 'historyOpen' },
  );

  // The end of the list in view loads the next page. Each page that lands
  // looks again, since the end may still be in view.
  let end!: HTMLDivElement;
  let seen: IntersectionObserver | undefined;
  onSettled(() => {
    seen = new IntersectionObserver((entries) => {
      const l = log();
      if (
        entries.at(-1)?.isIntersecting &&
        l?.more &&
        l.commits.length >= count()
      )
        setCount((n) => n + PAGE);
    });
    seen.observe(end);
    return () => seen?.disconnect();
  });
  createEffect(
    () => log(),
    () => {
      seen?.unobserve(end);
      seen?.observe(end);
    },
  );

  // Built when the menu opens, from the row's commit at that moment.
  const menu = (c: GitCommit, commitUrl: string | null): MenuEntry[] => {
    const page = remotePage({ ...c, commitUrl });
    return [
      ...(page
        ? [
            {
              label: 'Open on remote',
              icon: <ExternalIcon />,
              onSelect: () => openRemote(page),
            },
          ]
        : []),
      {
        label: 'Copy hash',
        icon: <CopyIcon />,
        onSelect: () => void copyText(c.hash),
      },
      {
        label: 'Copy message',
        icon: <CopyIcon />,
        onSelect: () => void copyText(c.subject),
      },
    ];
  };

  return (
    <>
      <ul class="pb-2">
        <For each={commits()} keyed={(c) => c.hash}>
          {(c) => (
            <li>
              <button
                class="context-target flex h-7 w-full items-center gap-2 rounded-md pr-2 pl-2.5 text-left text-muted transition-colors hover:bg-hover aria-current:bg-active touch:h-11"
                aria-current={openHash() === c().hash ? 'true' : undefined}
                title={`${c().hash.slice(0, 7)} · ${new Date(c().time).toLocaleString()}${c().unpushed ? ' · Not pushed' : ''}`}
                onClick={() => {
                  closeDrawer();
                  navigate(
                    commitHref(props.workspace, {
                      hash: c().hash,
                      repo: props.repo || undefined,
                    }),
                  );
                }}
                {...contextMenu(() => menu(c(), log()?.commitUrl ?? null))}
              >
                <Show
                  when={c().unpushed}
                  fallback={
                    <span class="mx-[3px] size-1.5 shrink-0 rounded-full bg-line-strong" />
                  }
                >
                  <span
                    class="shrink-0 text-accent [&_svg]:size-3"
                    aria-label="Not pushed"
                  >
                    <ArrowUpIcon />
                  </span>
                </Show>
                <span class="min-w-0 flex-1 truncate text-fg/85">
                  {c().subject}
                </span>
                <span class="shrink-0 text-meta tabular-nums">
                  {timeAgo(c().time)}
                </span>
              </button>
            </li>
          )}
        </For>
      </ul>
      <div ref={(el) => (end = el)} class="h-px" />
    </>
  );
}
