import { createMemo } from 'solid-js';
import type { BotColor } from '@bica/shared/bots';
import type { BotEdit, BotFiles } from '@bica/shared/protocol';
import { request, useTopic } from '../socket/socket';
import { useSessions } from '../sessions/sessions';

/** Every bot, in the sidebar's order (docs/bots.md). */
export function useBots() {
  return useTopic('bots', () => ({}));
}

export function useBot(id: () => string | undefined) {
  const bots = useBots();
  return createMemo(() => bots().find((b) => b.id === id()), {
    name: 'bot',
  });
}

/** The bot's own open session; undefined until `openBot` starts one. */
export function useBotSession(id: () => string | undefined) {
  const sessions = useSessions();
  return createMemo(
    () => sessions().find((s) => s.bot === id() && !s.archivedAt),
    { name: 'botSession' },
  );
}

/** The bot whose workspace a project is, for a project id. */
export function botOfProject(
  bots: { id: string }[],
  projectId: string | undefined,
) {
  return projectId ? bots.find((b) => b.id === projectId) : undefined;
}

export function createBot(edit: BotEdit) {
  return request('bot.create', edit);
}

export function updateBot(id: string, edit: Partial<BotEdit>) {
  return request('bot.update', { id, ...edit });
}

export function deleteBot(id: string) {
  return request('bot.delete', { id });
}

/** The bot's session id, started first if there is none. */
export function openBot(id: string) {
  return request('bot.open', { id });
}

/**
 * Archives the bot's session; `openBot` then starts a fresh one, with the
 * memory in its home.
 */
export function archiveBotSession(sessionId: string) {
  return request('session.archive', { id: sessionId, archived: true });
}

export function readBotFiles(id: string) {
  return request('bot.files', { id });
}

/** Each file's name in the bot's home, as the UI shows it. */
export const BOT_FILES: Record<keyof BotFiles, string> = {
  instructions: 'AGENTS.md',
  soul: 'SOUL.md',
  user: 'USER.md',
};

// Whole class names, so Tailwind finds them.
export const BOT_SWATCH: Record<BotColor, string> = {
  blue: 'bg-bot-blue',
  teal: 'bg-bot-teal',
  green: 'bg-bot-green',
  olive: 'bg-bot-olive',
  amber: 'bg-bot-amber',
  rose: 'bg-bot-rose',
  plum: 'bg-bot-plum',
  slate: 'bg-bot-slate',
};
