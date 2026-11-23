import { Show, createMemo, onCleanup } from 'solid-js';

import { openProjectPicker } from '../projects/ProjectPicker';
import ProjectSelect from '../projects/ProjectSelect';
import StartComposer from '../sessions/StartComposer';
import TopBar from '../app/TopBar';
import { Button } from '../ui/Button';
import { BranchIcon, PlusIcon } from '../ui/icons';
import { Segmented, segmentClass } from '../ui/Segmented';
import {
  CHATS_ID,
  currentTarget,
  folderName,
  resolveTarget,
  setCurrentTarget,
  useProjects,
} from '../projects/projects';

const HEADINGS = [
  'What are we building?',
  'What are we brewing?',
  'What should we ship today?',
  'Fresh espresso, fresh idea?',
  'What needs fixing?',
  'One more shot?',
  'What’s on the menu?',
  'Got a bug for me?',
  'Where do we start?',
  'What are we breaking today?',
  'Pull a shot, push a branch?',
  'What’s next?',
];

export default function Home() {
  const heading = HEADINGS[Math.floor(Math.random() * HEADINGS.length)];
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
  });

  return (
    <>
      <TopBar />
      <div class="chat-column flex flex-1 flex-col justify-center gap-8 pb-[15vh]">
        <h1 class="text-center font-reading text-greeting font-medium tracking-tight">
          {heading}
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
            const main = () =>
              t().project.workspaces.find((w) => w.main) ?? t().workspace;
            const chat = () => t().project.id === CHATS_ID;
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
                    cwd: t().workspace.path,
                    worktree: chat() || t().worktree,
                  }}
                  draft="new"
                />
                <div class="flex min-w-0 flex-wrap items-center gap-2 px-1">
                  <ProjectSelect
                    project={t().project}
                    onChange={setCurrentTarget}
                    onAdd={openProjectPicker}
                  />
                  {/* A bot's workspace holds many repos: no worktrees. */}
                  <Show when={t().project.git && !chat() && !t().project.bot}>
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
                </div>
              </div>
            );
          }}
        </Show>
      </div>
    </>
  );
}
