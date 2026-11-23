import type { Message } from '@earendil-works/pi-ai';

import { entryKind } from './pi-types';

/*
 * Requests: what a session waits on you for, shown as a card in the
 * transcript (docs/requests.md). The tool that makes one ends the run, so
 * nothing holds it in memory: it survives a refresh and a restart. A
 * question's card reads the `ask` call's arguments, the others read
 * `request` in the tool result's details. The answer comes back as the
 * next prompt.
 */

/** One call to a connected app on an approval card. */
export interface ApprovalItem {
  // Composio's tool slug: GMAIL_SEND_EMAIL; null when its text couldn't be read.
  tool: string | null;
  app: string | null;
  logo: string | null;
  // The account it runs on, such as a Gmail address, when the app has
  // several; cards from before multi-account mode don't have it.
  account?: string | null;
  args: Record<string, unknown> | null;
  // Composio's own description of the call, shown when `tool` is null.
  message: string;
  danger: boolean;
}

/**
 * Calls to connected apps waiting for your yes: Composio asked before tools
 * that create, update, or delete (docs/connectors.md).
 */
export interface ApprovalRequest {
  kind: 'approval';
  // An item deletes something: the card is red and has no Always approve.
  danger: boolean;
  items: ApprovalItem[];
  // The answers Composio offers, in its order: approve, always_approve, deny.
  choices: { value: string; label: string }[];
}

/** What a tool keeps in its result's details to wait on you. */
export type RequestDetails = ApprovalRequest;

/**
 * An answer given on a card rather than typed. The model reads the prompt's
 * text; the transcript folds this into the card it answers.
 */
export type Answer = { call: string; value: string; label: string };
export const AnswerEntry = entryKind<Answer>('bica.answer');

// Kept in step with server/src/tools/ask.ts, which the browser can't import.
export const ASK = 'ask';

/** What a tool result waits on you for: questions, another request, or nothing. */
export function requestOf(m: Message): 'question' | RequestDetails | undefined {
  if (m.role !== 'toolResult' || m.isError) return undefined;
  if (m.toolName === ASK) return 'question';
  const request = (m.details as { request?: RequestDetails } | undefined)
    ?.request;
  return request && typeof request === 'object' && 'kind' in request
    ? request
    : undefined;
}
