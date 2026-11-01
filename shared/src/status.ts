// What a session's status means, for the server and every list in the app
// (docs/GLOSSARY.md: Status).
import type { SessionStatus } from './protocol';

/** Needs you, most urgent first: a question, an unread reply, a failure. */
export const NEEDS_YOU: readonly SessionStatus[] = ['waiting', 'done', 'error'];

export function needsYou(status: SessionStatus) {
  return NEEDS_YOU.includes(status);
}

/** A run in progress, or backing off after a provider error. */
export function isBusy(status: SessionStatus | undefined) {
  return status === 'running' || status === 'retrying';
}

/** Sorts what needs you first, in its order, then busy, then idle. */
export function urgency(status: SessionStatus) {
  const i = NEEDS_YOU.indexOf(status);
  if (i >= 0) return i;
  return isBusy(status) ? NEEDS_YOU.length : NEEDS_YOU.length + 1;
}
