import { afterAll, beforeAll, expect, test } from 'bun:test';
import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { startBica, type Bica, type Tab } from '../testing/bica';

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

async function newSession(tab: Tab, body: object) {
  bica.reply(fauxAssistantMessage('On it'));
  const id = await tab.request('session.create', {
    prompt: 'Fix the cart total',
    requestId: crypto.randomUUID(),
    ...body,
  } as never);
  const list = await tab
    .watch('sessions', {})
    .until((l) => l.some((s) => s.id === id && s.status !== 'running'));
  return list.find((s) => s.id === id)!;
}

test("a new worktree starts with the main folder's ignored files, and archiving its last session offers to remove it", async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab, 'shop');
  await writeFile(join(ref.cwd, '.gitignore'), '.env\nnode_modules/\n');
  await tab.request('git.commit', { ...ref, message: 'Ignore', all: true });
  await writeFile(join(ref.cwd, '.env'), 'TOKEN=secret\n');
  await mkdir(join(ref.cwd, 'node_modules/left-pad'), { recursive: true });
  await writeFile(join(ref.cwd, 'node_modules/left-pad/index.js'), 'pad\n');

  const first = await newSession(tab, { ...ref, worktree: true });
  const worktree = first.cwd!;
  expect(worktree).not.toBe(ref.cwd);
  expect(await readFile(join(worktree, '.env'), 'utf8')).toBe('TOKEN=secret\n');
  expect(
    await readFile(join(worktree, 'node_modules/left-pad/index.js'), 'utf8'),
  ).toBe('pad\n');

  const second = await newSession(tab, {
    projectId: ref.projectId,
    cwd: worktree,
  });
  expect(
    await tab.request('session.archive', { id: first.id, archived: true }),
  ).toBeNull();
  expect(
    await tab.request('session.archive', { id: second.id, archived: true }),
  ).toEqual({ projectId: ref.projectId, cwd: worktree });
});
