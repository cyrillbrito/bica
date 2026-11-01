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
    // No echo: each keystroke shows once, as cat prints it.
    command: 'stty -echo; printf "héllo 🌈\\n"; cat',
  });
  const screen = tab.watch('terminal', { id });
  // Not the command line's own echo, typed ahead before the shell was ready.
  await screen.until((t) => t?.output.includes('héllo 🌈\r\n'));
  // Sent again after a lost reply, it types once.
  const resent = crypto.randomUUID();
  await tab.request('terminal.input', { id, data: 'ping 🌈\n' }, resent);
  await tab.request('terminal.input', { id, data: 'ping 🌈\n' }, resent);
  await tab.request('terminal.input', { id, data: 'end\n' });
  const after = await screen.until((t) => t?.output.includes('end'));
  expect(after!.output.split('ping 🌈').length - 1).toBe(1);
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
  const { id } = await tab.request('session.create', {
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

test('a long terminal_read wait ends at its text, when a message arrives, or when another session interrupts the command', async () => {
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
  // The transcript shows the read as running once it waits.
  const reading = (id: string) =>
    tab
      .watch('conversation', { id })
      .until((c) =>
        (
          c?.docs['pi.live'] as { tools?: { name: string; status: string }[] }
        )?.tools?.some(
          (t) => t.name === 'terminal_read' && t.status === 'running',
        ),
      );

  const ready = await tab.request('terminal.create', {
    ...ref,
    command: 'sleep 1; echo READY; sleep 600',
  });
  bica.reply(read(ready, 'READY'), fauxAssistantMessage('It is ready'));
  const { id: first } = await tab.request('session.create', {
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
  const { id: second } = await tab.request('session.create', {
    projectId: ref.projectId,
    prompt: 'Wait for the job',
    requestId: crypto.randomUUID(),
  });
  await reading(second);
  await tab.request('session.submit', {
    id: second,
    prompt: 'Never mind',
    requestId: crypto.randomUUID(),
    whenBusy: 'steer',
  });
  await done(second);

  // Send now on a queued prompt steers too.
  bica.reply(read(stuck), fauxAssistantMessage('Stopped waiting'));
  const { id: queuer } = await tab.request('session.create', {
    projectId: ref.projectId,
    prompt: 'Wait for the job',
    requestId: crypto.randomUUID(),
  });
  await reading(queuer);
  await tab.request('session.submit', {
    id: queuer,
    prompt: 'Never mind',
    requestId: crypto.randomUUID(),
    whenBusy: 'followUp',
  });
  const view = await tab
    .watch('conversation', { id: queuer })
    .until(
      (c) =>
        (c?.docs['pi.inbox'] as { items?: unknown[] } | undefined)?.items
          ?.length,
    );
  const [item] = (view!.docs['pi.inbox'] as { items: { id: unknown }[] }).items;
  await tab.request('session.push', {
    id: queuer,
    submission: Number(item!.id),
  });
  await done(queuer);

  // So does a voice call's handoff.
  bica.reply(read(stuck), fauxAssistantMessage('Stopped waiting'));
  const { id: caller } = await tab.request('session.create', {
    projectId: ref.projectId,
    prompt: 'Wait for the job',
    requestId: crypto.randomUUID(),
  });
  await reading(caller);
  const { voiceSession } = await import('../voice/session');
  const call = await voiceSession(caller);
  expect((await call.ask('Never mind')).text).toBe('Stopped waiting');

  const stopped = await tab.request('terminal.create', {
    ...ref,
    command: 'sleep 600',
  });
  bica.reply(read(stopped));
  const { id: waiting } = await tab.request('session.create', {
    projectId: ref.projectId,
    prompt: 'Wait for the job',
    requestId: crypto.randomUUID(),
  });
  await reading(waiting);
  bica.reply(
    fauxAssistantMessage(
      fauxToolCall('terminal_send', {
        id: stopped,
        input: '',
        interrupt: true,
        wait: 0,
        summary: 'Stop the job',
      }),
      { stopReason: 'toolUse' },
    ),
    // One answer each, whichever session asks first.
    fauxAssistantMessage('Done'),
    fauxAssistantMessage('Done'),
  );
  const { id: stopper } = await tab.request('session.create', {
    projectId: ref.projectId,
    prompt: 'Stop the job',
    requestId: crypto.randomUUID(),
  });
  await done(stopper);
  await done(waiting);
  for (const id of [ready, stuck, stopped])
    await tab.request('terminal.remove', { id });
});

test('stopping a terminal lets its command clean up, then ends every process it started', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab);
  const cleaned = `${ref.cwd}/cleaned`;
  for (const command of [
    'sleep 60 & echo CHILD:$!; wait',
    // Ignores the hangup a closed terminal sends.
    "( trap '' HUP; exec sleep 60 ) & echo CHILD:$!; wait",
    // Cleans up on SIGTERM, as servers do.
    `sh -c 'trap "echo bye > ${cleaned}; exit" TERM; echo CHILD:$$; while :; do sleep 0.1; done'`,
  ]) {
    const id = await tab.request('terminal.create', { ...ref, command });
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
    expect(alive(), command).toBe(false);
    await tab.request('terminal.remove', { id });
  }
  expect(await Bun.file(cleaned).text()).toBe('bye\n');
});
