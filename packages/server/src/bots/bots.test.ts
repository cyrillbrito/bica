import { afterAll, beforeAll, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Context } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import { shows, startBica, type Bica, type Tab } from '../testing/bica';

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
  bica.reply(...Array.from({ length: 100 }, () => route));
});
afterAll(() => bica?.stop());

let script: Record<string, unknown[]> = {};

// A child session's task comes with its parent's label in front.
function task(context: Context) {
  const first = context.messages.find((m) => m.role === 'user')?.content;
  const text = typeof first === 'string' ? first : JSON.stringify(first ?? '');
  return text.replace(/^\[Message from [^\]]*\] /, '');
}

/**
 * One fake model for every session: `script` maps how the session's first
 * prompt starts to its answers, in order; then it answers "Noted".
 */
function route(context: Context) {
  const key = Object.keys(script).find((k) => task(context).startsWith(k));
  const next = key ? script[key]!.shift() : undefined;
  if (next === undefined) return fauxAssistantMessage('Noted');
  if (typeof next === 'function') return next(context);
  return typeof next === 'string'
    ? fauxAssistantMessage(next)
    : (next as ReturnType<typeof fauxAssistantMessage>);
}

function call(name: string, args: Record<string, unknown>) {
  return fauxAssistantMessage(fauxToolCall(name, { ...args, summary: name }), {
    stopReason: 'toolUse',
  });
}

async function newBot(tab: Tab, name: string) {
  const workspace = join(bica.root, `${name}-repos`);
  await mkdir(workspace, { recursive: true });
  const id = await tab.request('bot.create', {
    name,
    color: 'plum',
    workspace,
  });
  const bots = await tab
    .watch('bots', {})
    .until((l) => l.some((b) => b.id === id));
  return { ...bots.find((b) => b.id === id)!, workspace };
}

async function settled(tab: Tab, ...ids: string[]) {
  return tab
    .watch('sessions', {})
    .until((l) =>
      ids.every((id) =>
        l.some(
          (s) =>
            s.id === id && s.status !== 'running' && s.status !== 'retrying',
        ),
      ),
    );
}

test('a bot made in one tab shows in the others, and its session answers with its soul', async () => {
  const laptop = await bica.connect();
  const phone = await bica.connect();
  const seen = phone.watch('bots', {});
  const { id } = await newBot(laptop, 'Juniper');
  await seen.until((l) => l.some((b) => b.id === id && b.name === 'Juniper'));

  await laptop.request('bot.update', {
    id,
    files: { soul: { before: '', text: 'Speak like a lighthouse keeper.' } },
  });
  script = {
    'How do you talk': [
      (context: Context) =>
        fauxAssistantMessage(
          shows(context, 'Speak like a lighthouse keeper.')
            ? 'Soul loaded'
            : 'No soul',
        ),
    ],
  };
  const session = await laptop.request('bot.open', { id });
  await laptop.request('session.submit', {
    id: session,
    prompt: 'How do you talk?',
    requestId: crypto.randomUUID(),
  });
  await phone
    .watch('conversation', { id: session })
    .until((c) => shows(c, 'Soul loaded'));
  // Opening it again finds the same session.
  expect(await phone.request('bot.open', { id })).toBe(session);
});

test("a bot's new session keeps the model its last one ended on", async () => {
  // A second provider, so the picked model differs from the default.
  await bica.provider('other');
  const tab = await bica.connect();
  const bot = await newBot(tab, 'Kit');
  const first = await tab.request('bot.open', { id: bot.id });
  const agentOf = (id: string) =>
    tab
      .watch('conversation', { id })
      .until((c) => !!c?.docs['pi.agent']?.model);
  const before = (await agentOf(first))!.docs['pi.agent']!;
  const picked = { provider: 'other', modelId: 'faux-1' };
  expect(before.model).not.toEqual(picked);
  await tab.request('session.configure', {
    id: first,
    model: picked,
    thinkingLevel: 'off',
  });
  await tab.request('session.archive', { id: first, archived: true });

  const second = await tab.request('bot.open', { id: bot.id });
  expect(second).not.toBe(first);
  const after = (await agentOf(second))!.docs['pi.agent']!;
  expect(after.model).toEqual(picked);
});

