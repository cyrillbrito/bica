import type { Schedule } from '@bica/shared/protocol';

import type { Mode } from './data';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function schedule(
  id: string,
  prompt: string,
  time: Schedule['time'],
  next: number | null,
  more: Partial<Schedule> = {},
): Schedule {
  const now = Date.now();
  return {
    id,
    prompt,
    time,
    session: null,
    start: null,
    lastRunAt: null,
    createdAt: now - 3 * DAY,
    next,
    ...more,
  };
}

/** The Schedules page's list for a test data mode, soonest first. */
export function fixtureSchedules(mode: Mode): Schedule[] {
  const now = Date.now();
  const demo = [
    schedule(
      'a1b2c3d4',
      'Remind the user to pay the electricity bill',
      { at: now + 2 * HOUR },
      now + 2 * HOUR,
      { session: 'demo-ada' },
    ),
    schedule(
      'e5f6a7b8',
      'Check my inbox and calendar, and tell me what needs me today',
      { cron: '0 8 * * 1-5' },
      now + 14 * HOUR,
      { session: 'demo-ada', start: {}, lastRunAt: now - 10 * HOUR },
    ),
    schedule(
      'c9d0e1f2',
      'Update the dependencies, run the tests, and fix what breaks',
      { cron: '0 2 * * 1' },
      now + 3 * DAY,
      { start: { projectId: 'bica', worktree: true } },
    ),
  ];
  const long =
    'Go through every open pull request across all of the repositories, read each review comment, reply where an answer is owed, push the fixes, and write a summary with links of what changed and what still waits on someone else, grouped by repository and by reviewer, without merging anything.';
  const worst = [
    schedule('late0001', long, { at: now - 5 * MIN }, now - 5 * MIN, {
      session: 'worst-bot',
    }),
    schedule('cron0002', 'x', { cron: '*/30 9-17 * * 1-5' }, now + MIN, {
      session: 'worst-bot',
      start: { folder: '/Users/aleksandra/Repos/a/very/deep/folder/path' },
    }),
    schedule(
      'cjk00003',
      '每天早上检查邮件并总结 📬',
      { cron: '15 7 * * *' },
      now + 9 * HOUR,
      { start: { projectId: 'cjk' } },
    ),
    schedule('gone0004', long, { cron: '0 0 1 * *' }, now + 20 * DAY, {
      session: 'no-such-session',
      start: {},
    }),
  ];
  if (mode === 'empty') return [];
  if (mode === 'one') return demo.slice(0, 1);
  if (mode === 'worst') return worst;
  if (mode === 'huge')
    return Array.from({ length: 200 }, (_, i) =>
      schedule(
        `huge${i}`,
        `Routine ${i + 1}`,
        { cron: `${i % 60} ${i % 24} * * *` },
        now + i * HOUR,
      ),
    );
  return demo;
}
