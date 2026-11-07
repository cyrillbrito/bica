import { Title } from '@solidjs/meta';
import { useLocation, type RouteProps } from '@solidjs/router';
import { Show, createMemo } from 'solid-js';

import OpenFile from '../../files/OpenFile';
import CommitView from '../../git/CommitView';
import { commitFromSearch, sameCommit } from '../../git/git';
import PullRequestBadge from '../../projects/PullRequestBadge';
import TopBar from '../../app/TopBar';
import WorkspaceOverview from '../../projects/WorkspaceOverview';
import Empty from '../../ui/Empty';
import { workspaceName } from '../../projects/projects';
import { openFromSearch, sameOpen, workspaceHref } from '../../files/files';
import { useCurrentWorkspace } from '../../projects/projects';

export default function WorkspacePage(_props: RouteProps<'/p/:id'>) {
  const location = useLocation();
  const current = useCurrentWorkspace();
  const open = createMemo(() => openFromSearch(location.search), {
    name: 'openFile',
    equals: sameOpen,
  });
  const commit = createMemo(() => commitFromSearch(location.search), {
    name: 'openCommit',
    equals: sameCommit,
  });

  return (
    <Show
      when={current()}
      fallback={
        <>
          <TopBar />
          <Empty>Workspace not found</Empty>
        </>
      }
    >
      {(c) => {
        const name = () => workspaceName(c().project, c().workspace.path);
        return (
          <>
            <Title>
              {(commit()?.path ?? open()?.path)?.split('/').pop() ??
                (commit() ? commit()!.hash.slice(0, 7) : name())}
            </Title>
            <TopBar>
              <h1 class="truncate font-semibold">{name()}</h1>
              <Show when={c().workspace.branch}>
                <span class="truncate font-mono text-meta text-muted">
                  {c().workspace.branch}
                </span>
              </Show>
              <Show when={c().workspace.pr}>
                {(pr) => <PullRequestBadge pr={pr()} />}
              </Show>
            </TopBar>
            <Show when={commit()}>
              {(o) => (
                <div class="flex min-h-0 flex-1 flex-col border-t border-line">
                  <CommitView workspace={c().ref} open={o()} />
                </div>
              )}
            </Show>
            <Show
              when={!commit() && open()}
              fallback={
                <Show when={!commit()}>
                  <WorkspaceOverview
                    project={c().project}
                    workspace={c().workspace}
                    at={c().ref}
                  />
                </Show>
              }
            >
              {(o) => (
                <div class="flex min-h-0 flex-1 flex-col border-t border-line">
                  <OpenFile
                    workspace={c()}
                    open={o()}
                    href={(x) => workspaceHref(c().ref, x)}
                  />
                </div>
              )}
            </Show>
          </>
        );
      }}
    </Show>
  );
}
