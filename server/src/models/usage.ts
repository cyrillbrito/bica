import type { PlanUsage } from '@bica/shared/protocol';
import { live } from '../live';
import { jsonFile } from '../storage';
import { emailOf, nameOf } from './account-info';
import {
  accountsOf,
  allLimits,
  baseOf,
  onLimits,
  pickOrder,
  restoreLimits,
} from './plans';
import { models } from './registry';

/*
 * The plans' limits for the sidebar's meters and night runs, from the
 * rate-limit headers of each account's last reply (plans.ts). Saved, so the
 * meters survive a restart; an account that hasn't answered yet has none.
 */
const file = jsonFile<ReturnType<typeof allLimits>>('plan-usage.json', {
  initial: () => [],
});

try {
  restoreLimits(file.read());
} catch (error) {
  // Only meters: the next reply's limits replace it.
  console.error('[usage]', error);
}

async function read(): Promise<PlanUsage> {
  // In the order you prefer the accounts.
  const place = (id: string) => accountsOf(models, baseOf(id)).indexOf(id);
  return allLimits()
    .filter(([id]) => models.getProvider(id))
    .sort(([a], [b]) => place(a) - place(b))
    .map(([id, { windows, updatedAt }]) => {
      const accounts = pickOrder(models, baseOf(id));
      return {
        id,
        family: baseOf(id),
        // The meters only show one plan's accounts: the email tells them apart.
        name: emailOf(id) ?? nameOf(id),
        inUse: accounts.length > 1 && accounts[0] === id,
        windows,
        updatedAt,
      };
    });
}

const feed = live(read);

onLimits(() => {
  void feed.refresh();
  file.write(allLimits()).catch((error) => console.error('[usage]', error));
});

export const watchPlanUsage = feed.watch;
export const refreshPlanUsage = feed.refresh;
