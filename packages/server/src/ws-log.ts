import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BICA_HOME } from './storage';

// Creating the file turns the log on and deleting it turns it off, so it
// works on a running server without a restart.
export const WS_LOG = join(BICA_HOME, 'ws-log.jsonl');

let on = false;
let checked = 0;
let connections = 0;

export function wsLogger() {
  const c = ++connections;
  return (dir: 'in' | 'out', text: string) => {
    const now = Date.now();
    if (now - checked > 1000) {
      checked = now;
      on = existsSync(WS_LOG);
    }
    if (!on) return;
    const line = `{"t":${now},"c":${c},"dir":"${dir}","bytes":${Buffer.byteLength(text)},"msg":${text}}\n`;
    try {
      appendFileSync(WS_LOG, line);
    } catch {
      on = false;
    }
  };
}
