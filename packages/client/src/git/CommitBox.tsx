import type { JSX } from '@solidjs/web';
import { Show, createSignal, onCleanup } from 'solid-js';

import { arrive } from '../ui/arrive';
import Alert from '../ui/Alert';
import { Button, IconButton } from '../ui/Button';
import TextArea from '../ui/TextArea';
import Chevron from '../ui/Chevron';
import { openContextMenu, type MenuEntry } from '../ui/ContextMenu';
import { DiscardIcon, DrawnCheckIcon, SparkleIcon } from '../ui/icons';
import { errorText } from '../ui/errors';

// The summary line git tools truncate at.
const SUBJECT_MAX = 72;

export interface CommitAction {
  id: string;
  label: string;
  icon: JSX.Element;
  disabled?: boolean | string;
  // It may run with an empty box (amend keeps the last message).
  keepsMessage?: boolean;
}

/**
 * The message box and Commit button, in the Git panel. "Write" asks the fast
 * model for a message; an empty box commits with one written unseen. A draft
 * fades in with a line under it to write another or undo it (affectUI's
 * Email Draft); a commit that went through draws a check on the button for a
 * moment.
 */
export default function CommitBox(props: {
  // What would be committed, e.g. "Commit all 3 files"; empty: nothing.
  label: string;
  hint?: string;
  // Set by the owner while it commits, pushes, lands…
  busy: string | false;
  // The model's message; null: no fast model is set. Throws on failure.
  suggest: (fresh: boolean) => Promise<string | null>;
  // `action` absent: the plain commit. True when done, so the box clears.
  onCommit: (text: string, action?: string) => Promise<boolean>;
  actions: () => CommitAction[];
  // Its own errors (drafting, no message); the owner shows its own.
  error?: string;
  class?: string;
}) {
  let box: HTMLTextAreaElement | undefined;
  const [message, setMessage] = createSignal('');
  // The message is the model's draft and untouched.
  const [drafted, setDrafted] = createSignal(false);
  const [drafting, setDrafting] = createSignal(false);
  // A commit waits for its unseen message.
  const [writing, setWriting] = createSignal(false);
  // No fast model on the server: no drafts, no button.
  const [noModel, setNoModel] = createSignal(false);
  const [ownError, setOwnError] = createSignal('');
  // What the box held before the draft replaced it, for Undo.
  const [before, setBefore] = createSignal<string | null>(null);
  // Just committed: the button shows a drawn check for a moment.
  const [done, setDone] = createSignal(false);
  let doneTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(doneTimer));
  const autoMessage = () => !message().trim() && !noModel();
  const ready = () => !!props.label;
  const busy = () => props.busy || (writing() && 'write');
  const subject = () => message().split('\n')[0]!.trim();

  // Only on request: each draft is a model call, and an agent at work
  // changes files every second.
  let draftRun = 0;
  /** The model's message for what would be committed; null on failure. */
  const write = async (fresh: boolean) => {
    const id = ++draftRun;
    setDrafting(true);
    try {
      const text = await props.suggest(fresh);
      // A newer draft started, or a commit went ahead without this one.
      if (id !== draftRun) return null;
      if (text === null) {
        setNoModel(true);
        setOwnError('No fast model set: write the message yourself');
        return null;
      }
      setOwnError('');
      return text;
    } catch (e) {
      if (id === draftRun) setOwnError(errorText(e));
      return null;
    } finally {
      if (id === draftRun) setDrafting(false);
    }
  };

  const draft = async () => {
    const text = await write(drafted());
    if (text === null) return;
    if (!drafted()) setBefore(message());
    setMessage(text);
    setDrafted(true);
    if (box) arrive(box);
  };

  const undoDraft = () => {
    setMessage(before() ?? '');
    setBefore(null);
    setDrafted(false);
    box?.focus();
  };

  const commit = async (action?: CommitAction) => {
    // Loading buttons swallow clicks, but ⌘↵ submits the form itself.
    if (busy() || (!ready() && !action?.keepsMessage)) return;
    let text = message().trim();
    if (!text && !action?.keepsMessage) {
      if (noModel()) return setOwnError('Write a commit message first');
      setWriting(true);
      const written = await write(false);
      setWriting(false);
      if (written === null) return;
      text = written;
    }
    // Stop a draft in flight from landing in the cleared box.
    draftRun++;
    setDrafting(false);
    setOwnError('');
    if (await props.onCommit(text, action?.id)) {
      setMessage('');
      setDrafted(false);
      setBefore(null);
      setDone(true);
      clearTimeout(doneTimer);
      doneTimer = setTimeout(() => setDone(false), 1800);
    }
  };

  const label = () => {
    if (done() && !busy()) return 'Committed';
    if (busy() === 'write') return 'Writing message…';
    if (busy() === 'commit') return 'Committing…';
    if (busy() === 'push') return 'Pushing…';
    if (busy() === 'land') return 'Landing…';
    return props.label || 'Nothing to commit';
  };

  const menu = (): MenuEntry[] =>
    props.actions().map((a) => ({
      label: a.label,
      icon: a.icon,
      disabled: a.disabled,
      onSelect: () => void commit(a),
    }));

  return (
    <form
      class={['flex flex-col gap-2', props.class]}
      onSubmit={(e) => {
        e.preventDefault();
        void commit();
      }}
    >
      <div
        class={[
          'flex flex-col rounded-card border bg-surface transition-colors focus-within:border-line-strong',
          drafting() ? 'border-line-strong' : 'border-line',
        ]}
      >
        <TextArea
          ref={(el) => (box = el)}
          name="message"
          rows="3"
          aria-label="Commit message"
          class="max-h-60 min-h-[4.75rem] px-3 pt-2.5 pb-1"
          placeholder={
            drafting() && !message()
              ? 'Writing a message…'
              : noModel()
                ? 'Commit message (⌘↵)'
                : 'Commit message, or leave empty to have one written (⌘↵)'
          }
          value={message()}
          onInput={(e) => {
            setMessage(e.currentTarget.value);
            // Edited by hand: it's yours now, nothing to undo.
            setDrafted(false);
            setBefore(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div class="flex h-8 items-center gap-1 px-1.5 touch:h-11">
          <Show when={!noModel()}>
            <Button
              size="sm"
              class={drafted() && 'text-accent!'}
              title={
                drafted()
                  ? 'Write another message'
                  : 'Write a message from the changes'
              }
              loading={drafting()}
              disabled={!drafting() && (!!busy() || !ready())}
              onClick={() => void draft()}
            >
              <SparkleIcon />
              {drafting() ? 'Writing…' : drafted() ? 'Rewrite' : 'Write'}
            </Button>
            <Show when={drafted() && before() !== null && !drafting()}>
              <Button
                size="sm"
                class="appear"
                title="Put back what was in the box"
                onClick={undoDraft}
              >
                <DiscardIcon />
                Undo
              </Button>
            </Show>
          </Show>
          <Show when={drafted() && !drafting() && subject().length <= 50}>
            <span class="appear ml-auto truncate pr-1 text-meta text-muted max-sm:hidden">
              Drafted for review
            </span>
          </Show>
          <Show when={subject().length > 50}>
            <span
              class={[
                'ml-auto pr-1 text-meta tabular-nums',
                subject().length > SUBJECT_MAX ? 'text-warn' : 'text-muted',
              ]}
              title={`Summary line: keep it to ${SUBJECT_MAX} characters`}
            >
              {subject().length}/{SUBJECT_MAX}
            </span>
          </Show>
        </div>
      </div>
      <div class="flex h-8 touch:h-11">
        <Button
          variant="soft"
          class={[
            'min-w-0 flex-1 rounded-r-none',
            done() && !busy() && 'text-running',
          ]}
          type="submit"
          loading={!!busy()}
          disabled={!busy() && !done() && !ready()}
          title={[
            props.hint,
            autoMessage() && 'The message is written for you.',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Show when={done() && !busy()}>
            <span class="swap-in">
              <DrawnCheckIcon />
            </span>
          </Show>
          <Show
            when={
              autoMessage() &&
              !done() &&
              (busy() === 'write' || (!busy() && ready()))
            }
          >
            <SparkleIcon />
          </Show>
          <span class="truncate">{label()}</span>
        </Button>
        <IconButton
          variant="soft"
          class="rounded-l-none border-l border-bg"
          title="More commit actions"
          aria-haspopup="menu"
          // Nothing to commit and no message: amend would change nothing.
          disabled={!!busy() || (!ready() && !message().trim())}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openContextMenu(r.right - 200, r.bottom + 4, menu());
          }}
        >
          <Chevron open />
        </IconButton>
      </div>
      <Show when={ownError() || props.error}>
        <Alert class="font-mono">{ownError() || props.error}</Alert>
      </Show>
    </form>
  );
}
