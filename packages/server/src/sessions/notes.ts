import type { Sent } from '@bica/shared/transcript';
import { context, getHarness } from '../harness';
import { queued, submit, type QueuedInput } from './prompts';
import { getConversation, sessionMeta } from './store';

// Notes' request ids start with it, so a queued note can be found and merged.
const NOTE_REQUEST = 'note:';

/**
 * A note from Bica to a session about other work, sent as a steer: it lands
 * at the current run's next step, so an agent polling a terminal hears it
 * finished, and it wakes an idle session. Notes that pile up before they land
 * merge into one. An archived or deleted session gets nothing.
 */
export async function tell(id: string, text: string) {
  try {
    const conversation = await getConversation(id);
    const meta = await sessionMeta(conversation.id);
    if (!meta || meta.archivedAt) return;
    let note = text;
    const harness = await getHarness();
    let waiting: QueuedInput | undefined;
    for (const item of (await queued(conversation.id)).toReversed()) {
      const submission = await harness.submission(item.id, context);
      const record = await submission?.status(context);
      if (record?.requestId?.startsWith(NOTE_REQUEST)) {
        waiting = item;
        break;
      }
    }
    // Not aborted: it was just sent, so this note goes on its own.
    if (
      waiting &&
      (await harness.abortSubmission(waiting.id, context, conversation.id)) ===
        'aborted'
    )
      note = `${(waiting.entry?.data as Sent | undefined)?.text}\n\n---\n\n${note}`;
    await submit(
      id,
      note,
      [],
      `${NOTE_REQUEST}${Date.now()}:${Math.random()}`,
      'bica',
      'steer',
    );
  } catch (error) {
    console.error('[note]', error);
  }
}
