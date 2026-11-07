// /app: a mock Bica screen in BoardUI's visual language. The frame follows
// BoardUI's free chat screen (agent-chat.tsx): a floating sidebar beside a
// rounded panel holding a header, the transcript column, and the composer.
// Everything is fake: a timer plays a scripted turn after each prompt.
import {
  For,
  Match,
  Show,
  Switch,
  createSignal,
  createStore,
  onSettled,
} from 'solid-js';

import { Sidebar, useSidebar, Collapsible } from '../blocks/Sidebar';
import { SettingsModal } from '../blocks/SettingsModal';
import { Button, IconButton } from '../ui/buttons';
import { cx } from '../ui/cx';
import { Chip, StatusDot } from '../ui/display';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiChatNewLine,
  RiErrorWarningFill,
  RiFolder3Line,
  RiGitBranchLine,
  RiGitPullRequestLine,
  RiMenuLine,
  RiMore2Line,
  RiSideBarFill,
} from '../ui/icons';
import { Dropdown, DropdownItem } from '../ui/menus';
import { NotificationViewport, toast } from '../ui/Notification';
import { Tooltip } from '../ui/Tooltip';
import { setTheme, theme } from '../theme';
import { Composer } from './Composer';
import {
  HISTORY,
  PROJECTS,
  SCRIPT,
  type Project,
  type Session,
  type SessionStatus,
  type Step,
  type Turn,
} from './data';
import {
  AgentProgress,
  AssistantReply,
  Thinking,
  ToolCalls,
  UserPrompt,
  type LiveTool,
} from './transcript';

/* --------------------------------------------------------------- sidebar */

const STATUS_LABEL: Record<SessionStatus, string> = {
  running: 'Running',
  waiting: 'Waiting on you',
  idle: 'Idle',
  error: 'Failed',
  done: 'Finished',
};

/** A session's status as a dot, with a shape per state as well as a color. */
function SessionDot(props: { status: SessionStatus; onFill?: boolean }) {
  return (
    <span
      class="flex size-5 shrink-0 items-center justify-center"
      title={STATUS_LABEL[props.status]}
    >
      <Switch>
        <Match when={props.status === 'running'}>
          <span class="relative flex size-3 items-center justify-center">
            <span class="bui-halo-pulse absolute inset-0 rounded-full bg-status-dot-green-halo" />
            <span class="relative size-1.5 rounded-full bg-green-500" />
          </span>
        </Match>
        <Match when={props.status === 'waiting'}>
          <StatusDot color="yellow" />
        </Match>
        <Match when={props.status === 'done'}>
          <StatusDot color="indigo" />
        </Match>
        <Match when={props.status === 'error'}>
          <RiErrorWarningFill
            class={cx('size-4', props.onFill ? 'text-white' : 'text-rose-500')}
          />
        </Match>
        <Match when={props.status === 'idle'}>
          <span
            class={cx(
              'size-2 rounded-full border-[1.5px]',
              props.onFill
                ? 'border-white/70'
                : 'border-foreground-icon-tertiary',
            )}
          />
        </Match>
      </Switch>
    </span>
  );
}

function SessionRow(props: {
  session: Session;
  selected: boolean;
  onSelect: () => void;
}) {
  const sidebar = useSidebar();
  return (
    <Show when={props.session.title.toLowerCase().includes(sidebar.query())}>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          props.onSelect();
        }}
        aria-current={props.selected ? 'page' : undefined}
        title={sidebar.collapsed() ? props.session.title : undefined}
        class={cx(
          'group flex h-9 items-center gap-2 overflow-hidden rounded-2lg px-2 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
          'transition-[width,background-color] duration-300 ease-in-out',
          sidebar.collapsed() ? 'w-9 justify-center px-0' : 'w-full',
          props.selected
            ? 'bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected'
            : 'hover:bg-background-secondary-hover',
        )}
      >
        <SessionDot status={props.session.status} onFill={props.selected} />
        <Collapsible class="flex-1 justify-between gap-2">
          <span
            class={cx(
              'truncate text-body-medium',
              props.selected
                ? 'text-white'
                : props.session.status === 'idle'
                  ? 'text-text-secondary'
                  : 'text-text-primary',
            )}
          >
            {props.session.title}
          </span>
          <span
            class={cx(
              'shrink-0 text-caption-1-medium tabular-nums',
              props.selected ? 'text-white/75' : 'text-text-tertiary',
            )}
          >
            {props.session.time}
          </span>
        </Collapsible>
      </a>
    </Show>
  );
}

