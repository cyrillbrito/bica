// Port of BoardUI's free chat screen, application/agent-chat (agent-chat.tsx,
// agent-chat-message.tsx, agent-composer.tsx; MIT). The AI SDK transport is
// replaced by scripted answers on a timer, the history rail is a simple list,
// and BoardUI's Composer Loader and Agent Thinking are not ported: the pill
// uses the prototype's own glow and dots instead.
import { For, Show, createSignal, createStore, onSettled } from 'solid-js';

import { Thinking } from '../app/transcript';
import { IconButton } from '../ui/buttons';
import { cx } from '../ui/cx';
import {
  RiArrowUpLine,
  RiAttachment2,
  RiChatAiLine,
  RiChatNewLine,
  RiDashboardLine,
  RiHistoryLine,
  RiInfinityLine,
  RiMenuLine,
  RiSparklingLine,
  RiStopFill,
} from '../ui/icons';
import { NavItem, Sidebar } from './Sidebar';

const SUGGESTIONS = [
  'Summarize a pull request',
  'Explain a stack trace',
  'Draft a commit message',
];

const ANSWERS: Record<string, string> = {
  default:
    'Here is a short take.\nBoardUI streams each line in with a soft blur, so a reply reads as it arrives.\nThis demo answers from a script, the way their starter does without an API key.',
};

type Message = { id: number; role: 'user' | 'assistant'; text: string };

