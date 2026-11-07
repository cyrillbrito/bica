import { For, Show, createMemo, createSignal } from 'solid-js';

import { workspaceName } from './projects';
import type {
  GitChange,
  Project,
  Workspace,
  WorkspaceRef,
} from '@bica/shared/protocol';
import { useSessions } from '../sessions/sessions';
import { age, timeAgo } from '../ui/time';
import { paths } from '../router';
import { repos, useGitStatus } from '../git/git';
import { workspaceHref, type View } from '../files/files';
import PullRequestBadge from './PullRequestBadge';
import StartComposer from '../sessions/StartComposer';
import StatusDot from '../sessions/StatusDot';
import {
  FilterChips,
  FilterMenu,
  passes,
  type FilterGroup,
  type FilterValue,
} from '../ui/FilterMenu';
import { ProgressRing } from '../ui/ProgressRing';
import { RollingNumber } from '../ui/RollingNumber';
import { Trend } from '../ui/Trend';
import {
  ArrowDownIcon,
  ArchiveIcon,
  ArrowUpIcon,
  BranchIcon,
  CommitIcon,
  DiffIcon,
  ExternalIcon,
} from '../ui/icons';

type Row = GitChange & {
  view: View;
  // Staged or Changes: the filter's "Where".
  where: string;
};

const KIND: Record<GitChange['status'], string> = {
  M: 'Modified',
  A: 'Added',
  U: 'Added',
  D: 'Deleted',
  R: 'Renamed',
  '!': 'Conflict',
};

const KIND_CLASS: Record<string, string> = {
  Modified: 'text-accent',
  Added: 'text-running-ink',
  Deleted: 'text-danger-ink',
  Renamed: 'text-accent',
  Conflict: 'text-warn-ink',
};

function folder(path: string) {
  return path.includes('/') ? path.slice(0, path.indexOf('/')) : '(top level)';
}

function num(n: number) {
  return n.toLocaleString();
}

/**
 * The workspace page before a file is open: the workspace as a card, after
 * affectUI's Project Card (a ring of one segment per changed file, filled
 * once staged, a status tag for the pull request), holding what changed,
 * after its Change Summary (each file's lines as trends, rolling totals).
 * Pointing at a file lifts its segment of the ring, and the other way round.
 */
