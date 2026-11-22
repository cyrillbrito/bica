import { Title } from '@solidjs/meta';
import { useLocation, useNavigate, type RouteProps } from '@solidjs/router';
import {
  type Accessor,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onSettled,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createStickToBottom } from '../../ui/stick-to-bottom';
import { createArrival } from '../../ui/arrive';
import CallBar from '../../voice/CallBar';
import Composer, { type ComposerApi } from '../../sessions/Composer';
import ContextChip from '../../context-usage/ContextChip';
import ContextNag from '../../context-usage/ContextNag';
import { isPruning } from '../../context-usage/context-usage';
import MessageRow, { RULE } from '../../sessions/MessageRow';
import ModelPicker from '../../models/ModelPicker';
import OpenFile from '../../files/OpenFile';
import OutsideFile from '../../files/OutsideFile';
import CommitView from '../../git/CommitView';
import { commitFromSearch, sameCommit } from '../../git/git';
import {
  detachSession,
  unwatchSession,
} from '../../orchestration/orchestration';
import ParentStrip from '../../orchestration/ParentStrip';
import WatchStrip from '../../orchestration/WatchStrip';
import { archiveBotSession, openBot, useBots } from '../../bots/bots';
import BotMark from '../../bots/BotMark';
import { openBotDialog } from '../../bots/BotDialog';
import WatchingStrip from '../../bots/WatchingStrip';
import { toast } from '../../ui/Toast';
import StuckStrip from '../../sessions/StuckStrip';
import Queue from '../../sessions/Queue';
import StatusDot from '../../sessions/StatusDot';
import AgentBadge from '../../sessions/AgentBadge';
import { menuItem, useSessionActions } from '../../sessions/actions';
import { MenuButton, type MenuEntry } from '../../ui/ContextMenu';
import VoiceSettings from '../../voice/VoiceSettings';
import TitleInput from '../../sessions/TitleInput';
import TopBar from '../../app/TopBar';
import { IconButton } from '../../ui/Button';
import Empty from '../../ui/Empty';
import {
  ArchiveIcon,
  CloseIcon,
  DeleteIcon,
  ParentIcon,
  PencilIcon,
  SessionIcon,
  VoiceIcon,
} from '../../ui/icons';
import { drawer, setNoPanels } from '../../ui/layout';
import {
  openFromSearch,
  outsideFromSearch,
  sameOpen,
  sessionFileHref,
} from '../../files/files';
import { useCurrentWorkspace } from '../../projects/projects';
import { paths } from '../../router';
import { sessionChoice, setOpenModel } from '../../models/models';
import {
  configureSession,
  forkSession,
  markSeen,
  sendPrompt,
  stopSession,
  useConversation,
  useSessions,
} from '../../sessions/sessions';
import { pageFocused } from '../../ui/focus';
import Working from '../../sessions/Working';
import { hasPanels } from '@bica/shared/agents';
import { isBusy } from '@bica/shared/status';
import type { ProjectedView } from '@bica/shared/projection';
import { SessionId } from '../../sessions/step-detail';
import { hideThinking } from '../../sessions/thinking';
import { call, startCall } from '../../voice/voice';
import {
  promptAt,
  toMessages,
  viewStatus,
  type Message,
} from '@bica/shared/transcript';

