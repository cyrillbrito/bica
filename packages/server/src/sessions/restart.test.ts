import { afterAll, test } from 'bun:test';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { connect, shows } from '../testing/bica';

const roots: string[] = [];
afterAll(() =>
  Promise.all(roots.map((r) => rm(r, { recursive: true, force: true }))),
);

async function scratch() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'bica-restart-')));
  roots.push(root);
  return root;
}

/** Bica in its own process, on the same data each time. */
async function launch(root: string, ...mode: string[]) {
  const child = Bun.spawn(
    ['bun', join(import.meta.dir, '../testing/serve.ts'), root, ...mode],
    { stdout: 'pipe', stderr: 'inherit' },
  );
  const reader = child.stdout.getReader();
  let out = '';
  const printed = async (pattern: RegExp) => {
    while (!pattern.test(out)) {
      const { value, done } = await reader.read();
      if (done)
        throw new Error(`Bica exited before printing ${pattern}:\n${out}`);
      out += new TextDecoder().decode(value);
    }
  };
  await printed(/port \d+/);
  return {
    child,
    port: Number(out.match(/port (\d+)/)![1]),
    printed,
    working: () => printed(/working/),
    async crash() {
      child.kill('SIGKILL');
      await child.exited;
    },
    async stop() {
      child.kill();
      await child.exited;
    },
  };
}

async function startWork(port: number, root: string) {
  const cwd = join(root, 'project');
  await mkdir(cwd);
  const tab = await connect(port);
  const projectId = await tab.request('project.add', { path: cwd });
  const { id } = await tab.request('session.create', {
    projectId,
    prompt: 'Work through the crash',
    requestId: crypto.randomUUID(),
  });
  return { id, tab };
}

test('a run cut off by a crash finishes after Bica restarts', async () => {
  const root = await scratch();
  const first = await launch(root, 'hang');
  const { id } = await startWork(first.port, root);
  await first.working();
  await first.crash();

  const second = await launch(root, 'answer', 'Finished after the restart');
  try {
    const again = await connect(second.port);
    await again
      .watch('conversation', { id })
      .until((c) => shows(c, 'Finished after the restart'), 10_000);
  } finally {
    await second.stop();
  }
}, 20_000);

test('a parent hears of a session it started that finishes after a restart, with no tab open', async () => {
  const root = await scratch();
  const first = await launch(root, 'start-child');
  const { id, tab } = await startWork(first.port, root);
  await first.working();
  await tab
    .watch('sessions', {})
    .until((l) =>
      l.some(
        (s) => s.id === id && s.status !== 'running' && s.status !== 'retrying',
      ),
    );
  await first.crash();

  // No tab connects: the note has to reach the parent on its own.
  const second = await launch(root, 'answer', 'Child finished');
  try {
    await second.printed(/asked: \[Note from Bica/);
  } finally {
    await second.stop();
  }
}, 20_000);

test('a run that keeps crashing Bica pauses, and Retry runs it again', async () => {
  const root = await scratch();
  const first = await launch(root, 'hang');
  const { id } = await startWork(first.port, root);
  await first.working();
  await first.crash();
  // Each restart resumes the run, which crashes Bica again: five crashes in
  // all, Pi Durable's limit.
  for (let i = 0; i < 4; i++) {
    const again = await launch(root, 'hang');
    await again.working();
    await again.crash();
  }

  const last = await launch(root, 'answer', 'Finished after the retry');
  try {
    const tab = await connect(last.port);
    await tab
      .watch('sessions', {})
      .until(
        (l) => l.some((s) => s.id === id && s.stuck === 'crashed'),
        10_000,
      );
    await tab.request('session.retry', { id });
    await tab
      .watch('conversation', { id })
      .until((c) => shows(c, 'Finished after the retry'), 10_000);
  } finally {
    await last.stop();
  }
}, 60_000);
