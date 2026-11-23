import { afterAll, beforeAll, expect, test } from 'bun:test';
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

function lastPrompt(context: Context) {
  const last = context.messages.findLast((m) => m.role === 'user')?.content;
  return typeof last === 'string' ? last : JSON.stringify(last ?? '');
}

let script: Record<string, unknown[]> = {};

/** Answers by the newest prompt: the first key it contains picks the answers. */
function route(context: Context) {
  if (context.messages.at(-1)?.role === 'toolResult')
    return fauxAssistantMessage('Done');
  const key = Object.keys(script).find((k) => lastPrompt(context).includes(k));
  const next = key ? script[key]!.shift() : undefined;
  if (next === undefined) return fauxAssistantMessage('Noted');
  return typeof next === 'string'
    ? fauxAssistantMessage(next)
    : (next as ReturnType<typeof fauxAssistantMessage>);
}

function scheduleCall(args: Record<string, unknown>) {
  return fauxAssistantMessage(
    fauxToolCall('schedule', { action: 'create', in_minutes: 0.02, ...args }),
    { stopReason: 'toolUse' },
  );
}

async function start(tab: Tab, prompt: string) {
  const { projectId } = await bica.project(tab, prompt.split(' ')[0]);
  const { id } = await tab.request('session.create', {
    projectId,
    prompt,
    requestId: crypto.randomUUID(),
  });
  return id;
}

test('a reminder a session sets comes back to it when due, and is gone once it fired', async () => {
  const tab = await bica.connect();
  script = {
    'Reminders please': [scheduleCall({ prompt: 'Remind them: pay rent' })],
    'pay rent': ['Time to pay your rent'],
  };
  const id = await start(tab, 'Reminders please');
  const schedules = tab.watch('schedules', {});
  await schedules.until((l) => l.length === 1);
  await tab
    .watch('conversation', { id })
    .until((c) => shows(c, 'Time to pay your rent'));
  await schedules.until((l) => l.length === 0);
});

test('a scheduled run that finds nothing is archived quietly, and one with news reports to the session that set it', async () => {
  const tab = await bica.connect();
  // The runs' prompts name the parent, so their keys come first.
  script = {
    'Quiet check': ['Nothing new'],
    'Busy check': ['Two new emails from the bank'],
    'Watch my inbox': [
      scheduleCall({ prompt: 'Quiet check', new_session: true }),
      scheduleCall({ prompt: 'Busy check', new_session: true }),
    ],
  };
  const parent = await start(tab, 'Watch my inbox');
  const sessions = tab.watch('sessions', {});
  // The second schedule is set in a later turn, so send one.
  await sessions.until((l) =>
    l.some((s) => s.id === parent && s.status !== 'running'),
  );
  await tab.request('session.submit', {
    id: parent,
    prompt: 'Watch my inbox again',
    requestId: crypto.randomUUID(),
  });
  const parentChat = tab.watch('conversation', { id: parent });
  await parentChat.until((c) => shows(c, 'Two new emails from the bank'));
  // The busy run stays open with its report; the quiet one is archived.
  await sessions.until(
    (l) =>
      l.filter((s) => s.parent === parent && s.archivedAt).length === 1 &&
      l.filter((s) => s.parent === parent && !s.archivedAt).length === 1,
  );
  expect(shows(parentChat.value, 'Nothing new')).toBe(false);
});

test('a repeat from the composer is listed with its next time until deleted, and a past time is refused', async () => {
  const tab = await bica.connect();
  const { projectId, cwd } = await bica.project(tab, 'composer');
  const created = await tab.request('schedule.create', {
    prompt: 'Summarize yesterday',
    time: { cron: '0 8 * * 1-5' },
    projectId,
    cwd,
  });
  const schedules = tab.watch('schedules', {});
  const listed = await schedules.until((l) =>
    l.some((s) => s.id === created.id),
  );
  const next = new Date(listed.find((s) => s.id === created.id)!.next!);
  expect(next.getHours()).toBe(8);
  expect([0, 6]).not.toContain(next.getDay());

  await tab.request('schedule.delete', { id: created.id });
  await schedules.until((l) => !l.some((s) => s.id === created.id));

  const refused = await tab
    .request('schedule.create', {
      prompt: 'Too late',
      time: { at: Date.now() - 3_600_000 },
      projectId,
      cwd,
    })
    .then(
      () => 'saved',
      (error: Error) => error.message,
    );
  expect(refused).toContain('has passed');
});
