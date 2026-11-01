import { clampThinkingLevel } from '@earendil-works/pi-ai';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

import type {
  ModelChoice,
  ModelRef,
  ThinkingLevel,
} from '@bica/shared/protocol';

import { credentials } from './credentials';
import { baseOf, extraAccount, isExtra, routeAccounts } from './plans';
import { timeThinking } from './thinking-time';

// Every model Bica can call: the harness, the fast model, and voice share it.
// Keys and sign-ins come only from Settings → Providers: an env var or a
// cloud CLI's login would make an account Bica uses but doesn't list.
export const models = builtinModels({
  credentials,
  authContext: {
    env: async () => undefined,
    fileExists: async () => false,
  },
});
routeAccounts(models);
timeThinking(models);

/** Registers a provider's extra account, `<provider>:<n>` (plans.ts). */
export function addExtraAccount(id: string) {
  const base = models.getProvider(baseOf(id));
  if (!base) throw new Error(`Unknown provider ${baseOf(id)}`);
  if (!models.getProvider(id))
    models.setProvider(extraAccount(base, id.slice(id.indexOf(':') + 1)));
}

// Extra accounts are known by their saved sign-ins.
export const accountsReady = credentials.list().then((saved) => {
  for (const { providerId } of saved)
    if (isExtra(providerId) && models.getProvider(baseOf(providerId)))
      addExtraAccount(providerId);
});

const LEVELS: readonly ThinkingLevel[] = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
];

function key(ref: ModelRef) {
  return `${ref.provider}/${ref.modelId}`;
}

/**
 * The model, if a key or sign-in in Settings reaches it now. pi-ai's
 * `getModel` knows every model, signed in or not, so only this tells.
 */
export async function reachable(ref: ModelRef) {
  return (await models.getAvailable()).find(
    (m) => m.provider === ref.provider && m.id === ref.modelId,
  );
}

/** A model the keys reach, and an effort it supports. */
export async function checkChoice(choice: ModelChoice) {
  await checkRef(choice.model);
  return knownChoice(choice);
}

/** A chat model the keys reach. */
export async function checkRef(ref: ModelRef) {
  if (!(await reachable(knownRef(ref))))
    throw new Error(
      `No sign-in reaches ${key(ref)}: connect its provider in Settings → Providers`,
    );
  return ref;
}

/**
 * A model pi-ai knows, signed in or not, and an effort it supports: for a
 * saved setting, which stays visible after its provider signs out.
 */
export function knownChoice({
  model,
  thinkingLevel,
}: ModelChoice): ModelChoice {
  const found = models.getModel(model.provider, model.modelId);
  if (!found) throw new Error(`Unknown model ${key(model)}`);
  if (!LEVELS.includes(thinkingLevel))
    throw new Error(`Unknown effort ${thinkingLevel}`);
  return {
    model: { provider: found.provider, modelId: found.id },
    thinkingLevel: clampThinkingLevel(found, thinkingLevel),
  };
}

function knownRef(ref: ModelRef) {
  if (!models.getModel(ref.provider, ref.modelId))
    throw new Error(`Unknown model ${key(ref)}`);
  return ref;
}
