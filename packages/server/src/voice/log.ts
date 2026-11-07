import { appendFileSync, renameSync, statSync } from 'node:fs';

import { dataPath } from '../storage';

// Calls fail in ways nobody sees: a mic that sends silence, a sideband that
// closes. Every step of every call goes here, from the browser and the
// server, keyed by the call's trace id, so a bad call can be read after.
export const VOICE_LOG = dataPath('voice-log.jsonl');
// One old file is kept next to it.
const MAX_BYTES = 2 << 20;

let checked = 0;

export function voiceLog(
  trace: string,
  from: 'server' | 'browser',
  event: string,
  data?: Record<string, unknown>,
) {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    trace,
    from,
    event,
    ...data,
  });
  console.log('[voice]', line);
  try {
    if (Date.now() - checked > 60_000) {
      checked = Date.now();
      const size = statSync(VOICE_LOG, { throwIfNoEntry: false })?.size ?? 0;
      if (size > MAX_BYTES) renameSync(VOICE_LOG, `${VOICE_LOG}.1`);
    }
    appendFileSync(VOICE_LOG, `${line}\n`);
  } catch (error) {
    console.error('[voice] log', (error as Error).message);
  }
}
