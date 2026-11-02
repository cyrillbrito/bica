import { homedir } from 'node:os';
import { join } from 'node:path';

import { scrubSecrets } from '@bica/shared/telemetry';

// Bica's own folder, when it runs from the repo: its name is the user's, and
// a worktree's name says what they work on. The binary has no such folder.
const ROOT = import.meta.dir.endsWith(join('server', 'src', 'telemetry'))
  ? join(import.meta.dir, '../../..')
  : undefined;

/** Text from an error, safe to send: no home folder, hosts, emails, or keys, and at most `max` long. */
export function scrub(text: string, max = 2000) {
  const home = homedir();
  let out = ROOT ? text.split(ROOT).join('bica') : text;
  if (home.length > 1) out = out.split(home).join('~');
  return scrubSecrets(out, max);
}

/** A copy of what was thrown with its message and stack scrubbed, and no cause. */
export function scrubError(thrown: unknown): Error {
  if (!(thrown instanceof Error)) {
    const error = new Error(scrub(String(thrown), 500));
    error.name = 'NonError';
    error.stack = `${error.name}: ${error.message}`;
    return error;
  }
  const error = new Error(scrub(thrown.message, 1000));
  error.name = thrown.name;
  error.stack = thrown.stack ? scrub(thrown.stack, 10_000) : undefined;
  return error;
}

/** Every string in a value scrubbed, such as an event's properties. */
export function scrubDeep<T>(value: T): T {
  if (typeof value === 'string') return scrub(value) as T;
  if (Array.isArray(value)) return value.map(scrubDeep) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, scrubDeep(v)]),
    ) as T;
  return value;
}