function ProjectGroup(props: {
  project: Project;
  selected: string;
  onSelect: (s: Session) => void;
}) {
  const sidebar = useSidebar();
  const [open, setOpen] = createSignal(true);
  return (
    <section class="flex flex-col gap-1">
      <Show
        when={!sidebar.collapsed()}
        fallback={<div class="mx-auto my-1 h-px w-6 bg-separator-border" />}
      >
        <div class="group/project flex h-7 items-center gap-1 ps-2 pe-1">
          <button
            type="button"
            aria-expanded={open() ? 'true' : 'false'}
            onClick={() => setOpen(!open())}
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiFolder3Line class="size-4 shrink-0 text-foreground-icon-tertiary" />
            <span class="truncate text-body-2-medium text-text-secondary">
              {props.project.name}
            </span>
            <RiArrowDownSLine
              class={cx(
                'size-4 shrink-0 text-foreground-icon-tertiary transition-transform duration-150',
                !open() && '-rotate-90',
              )}
            />
          </button>
          <Tooltip content="New session">
            <button
              type="button"
              aria-label={`New session in ${props.project.name}`}
              class="flex size-6 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary opacity-0 outline-none transition-opacity group-hover/project:opacity-100 hover:bg-background-secondary-hover focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border-focus-ring max-lg:opacity-100"
            >
              <RiAddLine class="size-4" />
            </button>
          </Tooltip>
        </div>
      </Show>
      <Show when={open() || sidebar.collapsed()}>
        <div class="flex flex-col gap-0.5">
          <For each={props.project.sessions}>
            {(s) => (
              <SessionRow
                session={s}
                selected={props.selected === s.id}
                onSelect={() => props.onSelect(s)}
              />
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}

function AppSidebar(props: {
  mobile?: boolean;
  onClose?: () => void;
  selected: string;
  onSelect: (s: Session) => void;
  onSettings: () => void;
  class?: string;
}) {
  return (
    <Sidebar
      mobile={props.mobile}
      onClose={props.onClose}
      class={props.class}
      workspace={{
        name: 'Bica',
        initials: 'B',
        detail: '<machine> · 3 projects',
      }}
      searchLabel="Search sessions"
      theme={theme()}
      onTheme={setTheme}
      onSettings={props.onSettings}
      action={<NewSessionButton />}
    >
      <nav aria-label="Projects" class="flex w-full flex-col gap-3">
        <For each={PROJECTS}>
          {(p) => (
            <ProjectGroup
              project={p}
              selected={props.selected}
              onSelect={props.onSelect}
            />
          )}
        </For>
      </nav>
    </Sidebar>
  );
}

function NewSessionButton() {
  const sidebar = useSidebar();
  return (
    <Show
      when={!sidebar.collapsed()}
      fallback={
        <IconButton
          icon={RiChatNewLine}
          aria-label="New session"
          class="rounded-full"
        />
      }
    >
      <Button variant="primary" leadingIcon={RiChatNewLine} class="w-full">
        New session
      </Button>
    </Show>
  );
}

/* ------------------------------------------------------------ transcript */

type LiveTurn =
  | Turn
  | { kind: 'tools'; tools: LiveTool[] }
  | { kind: 'assistant'; text: string; streaming?: boolean };

type Phase = 'idle' | 'thinking' | 'tools' | 'writing';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BicaApp() {
  const [state, setState] = createStore<{ turns: LiveTurn[]; phase: Phase }>({
    turns: structuredClone(HISTORY),
    phase: 'idle',
  });
  const [selected, setSelected] = createSignal('s1');
  const [title, setTitle] = createSignal('Port BoardUI to Solid');
  const [drawer, setDrawer] = createSignal(false);
  const [settings, setSettings] = createSignal(false);
  let run = 0;
  let scroller!: HTMLDivElement;
  let column!: HTMLDivElement;
  let pinned = true;

  const play = async (prompt: string) => {
    const id = ++run;
    const live = () => id === run;
    setState((s) => {
      s.turns.push({ kind: 'user', text: prompt });
      s.phase = 'thinking';
    });
    pinned = true;
    await sleep(1600);
    if (!live()) return;

    const steps: Step[] = SCRIPT.steps.map((label, i) => ({
      label,
      state: i === 0 ? 'active' : 'pending',
    }));
    // Store reads lag until the next flush, so take the indexes from the draft.
    let progressAt = 0;
    let toolsAt = 0;
    setState((s) => {
      progressAt = s.turns.push({ kind: 'progress', steps }) - 1;
      toolsAt = s.turns.push({ kind: 'tools', tools: [] }) - 1;
      s.phase = 'tools';
    });
    for (const [i, tool] of SCRIPT.tools.entries()) {
      setState((s) => {
        (s.turns[toolsAt] as { tools: LiveTool[] }).tools.push({
          ...tool,
          running: true,
        });
      });
      await sleep(1100);
      if (!live()) return;
      setState((s) => {
        (s.turns[toolsAt] as { tools: LiveTool[] }).tools[i].running = false;
        const plan = (s.turns[progressAt] as { steps: Step[] }).steps;
        if (i < plan.length - 1) {
          plan[i].state = 'done';
          plan[i + 1].state = 'active';
        }
      });
    }

    let replyAt = 0;
    setState((s) => {
      replyAt =
        s.turns.push({ kind: 'assistant', text: '', streaming: true }) - 1;
      s.phase = 'writing';
    });
    const reply = SCRIPT.reply;
    for (let at = 0; at < reply.length;) {
      at = Math.min(reply.length, at + 3 + Math.floor(Math.random() * 6));
      const text = reply.slice(0, at);
      setState((s) => {
        (s.turns[replyAt] as { text: string }).text = text;
      });
      await sleep(28);
      if (!live()) return;
    }
    setState((s) => {
      (s.turns[replyAt] as { streaming?: boolean }).streaming = false;
      for (const step of (s.turns[progressAt] as { steps: Step[] }).steps)
        step.state = 'done';
      s.phase = 'idle';
    });
    toast({
      status: 'success',
      title: 'Session finished',
      description: 'Port BoardUI to Solid stopped running.',
    });
  };

  const stop = () => {
    run++;
    setState((s) => {
      for (const t of s.turns) {
        if (t.kind === 'tools')
          for (const tool of t.tools as LiveTool[]) tool.running = false;
        if (t.kind === 'assistant')
          (t as { streaming?: boolean }).streaming = false;
        if (t.kind === 'progress')
          for (const step of t.steps)
            if (step.state === 'active') step.state = 'pending';
      }
      s.phase = 'idle';
    });
  };

  onSettled(() => {
    // Keep the newest output in view while it streams, unless scrolled up.
    const ro = new ResizeObserver(() => {
      if (pinned) scroller.scrollTop = scroller.scrollHeight;
    });
    ro.observe(column);
    const start = setTimeout(
      () =>
        play(
          'Now port the Button family to Solid 2 and check both themes in the gallery.',
        ),
      700,
    );
    return () => {
      ro.disconnect();
      clearTimeout(start);
      run++;
    };
  });

  const select = (s: Session) => {
    setSelected(s.id);
    setTitle(s.title);
    setDrawer(false);
  };

  const busy = () => state.phase !== 'idle';

  return (
    <div class="relative flex h-dvh w-full gap-3 overflow-hidden bg-background-full p-2 sm:p-3 lg:gap-4">
      <AppSidebar
        class="hidden lg:flex"
        selected={selected()}
        onSelect={select}
        onSettings={() => setSettings(true)}
      />

      {/* Below lg the sidebar is a drawer over the page, as in BoardUI's chat. */}
      <Show when={drawer()}>
        <div
          class="fixed inset-0 z-50 flex lg:hidden"
          onKeyDown={(e) => e.key === 'Escape' && setDrawer(false)}
        >
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            class="bui-fade absolute inset-0 cursor-pointer bg-black/40"
          />
          <div class="bui-drawer relative flex h-full max-w-[calc(100vw-48px)] p-2 sm:p-3">
            <AppSidebar
              mobile
              onClose={() => setDrawer(false)}
              selected={selected()}
              onSelect={select}
              onSettings={() => {
                setDrawer(false);
                setSettings(true);
              }}
            />
          </div>
        </div>
      </Show>

      <main
        inert={drawer()}
        class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-background-secondary-default sm:rounded-3xl"
      >
        <header class="flex h-14 shrink-0 items-center gap-2 border-b border-separator-border px-3 sm:px-4">
          <IconButton
            icon={RiMenuLine}
            size="small"
            aria-label="Open navigation"
            onClick={() => setDrawer(true)}
            class="lg:hidden"
          />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-headline-medium text-text-primary">
              {title()}
            </span>
            <span class="flex items-center gap-1 text-caption-1-medium text-text-tertiary sm:hidden">
              <RiGitBranchLine class="size-3.5" /> boardui-port
            </span>
          </div>
          <Chip
            variant="caption"
            color={busy() ? 'lime' : 'neutral'}
            class="hidden gap-1.5 sm:inline-flex"
          >
            <Show
              when={busy()}
              fallback={
                <span class="size-1.5 rounded-full bg-current opacity-60" />
              }
            >
              <span class="size-1.5 rounded-full bg-green-500" />
            </Show>
            {busy() ? 'Running' : 'Idle'}
          </Chip>
          <Chip
            variant="caption"
            color="soft"
            class="hidden gap-1 md:inline-flex"
          >
            <RiGitBranchLine class="size-3.5" /> boardui-port
          </Chip>
          <Tooltip content="Open pull request">
            <IconButton
              icon={RiGitPullRequestLine}
              size="small"
              aria-label="Open pull request"
              class="max-sm:hidden"
            />
          </Tooltip>
          <Tooltip content="Side panel">
            <IconButton
              icon={RiSideBarFill}
              size="small"
              aria-label="Side panel"
              class="max-md:hidden"
            />
          </Tooltip>
          <Dropdown
            aria-label="Session actions"
            placement="bottom-end"
            triggerLabel="Session actions"
            class="w-56"
            triggerClass="flex size-8 items-center justify-center rounded-2lg border border-border-button-default bg-background-primary-default text-foreground-icon-primary shadow-xs hover:bg-background-primary-hover"
            trigger={<RiMore2Line class="size-4" />}
          >
            <DropdownItem>Rename</DropdownItem>
            <DropdownItem>Fork from here</DropdownItem>
            <DropdownItem>Copy transcript</DropdownItem>
            <DropdownItem class="text-text-destructive">Archive</DropdownItem>
          </Dropdown>
        </header>

        <div
          ref={scroller}
          onScroll={() =>
            (pinned =
              scroller.scrollHeight -
                scroller.scrollTop -
                scroller.clientHeight <
              40)
          }
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div
            ref={column}
            class="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 pt-6 pb-6 sm:px-4"
          >
            <For each={state.turns}>
              {(turn) => (
                <Switch>
                  <Match when={turn.kind === 'user'}>
                    <UserPrompt text={(turn as { text: string }).text} />
                  </Match>
                  <Match when={turn.kind === 'assistant'}>
                    <AssistantReply
                      text={(turn as { text: string }).text}
                      streaming={(turn as { streaming?: boolean }).streaming}
                    />
                  </Match>
                  <Match when={turn.kind === 'tools'}>
                    <ToolCalls tools={(turn as { tools: LiveTool[] }).tools} />
                  </Match>
                  <Match when={turn.kind === 'progress'}>
                    <AgentProgress steps={(turn as { steps: Step[] }).steps} />
                  </Match>
                </Switch>
              )}
            </For>
            <Show when={state.phase === 'thinking' || state.phase === 'tools'}>
              <Thinking
                label={state.phase === 'thinking' ? 'Thinking' : 'Working'}
              />
            </Show>
          </div>
        </div>

        <div class="shrink-0 px-2 pb-2 sm:px-3 sm:pb-3">
          <div class="mx-auto w-full max-w-3xl">
            <Composer
              busy={busy()}
              onSend={play}
              onStop={stop}
              branch="boardui-port"
            />
          </div>
        </div>
      </main>

      <SettingsModal
        open={settings()}
        onClose={() => setSettings(false)}
        theme={theme()}
        onTheme={setTheme}
      />
      <NotificationViewport />
    </div>
  );
}
