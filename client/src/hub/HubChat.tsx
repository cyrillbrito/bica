import { For, Show, createEffect, createMemo } from 'solid-js';

import { pageFocused } from '../ui/focus';
import {
  markSeen,
  sendPrompt,
  stopSession,
  useConversation,
  useSessions,
} from '../sessions/sessions';
import { SessionId } from '../sessions/step-detail';
import { createStickToBottom } from '../ui/stick-to-bottom';
import { hideThinking } from '../sessions/thinking';
import { toMessages } from '@bica/shared/transcript';
import { isBusy } from '@bica/shared/status';
import { call, startCall } from '../voice/voice';
import CallBar from '../voice/CallBar';
import Composer, { type ComposerApi } from '../sessions/Composer';
import MessageRow from '../sessions/MessageRow';
import Queue from '../sessions/Queue';

/**
 * The hub's conversation: the transcript, then a composer with a voice call
 * button. No fork, compaction, model, or agent controls: the hub is one
 * session that keeps its own memory, with its model set in Settings.
 */
export default function HubChat(props: { id: string }) {
  const view = useConversation(() => props.id);
  const sessions = useSessions();
  const status = createMemo(
    () => sessions().find((s) => s.id === props.id)?.status,
    { name: 'hubStatus' },
  );
  const busy = () => isBusy(status());
  const messages = createMemo(
    () => {
      const v = view();
      return v ? toMessages(v, undefined, { thinking: !hideThinking() }) : [];
    },
    { name: 'hubMessages' },
  );
  // Open and focused is read.
  createEffect(
    () => pageFocused() && status() === 'done',
    (read) => {
      if (read) void markSeen(props.id);
    },
    { name: 'hubSeen' },
  );
  const stick = createStickToBottom();
  let composer: ComposerApi | undefined;

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <div
        ref={stick.scroller}
        class="flex-1 overflow-y-auto overscroll-contain border-t border-line [scrollbar-gutter:stable_both-edges]"
      >
        <div ref={stick.content} class="chat-column flex flex-col gap-5 py-6">
          <SessionId value={() => props.id}>
            <For
              each={messages()}
              keyed={(m) => m.key}
              fallback={
                <div class="text-center text-muted">
                  Tell the hub what you're working on.
                </div>
              }
            >
              {(m) => (
                <MessageRow
                  message={m()}
                  onAnswer={(text) => {
                    stick.follow();
                    return sendPrompt(props.id, text, []);
                  }}
                />
              )}
            </For>
          </SessionId>
        </div>
      </div>
      <div class="chat-column pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
        <CallBar id={props.id} busy={busy()} />
        {/* Hidden, not removed, during a call: a draft survives it. */}
        <div hidden={call()?.sessionId === props.id}>
          <Composer
            draft={props.id}
            placeholder="Tell the hub…"
            onSend={(prompt, images, steer) => {
              stick.follow();
              return sendPrompt(props.id, prompt, images, { steer });
            }}
            busy={busy()}
            // The stop drops queued prompts; give them back to edit.
            onStop={() =>
              stopSession(props.id).then((dropped) => {
                for (const p of dropped) composer?.restore(p.prompt, p.images);
              })
            }
            ref={(api) => (composer = api)}
            top={
              <Show when={view()}>
                {(v) => (
                  <Queue id={props.id} view={v()} composer={() => composer} />
                )}
              </Show>
            }
            onCall={() => void startCall(props.id)}
          />
        </div>
      </div>
    </div>
  );
}
