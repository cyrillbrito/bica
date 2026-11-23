import type { ConversationId } from '@earendil-works/pi-durable';

import type { Calls, Schedule, ScheduleStart } from '@bica/shared/protocol';
import { momentWords } from '@bica/shared/schedules';
import { live } from '../live';
import { jsonFile } from '../storage';
import { archiveWithWorktree } from '../projects/worktrees';
import { createSession, spawnSession } from '../sessions/create';
import { archive, setAgent } from '../sessions/meta';
import { submit } from '../sessions/prompts';
import { readSession } from '../sessions/read';
import { editSession, listSessions, sessionMeta } from '../sessions/store';

// Schedules (docs/schedules.md): prompts that fire later, once or on a
// repeat, back into the session that made them or as a new session each run.
// Times are the machine's local time, as Bun.cron reads them.

type Stored = Omit<Schedule, 'next'>;

const file = jsonFile<Stored[]>('schedules.json', { initial: () => [] });

const MINUTE = 60_000;
// A repeat more often than this would start sessions faster than anyone reads them.
const MIN_GAP = 10 * MINUTE;
// Later than this, the prompt says when it was due.
const LATE = 2 * MINUTE;

function nextOf(s: Stored): number | null {
  if ('at' in s.time) return s.lastRunAt ? null : s.time.at;
  return (
    Bun.cron.parse(s.time.cron, s.lastRunAt ?? s.createdAt)?.getTime() ?? null
  );
}

/** Every schedule, soonest first. */
export function listSchedules(): Schedule[] {
  return file
    .read()
    .map((s) => ({ ...s, next: nextOf(s) }))
    .sort((a, b) => (a.next ?? Infinity) - (b.next ?? Infinity));
}

const feed = live(async () => listSchedules());

export const watchSchedules = feed.watch;

/** Throws when the time can't be scheduled: past, invalid, or too often. */
function checkTime(time: Schedule['time']) {
  if ('at' in time) {
    if (!Number.isFinite(time.at)) throw new Error('Pick a date and time');
    if (time.at < Date.now() - MINUTE)
      throw new Error(`${momentWords(time.at)} has passed`);
    return;
  }
  const cron = time.cron.trim();
  let first: Date | null;
  try {
    first = Bun.cron.parse(cron);
  } catch (error) {
    throw new Error(
      `\`${cron}\` isn't a cron expression: ${(error as Error).message}`,
    );
  }
  if (!first) throw new Error(`\`${cron}\` never fires`);
  const second = Bun.cron.parse(cron, first);
  if (second && second.getTime() - first.getTime() < MIN_GAP)
    throw new Error(
      `\`${cron}\` fires more often than every ${MIN_GAP / MINUTE} minutes`,
    );
}

export async function createSchedule(
  prompt: string,
  time: Schedule['time'],
  session: string | null,
  start: ScheduleStart | null,
) {
  if (!prompt.trim()) throw new Error('A schedule needs a prompt');
  if ('cron' in time) time = { cron: time.cron.trim() };
  checkTime(time);
  const stored: Stored = {
    id: crypto.randomUUID().slice(0, 8),
    prompt: prompt.trim(),
    time,
    session,
    start,
    lastRunAt: null,
    createdAt: Date.now(),
  };
  await file.update((list) => void list.push(stored));
  await changed();
  return { ...stored, next: nextOf(stored) };
}

/** From the composer: each run starts a new session there, which is yours. */
export function createFromComposer({
  prompt,
  time,
  projectId,
  cwd,
  worktree,
  choice,
}: Calls['schedule.create']['args']) {
  return createSchedule(prompt, time, null, {
    projectId,
    folder: cwd,
    ...(worktree && { worktree }),
    ...(choice && { choice }),
  });
}

export async function deleteSchedule(id: string) {
  let found = false;
  await file.update((list) => {
    const i = list.findIndex((s) => s.id === id);
    if (i >= 0) list.splice(i, 1);
    found = i >= 0;
  });
  if (!found) throw new Error(`No schedule ${id}`);
  await changed();
}

async function changed() {
  arm();
  await feed.refresh();
}

let timer: ReturnType<typeof setTimeout> | undefined;
let firing = false;

/**
 * Wakes at the soonest fire, or within a minute: timers run late after the
 * machine sleeps, and a fire missed while Bica was off is caught then too.
 */
function arm() {
  clearTimeout(timer);
  const soonest = Math.min(
    ...file
      .read()
      .map(nextOf)
      .filter((n) => n !== null),
    Date.now() + MINUTE,
  );
  timer = setTimeout(() => void tick(), Math.max(0, soonest - Date.now()));
}

