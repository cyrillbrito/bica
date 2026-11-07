import type { ConversationId, Cursor } from '@earendil-works/pi-durable';

import type { Question } from '@bica/shared/transcript';
import { ASK } from '../tools/ask';
import { context, getHarness } from '../harness';
import { getConversation, listSessions, sessionMeta, summarize } from './store';

/**
 * How agents and notes name a session: the title first, which the user
 * knows, then the id, which the tools take.
 */
export function named(s: { id: string; title: string }) {
  return `"${s.title || 'Untitled'}" (session ${s.id})`;
}

/** A session's title, status, and last reply, as an agent reads it. */
export async function readSession(id: string) {
  const { id: conversationId } = await getConversation(id);
  const s = await summarize(conversationId);
  if (!s) throw new Error(`No session ${id}`);
  return { ...s, reply: await lastReply(conversationId) };
}

/**
 * A session's last `count` messages, prompts and replies, oldest first,
 * without tool calls; and the `ask` questions it waits on, if any.
 */
export async function recentMessages(id: string, count: number) {
  const conversation = await (
    await getHarness()
  ).conversation(Number(id) as ConversationId, context);
  const messages: { from: 'prompt' | 'reply'; text: string }[] = [];
  let questions: Question[] | undefined;
  let cursor: Cursor | undefined;
  // ponytail: looks back at most 1,000 entries.
  for (let pages = 0; pages < 10 && messages.length < count; pages++) {
    const page = await conversation?.entries({}, 100, cursor, context);
    for (const entry of page?.items ?? [])
      for (const m of (entry.model ?? []).toReversed()) {
        if (m.role === 'assistant')
          questions ??= m.content.flatMap((b) =>
            b.type === 'toolCall' && b.name === ASK
              ? ((b.arguments as { questions?: Question[] }).questions ?? [])
              : [],
          );
        if (m.role !== 'assistant' && m.role !== 'user') continue;
        const text = textOf(m.content);
        if (text && messages.length < count)
          messages.push({
            from: m.role === 'user' ? 'prompt' : 'reply',
            text,
          });
      }
    cursor = page?.next;
    if (!cursor) break;
  }
  return { messages: messages.toReversed(), questions: questions ?? [] };
}

/** Who sent a session's newest prompt: "user", "bica", or a session id. */
export async function lastSender(id: string) {
  return (await sessionMeta(Number(id) as ConversationId))?.lastFrom;
}

async function lastReply(id: ConversationId) {
  const conversation = await (await getHarness()).conversation(id, context);
  // Newest first.
  const page = await conversation?.entries({}, 50, undefined, context);
  for (const entry of page?.items ?? [])
    for (const m of (entry.model ?? []).toReversed())
      if (m.role === 'assistant') {
        const text = textOf(m.content);
        if (text) return text;
      }
  return '';
}

/** The text of a message's content, without images or tool calls. */
export function textOf(
  content: string | readonly { type: string; text?: string }[],
) {
  return (
    typeof content === 'string'
      ? content
      : content.flatMap((b) => (b.type === 'text' ? b.text : [])).join('\n')
  ).trim();
}

// Per session, and in total: intent, not the whole conversation.
const MAX_PROMPTS = 4;
const MAX_PROMPT_CHARS = 600;
const MAX_SESSIONS = 6;

/** What the user asked agents in this workspace since `since`, for commit messages. */
export async function recentPrompts(cwd: string, since: number) {
  const harness = await getHarness();
  const found = await Promise.all(
    (await listSessions())
      .filter((s) => s.cwd === cwd && !s.archivedAt)
      .slice(0, MAX_SESSIONS * 2)
      .map(async (s) => {
        const conversation = await harness.conversation(
          Number(s.id) as ConversationId,
          context,
        );
        // Newest first.
        const page = await conversation?.entries({}, 60, undefined, context);
        const prompts: string[] = [];
        for (const entry of page?.items ?? []) {
          for (const m of entry.model ?? []) {
            if (m.role !== 'user' || m.timestamp < since) continue;
            const text = textOf(m.content);
            if (text) prompts.push(text.slice(0, MAX_PROMPT_CHARS));
          }
          if (prompts.length >= MAX_PROMPTS) break;
        }
        return { title: s.title, prompts: prompts.reverse() };
      }),
  );
  return found.filter((s) => s.prompts.length).slice(0, MAX_SESSIONS);
}
