import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import { shows, startBica, type Bica, type Tab } from '../testing/bica';

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

async function newSession(tab: Tab, prompt: string, requestId?: string) {
  const { projectId } = await bica.project(tab);
  const { id } = await tab.request(
    'session.create',
    { projectId, prompt, requestId: crypto.randomUUID() },
    requestId,
  );
  return id;
}

function statusOf(tab: Tab, id: string) {
  const sessions = tab.watch('sessions', {});
  return (status: string) =>
    sessions.until((list) =>
      list.some((s) => s.id === id && s.status === status),
    );
}

test('a prompt gets an answer, and the session ends done', async () => {
  const tab = await bica.connect();
  bica.reply(fauxAssistantMessage('Hello from the agent'));
  const id = await newSession(tab, 'Say hello');
  await tab
    .watch('conversation', { id })
    .until((c) => shows(c, 'Hello from the agent'));
  await statusOf(tab, id)('done');
});

test('a prompt sent while the agent works runs after the current answer', async () => {
  const tab = await bica.connect();
  // Two steps, so a prompt that joined the run early would show before the
  // first answer instead of after it.
  const first = bica.hold(
    fauxAssistantMessage(
      fauxToolCall('bash', { command: 'true', summary: 'Check' }),
      { stopReason: 'toolUse' },
    ),
  );
  bica.reply(
    fauxAssistantMessage('first answer'),
    fauxAssistantMessage('second answer'),
  );
  const id = await newSession(tab, 'first prompt');
  await first.started;
  await tab.request('session.submit', {
    id,
    prompt: 'second prompt',
    requestId: crypto.randomUUID(),
  });
  first.release();
  const conversation = await tab
    .watch('conversation', { id })
    .until((c) => shows(c, 'second answer'));
  const text = JSON.stringify(conversation);
  const order = [
    'first prompt',
    'first answer',
    'second prompt',
    'second answer',
  ];
  const at = order.map((s) => text.indexOf(s));
  expect(at).toEqual(at.toSorted((a, b) => a - b));
});

test('a running session counts its time from the prompt, not from its latest turn', async () => {
  const tab = await bica.connect();
  const first = bica.hold(
    fauxAssistantMessage(
      fauxToolCall('bash', { command: 'sleep 0.02', summary: 'Wait' }),
      { stopReason: 'toolUse' },
    ),
  );
  const second = bica.hold('done at last');
  const id = await newSession(tab, 'a long job');
  await first.started;
  const prompted = Date.now();
  first.release();
  await second.started;
  // A fresh watch reads the list as it is now, after the tool call.
  const list = await tab
    .watch('sessions', {})
    .until((l) => l.some((s) => s.id === id && s.status === 'running'));
  const since = list.find((s) => s.id === id)?.runningSince;
  expect(since).toBeLessThanOrEqual(prompted);
  second.release();
  await statusOf(tab, id)('done');
});

test('stop ends the run and hands queued prompts back', async () => {
  const tab = await bica.connect();
  const run = bica.hold();
  const id = await newSession(tab, 'long job');
  await run.started;
  await tab.request('session.submit', {
    id,
    prompt: 'queued for later',
    requestId: crypto.randomUUID(),
  });
  const returned = await tab.request('session.stop', { id });
  expect(returned.map((q) => q.prompt)).toEqual(['queued for later']);
  await tab
    .watch('sessions', {})
    .until((l) => l.some((s) => s.id === id && s.status !== 'running'));
  // The next prompt runs on its own: the dropped one never reaches the model.
  bica.reply(fauxAssistantMessage('fresh answer'));
  await tab.request('session.submit', {
    id,
    prompt: 'fresh start',
    requestId: crypto.randomUUID(),
  });
  const conversation = await tab
    .watch('conversation', { id })
    .until((c) => shows(c, 'fresh answer'));
  expect(shows(conversation, 'queued for later')).toBe(false);
});

test('a long session opens with all of it, and after a compaction with the summary', async () => {
  const tab = await bica.connect();
  // More steps than Pi Durable's view holds at once, with output enough
  // that a compaction summarizes the first ones.
  const steps = Array.from({ length: 40 }, (_, i) =>
    fauxAssistantMessage(
      fauxToolCall('bash', {
        command: 'yes output | head -c 4000',
        summary: `Step ${i}`,
      }),
      { stopReason: 'toolUse' },
    ),
  );
  bica.reply(...steps, fauxAssistantMessage('done with every step'));
  const id = await newSession(tab, 'the very first prompt');
  await statusOf(tab, id)('done');

  const opened = await (
    await bica.connect()
  )
    .watch('conversation', { id })
    .until((c) => shows(c, 'done with every step'));
  expect(shows(opened, 'the very first prompt')).toBe(true);

  bica.reply(fauxAssistantMessage('<summary>what the steps did</summary>'));
  await tab.request('session.compact', { id });
  const compacted = await (
    await bica.connect()
  )
    .watch('conversation', { id })
    .until((c) => shows(c, 'what the steps did'));
  expect(shows(compacted, 'the very first prompt')).toBe(false);
  expect(shows(compacted, 'done with every step')).toBe(true);
});