test("a bot's file the bot changed since you opened it is not overwritten", async () => {
  const tab = await bica.connect();
  const bot = await newBot(tab, 'Wren');
  const opened = await tab.request('bot.files', { id: bot.id });
  expect(opened.user).toBe('');

  script = {
    'Remember I like tea': [
      call('write', {
        path: join(bot.homePath, 'USER.md'),
        content: 'Prefer tea over coffee.',
      }),
      'Saved',
    ],
  };
  const session = await tab.request('bot.open', { id: bot.id });
  await tab.request('session.submit', {
    id: session,
    prompt: 'Remember I like tea',
    requestId: crypto.randomUUID(),
  });
  await tab
    .watch('conversation', { id: session })
    .until((c) => shows(c, 'Saved'));

  const refusal = await tab
    .request('bot.update', {
      id: bot.id,
      files: { user: { before: opened.user, text: 'Prefer coffee.' } },
    })
    .then(
      () => 'saved',
      (error: Error) => error.message,
    );
  expect(refusal).toContain('Wren changed USER.md since you opened it');
  expect((await tab.request('bot.files', { id: bot.id })).user).toBe(
    'Prefer tea over coffee.',
  );
});

test('a session a bot starts outside any project runs in its workspace and lists under it', async () => {
  const tab = await bica.connect();
  const bot = await newBot(tab, 'Ada');
  script = {
    'Look around': [
      call('session_start', { prompt: 'Survey the repos' }),
      'Started',
    ],
  };
  const session = await tab.request('bot.open', { id: bot.id });
  await tab.request('session.submit', {
    id: session,
    prompt: 'Look around my repos',
    requestId: crypto.randomUUID(),
  });
  const list = await tab
    .watch('sessions', {})
    .until((l) => l.some((s) => s.parent === session));
  const child = list.find((s) => s.parent === session)!;
  expect(child.projectId).toBe(bot.id);
  expect(child.cwd).toBe(bot.workspace);
  expect(list.find((s) => s.id === session)!.bot).toBe(bot.id);
  const projects = await tab.watch('projects', {}).until(() => true);
  expect(projects.find((p) => p.id === bot.id)).toMatchObject({
    name: 'Ada',
    path: bot.workspace,
    bot: true,
  });
});

test('deleting a bot archives its session and workspace sessions, and the sessions it started in projects become yours', async () => {
  const tab = await bica.connect();
  const bot = await newBot(tab, 'Basil');
  const project = await bica.project(tab, 'basil-project');
  script = {
    'Split the work': [
      call('session_start', { prompt: 'Workspace job' }),
      call('session_start', {
        prompt: 'Project job',
        folder: project.cwd,
      }),
      'Both started',
    ],
  };
  const session = await tab.request('bot.open', { id: bot.id });
  await tab.request('session.submit', {
    id: session,
    prompt: 'Split the work',
    requestId: crypto.randomUUID(),
  });
  const before = await tab
    .watch('sessions', {})
    .until((l) => l.filter((s) => s.parent === session).length === 2);
  const inWorkspace = before.find(
    (s) => s.parent === session && s.projectId === bot.id,
  )!.id;
  const inProject = before.find(
    (s) => s.parent === session && s.projectId === project.projectId,
  )!.id;
  await settled(tab, session, inWorkspace, inProject);

  await tab.request('bot.delete', { id: bot.id });
  const after = await tab
    .watch('sessions', {})
    .until((l) => l.some((s) => s.id === inProject && s.parent === null));
  const byId = (id: string) => after.find((s) => s.id === id)!;
  expect(byId(session).archivedAt).not.toBeNull();
  expect(byId(inWorkspace).archivedAt).not.toBeNull();
  expect(byId(inProject).archivedAt).toBeNull();
  await tab.watch('bots', {}).until((l) => !l.some((b) => b.id === bot.id));
  expect(existsSync(bot.homePath)).toBe(true);
});
