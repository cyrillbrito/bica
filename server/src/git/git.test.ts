import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { shows, startBica, type Bica } from '../testing/bica';

// Each test runs a few dozen git processes and waits for the status poll to
// see files written outside Bica. That takes a second or two alone, and
// several times as long while the other test files run alongside.
setDefaultTimeout(15_000);

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

test("the agent's edits show as changes, and a commit records them", async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab);
  const status = tab.watch('git.status', ref);
  await status.until((s) => s?.unstaged.length === 0);

  bica.reply(
    fauxAssistantMessage(
      fauxToolCall('write', {
        path: 'notes.md',
        content: 'written by the agent\n',
        summary: 'Write notes',
      }),
      { stopReason: 'toolUse' },
    ),
    fauxAssistantMessage('Wrote the notes'),
  );
  await tab.request('session.create', {
    ...ref,
    prompt: 'Write notes.md',
    requestId: crypto.randomUUID(),
  });
  await status.until((s) => shows(s?.unstaged, 'notes.md'));
  const file = await tab.request('file.read', { ...ref, path: 'notes.md' });
  expect(shows(file, 'written by the agent')).toBe(true);

  await tab.request('git.commit', { ...ref, message: 'Add notes', all: true });
  const after = await status.until((s) => shows(s?.recent, 'Add notes'));
  expect([...after!.staged, ...after!.unstaged]).toEqual([]);
});

test("a diff's sides load by hash, and a file changed since is never kept under the old one", async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab, 'blobs');
  const status = tab.watch('git.status', ref);
  const file = join(ref.cwd, 'poem.txt');
  await writeFile(file, 'first line\n');
  await status.until((s) => shows(s?.unstaged, 'poem.txt'));
  await tab.request('git.commit', { ...ref, message: 'Add poem', all: true });
  await status.until((s) => shows(s?.recent, 'Add poem'));

  await writeFile(file, 'second line\n');
  const changed = await status.until((s) => !!s?.unstaged[0]?.blobs?.new);
  const blobs = changed!.unstaged[0]!.blobs!;
  const read = (hash: string, { disk = false, path = 'poem.txt' } = {}) => {
    const q = new URLSearchParams({
      project: ref.projectId,
      cwd: ref.cwd,
      path,
    });
    if (disk) q.set('disk', '');
    return fetch(`http://127.0.0.1:${bica.port}/blob/${hash}?${q.toString()}`);
  };
  const before = await read(blobs.old!);
  expect(await before.text()).toBe('first line\n');
  const after = await read(blobs.new!, { disk: true });
  expect(await after.text()).toBe('second line\n');
  expect(after.headers.get('Cache-Control')).toContain('immutable');

  // Edited before the browser asked: the new bytes, but not to keep.
  await writeFile(file, 'third line\n');
  const stale = await read(blobs.new!, { disk: true });
  expect(await stale.text()).toBe('third line\n');
  expect(stale.headers.get('Cache-Control')).toBe('no-store');

  // Only the side on disk falls back, and only to files in the workspace.
  expect((await read(blobs.new!)).status).toBe(404);
  const other = await read(blobs.new!, { disk: true, path: '../poem.txt' });
  expect(other.status).toBe(404);
});