export function ChatScreen(props: { class?: string }) {
  const [state, setState] = createStore<{
    messages: Message[];
    busy: boolean;
    thinking: boolean;
  }>({
    messages: [],
    busy: false,
    thinking: false,
  });
  const [input, setInput] = createSignal('');
  const [navOpen, setNavOpen] = createSignal(false);
  let id = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || state.busy) return;
    setInput('');
    setState((s) => {
      s.messages.push({ id: ++id, role: 'user', text: value });
      s.busy = true;
      s.thinking = true;
    });
    const lines = ANSWERS.default.split('\n');
    let shown = 0;
    const next = () => {
      if (shown === 0) {
        setState((s) => {
          s.thinking = false;
          s.messages.push({ id: ++id, role: 'assistant', text: '' });
        });
      }
      shown++;
      setState((s) => {
        s.messages[s.messages.length - 1].text = lines
          .slice(0, shown)
          .join('\n');
        if (shown === lines.length) s.busy = false;
      });
      if (shown < lines.length) timer = setTimeout(next, 650);
    };
    timer = setTimeout(next, 1200);
  };
  const stop = () => {
    clearTimeout(timer);
    setState((s) => {
      s.busy = false;
      s.thinking = false;
    });
  };
  onSettled(() => () => clearTimeout(timer));

  // A function, so each Sidebar builds its own rows inside its context.
  const nav = () => (
    <>
      <NavItem icon={RiChatAiLine} label="Chat" selected />
      <NavItem icon={RiDashboardLine} label="Dashboard" />
      <NavItem icon={RiHistoryLine} label="History" badge={12} />
    </>
  );

  return (
    <div
      class={cx(
        'relative flex w-full gap-4 overflow-hidden bg-background-full p-3',
        props.class,
      )}
    >
      <Sidebar
        class="hidden lg:flex"
        workspace={{ name: 'Acme', initials: 'A', detail: 'Free plan' }}
      >
        <nav class="flex w-full flex-col gap-1 px-0.5">{nav()}</nav>
      </Sidebar>
      <Show when={navOpen()}>
        <div class="absolute inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            class="absolute inset-0 cursor-pointer bg-black/40"
          />
          <div class="relative flex h-full p-3">
            <Sidebar
              mobile
              onClose={() => setNavOpen(false)}
              workspace={{ name: 'Acme', initials: 'A', detail: 'Free plan' }}
            >
              <nav class="flex w-full flex-col gap-1 px-0.5">{nav()}</nav>
            </Sidebar>
          </div>
        </div>
      </Show>

      <div class="relative flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
        <div class="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background-secondary-default">
          <header class="flex h-12 shrink-0 items-center gap-2 px-4 pt-[7px]">
            <IconButton
              icon={RiMenuLine}
              size="small"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
              class="lg:hidden"
            />
            <span class="min-w-0 shrink truncate text-headline-medium text-text-primary">
              {state.messages[0]?.text ?? 'New chat'}
            </span>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto">
            <div
              class={cx(
                'mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-6',
                state.messages.length === 0 && 'min-h-full justify-center',
              )}
            >
              <Show
                when={state.messages.length}
                fallback={
                  <div class="flex flex-col items-center gap-4 text-center">
                    <div class="flex flex-col gap-1">
                      <h2 class="text-title-2-medium text-text-primary">
                        What can I help with?
                      </h2>
                      <p class="text-body-regular text-text-secondary">
                        Demo mode: the answers are scripted.
                      </p>
                    </div>
                    <div class="flex flex-wrap justify-center gap-2">
                      <For each={SUGGESTIONS}>
                        {(s) => (
                          <button
                            type="button"
                            onClick={() => submit(s)}
                            class="cursor-pointer rounded-full bg-background-primary-default px-3.5 py-2 text-body-regular text-text-secondary shadow-xs transition-colors hover:bg-background-primary-hover"
                          >
                            {s}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                }
              >
                <For each={state.messages}>
                  {(m) => (
                    <Show
                      when={m.role === 'user'}
                      fallback={
                        <div class="bui-line-in flex flex-col gap-3 px-1">
                          <For
                            each={m.text.split('\n').filter(Boolean)}
                            keyed={false}
                          >
                            {(line) => (
                              <p class="text-body-regular break-words text-text-primary">
                                {line()}
                              </p>
                            )}
                          </For>
                        </div>
                      }
                    >
                      <p class="ms-auto flex w-fit max-w-[75%] flex-col rounded-2xl bg-background-primary-default px-3 py-[11px] text-start text-body-regular break-words whitespace-pre-wrap text-text-primary shadow-card">
                        {m.text}
                      </p>
                    </Show>
                  )}
                </For>
                <Show when={state.thinking}>
                  <Thinking />
                </Show>
              </Show>
            </div>
          </div>

          <div class="shrink-0 px-3 pb-3">
            <div class="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
              <div
                class="bui-glow rounded-full"
                data-active={state.busy || undefined}
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(input());
                  }}
                  class="flex h-[52px] w-full items-center gap-2.5 rounded-full bg-background-primary-default p-2 shadow-xs"
                >
                  <button
                    type="button"
                    aria-label="Add attachment"
                    class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ai-chat-composer-add-background text-foreground-icon-primary transition-colors duration-150 ease hover:bg-ai-chat-composer-add-hover-background"
                  >
                    <RiAttachment2 class="size-5" />
                  </button>
                  <input
                    type="text"
                    aria-label="Message"
                    value={input()}
                    onInput={(e) => setInput(e.currentTarget.value)}
                    placeholder="Ask me anything"
                    autocomplete="off"
                    class="h-5 min-w-0 flex-1 bg-transparent text-body-regular text-text-primary caret-text-primary outline-none placeholder:text-text-tertiary"
                  />
                  <span class="flex h-8 shrink-0 items-center gap-1 rounded-xl px-2 text-body-2-medium text-text-secondary">
                    <RiSparklingLine class="size-4 shrink-0 text-foreground-icon-secondary" />
                    <span class="hidden sm:inline">gpt-5-nano</span>
                  </span>
                  <Show
                    when={state.busy}
                    fallback={
                      <button
                        type="submit"
                        aria-label="Send message"
                        disabled={!input().trim()}
                        class="flex size-9 cursor-pointer items-center justify-center rounded-full bg-button-primary text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <RiArrowUpLine class="size-5" />
                      </button>
                    }
                  >
                    <button
                      type="button"
                      onClick={stop}
                      aria-label="Stop generating"
                      class="flex size-9 cursor-pointer items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-secondary transition-colors hover:bg-background-secondary-hover"
                    >
                      <RiStopFill class="size-5" />
                    </button>
                  </Show>
                </form>
              </div>
              <div class="flex h-[26px] w-full items-center justify-between">
                <span class="flex items-center gap-1">
                  <RiInfinityLine class="size-4 shrink-0 text-foreground-icon-secondary" />
                  <span class="text-body-2-medium whitespace-nowrap text-text-secondary">
                    Demo mode
                  </span>
                </span>
                <span class="flex items-center gap-1">
                  <RiSparklingLine class="size-4 shrink-0 text-foreground-icon-secondary" />
                  <span class="text-body-2-medium whitespace-nowrap text-text-secondary">
                    {state.messages.length === 0
                      ? 'New chat'
                      : `${state.messages.length} messages`}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <aside class="hidden w-64 shrink-0 flex-col gap-2 rounded-3xl bg-background-secondary-default p-3 2xl:flex">
          <div class="flex items-center justify-between ps-1">
            <span class="text-body-medium text-text-secondary">History</span>
            <IconButton
              icon={RiChatNewLine}
              size="small"
              aria-label="New chat"
            />
          </div>
          <For
            each={[
              'Refactor the auth hook',
              'Quarterly numbers',
              'Name ideas for a café',
            ]}
          >
            {(t, i) => (
              <button
                type="button"
                class={cx(
                  'flex w-full cursor-pointer flex-col items-start rounded-2lg p-2 text-start hover:bg-background-secondary-hover',
                  i() === 0 && 'bg-background-secondary-hover',
                )}
              >
                <span class="w-full truncate text-body-medium text-text-primary">
                  {t}
                </span>
                <span class="text-caption-1-regular text-text-tertiary">
                  {i() + 1} days ago
                </span>
              </button>
            )}
          </For>
        </aside>
      </div>
    </div>
  );
}
