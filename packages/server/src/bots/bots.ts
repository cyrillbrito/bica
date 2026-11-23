import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentDoc, type ConversationId } from '@earendil-works/pi-durable';

import { isBotColor } from '@bica/shared/bots';
import { isBusy } from '@bica/shared/status';
import type { BotEdit, BotFiles, ModelChoice } from '@bica/shared/protocol';
import { context, getHarness } from '../harness';
import { agentChoice } from '../agents/choice';
import { getAgent, selection } from '../agents/registry';
import { refreshProjects } from '../projects/projects';
import { SessionDoc } from '../sessions/session-doc';
import { archive } from '../sessions/meta';
import { stop } from '../sessions/prompts';
import { allTerminals, removeTerminal } from '../terminals/terminals';
import {
  editSession,
  getConversation,
  listSessions,
  sessions,
} from '../sessions/store';
import {
  BOT_FILES,
  editBots,
  expandPath,
  homeOf,
  refreshBots,
  storedBots,
  type StoredBot,
} from './store';

// Bots (docs/bots.md): each one a session of the Bot agent in its home,
// starting sessions in its workspace or in projects.

function stored(id: string) {
  const bot = storedBots().find((b) => b.id === id);
  if (!bot) throw new Error('No such bot. It may have been deleted.');
  return bot;
}

function checkName(name: string) {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!clean) throw new Error('A bot needs a name');
  return clean;
}

// Not made when missing: it holds the user's repos, so a missing one is
// more likely a typo than a folder to create.
async function checkWorkspace(path: string) {
  const expanded = expandPath(path, 'workspace');
  if (!expanded)
    throw new Error(
      'A bot needs a workspace: the folder that holds your projects',
    );
  const found = await stat(expanded).catch(() => null);
  if (!found?.isDirectory())
    throw new Error(
      `${expanded} doesn't exist. Pick the folder that holds your projects.`,
    );
  return expanded;
}

async function readFiles(home: string): Promise<BotFiles> {
  const read = (name: string) =>
    readFile(join(home, name), 'utf8').catch(() => '');
  const [instructions, soul, user] = await Promise.all(
    Object.values(BOT_FILES).map(read),
  );
  return { instructions: instructions!, soul: soul!, user: user! };
}

/**
 * Writes the dialog's files, each only if it still holds the text the dialog
 * read: a file the bot changed since is refused whole, before anything is
 * written, so its edits are never lost.
 */
async function writeFiles(
  bot: Pick<StoredBot, 'name'>,
  home: string,
  files: BotEdit['files'] = {},
) {
  const now = await readFiles(home);
  const keys = Object.keys(files) as (keyof BotFiles)[];
  for (const key of keys)
    if (now[key] !== files[key]!.before)
      throw new Error(
        `${bot.name} changed ${BOT_FILES[key]} since you opened it. Close and open again to see its version.`,
      );
  await Promise.all(
    keys.map((key) => writeFile(join(home, BOT_FILES[key]), files[key]!.text)),
  );
}

async function refresh() {
  await Promise.all([refreshBots(), refreshProjects()]);
}

/** A new bot from the dialog; its id. */
export async function createBot(edit: BotEdit) {
  if (!isBotColor(edit.color))
    throw new Error(`No color ${String(edit.color)}`);
  let id = `bot-${Date.now().toString(36)}`;
  while (storedBots().some((b) => b.id === id)) id += 'x';
  const bot: StoredBot = {
    id,
    name: checkName(edit.name),
    color: edit.color,
    home: edit.home ? expandPath(edit.home, 'home') || null : null,
    workspace: await checkWorkspace(edit.workspace),
    createdAt: Date.now(),
  };
  const home = homeOf(bot);
  await mkdir(home, { recursive: true });
  await writeFiles(bot, home, edit.files);
  await editBots((list) => void list.push(bot));
  await refresh();
  return id;
}