async function tick() {
  if (firing) return;
  firing = true;
  try {
    await fireDue();
  } catch (error) {
    console.error('[schedules]', error);
  } finally {
    firing = false;
    arm();
  }
}

/**
 * Fires what is due. A repeat missed several times fires once. It is marked
 * run before firing, so a failure or a restart never fires it twice.
 */
async function fireDue() {
  const now = Date.now();
  const due = file.read().flatMap((s) => {
    const at = nextOf(s);
    return at !== null && at <= now ? [{ s, at }] : [];
  });
  if (!due.length) return;
  await file.update((list) => {
    for (const s of list)
      if (due.some((d) => d.s.id === s.id)) s.lastRunAt = now;
  });
  for (const { s, at } of due)
    await fire(s, at, now).catch((error) =>
      console.error('[schedules]', s.id, error),
    );
  // A one-off is done once fired.
  await file.update((list) => {
    for (let i = list.length - 1; i >= 0; i--)
      if ('at' in list[i]!.time && list[i]!.lastRunAt) list.splice(i, 1);
  });
  await feed.refresh();
}

async function fire(s: Stored, at: number, now: number) {
  const late =
    now - at > LATE
      ? ` It was due ${momentWords(at)}, while Bica was off or asleep.`
      : '';
  const requestId = `schedule:${s.id}:${at}`;
  if (!s.start) {
    const target = await liveTarget(s.session!);
    await submit(
      target,
      `A schedule you set ${momentWords(s.createdAt)} fired.${late} Its prompt:\n\n${s.prompt}`,
      [],
      requestId,
      'bica',
    );
    return;
  }
  const prompt = `${UNATTENDED}${late}\n\n${s.prompt}`;
  if (s.session)
    await spawnSession(
      Number(await liveTarget(s.session)) as ConversationId,
      prompt,
      requestId,
      s.start.folder,
      s.start.worktree,
      false,
      s.start.effort,
      s.id,
    );
  else
    await createSession({
      projectId: s.start.projectId!,
      cwd: s.start.worktree ? undefined : s.start.folder,
      prompt,
      requestId,
      choice: s.start.choice,
      worktree: s.start.worktree,
      schedule: s.id,
    });
}

const UNATTENDED = `This session was started by a schedule, and nobody watches it as it runs. Work until the task is done or truly blocked, take the choice that is easiest to undo when one comes up, prove the work with commands, and end with a short report. If there is nothing worth reporting, reply exactly "Nothing new" and nothing else.`;

/**
 * The session to fire into: the one that made the schedule, or for a bot's
 * session that was replaced, the bot's current one. An archived one is
 * brought back, since a prompt there would go unseen.
 */
async function liveTarget(id: string) {
  const all = await listSessions();
  const s = all.find((o) => o.id === id);
  if (!s) throw new Error(`Session ${id} is gone`);
  if (!s.archivedAt) return id;
  const current = s.bot && all.find((o) => o.bot === s.bot && !o.archivedAt);
  if (current) return current.id;
  await archive(id, false);
  return id;
}

/**
 * A schedule's run that replied "Nothing new" goes to the archive, so its
 * parent hears nothing (orchestration/notes.ts skips archived sessions).
 */
export async function archiveIfQuiet(id: ConversationId) {
  const meta = await sessionMeta(id);
  if (!meta?.schedule || meta.archivedAt || meta.lastFrom === 'user') return;
  const s = await readSession(String(id));
  if (s.status !== 'idle' && s.status !== 'done') return;
  if (!/^nothing new\.?$/i.test(s.reply.trim())) return;
  await archiveWithWorktree(String(id), true);
}

/**
 * Night runs became schedules. A session that still runs as the Night agent
 * goes back to Coding, and a prompt held for tonight fires into it at 01:00.
 */
async function retireNightRuns() {
  for (const s of await listSessions()) {
    const id = Number(s.id) as ConversationId;
    const meta = (await sessionMeta(id)) as { profile?: string } | undefined;
    if (meta?.profile !== 'night') continue;
    await setAgent(s.id, 'coding');
    const held = await editSession(id, (m) => {
      const old = m as { tonight?: string };
      const was = old.tonight;
      delete old.tonight;
      return was;
    });
    if (!held) continue;
    const at = new Date();
    at.setHours(1, 0, 0, 0);
    if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
    await createSchedule(held, { at: at.getTime() }, s.id, null);
  }
}

/** Starts firing schedules, with no browser tab needed. */
export function startSchedules() {
  arm();
  void retireNightRuns().catch((error) => console.error('[schedules]', error));
}
