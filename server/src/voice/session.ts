import {
  LiveDoc,
  type ConversationId,
  type EntryId,
  type EntryRecord,
} from '@earendil-works/pi-durable';

import type { PromptImage } from '@bica/shared/protocol';
import {
  VOICE_ENTRY,
  withoutCallWords,
  type VoiceLine,
} from '@bica/shared/transcript';
import { context, getHarness } from '../harness';
import { VOICE_TITLE, retitle } from '../sessions/names';
import { submit } from '../sessions/prompts';
import { textOf } from '../sessions/read';
import {
  getConversation,
  sessionMeta,
  sessionWorkspace,
} from '../sessions/store';

/** The text an entry's last assistant or user message says. */
function entryText(entry: EntryRecord | undefined) {
  return textOf(entry?.model?.at(-1)?.content ?? '');
}

/**
 * What a voice call (server/src/voice/voice.ts) does with its session: hand it
 * work, follow its progress, and keep what was said in the transcript.
 */
export async function voiceSession(sessionId: string) {
  const conversation = await getConversation(sessionId);
  const id: ConversationId = conversation.id;
  const harness = await getHarness();
  let named = false;
  return {
    settings: async () => (await sessionMeta(id))?.voice,
    cwd: async () => (await sessionWorkspace(id)).cwd,
    busy: async () => !!(await harness.snapshot(LiveDoc, id, context))?.run,
    abort: () => conversation.abort(context),

    /** The last prompts and replies, newest last, at most `chars` long. */
    async recent(chars: number) {
      const page = await conversation.entries({}, 40, undefined, context);
      const lines: string[] = [];
      let length = 0;
      for (const entry of page.items) {
        const role = entry.model?.at(-1)?.role;
        if (role !== 'user' && role !== 'assistant') continue;
        const text = withoutCallWords(entryText(entry)).slice(0, 1500);
        if (!text) continue;
        lines.unshift(`${role === 'user' ? 'User' : 'Agent'}: ${text}`);
        if ((length += text.length) > chars) break;
      }
      return lines.join('\n\n');
    },

    /**
     * The text of each turn the agent writes: `final` for the reply that
     * ends a run, else a turn that called tools. Errors and aborts are left
     * out: their handoff says it stopped.
     */
    onStep(listener: (text: string, final: EntryId | undefined) => void) {
      // An entry can be committed again, e.g. when its thinking folds.
      const seen = new Set<EntryId>();
      return harness.subscribeCommits(({ changes }) => {
        for (const change of changes) {
          if (change.type !== 'entry' || change.value.conversationId !== id)
            continue;
          const message = change.value.model?.at(-1);
          if (message?.role !== 'assistant' || seen.has(change.value.id))
            continue;
          const { stopReason } = message;
          if (stopReason !== 'toolUse' && stopReason !== 'stop') continue;
          seen.add(change.value.id);
          const text = entryText(change.value);
          if (text)
            listener(text, stopReason === 'stop' ? change.value.id : undefined);
        }
      });
    },

    /**
     * Sends a handoff to the session and resolves with its reply. While a
     * run works, the handoff joins it, as Codex's voice does, so a
     * correction lands before the outdated work is done. A session started
     * for the call is named after what was first asked.
     */
    async ask(
      request: string,
      title = request,
      images: PromptImage[] = [],
    ): Promise<{ answer?: EntryId; text: string }> {
      if (!named) {
        named = true;
        void retitle(id, title, VOICE_TITLE);
      }
      const submission = await submit(
        sessionId,
        request,
        images,
        crypto.randomUUID(),
        'user',
        'steer',
      );
      const settled = await submission.wait(context);
      const answer = settled.answer;
      return answer
        ? {
            answer,
            text: entryText(
              await harness.commit((tx) => tx.entry(answer), context),
            ),
          }
        : { text: `It stopped without an answer (${settled.reason}).` };
    },

    /** What was said, in the transcript but outside the agent's context. */
    save(line: VoiceLine) {
      conversation
        .submit(
          { type: 'write', entry: { kind: VOICE_ENTRY, data: line } },
          context,
        )
        .catch((error) => console.error('[voice] transcript', error));
    },
  };
}