/** Edits from the dialog; the bot's session follows its name and home. */
export async function updateBot(id: string, edit: Partial<BotEdit>) {
  const before = stored(id);
  const next: StoredBot = { ...before };
  if (edit.name !== undefined) next.name = checkName(edit.name);
  if (edit.color !== undefined) {
    if (!isBotColor(edit.color))
      throw new Error(`No color ${String(edit.color)}`);
    next.color = edit.color;
  }
  if (edit.workspace !== undefined)
    next.workspace = await checkWorkspace(edit.workspace);
  if (edit.home !== undefined)
    next.home = edit.home ? expandPath(edit.home, 'home') || null : null;
  const home = homeOf(next);
  await mkdir(home, { recursive: true });
  await writeFiles(next, home, edit.files);
  await editBots((list) => {
    const i = list.findIndex((b) => b.id === id);
    if (i < 0) throw new Error('No such bot. It may have been deleted.');
    list[i] = next;
  });
  await refresh();
  await follow(next, before);
}

/** The bot's open session takes its new name and home. */
async function follow(bot: StoredBot, before: StoredBot) {
  const open = await findSession(bot.id);
  if (!open) return;
  const conversation = await getConversation(open.id);
  const moved = homeOf(bot) !== homeOf(before);
  if (moved) await conversation.configure({ cwd: homeOf(bot) }, context);
  if (moved || bot.name !== before.name)
    await editSession(conversation.id, (meta) => {
      meta.title = bot.name;
      // Another home holds other memory files.
      if (moved) {
        delete meta.memory;
        delete meta.projects;
      }
    });
  await sessions.refresh();
}

/** The bot's newest open session. */
async function findSession(id: string) {
  return (await listSessions()).find((s) => s.bot === id && !s.archivedAt);
}

/**
 * The model of the bot's newest archived session, so a new session keeps the
 * one the user picked; null: none.
 */
async function lastChoice(id: string): Promise<ModelChoice | null> {
  const last = (await listSessions())
    .filter((s) => s.bot === id && s.archivedAt)
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))[0];
  if (!last) return null;
  const agent = await (
    await getHarness()
  ).snapshot(AgentDoc, Number(last.id) as ConversationId, context);
  return agent?.model && agent.thinkingLevel
    ? { model: agent.model, thinkingLevel: agent.thinkingLevel }
    : null;
}

/** The bot's session id, started in its home first if there is none. */
export async function openBot(id: string) {
  const bot = stored(id);
  const open = await findSession(id);
  if (open) return open.id;
  const home = homeOf(bot);
  await mkdir(home, { recursive: true });
  const extensions = selection(getAgent('bot'));
  const conversation = await (
    await getHarness()
  ).createConversation(
    {
      ownership: { kind: 'ownerless' },
      agent: {
        ...(await agentChoice(getAgent('bot'), await lastChoice(id))),
        cwd: home,
        ...(extensions && { extensions }),
      },
      init: async (tx, id) => {
        const doc = await tx.doc(SessionDoc, id);
        doc.title = bot.name;
        doc.createdAt = Date.now();
        doc.seenEntry = 0;
        doc.profile = 'bot';
        doc.bot = bot.id;
      },
    },
    context,
  );
  await sessions.refresh();
  return String(conversation.id);
}

/** The text of the bot's files, '' for a missing one. */
export async function readBotFiles(id: string) {
  return readFiles(homeOf(stored(id)));
}

/**
 * Archives the bot's session and every open session in its workspace, which
 * would lose their project, with their terminals. The sessions they lead in
 * projects become the user's. The home stays: its memory is the user's data.
 */
export async function deleteBot(id: string) {
  stored(id);
  const all = await listSessions();
  const gone = all.filter(
    (s) => !s.archivedAt && (s.bot === id || s.projectId === id),
  );
  // Archived before stopping: an archived session's run end sends no note,
  // so a stopped child wakes nobody.
  for (const s of gone) await archive(s.id, true);
  for (const s of gone.filter((s) => isBusy(s.status))) await stop(s.id);
  await Promise.all(
    allTerminals()
      .filter((t) => t.projectId === id)
      .map((t) => removeTerminal(t.id)),
  );
  await editBots((list) => {
    const i = list.findIndex((b) => b.id === id);
    if (i >= 0) list.splice(i, 1);
  });
  await refresh();
  await sessions.refresh();
}