test('a phone that reconnects and resends its request gets one session with everything in it', async () => {
  const phone = await bica.connect();
  bica.reply(fauxAssistantMessage('answer for the phone'));
  const requestId = crypto.randomUUID();
  const id = await newSession(phone, 'from the phone', requestId);
  // The reply was lost: the new socket sends the same request again.
  const again = await bica.connect();
  expect(await newSession(again, 'from the phone', requestId)).toBe(id);
  await again
    .watch('conversation', { id })
    .until((c) => shows(c, 'answer for the phone'));
  const list = await again.watch('sessions', {}).until(() => true);
  expect(list.filter((s) => shows(s, 'from the phone'))).toHaveLength(1);
});

test('the model reads each image where the prompt names it, with its file', async () => {
  const tab = await bica.connect();
  let seen: unknown;
  bica.reply((context) => {
    seen = context.messages.findLast((m) => m.role === 'user')?.content;
    return fauxAssistantMessage('seen them');
  });
  const { projectId } = await bica.project(tab);
  const image = (data: string, ref?: number) => ({
    mimeType: 'image/png',
    data,
    ...(ref && { ref }),
  });
  const { id } = await tab.request('session.create', {
    projectId,
    prompt: 'Compare [Image #1] with [Image #2] please',
    images: [image('second', 2), image('first', 1), image('unnamed')],
    requestId: crypto.randomUUID(),
  });
  const conversation = await tab
    .watch('conversation', { id })
    .until((c) => shows(c, 'seen them'));
  const blocks = seen as { type: string; text?: string; data?: string }[];
  const files = blocks.flatMap(
    (b) =>
      /^\n\[The image above as a file, for tools: (.+)\]\n$/.exec(
        b.text ?? '',
      )?.[1] ?? [],
  );
  expect(
    blocks.map((b) => b.text ?? b.data).filter((t) => t![0] !== '\n'),
  ).toEqual([
    'Compare [Image #1]',
    'first',
    ' with [Image #2]',
    'second',
    ' please',
    'unnamed',
  ]);
  // The agent's tools can open each file: the image's own bytes.
  expect(files).toHaveLength(3);
  const first = await Bun.file(files[0]!).bytes();
  expect(Buffer.from(first).toString('base64')).toBe(
    Buffer.from('first', 'base64').toString('base64'),
  );

  // The browser gets the file's name, not the bytes, and loads it by URL.
  const user = JSON.stringify(
    conversation!.entries.find((e) => e.model?.[0]?.role === 'user'),
  );
  expect(user).not.toContain('"data":"first"');
  expect(user).toContain(files[0]!.split('/').pop()!);
  const res = await fetch(
    `http://127.0.0.1:${bica.port}/attachment/${files[0]!.split('/').pop()}`,
  );
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(first);
  expect(res.headers.get('Cache-Control')).toContain('immutable');
  expect(
    (await fetch(`http://127.0.0.1:${bica.port}/attachment/..%2Fsecret`))
      .status,
  ).toBe(404);
});

test("Prune takes old prompts' images out of what the model reads, and keeps their files", async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab);
  const conversation = (id: string) => tab.watch('conversation', { id });
  bica.reply(fauxAssistantMessage('answer 0'));
  const { id } = await tab.request('session.create', {
    projectId,
    prompt: 'Look at [Image #1]',
    images: [{ mimeType: 'image/png', data: 'old', ref: 1 }],
    requestId: crypto.randomUUID(),
  });
  await conversation(id).until((c) => shows(c, 'answer 0'));
  for (const n of [1, 2, 3]) {
    bica.reply(fauxAssistantMessage(`answer ${n}`));
    await tab.request('session.submit', {
      id,
      prompt: `prompt ${n}`,
      requestId: crypto.randomUUID(),
    });
    await conversation(id).until((c) => shows(c, `answer ${n}`));
  }

  await tab.request('session.cleanup', { id });
  let seen: unknown;
  bica.reply((context) => {
    seen = context.messages.find((m) => m.role === 'user')?.content;
    return fauxAssistantMessage('after prune');
  });
  await tab.request('session.submit', {
    id,
    prompt: 'one more',
    requestId: crypto.randomUUID(),
  });
  await conversation(id).until((c) => shows(c, 'after prune'));
  const first = JSON.stringify(seen);
  expect(first).toContain('Look at [Image #1]');
  expect(first).not.toContain('"type":"image"');
  expect(first).toContain('[The image above as a file, for tools: ');
});

test('a session on a provider you signed out of moves to the same model through another', async () => {
  // A second provider of the same model, signed in with a key.
  const other = await bica.provider('other');
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab);
  other.reply(fauxAssistantMessage('from the other provider'));
  const { id } = await tab.request('session.create', {
    projectId,
    prompt: 'first',
    requestId: crypto.randomUUID(),
    choice: {
      model: { provider: 'other', modelId: 'faux-1' },
      thinkingLevel: 'off',
    },
  });
  const conversation = tab.watch('conversation', { id });
  await conversation.until((c) => shows(c, 'from the other provider'));

  await tab.request('account.signOut', { id: 'other' });
  bica.reply(fauxAssistantMessage('after the sign-out'));
  await tab.request('session.submit', {
    id,
    prompt: 'second',
    requestId: crypto.randomUUID(),
  });
  await conversation.until((c) => shows(c, 'after the sign-out'));
});
