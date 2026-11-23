import { homedir } from 'node:os';
import { isAbsolute } from 'node:path';

import type { BotColor } from '@bica/shared/bots';
import type { Bot, BotFiles } from '@bica/shared/protocol';
import { live } from '../live';
import { dataPath, jsonFile } from '../storage';

// The bots the user made (docs/bots.md). Like projects.json: read every time,
// so a hand edit applies without a restart, and its order is the sidebar's.
// projects/projects.ts lists each bot's workspace from here, so this file
// imports nothing from projects/.

export type StoredBot = {
  // Also the id of its workspace's project.
  id: string;
  name: string;
  color: BotColor;
  // null: dataPath('bots', id).
  home: string | null;
  workspace: string;
  createdAt: number;
};

const file = jsonFile<StoredBot[]>('bots.json', {
  initial: () => [],
  reread: true,
});

/** The files in its home the prompt loads, by their BotFiles key. */
export const BOT_FILES: Record<keyof BotFiles, string> = {
  instructions: 'AGENTS.md',
  soul: 'SOUL.md',
  user: 'USER.md',
};

export function storedBots() {
  return file.read();
}

export function editBots(change: (list: StoredBot[]) => void | Promise<void>) {
  return file.update(change);
}

export function homeOf(bot: Pick<StoredBot, 'id' | 'home'>) {
  return bot.home ?? dataPath('bots', bot.id);
}

function toBot(stored: StoredBot): Bot {
  return {
    id: stored.id,
    name: stored.name,
    color: stored.color,
    home: stored.home,
    homePath: homeOf(stored),
    workspace: stored.workspace,
  };
}

export function listBots(): Bot[] {
  return file.read().map(toBot);
}

export function getBot(id: string | undefined): Bot | undefined {
  const stored = id ? file.read().find((b) => b.id === id) : undefined;
  return stored && toBot(stored);
}

/** An absolute path from what the user typed, `~` expanded; '' for none. */
export function expandPath(path: string, what: string) {
  const expanded = path
    .trim()
    .replace(/^~(?=\/|$)/, homedir())
    .replace(/(.)\/+$/, '$1');
  if (expanded && !isAbsolute(expanded))
    throw new Error(`The ${what} needs an absolute path, like ~/Repos`);
  return expanded;
}

const feed = live(async () => listBots());

export const watchBots = feed.watch;

export function refreshBots() {
  return feed.refresh();
}
