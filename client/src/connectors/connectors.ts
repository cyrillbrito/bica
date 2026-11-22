import type { ApprovalItem } from '@bica/shared/requests';
import { request, useTopic } from '../socket/socket';

export function useConnectors() {
  return useTopic('connectors', () => ({}));
}

/** Saves the Composio key once Composio accepts it; null removes it. */
export function setKey(key: string | null) {
  return request('connector.key', { key });
}

export function searchToolkits(search: string) {
  return request('connector.toolkits', { search });
}

export function connect(toolkit: string) {
  return request('connector.connect', { toolkit });
}

export function disconnect(id: string) {
  return request('connector.disconnect', { id });
}

/**
 * Composio's tool slug as words: GMAIL_SEND_EMAIL → "Send email". The app's
 * name comes off the front when it matches, else the first word does.
 */
export function toolWords(item: Pick<ApprovalItem, 'tool' | 'app'>) {
  const tool = item.tool ?? '';
  const name = (item.app ?? '').toUpperCase();
  // "Google Calendar" is GOOGLECALENDAR_ in a slug, sometimes GOOGLE_CALENDAR_.
  const app = [
    name.replace(/[^A-Z0-9]+/g, ''),
    name.replace(/[^A-Z0-9]+/g, '_'),
  ].find((p) => p && tool.toUpperCase().startsWith(`${p}_`));
  const rest = app
    ? tool.slice(app.length + 1)
    : tool.includes('_')
      ? tool.slice(tool.indexOf('_') + 1)
      : tool;
  const words = rest.replace(/_+/g, ' ').trim().toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : tool;
}

const STATUS: Record<string, string> = {
  ACTIVE: 'Connected',
  INITIATED: 'Waiting for sign-in',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
  INACTIVE: 'Inactive',
  REVOKED: 'Revoked',
};

/** A connected app's status in plain words, and whether it needs a look. */
export function statusText(status: string) {
  const upper = status.toUpperCase();
  return {
    text:
      STATUS[upper] ??
      (status ? status[0]!.toUpperCase() + status.slice(1).toLowerCase() : ''),
    warn: upper !== 'ACTIVE' && upper !== 'INITIATED',
  };
}
