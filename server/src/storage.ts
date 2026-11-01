import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Bica's own state: the repo's `.data`, or `BICA_DATA_DIR` (the `bica` binary sets it). */
export const DATA_DIR =
  process.env.BICA_DATA_DIR || join(import.meta.dir, '../../.data');

/** The user's Bica folder, like Pi's `~/.pi/agent`: their own `AGENTS.md` and skills. */
export const BICA_HOME = join(homedir(), '.bica');

/** A path under `.data`, creating `.data` on first use. */
export function dataPath(...parts: string[]) {
  mkdirSync(DATA_DIR, { recursive: true });
  return join(DATA_DIR, ...parts);
}

/**
 * Stops a second server on the same `.data`. Pi Durable has no lock across
 * processes and keeps its next ID in memory, so two servers writing one
 * store corrupt it: it then fails at every start.
 */
export function claimDataDir() {
  const path = dataPath('server.pid');
  let pid = 0;
  try {
    pid = Number(readFileSync(path, 'utf8'));
  } catch {}
  if (pid && pid !== process.pid && alive(pid))
    throw new Error(
      `Another Bica server (pid ${pid}) uses ${DATA_DIR}. Stop it, or set BICA_DATA_DIR to another folder.`,
    );
  writeFileSync(path, String(process.pid));
}

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // Another user's process.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export interface DataFile<T> {
  /** The saved value, or the initial one when there is no file. Don't mutate it. */
  read(): T;
  /** Changes a copy of the value, then saves it; changes run one at a time. */
  update(change: (draft: T) => void | Promise<void>): Promise<T>;
  write(value: T): Promise<void>;
}

interface Options<T> {
  initial: () => T;
  // Only this process may read it: keys and sign-ins.
  secret?: boolean;
  // Read from disk every time, so a hand edit applies without a restart.
  reread?: boolean;
}

/** A JSON file in `.data`. */
export function jsonFile<T>(name: string, options: Options<T>) {
  return dataFile<T>(
    name,
    options,
    JSON.parse,
    (v) => `${JSON.stringify(v, null, 2)}\n`,
  );
}

/** A one-line text file in `.data`. */
export function textFile(name: string, options: Partial<Options<string>> = {}) {
  return dataFile(
    name,
    { initial: () => '', ...options },
    (text) => text.trim(),
    (v) => v,
  );
}

function dataFile<T>(
  name: string,
  { initial, secret, reread }: Options<T>,
  parse: (text: string) => T,
  format: (value: T) => string,
): DataFile<T> {
  const path = dataPath(name);
  let cached: { value: T } | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  function read(): T {
    if (cached && !reread) return cached.value;
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return (cached = { value: initial() }).value;
    }
    try {
      return (cached = { value: parse(text) }).value;
    } catch (error) {
      // Thrown, not replaced by the initial value: the next save would
      // overwrite what is left of it.
      throw new Error(
        `${path} can't be read, fix or remove it: ${(error as Error).message}`,
      );
    }
  }

  // Through a temporary file, so a crash mid-write leaves the old file whole.
  async function save(value: T) {
    const tmp = `${path}.tmp`;
    mkdirSync(dirname(path), { recursive: true });
    await writeFile(tmp, format(value), { mode: secret ? 0o600 : 0o644 });
    await rename(tmp, path);
    cached = { value };
  }

  function enqueue<R>(task: () => Promise<R>) {
    const next = queue.then(task);
    queue = next.catch(() => {});
    return next;
  }

  return {
    read,
    update: (change) =>
      enqueue(async () => {
        const draft = structuredClone(read());
        await change(draft);
        await save(draft);
        return draft;
      }),
    write: (value) => enqueue(() => save(value)),
  };
}
