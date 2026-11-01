import { jsonFile } from '../storage';
import { type Identity as Info, lookUp } from './known-providers';
import { baseOf, setPreferred } from './plans';
import { models } from './registry';

/*
 * What Bica knows about each account beyond its sign-in
 * (docs/models.md#more-than-one-account): its email and plan, and which
 * account of a plan goes first. Kept out of auth.json, since
 * renewing a sign-in rewrites its entry there.
 */
const file = jsonFile<{
  accounts: Record<string, Info>;
  // Account ids, most preferred first; ones missing follow in sign-in order.
  order: string[];
}>('accounts.json', { initial: () => ({ accounts: {}, order: [] }) });

setPreferred(file.read().order);

/** The provider's name: every account of a plan shares it, the email tells them apart. */
export function nameOf(id: string) {
  const base = baseOf(id);
  return models.getProvider(base)?.name ?? base;
}

export function emailOf(id: string) {
  return file.read().accounts[id]?.email ?? null;
}
export function planOf(id: string) {
  return file.read().accounts[id]?.plan ?? null;
}

/** Puts the account ahead of the others of its plan. */
export async function useFirst(id: string) {
  const { order } = await file.update((saved) => {
    saved.order = [id, ...saved.order.filter((o) => o !== id)];
  });
  setPreferred(order);
}

export async function forgetAccount(id: string) {
  const { accounts, order } = file.read();
  if (!(id in accounts) && !order.includes(id)) return;
  const saved = await file.update((saved) => {
    delete saved.accounts[id];
    saved.order = saved.order.filter((o) => o !== id);
  });
  setPreferred(saved.order);
}

/** An unused id for another account of `provider`: anthropic:2, anthropic:3. */
export function newAccountId(provider: string) {
  let n = 2;
  const { accounts } = file.read();
  while (models.getProvider(`${provider}:${n}`) || accounts[`${provider}:${n}`])
    n++;
  return `${provider}:${n}`;
}

const tried = new Set<string>();
const pending = new Map<string, Promise<void>>();

/**
 * Reads the account's email and plan, once per sign-in: after a new one
 * (`fresh`), or for an older one that never had them. One that fails isn't
 * tried again until the next sign-in or restart. Calls `done` on news.
 */
export async function learn(id: string, fresh: boolean, done: () => void) {
  if (!fresh && (file.read().accounts[id]?.email || tried.has(id))) return;
  tried.add(id);
  // After any lookup already running, so a new sign-in reads its own token.
  const run = (pending.get(id) ?? Promise.resolve()).then(async () => {
    try {
      const token = (await models.getAuth(id))?.auth.apiKey;
      const info = token ? await lookUp(baseOf(id), token) : null;
      if (!info?.email) return;
      await file.update(({ accounts }) => {
        accounts[id] = { ...accounts[id], email: info.email, plan: info.plan };
      });
      done();
    } catch (error) {
      console.error('[accounts]', id, error);
    }
  });
  pending.set(id, run);
  await run;
  if (pending.get(id) === run) pending.delete(id);
}
