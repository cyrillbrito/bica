import {
  bool,
  lit,
  num,
  obj,
  opt,
  str,
  union,
} from '@earendil-works/pi-schema';
import { defineTool } from '@earendil-works/pi-durable';

import type { Schedule } from '@bica/shared/protocol';
import { momentWords, timeWords } from '@bica/shared/schedules';
import { createSchedule, deleteSchedule, listSchedules } from './schedules';

function text(value: string) {
  return { output: [{ type: 'text' as const, text: value }] };
}

function describe(s: Schedule, me: string) {
  const where = s.start
    ? 'starts a new session'
    : s.session === me
      ? 'comes back to this session'
      : `comes back to session ${s.session}`;
  const by =
    s.session === me
      ? 'set by you'
      : s.session
        ? `set by session ${s.session}`
        : 'set by the user';
  const next = s.next ? `next ${momentWords(s.next)}` : 'done';
  const prompt = s.prompt.replace(/\s+/g, ' ');
  return `${s.id}: ${timeWords(s.time)}, ${next}, ${where}, ${by}: "${prompt.length > 100 ? `${prompt.slice(0, 100)}…` : prompt}"`;
}

/** The time `at` names, as local time when it has no zone. */
function parseAt(at: string) {
  const ms = new Date(at.trim()).getTime();
  if (Number.isNaN(ms))
    throw new Error(`\`${at}\` isn't a date and time like 2026-05-08T09:00`);
  return ms;
}

export const scheduleTool = defineTool({
  name: 'schedule',
  description: `Save a prompt that fires later, once or on a repeat, in the dev machine's local time: a reminder, a check later, or a routine. Only when the user asks for one. By default it comes back to this session as a note, with this conversation's context, which suits reminders: "remind me Friday to pay X" is the prompt "Remind the user to pay X". With \`new_session\`, each run starts a new child session as session_start would: it works alone, reports to you, and is archived when it replies "Nothing new". That suits repeated work like a morning inbox check, and its prompt must stand alone. \`list\` shows the current time and every schedule; \`delete\` removes one by id. When the user gives no time of day, pick a sensible one and say it.`,
  parameters: obj(
    {
      action: union([lit('create'), lit('list'), lit('delete')]),
      prompt: opt(
        str({ description: 'create: what to do or say when it fires' }),
      ),
      at: opt(
        str({
          description:
            "create, once: local date and time, like 2026-05-08T09:00. Run `list` first if you don't know today's date",
        }),
      ),
      in_minutes: opt(
        num({ description: 'create, once: this many minutes from now' }),
      ),
      cron: opt(
        str({
          description:
            'create, repeat: a 5-field cron expression in local time, like `0 8 * * 1-5` for weekdays at 08:00',
        }),
      ),
      new_session: opt(
        bool({
          description:
            'create: true to start a new session each run instead of coming back here',
        }),
      ),
      folder: opt(
        str({
          description:
            'new_session: a project folder or worktree to start in; absent: your folder',
        }),
      ),
      worktree: opt(
        bool({
          description:
            "new_session: true to start each run in a new git worktree of `folder`'s project",
        }),
      ),
      effort: opt(
        union([lit('low'), lit('medium'), lit('high')], {
          description: 'new_session: how hard each run thinks',
        }),
      ),
      id: opt(str({ description: 'delete: the schedule id' })),
    },
    { open: true },
  ),
  execute: async (args, api) => {
    const me = String(api.conversationId);
    const now = `Now: ${momentWords(Date.now())} (${new Date().toString()}).`;
    if (args.action === 'list') {
      const all = listSchedules();
      return text(
        [now, ...all.map((s) => describe(s, me))].join('\n') +
          (all.length ? '' : '\nNo schedules.'),
      );
    }
    if (args.action === 'delete') {
      if (!args.id) throw new Error('Pass the `id` to delete');
      await deleteSchedule(args.id);
      return text(`Deleted schedule ${args.id}.`);
    }
    const times = [args.at, args.in_minutes, args.cron].filter(
      (t) => t !== undefined,
    );
    if (times.length !== 1)
      throw new Error('Pass exactly one of `at`, `in_minutes`, or `cron`');
    const time: Schedule['time'] = args.cron
      ? { cron: args.cron }
      : {
          at:
            args.in_minutes !== undefined
              ? Date.now() + args.in_minutes * 60_000
              : parseAt(args.at!),
        };
    const s = await createSchedule(
      args.prompt ?? '',
      time,
      me,
      args.new_session
        ? {
            ...(args.folder && { folder: args.folder }),
            ...(args.worktree && { worktree: true }),
            ...(args.effort && { effort: args.effort }),
          }
        : null,
    );
    return text(
      `Scheduled ${describe(s, me)}. ${now} The user sees it on the Schedules page.`,
    );
  },
});
