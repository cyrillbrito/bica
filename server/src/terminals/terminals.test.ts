import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import { startBica, type Bica } from '../testing/bica';

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

test('a terminal streams its output and takes input', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab);
  const id = await tab.request('terminal.create', {
    ...ref,
    command: 'printf "héllo 🌈\\n"; cat',
  });
  const screen = tab.watch('terminal', { id });
  await screen.until((t) => t?.output.includes('héllo 🌈'));
  await tab.request('terminal.input', { id, data: 'ping 🌈\n' });
  await screen.until((t) => t?.output.includes('ping 🌈'));
  await tab.request('terminal.remove', { id });
});

test('archiving a session closes the terminals it leads, and leaves the ones detached from it', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'archive-terminals');
  const start = (name: string) =>
    fauxAssistantMessage(
      fauxToolCall('terminal_start', {
        name,
        command: 'cat',
        wait: 0,
        summary: 'Start a server',
      }),
      { stopReason: 'toolUse' },
    );
  bica.reply(
    start('keep me'),
    start('close me'),
    fauxAssistantMessage('Both running'),
  );
  const id = await tab.request('session.create', {
    projectId,
    prompt: 'Start two servers',
    requestId: crypto.randomUUID(),
  });
  const terminals = tab.watch('terminals', {});
  const list = await terminals.until(
    (l) => l.filter((t) => t.parent === id).length === 2,
  );
  await tab
    .watch('sessions', {})
    .until((l) => l.some((s) => s.id === id && s.status === 'done'));

  await tab.request('terminal.detach', {
    id: list.find((t) => t.title === 'keep me')!.id,
  });
  await tab.request('session.archive', { id, archived: true });
  const left = await terminals.until(
    (l) => !l.some((t) => t.title === 'close me'),
  );
  expect(left.find((t) => t.title === 'keep me')?.status).toBe('running');
  for (const t of left) await tab.request('terminal.remove', { id: t.id });
});

test('a long terminal_read wait ends at its text, or when a message arrives', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab, 'long-wait');
  const read = (id: string, until?: string) =>
    fauxAssistantMessage(
      fauxToolCall('terminal_read', {
        id,
        wait: 600,
        ...(until && { until }),
        summary: 'Wait for the job',
      }),
      { stopReason: 'toolUse' },
    );
  const sessions = tab.watch('sessions', {});
  const done = (id: string) =>
    sessions.until((l) => l.some((s) => s.id === id && s.status === 'done'));

  const ready = await tab.request('terminal.create', {
    ...ref,
    command: 'sleep 1; echo READY; sleep 600',
  });
  bica.reply(read(ready, 'READY'), fauxAssistantMessage('It is ready'));
  const first = await tab.request('session.create', {
    projectId: ref.projectId,
    prompt: 'Wait until ready',
    requestId: crypto.randomUUID(),
  });
  await done(first);

  const stuck = await tab.request('terminal.create', {
    ...ref,
    command: 'sleep 600',
  });
  bica.reply(read(stuck), fauxAssistantMessage('Stopped waiting'));
  const second = await tab.request('session.create', {
    projectId: ref.projectId,
    prompt: 'Wait for the job',
    requestId: crypto.randomUUID(),
  });
  await sessions.until((l) =>
    l.some((s) => s.id === second && s.status === 'running'),
  );
  await Bun.sleep(300);
  await tab.request('session.submit', {
    id: second,
    prompt: 'Never mind',
    requestId: crypto.randomUUID(),
    whenBusy: 'steer',
  });
  await done(second);
  for (const id of [ready, stuck]) await tab.request('terminal.remove', { id });
});

test('stopping a terminal ends the processes its command started', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab);
  const id = await tab.request('terminal.create', {
    ...ref,
    command: 'sleep 60 & echo CHILD:$!; wait',
  });
  const screen = await tab
    .watch('terminal', { id })
    .until((t) => /CHILD:\d+/.test(t?.output ?? ''));
  const pid = Number(screen!.output.match(/CHILD:(\d+)/)![1]);
  await tab.request('terminal.stop', { id });
  const alive = () => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  for (let i = 0; i < 40 && alive(); i++) await Bun.sleep(25);
  expect(alive()).toBe(false);
  await tab.request('terminal.remove', { id });
});
