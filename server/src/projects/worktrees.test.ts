import { afterAll, beforeAll, expect, test } from 'bun:test';
import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { startBica, type Bica, type Tab } from '../testing/bica';

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

const DAY = 24 * 60 * 60_000;

async function newSession(tab: Tab, body: object, prompt = 'Fix the cart') {
  bica.reply(fauxAssistantMessage('On it'));
  const id = await tab.request('session.create', {
    prompt,
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
}, 20_000);

test('a worktree unused for a week goes on its own once all its commits are in main, and one with its own commits stays', async () => {
  const { cleanUpWorktrees } = await import('./cleanup');
  const tab = await bica.connect();
  const ref = await bica.project(tab, 'garden');
  await writeFile(join(ref.cwd, 'README.md'), 'A garden\n');
  await tab.request('git.commit', { ...ref, message: 'Start', all: true });

  const idle = await newSession(tab, { ...ref, worktree: true }, 'Water');
  const busy = await newSession(tab, { ...ref, worktree: true }, 'Plant');
  await writeFile(join(busy.cwd!, 'tomatoes.md'), 'Two rows\n');
  await tab.request('git.commit', {
    projectId: ref.projectId,
    cwd: busy.cwd!,
    message: 'Plant tomatoes',
    all: true,
  });

  await cleanUpWorktrees();
  expect(existsSync(idle.cwd!)).toBe(true);

  await cleanUpWorktrees(Date.now() + 8 * DAY);
  expect(existsSync(idle.cwd!)).toBe(false);
  expect(existsSync(busy.cwd!)).toBe(true);
  await tab
    .watch('sessions', {})
    .until((l) => !!l.find((s) => s.id === idle.id)?.archivedAt);
}, 20_000);
