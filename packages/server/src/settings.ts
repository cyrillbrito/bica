import { homedir } from 'node:os';
import { isAbsolute } from 'node:path';

import type {
  ModelChoice,
  ModelRef,
  Settings,
  SettingsChange,
} from '@bica/shared/protocol';
import { env } from './env';
import { live } from './live';
import { checkChoice, checkRef, knownChoice } from './models/registry';
import { jsonFile } from './storage';

// Bica's settings, the same on every device (docs/models.md for the model
// ones). Preferences of one device, like the theme, stay in its browser.
const file = jsonFile<SettingsChange>('settings.json', { initial: () => ({}) });

function parseRef(id: string): ModelRef | null {
  if (!id) return null;
  const [provider, ...rest] = id.split('/');
  return { provider: provider!, modelId: rest.join('/') };
}

/** The saved settings, with the defaults filled in. */
export function settings(): Settings {
  const saved = file.read();
  const choice: ModelChoice = {
    model: saved.model ?? parseRef(env.PI_MODEL)!,
    thinkingLevel: saved.thinkingLevel ?? 'medium',
  };
  let checked = choice;
  try {
    checked = knownChoice(choice);
  } catch {
    // An unknown saved model stays visible; picking another fixes it.
  }
  return {
    ...checked,
    enabled: saved.enabled ?? [],
    fastModel:
      saved.fastModel === undefined
        ? parseRef(env.PI_FAST_MODEL ?? '')
        : saved.fastModel,
    // Long by default, like Claude Code on a subscription: pauses of 5 to 60
    // minutes are rare, but each one rewrites the whole context.
    longCache: saved.longCache ?? true,
    stageOnView: saved.stageOnView ?? false,
    hubFolder: saved.hubFolder ?? null,
    hubModel: saved.hubModel ?? null,
    nightStart: saved.nightStart ?? '01:00',
    fromEnv: {
      model: !saved.model,
      fastModel: saved.fastModel === undefined && !!env.PI_FAST_MODEL,
    },
  };
}

const feed = live(async () => settings());

export const watchSettings = feed.watch;

/** Checks and saves a change from the Settings page. */
export async function updateSettings(change: SettingsChange) {
  await file.update(async (next) => {
    if (change.model || change.thinkingLevel) {
      const current = settings();
      Object.assign(
        next,
        await checkChoice({
          model: change.model ?? current.model,
          thinkingLevel: change.thinkingLevel ?? current.thinkingLevel,
        }),
      );
    }
    if (change.enabled) next.enabled = [...new Set(change.enabled)];
    if (change.fastModel !== undefined)
      next.fastModel = change.fastModel && (await checkRef(change.fastModel));
    if (change.longCache !== undefined) next.longCache = !!change.longCache;
    if (change.stageOnView !== undefined)
      next.stageOnView = !!change.stageOnView;
    if (change.hubFolder !== undefined) {
      const path = (change.hubFolder ?? '')
        .trim()
        .replace(/^~(?=\/|$)/, homedir())
        .replace(/(.)\/+$/, '$1');
      if (path && !isAbsolute(path))
        throw new Error('The hub folder needs an absolute path');
      next.hubFolder = path || null;
    }
    if (change.hubModel !== undefined)
      next.hubModel = change.hubModel && (await checkChoice(change.hubModel));
    if (change.nightStart !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(change.nightStart))
        throw new Error('Pick a time like 01:00');
      next.nightStart = change.nightStart;
    }
  });
  await feed.refresh();
}
