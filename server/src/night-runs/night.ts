import { AgentDoc, type ConversationId } from '@earendil-works/pi-durable';

import type { SessionSummary } from '@bica/shared/protocol';
import { isBusy } from '@bica/shared/status';
import { context, getHarness } from '../harness';
import { accountsOf, openWindows } from '../models/plans';
import { models } from '../models/registry';
import { settings } from '../settings';
import { setAgent } from '../sessions/meta';
import { stop, submit } from '../sessions/prompts';
import {
  editSession,
  getConversation,
  listSessions,
  sessionMeta,
  sessions,
} from '../sessions/store';

// Night runs (docs/night-runs.md): sessions held for tonight run as the Night
// agent. They start one at a time from the start time in Settings, while the
// plan has room, and go back to the Coding agent once they ran.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// New runs start only within one 5-hour plan window after the start time,
// so a late one can't eat into the morning's window.
const SPAN = 5 * HOUR;
// A run past this gets told to wrap up, and stops a while later.
const WRAP_UP_AT = 3 * HOUR;
const STOP_AT = WRAP_UP_AT + 20 * MINUTE;
// Above this much of the week used, nothing new starts: tomorrow needs it.
const WEEK_RESERVE = 0.8;

const WRAP_UP = `This night run has gone on for ${WRAP_UP_AT / HOUR} hours. Finish the step you are on, stop the terminals you started, and write your final report now. Bica stops the run in ${(STOP_AT - WRAP_UP_AT) / MINUTE} minutes.`;

// Runs started from here whose end hasn't come yet. Their status can lag a
// moment behind the submit.
const starting = new Set<string>();
const warned = new Set<string>();

/**
 * Checks every minute whether a night run should start, wrap up, or end.
 * Bun.cron never starts a check before the last one ends.
 */
export function startNight() {
  Bun.cron('* * * * *', () =>
    tick().catch((error) => console.error('[night]', error)),
  );
}

function running(s: SessionSummary) {
  return starting.has(s.id) || isBusy(s.status);
}

async function tick() {
  const night = (await listSessions()).filter(
    (s) => s.agent === 'night' && !s.archivedAt,
  );
  // Ran, failed, or stopped: from now on it's a normal session.
  for (const s of night)
    if (!s.tonight && !running(s)) {
      warned.delete(s.id);
      await setAgent(s.id, 'coding');
    }
  const current = night.find((s) => !s.tonight && running(s));
  if (current) {
    const age = Date.now() - (current.runningSince ?? Date.now());
    if (age > STOP_AT) await stop(current.id);
    else if (age > WRAP_UP_AT && !warned.has(current.id)) {
      warned.add(current.id);
      await submit(
        current.id,
        WRAP_UP,
        [],
        `night-wrap:${current.id}`,
        'bica',
        'steer',
      );
    }
    return;
  }
  if (!inWindow(new Date(), settings().nightStart)) return;
  // Oldest first: the order they were planned in.
  const next = night
    .filter((s) => s.tonight)
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (next && (await hasRoom(next.id))) await run(next.id);
}

/** Within SPAN after the latest start time, today's or yesterday's. */
function inWindow(now: Date, start: string) {
  const [h, m] = start.split(':').map(Number);
  const at = new Date(now);
  at.setHours(h ?? 1, m ?? 0, 0, 0);
  if (at > now) at.setDate(at.getDate() - 1);
  return now.getTime() - at.getTime() < SPAN;
}

/**
 * Whether the plan behind the session's model has room: one of its accounts
 * isn't blocked and has the week's reserve left. An account whose limits
 * aren't known yet, like any API key, counts as having room.
 */
async function hasRoom(id: string) {
  const agent = await (
    await getHarness()
  ).snapshot(AgentDoc, Number(id) as ConversationId, context);
  const model = agent?.model;
  const accounts = model ? accountsOf(models, model.provider) : [];
  if (!accounts.length) return true;
  return accounts.some((account) =>
    openWindows(account).every(
      (w) =>
        !w.limited && !(w.label === 'Week' && w.utilization >= WEEK_RESERVE),
    ),
  );
}

/** Sends the held prompt now, whatever the time, `prompt` when edited. */
export async function runTonight(id: string, prompt?: string) {
  const held = await takePrompt(id);
  if (!held) throw new Error('Nothing is waiting for tonight');
  await send(id, prompt?.trim() || held);
}

/** Replaces the held prompt, while it still waits. */
export async function saveTonight(id: string, prompt: string) {
  if (!prompt.trim()) throw new Error('A night run needs a prompt');
  const { id: conversationId } = await getConversation(id);
  await editSession(conversationId, (meta) => {
    if (!meta.tonight) throw new Error('This night run already started');
    meta.tonight = prompt.trim();
  });
  await sessions.refresh();
}

async function run(id: string) {
  const prompt = await takePrompt(id);
  if (prompt) await send(id, prompt);
}

async function send(id: string, prompt: string) {
  starting.add(id);
  try {
    // As its parent, so a session the hub planned stays the hub's.
    const meta = await sessionMeta((await getConversation(id)).id);
    await submit(id, prompt, [], `night:${id}`, meta?.startedBy ?? 'user');
  } catch (error) {
    starting.delete(id);
    // Held again: a start that failed mustn't lose the prompt.
    await hold(id, prompt).catch(() => {});
    throw error;
  }
  const conversation = await getConversation(id);
  void conversation
    .waitForIdle(context)
    .catch(() => {})
    .finally(() => starting.delete(id));
}

/**
 * Drops the night run: the session becomes a normal, empty one, and the
 * prompt comes back to edit or send.
 */
export async function cancelTonight(id: string) {
  const prompt = await takePrompt(id);
  await setAgent(id, 'coding');
  return prompt;
}

async function hold(id: string, prompt: string) {
  const { id: conversationId } = await getConversation(id);
  await editSession(conversationId, (meta) => void (meta.tonight = prompt));
  await sessions.refresh();
}

/** The held prompt, cleared so it can't run twice. */
async function takePrompt(id: string) {
  const { id: conversationId } = await getConversation(id);
  const prompt = await editSession(conversationId, (meta) => {
    const held = meta.tonight ?? '';
    meta.tonight = '';
    return held;
  });
  await sessions.refresh();
  return prompt;
}
