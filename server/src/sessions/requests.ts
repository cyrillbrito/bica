import type { JsonValue } from '@earendil-works/chord/json';
import { LiveDoc } from '@earendil-works/pi-durable';
import type { ToolResultMessage } from '@earendil-works/pi-ai';

import {
  AnswerEntry,
  requestOf,
  type RequestDetails,
} from '@bica/shared/requests';
import { openRequests } from '@bica/shared/transcript';
import { context, getHarness } from '../harness';
import { submit } from './prompts';
import { getConversation } from './store';

/*
 * Answers to requests given on their cards (docs/requests.md). The run
 * ended when the request was made, so an answer is a prompt: the feature
 * that made the request turns the choice into what the model reads, such as
 * an approved call's result, and the transcript folds it into the card.
 * Questions take typed prompts instead, so they never come here.
 */

type Answered = { text: string; label: string };
type Handler = (answer: {
  request: RequestDetails;
  // The whole tool result's details, with what the feature kept for later.
  details: JsonValue;
  value: string;
}) => Promise<Answered>;

const handlers = new Map<RequestDetails['kind'], Handler>();

/** Who turns an answer to requests of `kind` into the prompt. */
export function onAnswer(kind: RequestDetails['kind'], handler: Handler) {
  handlers.set(kind, handler);
}

// A second click or tab would run an approved call twice.
const answering = new Set<string>();

export async function answerRequest(
  session: string,
  call: string,
  value: string,
) {
  const key = `${session}:${call}`;
  if (answering.has(key)) throw new Error('That is being answered already');
  answering.add(key);
  try {
    const result = await openResult(session, call);
    const request = requestOf(result);
    if (!request || request === 'question')
      throw new Error('Answer questions with a prompt');
    const handler = handlers.get(request.kind);
    if (!handler) throw new Error(`Nothing answers ${request.kind} requests`);
    const { text, label } = await handler({
      request,
      details: (result.details ?? null) as JsonValue,
      value,
    });
    await submit(session, text, [], crypto.randomUUID(), 'user', 'followUp', {
      kind: AnswerEntry.kind,
      data: { call, value, label },
    });
  } finally {
    answering.delete(key);
  }
}

/** The tool result of a request the session still waits on. */
async function openResult(session: string, call: string) {
  const conversation = await getConversation(session);
  const [live, page] = await Promise.all([
    (await getHarness()).snapshot(LiveDoc, conversation.id, context),
    // Newest first; an open request is among the last entries.
    conversation.entries({}, 50, undefined, context),
  ]);
  const entries = page.items.toReversed();
  if (!openRequests(live, entries).has(call))
    throw new Error('That is no longer open');
  for (const entry of entries)
    for (const m of entry.model ?? [])
      if (m.role === 'toolResult' && m.toolCallId === call)
        return m as ToolResultMessage;
  throw new Error('That is no longer open');
}
