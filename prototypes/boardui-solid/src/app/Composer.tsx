// The composer of the mock Bica screen. Its shape and controls follow
// BoardUI's free AgentComposer (agent-composer.tsx, MIT): a raised surface on
// the chat panel, a round add button, a model chip, and a round gradient send
// button that turns into stop. It grows to a multi-line card for Bica's
// longer prompts. The working glow is the prototype's own (`.bui-glow`).
import { Show, createSignal } from 'solid-js';

import { cx } from '../ui/cx';
import { Kbd } from '../ui/display';
import {
  RiArrowUpLine,
  RiAttachment2,
  RiGitBranchLine,
  RiSparkling2Fill,
  RiStopFill,
} from '../ui/icons';
import { Select } from '../ui/menus';
import { Tooltip } from '../ui/Tooltip';

const MODELS = [
  { id: 'opus', label: 'Opus 4.5' },
  { id: 'sonnet', label: 'Sonnet 4.5' },
  { id: 'gpt', label: 'GPT-5.4' },
];

export function Composer(props: {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  branch?: string;
}) {
  const [text, setText] = createSignal('');
  const [model, setModel] = createSignal('opus');
  let field!: HTMLTextAreaElement;

  const fit = () => {
    field.style.height = '0px';
    field.style.height = `${Math.min(field.scrollHeight, 200)}px`;
  };
  const send = () => {
    const value = text().trim();
    if (!value || props.busy) return;
    props.onSend(value);
    setText('');
    field.value = '';
    fit();
  };

  return (
    <div class="flex w-full flex-col gap-2">
      <div class="bui-glow rounded-3xl" data-active={props.busy || undefined}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          class={cx(
            'flex w-full flex-col gap-1 rounded-3xl bg-background-primary-default p-2 transition-shadow duration-300',
            props.busy ? 'shadow-none' : 'shadow-xs',
          )}
        >
          <label class="sr-only" for="composer">
            Prompt
          </label>
          <textarea
            ref={field}
            id="composer"
            rows={1}
            value={text()}
            onInput={(e) => {
              setText(e.currentTarget.value);
              fit();
            }}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !matchMedia('(pointer: coarse)').matches
              ) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              props.busy
                ? 'Queue a follow-up…'
                : 'Ask the agent to build something'
            }
            class="block max-h-[200px] min-h-10 w-full resize-none bg-transparent px-2 pt-2 text-body-regular text-text-primary caret-accent-500 outline-none placeholder:text-text-tertiary max-sm:text-[16px]"
          />
          <div class="flex items-center gap-2">
            <Tooltip content="Attach files">
              <button
                type="button"
                aria-label="Attach files"
                class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ai-chat-composer-add-background text-foreground-icon-primary transition-colors duration-150 ease outline-none hover:bg-ai-chat-composer-add-hover-background focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                <RiAttachment2 class="size-5" />
              </button>
            </Tooltip>
            <Select
              aria-label="Model"
              size="sm"
              value={model()}
              onChange={setModel}
              options={MODELS.map((m) => ({ ...m, icon: RiSparkling2Fill }))}
              triggerClass="h-8 rounded-xl border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-background-secondary-default text-text-secondary"
            />
            <span class="ms-auto hidden items-center gap-1 text-caption-1-medium text-text-tertiary sm:flex">
              <Kbd>↵</Kbd> to send
            </span>
            <Show
              when={props.busy}
              fallback={
                <button
                  type="submit"
                  aria-label="Send prompt"
                  disabled={!text().trim()}
                  class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-button-primary text-white shadow-xs transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 max-sm:ms-auto"
                >
                  <RiArrowUpLine class="size-5" />
                </button>
              }
            >
              <button
                type="button"
                onClick={() => props.onStop()}
                aria-label="Stop"
                class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-background-tertiary-default text-foreground-icon-primary transition-colors outline-none hover:bg-background-tertiary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:ms-auto"
              >
                <RiStopFill class="size-4" />
              </button>
            </Show>
          </div>
        </form>
      </div>
      <div class="flex h-5 items-center justify-between px-2">
        <span class="flex min-w-0 items-center gap-1 text-body-2-medium text-text-secondary">
          <RiGitBranchLine class="size-4 shrink-0 text-foreground-icon-secondary" />
          <span class="truncate">{props.branch ?? 'main'}</span>
        </span>
        <span class="flex items-center gap-1.5 text-body-2-medium text-text-secondary tabular-nums">
          <span class="h-1.5 w-12 overflow-hidden rounded-full bg-background-tertiary-default">
            <span class="block h-full w-[38%] rounded-full bg-accent-500" />
          </span>
          38% context
        </span>
      </div>
    </div>
  );
}