export default function WorkspaceOverview(props: {
  project: Project;
  workspace: Workspace;
  // `ref` is Solid's own prop.
  at: WorkspaceRef;
}) {
  // A folder without git: nothing to list until `git init`.
  const plain = () => !props.project.git;
  const status = useGitStatus(() => props.at);
  const sessions = useSessions();
  // Every session here, open ones first: coming back to a branch starts
  // from what was done on it.
  const here = createMemo(
    () =>
      sessions()
        .filter((s) => s.cwd === props.at.cwd)
        .sort(
          (a, b) =>
            Number(!!a.archivedAt) - Number(!!b.archivedAt) ||
            b.updatedAt - a.updatedAt,
        ),
    { name: 'overviewSessions' },
  );
  const [allSessions, setAllSessions] = createSignal(false);
  const SESSIONS_SHOWN = 6;

  const rows = createMemo<Row[]>(() => {
    if (plain()) return [];
    const s = status();
    if (!s) return [];
    return repos(s).flatMap((r) => [
      ...r.staged.map((c) => ({
        ...c,
        view: 'staged' as const,
        where: 'Staged',
      })),
      ...r.unstaged.map((c) => ({
        ...c,
        view: 'changes' as const,
        where: 'Changes',
      })),
    ]);
  });

  const [filter, setFilter] = createSignal<FilterValue>(
    {},
    { name: 'overviewFilter' },
  );
  const facets = (r: Row) => ({
    kind: KIND[r.status],
    folder: folder(r.path),
    where: r.where,
  });
  const groups = createMemo<FilterGroup[]>(() => {
    const count = (key: 'kind' | 'folder' | 'where') => {
      const map = new Map<string, number>();
      for (const r of rows()) {
        const k = facets(r)[key];
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return [...map].map(([id, n]) => ({ id, label: id, count: n }));
    };
    return [
      { id: 'kind', label: 'Change', options: count('kind') },
      {
        id: 'folder',
        label: 'Folder',
        options: count('folder'),
        chipPrefix: 'In ',
      },
      { id: 'where', label: 'Where', options: count('where') },
    ].filter((g) => g.options.length > 1);
  });
  const shown = createMemo(() =>
    rows().filter((r) => passes(filter(), facets(r))),
  );
  const added = () => shown().reduce((n, r) => n + (r.added ?? 0), 0);
  const removed = () => shown().reduce((n, r) => n + (r.removed ?? 0), 0);
  const staged = () => rows().filter((r) => r.view === 'staged').length;

  // Shared between the ring and the rows: the file under the pointer.
  const [hot, setHot] = createSignal<string | undefined>(undefined, {
    name: 'overviewHot',
  });
  const hotIndex = () => {
    const i = rows().findIndex((r) => key(r) === hot());
    return i < 0 ? undefined : i;
  };
  const key = (r: Row) => `${r.view}:${r.path}`;

  // Rows stagger in on first view only; later arrivals just rise.
  const mounted = Date.now();
  const stagger = (i: number) =>
    Date.now() - mounted < 400 ? Math.min(i, 10) : 0;

  const name = () => workspaceName(props.project, props.workspace.path);
  const ringLabel = () =>
    plain()
      ? `${rows().length} changed files`
      : `${staged()} of ${rows().length} files staged`;

  const hint = () => {
    const s = status();
    const parts: string[] = [];
    if (!plain() && rows().length)
      parts.push(
        staged() === rows().length
          ? 'Everything staged'
          : `${staged()} of ${rows().length} staged`,
      );
    if (s?.ahead) parts.push(`${s.ahead} to push`);
    if (s?.behind) parts.push(`${s.behind} to pull`);
    if (!parts.length) return rows().length ? '' : 'Nothing changed yet';
    return parts.join(' · ');
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain border-t border-line">
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-3 px-3 pt-6 pb-10 md:pt-10">
        <StartComposer
          target={{ projectId: props.project.id, cwd: props.at.cwd }}
          draft={`new:${props.at.cwd}`}
          placeholder={`New session in ${name()}…`}
        />
        <Show when={here().length}>
          <section class="appear px-4">
            <h3 class="pb-1 text-meta font-medium text-muted">Sessions</h3>
            <ul>
              <For
                each={allSessions() ? here() : here().slice(0, SESSIONS_SHOWN)}
                keyed={(s) => s.id}
              >
                {(s) => (
                  <li>
                    <a
                      href={paths.s(s().id)()}
                      class={[
                        '-mx-2 flex h-8 items-center gap-2.5 rounded-md px-2 transition-colors hover:bg-hover touch:h-11',
                        s().archivedAt ? 'text-muted' : 'text-fg/85',
                      ]}
                    >
                      <Show
                        when={!s().archivedAt}
                        fallback={
                          <span
                            class="grid size-3.5 shrink-0 place-items-center [&_svg]:size-3.5"
                            title="Archived"
                          >
                            <ArchiveIcon />
                          </span>
                        }
                      >
                        <span class="grid size-3.5 shrink-0 place-items-center">
                          <StatusDot status={s().status} />
                        </span>
                      </Show>
                      <span class="min-w-0 flex-1 truncate" dir="auto">
                        {s().title || 'Untitled session'}
                      </span>
                      <span class="shrink-0 text-meta text-muted tabular-nums">
                        {age(s().updatedAt)}
                      </span>
                    </a>
                  </li>
                )}
              </For>
            </ul>
            <Show when={!allSessions() && here().length > SESSIONS_SHOWN}>
              <button
                type="button"
                class="-mx-2 h-8 rounded-md px-2 text-meta text-muted transition-colors hover:bg-hover hover:text-fg touch:h-11"
                onClick={() => setAllSessions(true)}
              >
                Show {here().length - SESSIONS_SHOWN} more
              </button>
            </Show>
          </section>
        </Show>

        <section class="appear flex flex-col rounded-tray bg-well p-1">
          <div class="@container flex flex-col overflow-hidden rounded-sheet border border-line bg-surface">
            <header class="flex items-center gap-3 px-4 pt-3.5 pb-3">
              <ProgressRing
                total={rows().length}
                done={staged()}
                value={rows().length}
                hot={hotIndex()}
                onHot={(i) =>
                  setHot(i === undefined ? undefined : key(rows()[i]!))
                }
                label={ringLabel()}
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <h2 class="truncate font-semibold">{name()}</h2>
                <div class="flex h-5 min-w-0 items-center gap-1.5 text-meta text-muted">
                  <Show
                    when={props.workspace.pr}
                    fallback={
                      <span class="shrink-0 rounded-sm bg-hover px-1.5 leading-5 font-medium">
                        {plain()
                          ? 'No git'
                          : props.workspace.main
                            ? 'Main folder'
                            : 'No pull request'}
                      </span>
                    }
                  >
                    {(pr) => <PullRequestBadge pr={pr()} pill />}
                  </Show>
                  <Show when={status()?.branch ?? props.workspace.branch}>
                    {(b) => (
                      <span class="flex min-w-0 items-center gap-1 font-mono">
                        <span class="shrink-0 [&_svg]:size-3.5">
                          <BranchIcon />
                        </span>
                        <span class="truncate">{b()}</span>
                      </span>
                    )}
                  </Show>
                  <Show when={status()?.ahead}>
                    <span
                      class="flex shrink-0 items-center tabular-nums [&_svg]:size-3"
                      title="Commits to push"
                    >
                      <ArrowUpIcon />
                      {status()!.ahead}
                    </span>
                  </Show>
                  <Show when={status()?.behind}>
                    <span
                      class="flex shrink-0 items-center tabular-nums [&_svg]:size-3"
                      title="Commits to pull"
                    >
                      <ArrowDownIcon />
                      {status()!.behind}
                    </span>
                  </Show>
                </div>
              </div>
            </header>

            <div class="flex items-center gap-2 border-t border-line px-4 py-2">
              <span class="flex items-center gap-2 font-medium [&_svg]:text-muted">
                <DiffIcon />
                What's changed
              </span>
              <Show when={rows().length}>
                <span class="flex items-center gap-1.5 text-meta tabular-nums max-sm:hidden">
                  <span class="text-running">
                    +<RollingNumber value={added()} format={num} />
                  </span>
                  <span class="text-danger">
                    −<RollingNumber value={removed()} format={num} />
                  </span>
                </span>
              </Show>
              <span class="ml-auto" />
              <Show when={groups().length}>
                <FilterMenu
                  title="Filter changes"
                  groups={groups()}
                  value={filter()}
                  onChange={setFilter}
                />
              </Show>
            </div>
            <FilterChips
              class="px-4 pb-2"
              groups={groups()}
              value={filter()}
              onChange={setFilter}
            />

            <Show
              when={shown().length}
              fallback={
                <p class="border-t border-line px-4 py-6 text-center text-meta text-muted">
                  {rows().length
                    ? 'No changes match these filters'
                    : plain()
                      ? 'Not a git repository'
                      : 'Working tree clean'}
                </p>
              }
            >
              <ul class="border-t border-line" onPointerLeave={() => setHot()}>
                <For each={shown()} keyed={key}>
                  {(r, i) => {
                    const kind = () => KIND[r().status];
                    const dir = () =>
                      r().path.includes('/')
                        ? r().path.slice(0, r().path.lastIndexOf('/') + 1)
                        : '';
                    const base = () =>
                      r().path.slice(r().path.lastIndexOf('/') + 1);
                    const total = () => (r().added ?? 0) + (r().removed ?? 0);
                    const greens = () =>
                      total()
                        ? Math.round((5 * (r().added ?? 0)) / total())
                        : 0;
                    return (
                      <li
                        class="rise-in border-line not-first:border-t"
                        style={{ '--i': stagger(i()) }}
                      >
                        <a
                          href={workspaceHref(props.at, {
                            path: r().path,
                            view: r().view,
                          })}
                          class={[
                            'grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-1 touch:min-h-11 transition-colors hover:bg-hover @max-sm:grid-cols-1 @max-sm:gap-1 @max-sm:py-2.5',
                            hot() === key(r()) && 'bg-hover',
                          ]}
                          onPointerEnter={() => setHot(key(r()))}
                          title={`${kind()} · ${r().where}`}
                        >
                          <span class="flex min-w-0 items-center gap-2">
                            <span
                              class={[
                                'w-3 shrink-0 font-mono text-meta font-semibold',
                                KIND_CLASS[kind()],
                              ]}
                              aria-label={kind()}
                            >
                              {r().status === 'U' ? 'A' : r().status}
                            </span>
                            {/* The folder gives way first, so the name stays. */}
                            <span class="flex min-w-0 font-mono text-code">
                              <span class="min-w-0 truncate text-muted">
                                {dir()}
                              </span>
                              <span class="max-w-full shrink-0 truncate font-medium">
                                {base()}
                              </span>
                            </span>
                            <Show
                              when={rows().some(
                                (x) => x.where !== rows()[0]!.where,
                              )}
                            >
                              <span class="shrink-0 text-meta text-muted max-md:hidden">
                                {r().where}
                              </span>
                            </Show>
                          </span>
                          <span class="flex items-center gap-3 text-meta @max-sm:pl-5">
                            <Show
                              when={
                                r().added !== undefined ||
                                r().removed !== undefined
                              }
                              fallback={<Trend tone="neutral">Binary</Trend>}
                            >
                              <Show when={r().added}>
                                <Trend tone="good">{num(r().added!)}</Trend>
                              </Show>
                              <Show when={r().removed}>
                                <Trend tone="bad">{num(r().removed!)}</Trend>
                              </Show>
                              <span
                                class="flex gap-0.5 max-sm:hidden"
                                aria-hidden="true"
                              >
                                <For each={[0, 1, 2, 3, 4]}>
                                  {(n) => (
                                    <span
                                      class={[
                                        'cell size-2',
                                        n < greens()
                                          ? 'bg-running'
                                          : 'bg-danger',
                                      ]}
                                      style={{ '--i': n * 20 }}
                                    />
                                  )}
                                </For>
                              </span>
                            </Show>
                          </span>
                        </a>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </Show>
          </div>
          <footer class="flex min-h-9 items-center gap-2 px-3 pt-1.5 pb-1 text-meta text-muted">
            <span class="min-w-0 flex-1 truncate">{hint()}</span>
            <Show when={props.workspace.pr}>
              {(pr) => (
                <a
                  href={pr().url}
                  target="_blank"
                  rel="noreferrer"
                  class="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-fg transition-colors hover:bg-hover touch:py-3.5 [&_svg]:size-3.5"
                >
                  Open #{pr().number}
                  <ExternalIcon />
                </a>
              )}
            </Show>
          </footer>
        </section>

        <Show when={status()?.recent.length}>
          <section class="appear px-4">
            <h3 class="pb-1 text-meta font-medium text-muted">
              Recent commits
            </h3>
            <ul>
              <For each={status()!.recent.slice(0, 5)} keyed={(c) => c.hash}>
                {(c) => (
                  <li class="flex h-8 items-center gap-2.5 text-muted">
                    <span class="shrink-0 [&_svg]:size-3.5">
                      <CommitIcon />
                    </span>
                    <span class="min-w-0 flex-1 truncate text-fg/85">
                      {c().subject}
                    </span>
                    <span class="shrink-0 font-mono text-meta">
                      {c().hash.slice(0, 7)}
                    </span>
                    <span class="w-8 shrink-0 text-right text-meta tabular-nums">
                      {timeAgo(c().time)}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>
      </div>
    </div>
  );
}