export default function Session(props: RouteProps<'/s/:id'>) {
  const view = useConversation(() => props.params.id!);
  const sessions = useSessions();
  // Titles and read state are ours, not Pi Durable's; they come with the list.
  const summary = createMemo(
    () => sessions().find((s) => s.id === props.params.id),
    { name: 'sessionSummary' },
  );
  const bots = useBots();
  // Set when this is a bot's own session, which goes by the bot's name.
  const bot = createMemo(() => bots().find((b) => b.id === summary()?.bot), {
    name: 'sessionBot',
  });
  const title = () => bot()?.name ?? (summary()?.title || '…');
  const titleRef = createArrival(
    () => summary()?.title,
    () => props.params.id!,
  );

  // A background or unfocused tab hasn't been read, even with the session
  // open in it.
  createEffect(
    () =>
      pageFocused() && summary()?.status === 'done'
        ? props.params.id
        : undefined,
    (id) => {
      if (id) void markSeen(id);
    },
    { name: 'markSeen' },
  );
  // A session without panels hides the files and changes panel while open.
  createEffect(
    () => (summary() ? !hasPanels(summary()!.agent) : false),
    (hide) => {
      setNoPanels(hide);
      return () => setNoPanels(false);
    },
    { name: 'noPanels' },
  );
  const [renaming, setRenaming] = createSignal(false);
  const navigate = useNavigate();
  // A file opened from the side panel shows over the chat, which stays
  // mounted underneath: closing it is back to the same draft and scroll.
  const location = useLocation();
  const workspace = useCurrentWorkspace();
  const open = createMemo(() => openFromSearch(location.search), {
    name: 'fileOverChat',
    equals: sameOpen,
  });
  const commit = createMemo(() => commitFromSearch(location.search), {
    name: 'commitOverChat',
    equals: sameCommit,
  });
  const outside = createMemo(() => outsideFromSearch(location.search), {
    name: 'outsideFileOverChat',
  });
  const closeFile = () => navigate(paths.s(props.params.id!)());
  onSettled(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        (open() || commit() || outside()) &&
        !drawer() &&
        !e.defaultPrevented
      )
        closeFile();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  const forkedFrom = createMemo(
    () => sessions().find((s) => s.id === summary()?.forkedFrom),
    { name: 'forkedFrom' },
  );
  const parent = createMemo(
    () => sessions().find((s) => s.id === summary()?.parent),
    { name: 'parent' },
  );
  // Hovering any part of a reply shows the fork button at its end, or the
  // next compaction or pruning line, which has its own.
  let shown: Element | undefined;
  const forks = ['end', 'compaction', 'prune'];
  const showFork = (e?: PointerEvent) => {
    let row = (e?.target as Element | undefined)?.closest('[data-kind]');
    while (row && ![...forks, 'user'].includes(row.getAttribute('data-kind')!))
      row = row.nextElementSibling ?? undefined;
    const end =
      row && forks.includes(row.getAttribute('data-kind') ?? '')
        ? row
        : undefined;
    if (end === shown) return;
    shown?.removeAttribute('data-show');
    end?.setAttribute('data-show', '');
    shown = end;
  };
  // The bot whose session is the parent, so the parent shows by the bot's name.
  const parentBot = createMemo(
    () => bots().find((b) => b.id === parent()?.bot),
    { name: 'parentBot' },
  );
  const watchers = createMemo(
    () =>
      (summary()?.watchedBy ?? []).flatMap((id) => {
        const s = sessions().find((s) => s.id === id);
        if (!s) return [];
        const bot = bots().find((b) => b.id === s.bot);
        return [{ id, name: bot?.name ?? (s.title || 'New session'), bot }];
      }),
    { name: 'watchers' },
  );
  const forkAt = async (at: number) =>
    navigate(paths.s(await forkSession(props.params.id!, at))());
  // A number, so list refreshes don't rebuild the transcript.
  const forkedAt = createMemo(() => summary()?.forkedAt ?? undefined, {
    name: 'forkedAt',
  });
  const messages = createMemo(() => {
    const v = view();
    return v ? toMessages(v, forkedAt(), { thinking: !hideThinking() }) : [];
  });
  // Each change of who is in charge as a line, before the first prompt sent after it.
  const rows = createMemo(
    () => {
      const list = messages();
      const changes = summary()?.handoffs ?? [];
      const pruning = isPruning(props.params.id!);
      if (!changes.length && !pruning) return list;
      const out = [...list];
      for (const h of changes.toSorted((a, b) => b.at - a.at)) {
        const i = out.findIndex((m) => (promptAt(m) ?? -1) >= h.at);
        out.splice(i === -1 ? out.length : i, 0, {
          key: `in-charge:${h.at}`,
          kind: 'in-charge',
          to: h.to,
        });
      }
      if (pruning)
        out.push({
          key: 'pruning',
          kind: 'pruning',
          running: !!view()?.docs['pi.live']?.run,
        });
      return out;
    },
    { name: 'transcriptRows' },
  );
  // While a run lasts, one line at the bottom says the agent is on it, timed
  // from the prompt that started this stretch of work.
  const waiting = createMemo(
    () => {
      const live = view()?.docs['pi.live'];
      if (!live?.run) return undefined;
      let since: number | undefined;
      for (const m of messages().toReversed()) {
        if (m.kind === 'end' || m.kind === 'error') break;
        since = promptAt(m) ?? since;
      }
      return { since, retry: live.generation?.retry };
    },
    {
      name: 'waitingOnAgent',
      equals: (a, b) =>
        a?.since === b?.since &&
        a?.retry?.at === b?.retry?.at &&
        a?.retry?.error === b?.retry?.error,
    },
  );
  // Worked out by the server, which holds the full conversation; shared by
  // the chip and the nag above the composer.
  const usage = createMemo(() => view()?.docs['bica.context'], {
    name: 'contextUsage',
  });
  const lastCompaction = createMemo(
    () =>
      messages().findLast(
        (m): m is Extract<Message, { kind: 'compaction' }> =>
          m.kind === 'compaction',
      ),
    { name: 'lastCompaction' },
  );
  const lastPrune = createMemo(
    () =>
      messages().findLast(
        (m): m is Extract<Message, { kind: 'prune' }> => m.kind === 'prune',
      ),
    { name: 'lastPrune' },
  );

  // From the list, not the transcript: the composer is ready before it loads.
  const busy = createMemo(() => isBusy(summary()?.status), {
    name: 'sessionBusy',
  });
  const { actionsFor } = useSessionActions();
  let voiceDialog: HTMLDialogElement | undefined;
  // The session's own menu: what the sidebar row offers, plus its voice.
  const sessionMenu = (): MenuEntry[] => {
    const s = summary();
    if (!s) return [];
    const b = bot();
    return [
      ...actionsFor(s, () => setRenaming(true))
        .filter((a) => a.id !== 'new-tab')
        .map(menuItem),
      'separator',
      {
        label: 'Voice settings',
        icon: <VoiceIcon />,
        onSelect: () => voiceDialog?.showModal(),
      },
      ...(b ? botMenu(b.id, s.id, navigate) : []),
    ];
  };
  // A session opens where it was left, or at its newest message.
  const stick = createStickToBottom(() => props.params.id!);
  let composer: ComposerApi | undefined;
  // The title, top bar, and composer come from the list, which is already
  // here. The parts that need the transcript appear when it lands, each in
  // place, so switching sessions shows the page at once and fills it in.
  const Ready = (p: {
    children: (view: Accessor<ProjectedView>) => JSX.Element;
  }) => <Show when={view()}>{p.children}</Show>;
  // The agent's model, under the prompt and under a call alike.
  const modelPicker = () => (
    <Ready>
      {(v) => (
        <ModelPicker
          value={sessionChoice(v())}
          onChange={(choice) => void configureSession(props.params.id!, choice)}
        />
      )}
    </Ready>
  );

  return (
    <Show
      when={!!summary()}
      fallback={
        <>
          <TopBar />
          <Empty>Session not found</Empty>
        </>
      }
    >
      <Title>{title()}</Title>
      <TopBar
        actions={
          <>
            <Ready>
              {(v) => (
                <ContextChip
                  id={props.params.id!}
                  view={v()}
                  usage={usage()!}
                />
              )}
            </Ready>
            <MenuButton size="md" title="Session actions" items={sessionMenu} />
          </>
        }
      >
        <Show
          when={bot()}
          fallback={<AgentBadge agent={summary()?.agent ?? 'coding'} />}
        >
          {(b) => <BotMark bot={b()} size="md" />}
        </Show>
        {/* The open session is always read: only show a state worth noticing. */}
        <Ready>
          {(v) => (
            <Show when={viewStatus(v()) !== 'idle'}>
              <StatusDot status={viewStatus(v())} />
            </Show>
          )}
        </Ready>
        <Show
          when={!bot()}
          fallback={
            <h1 dir="auto" class="min-w-0 truncate font-semibold">
              {title()}
            </h1>
          }
        >
          <Show
            when={renaming()}
            fallback={
              // Negative margin on the h1, not the button: on the button it
              // shrinks the h1 below the button's width, always truncating.
              <h1 class="-mx-1.5 min-w-0">
                <button
                  class="block max-w-full truncate rounded-md px-1.5 py-0.5 font-semibold transition-colors hover:bg-hover"
                  title="Rename"
                  onClick={() => setRenaming(true)}
                >
                  <span ref={titleRef}>{title()}</span>
                </button>
              </h1>
            }
          >
            <TitleInput
              id={props.params.id!}
              value={summary()?.title ?? ''}
              onClose={() => setRenaming(false)}
              class="-mx-1.5 max-w-120 py-0.5 font-semibold"
            />
          </Show>
        </Show>
        <Show when={parent()}>
          {(parent) => (
            <a
              class="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-meta text-accent-ink transition-colors hover:bg-hover [&_svg]:size-3.5"
              href={paths.s(parent().id)()}
              title="Its parent session is in charge. Open the parent."
            >
              <ParentIcon />
              <span class="max-md:hidden">Parent in charge</span>
            </a>
          )}
        </Show>
      </TopBar>
      <Show when={bot()}>
        <WatchingStrip sessionId={props.params.id!} />
      </Show>
      <div class="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={stick.scroller}
          class="flex flex-1 flex-col overflow-y-auto overscroll-contain border-t border-line"
          inert={!!open()}
        >
          <div
            ref={stick.content}
            class="chat-column flex flex-1 flex-col gap-5 pt-8"
            onPointerOver={showFork}
            onPointerLeave={() => showFork()}
          >
            <Show when={parent()}>
              {(parent) => (
                <a
                  class={[RULE, 'min-w-0 self-center hover:text-fg']}
                  href={paths.s(parent().id)()}
                >
                  <SessionIcon />
                  <span class="truncate">
                    Started by{' '}
                    {parentBot()?.name ?? (parent().title || 'another session')}
                  </span>
                </a>
              )}
            </Show>
            <Ready>
              {(v) => {
                // The sidebar shows only this model's plan.
                createEffect(
                  () => {
                    const model = sessionChoice(v())?.model;
                    return model && `${model.provider}/${model.modelId}`;
                  },
                  (key) => {
                    const [provider, ...rest] = key?.split('/') ?? [];
                    setOpenModel(
                      provider
                        ? { provider, modelId: rest.join('/') }
                        : undefined,
                    );
                    return () => setOpenModel(undefined);
                  },
                  { name: 'openModel' },
                );
                return (
                  <SessionId value={() => props.params.id!}>
                    {/* Every change derives fresh objects; the key keeps rows. */}
                    <For
                      each={rows()}
                      keyed={(m) => m.key}
                      fallback={
                        <div class="text-center text-muted">
                          {bot()
                            ? `Tell ${bot()!.name} what you're working on.`
                            : 'No messages yet'}
                        </div>
                      }
                    >
                      {(m) => (
                        <MessageRow
                          message={m()}
                          onFork={bot() ? undefined : forkAt}
                          onAnswer={(text) => {
                            stick.follow();
                            return sendPrompt(props.params.id!, text, []);
                          }}
                          forkedFrom={forkedFrom()}
                          cwd={summary()?.cwd ?? undefined}
                        />
                      )}
                    </For>
                    <Show when={waiting()}>
                      {(w) => <Working since={w().since} retry={w().retry} />}
                    </Show>
                  </SessionId>
                );
              }}
            </Ready>
          </div>
          {/* Sticky inside the scroller, so the transcript scrolls behind it
              and the scroll height already counts it. */}
          <div
            ref={stick.content}
            class="pointer-events-none sticky bottom-0 bg-[linear-gradient(to_bottom,transparent,var(--color-bg)_--spacing(8))] pt-8"
          >
            <div class="chat-column pointer-events-auto pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
              <CallBar
                id={props.params.id!}
                busy={busy()}
                controls={modelPicker()}
              />
              {/* Hidden, not removed, during a call: a draft survives it. */}
              <div hidden={call()?.sessionId === props.params.id}>
                <Composer
                  draft={props.params.id!}
                  onSend={(prompt, images, steer) => {
                    // Sending means wanting to see the reply.
                    stick.follow();
                    return sendPrompt(props.params.id!, prompt, images, {
                      steer,
                    });
                  }}
                  placeholder={bot() && `Tell ${bot()!.name}…`}
                  busy={busy()}
                  // The stop drops queued prompts; give them back to edit.
                  onStop={() =>
                    stopSession(props.params.id!).then((dropped) => {
                      for (const p of dropped)
                        composer?.restore(p.prompt, p.images);
                    })
                  }
                  ref={(api) => (composer = api)}
                  top={
                    <Ready>
                      {(v) => (
                        <>
                          <Show when={summary()?.stuck}>
                            <StuckStrip />
                          </Show>
                          <Show when={summary()?.parent}>
                            <ParentStrip
                              parent={parent()}
                              bot={parentBot()}
                              onDetach={() => detachSession(props.params.id!)}
                            />
                          </Show>
                          <Show when={summary()?.watchedBy.length}>
                            <WatchStrip
                              watchers={watchers()}
                              onStop={() => unwatchSession(props.params.id!)}
                            />
                          </Show>
                          <ContextNag
                            id={props.params.id!}
                            usage={usage()!}
                            compaction={lastCompaction()}
                            prune={lastPrune()}
                          />
                          <Queue
                            id={props.params.id!}
                            view={v()}
                            composer={() => composer}
                          />
                        </>
                      )}
                    </Ready>
                  }
                  controls={modelPicker()}
                  onCall={() => void startCall(props.params.id!)}
                />
              </div>
            </div>
          </div>
        </div>
        <Show when={workspace() && commit()}>
          {(o) => (
            <section
              class="absolute inset-0 z-10 flex flex-col border-t border-line bg-bg"
              aria-label={`Commit ${o().hash.slice(0, 7)}`}
            >
              <CommitView
                workspace={workspace()!.ref}
                open={o()}
                actions={
                  <IconButton
                    size="md"
                    title="Back to the session (Esc)"
                    onClick={closeFile}
                  >
                    <CloseIcon />
                  </IconButton>
                }
              />
            </section>
          )}
        </Show>
        <Show when={outside()}>
          {(path) => (
            <section
              class="absolute inset-0 z-10 flex flex-col border-t border-line bg-bg"
              aria-label={path()}
            >
              <OutsideFile
                path={path()}
                actions={
                  <IconButton
                    size="md"
                    title="Back to the session (Esc)"
                    onClick={closeFile}
                  >
                    <CloseIcon />
                  </IconButton>
                }
              />
            </section>
          )}
        </Show>
        <Show when={workspace() && !commit() && open()}>
          {(o) => (
            <section
              class="absolute inset-0 z-10 flex flex-col border-t border-line bg-bg"
              aria-label={o().path}
            >
              <OpenFile
                workspace={workspace()!}
                open={o()}
                href={(x) => sessionFileHref(props.params.id!, x)}
                actions={
                  <IconButton
                    size="md"
                    title="Back to the session (Esc)"
                    onClick={closeFile}
                  >
                    <CloseIcon />
                  </IconButton>
                }
              />
            </section>
          )}
        </Show>
      </div>
      <VoiceSettings
        id={props.params.id!}
        voice={summary()?.voice ?? null}
        ref={(el) => (voiceDialog = el)}
      />
    </Show>
  );
}

// A bot's session's own entries, in place of Fork and Archive.
function botMenu(
  botId: string,
  sessionId: string,
  navigate: (to: string, opts: { replace: boolean }) => void,
): MenuEntry[] {
  return [
    'separator',
    {
      label: 'Edit bot',
      icon: <PencilIcon />,
      onSelect: () => openBotDialog(botId),
    },
    {
      label: 'Start a new session',
      hint: 'Archives this one. Its memory stays in its home.',
      icon: <ArchiveIcon />,
      onSelect: () =>
        void archiveBotSession(sessionId)
          .then(() => openBot(botId))
          .then((id) => navigate(paths.s(id)(), { replace: true }))
          .catch((error: unknown) => toast.error(error)),
    },
    {
      label: 'Delete bot',
      icon: <DeleteIcon />,
      danger: true,
      onSelect: () => openBotDialog(botId, { delete: true }),
    },
  ];
}
