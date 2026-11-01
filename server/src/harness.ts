import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  createRegistry,
  Harness,
  type Extension,
} from '@earendil-works/pi-durable';
import { NodeExecutionEnv } from '@earendil-works/pi-durable/env/node';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';

import { accountsReady, models } from './models/registry';
import { settings } from './settings';
import { announceRuns } from './tools/tool-ran';
import { timeTools } from './tools/tool-time';
import { claimDataDir, dataPath } from './storage';

export const context = BACKGROUND_CONTEXT;

/** Every extension agents pick; sessions find theirs here by name. */
export const registry = createRegistry();
let defaults: Extension[] | undefined;
let harness: Promise<Harness> | undefined;

/**
 * Installs the extensions, and the ones sessions get unless their agent picks
 * its own. Before the harness opens: it resumes runs that need their tools.
 */
export function install(all: Iterable<Extension>, byDefault: Extension[]) {
  for (const extension of all)
    registry.install(announceRuns(timeTools(extension)));
  defaults = byDefault;
}

async function open(): Promise<Harness> {
  if (!defaults)
    throw new Error('Install the extensions before opening the harness');
  await accountsReady.catch(() => {});
  // Here, not in serve(): modules open the harness as they load, and a
  // second process must stop before it resumes anyone's runs.
  try {
    claimDataDir();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
  const harness = await Harness.open(
    await openNodeSqliteStorage(dataPath('harness.sqlite')),
    {
      models,
      registry,
      env: ({ cwd }) => new NodeExecutionEnv({ cwd: cwd ?? process.cwd() }),
      onReport: (error, info) => console.error('[harness]', info.type, error),
      // Steers are corrections: every one waiting lands at the next step.
      // Follow-ups stay one per run.
      settings: {
        // Without it, every session would get the hub's tools too.
        extensions: defaults,
        steeringMode: 'all',
        // Prompts and notes queued behind a failed run still run: many
        // sessions work unwatched, and a note left waiting is never read.
        afterFailedRun: 'continue',
        get stream() {
          return {
            cacheRetention: settings().longCache
              ? ('long' as const)
              : ('short' as const),
          };
        },
      },
    },
    context,
  );
  // Continue runs a previous process left unfinished.
  harness.resume();
  return harness;
}

export function getHarness() {
  return (harness ??= open());
}
