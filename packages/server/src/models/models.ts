import { getSupportedThinkingLevels } from '@earendil-works/pi-ai';
import { DEFAULT_COMPACTION_POLICY } from '@earendil-works/pi-durable';

import type {
  ModelCatalog,
  ModelChoice,
  ThinkingLevel,
} from '@bica/shared/protocol';
import { nameOf } from './account-info';
import { models } from './registry';
import { live } from '../live';
import { settings } from '../settings';

export async function getCatalog(): Promise<ModelCatalog> {
  const providers = (
    await Promise.all(
      models.getProviders().map(async (p) => {
        const auth = await models.checkAuth(p.id).catch(() => undefined);
        return (
          auth && { id: p.id, name: nameOf(p.id), source: auth.source ?? null }
        );
      }),
    )
  ).filter((p) => !!p);
  const available = await models.getAvailable();
  return {
    providers,
    models: available.map((m) => ({
      provider: m.provider,
      id: m.id,
      name: m.name,
      levels: getSupportedThinkingLevels(m) as ThinkingLevel[],
      contextWindow: m.contextWindow,
      cost: { input: m.cost.input, output: m.cost.output },
      cacheTtl: { ...m.promptCache },
    })),
    // The harness doesn't override the policy (server/src/harness.ts).
    compaction: {
      reserveTokens: DEFAULT_COMPACTION_POLICY.reserveTokens,
      backgroundTokens: DEFAULT_COMPACTION_POLICY.backgroundTokens,
      keepRecentTokens: DEFAULT_COMPACTION_POLICY.keepRecentTokens,
    },
  };
}

const catalog = live(getCatalog);

export const watchModels = catalog.watch;
export const refreshModels = catalog.refresh;

export async function defaultChoice(): Promise<ModelChoice> {
  const { model, thinkingLevel } = settings();
  return { model, thinkingLevel };
}
