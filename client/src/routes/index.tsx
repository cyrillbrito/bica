import { Show, createMemo, onCleanup } from 'solid-js';

import { openProjectPicker } from '../projects/ProjectPicker';
import ProjectSelect from '../projects/ProjectSelect';
import StartComposer, {
  setStartAgent,
  startAgent,
} from '../sessions/StartComposer';
import TopBar from '../app/TopBar';
import { Button, IconButton } from '../ui/Button';
import { AssistantIcon, BranchIcon, CloseIcon, PlusIcon } from '../ui/icons';
import { Segmented, segmentClass } from '../ui/Segmented';
import {
  CHATS_ID,
  currentTarget,
  folderName,
  resolveTarget,
  setCurrentTarget,
  useProjects,
} from '../projects/projects';

export default function Home() {
  const projects = useProjects();
  const target = createMemo(() => resolveTarget(projects(), currentTarget()), {
    name: 'homeTarget',
  });
  // Each visit starts in the main folder: a new worktree or an existing one
  // is picked for one session, not kept for the next.
  onCleanup(() => {
    const t = currentTarget();
    if (t && (t.worktree || t.cwd))
      setCurrentTarget({ projectId: t.projectId });
    setStartAgent('coding');
  });

  return (
    <>
      <TopBar />
      <div class="chat-column flex flex-1 flex-col justify-center gap-6 pb-[15vh]">
        <h1 class="text-center text-display font-semibold tracking-tight">
          What are we building?
        </h1>
        <Show
          when={target()}
          fallback={
            <Button
              class="mx-auto"
              variant="primary"
              onClick={openProjectPicker}
            >
              Add a project to start
            </Button>
          }
        >
          {(t) => {
            const assistant = () => startAgent() === 'assistant';
            const main = () =>
              t().project.workspaces.find((w) => w.main) ?? t().workspace;
            const chat = () => t().project.id === CHATS_ID;
            // Assistant mode keeps to the main folder: it isn't feature work.
            const cwd = () => (assistant() ? main().path : t().workspace.path);
            const choose = (place: 'main' | 'new') =>
              setCurrentTarget({
                projectId: t().project.id,
                worktree: place === 'new' || undefined,
              });
            const existing = () =>
              !t().worktree && !t().workspace.main ? t().workspace : undefined;
            return (
              <div class="flex flex-col gap-2">
                <StartComposer
                  target={{
                    projectId: t().project.id,
                    cwd: cwd(),
                    worktree: chat() || (!assistant() && t().worktree),
                  }}
                  agent={startAgent()}
                  draft="new"
                />
                <div class="flex min-w-0 flex-wrap items-center gap-2 px-1">
                  <ProjectSelect
                    project={t().project}
                    onChange={setCurrentTarget}
                    onAdd={openProjectPicker}
                  />
                  <Show
                    when={!assistant()}
                    fallback={
                      <span class="flex items-center gap-1 rounded-md bg-active py-0.5 pr-0.5 pl-2 text-meta">
                        <AssistantIcon />
                        Assistant mode
                        <IconButton
                          size="sm"
                          title="Start a coding session instead"
                          onClick={() => setStartAgent('coding')}
                        >
                          <CloseIcon />
                        </IconButton>
                      </span>
                    }
                  >
                    <Show when={t().project.git && !chat()}>
                      <Segmented class="min-w-0">
                        <button
                          type="button"
                          class={segmentClass}
                          data-on={(!t().worktree && !existing()) || undefined}
                          aria-pressed={
                            !t().worktree && !existing() ? 'true' : 'false'
                          }
                          title={`${main().path}${main().branch ? `, on ${main().branch}` : ''}`}
                          onClick={() => choose('main')}
                        >
                          Main folder
                        </button>
                        <button
                          type="button"
                          class={segmentClass}
                          data-on={t().worktree || undefined}
                          aria-pressed={t().worktree ? 'true' : 'false'}
                          title="A new worktree and branch from the default branch, named after the session"
                          onClick={() => choose('new')}
                        >
                          <PlusIcon />
                          New worktree
                        </button>
                        <Show when={existing()}>
                          {(w) => (
                            <button
                              type="button"
                              class={[segmentClass, 'min-w-0']}
                              data-on
                              aria-pressed="true"
                              title={w().path}
                            >
                              <BranchIcon />
                              <span class="truncate font-mono">
                                {w().branch ?? folderName(w().path)}
                              </span>
                            </button>
                          )}
                        </Show>
                      </Segmented>
                    </Show>
                  </Show>
                </div>
              </div>
            );
          }}
        </Show>
      </div>
    </>
  );
}
