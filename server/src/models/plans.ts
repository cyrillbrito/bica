import {
  type AssistantMessage,
  createAssistantMessageEventStream,
  lazyStream,
  type MutableModels,
  type Provider,
  type SimpleStreamOptions,
} from '@earendil-works/pi-ai';

import type { PlanWindow } from '@bica/shared/protocol';
import { limitWindows } from './known-providers';

/*
 * More than one account on a plan provider (docs/models.md#more-than-one-account).
 * An extra account is the provider again under `<provider>:<n>`, with
 * its own sign-in and no models of its own. A session keeps its model, such
 * as anthropic/claude-opus-5-5, and each request goes out on the first
 * account with room, with that account's token. The reply keeps the model's
 * provider, since pi-ai drops thinking from other providers' replies.
 */

// Past this share of any window, requests move to the next account.
export const SWITCH_AT = 0.9;
// An account that failed without telling its limits is skipped this long.
const COOL_DOWN_MS = 5 * 60_000;

export function baseOf(id: string) {
  return id.split(':')[0]!;
}
export function isExtra(id: string) {
  return id.includes(':');
}

/** The provider again under `<base>:<n>`, for a second sign-in. */
export function extraAccount(base: Provider, n: string): Provider {
  return {
    ...base,
    id: `${base.id}:${n}`,
    getModels: () => [],
    getAllModels: () => [],
    refreshModels: undefined,
  };
}

// Account ids in the order you prefer them (account-info.ts).
let preferred: string[] = [];
export function setPreferred(ids: string[]) {
  return void (preferred = ids);
}

/**
 * The provider and its extra accounts: the preferred ones first, then the
 * rest in the order they were added.
 */
export function accountsOf(models: MutableModels, provider: string) {
  const rank = (id: string) =>
    preferred.includes(id) ? preferred.indexOf(id) : Infinity;
  return models
    .getProviders()
    .map((p) => p.id)
    .filter((id) => id === provider || id.startsWith(`${provider}:`))
    .sort((a, b) => rank(a) - rank(b));
}

// Limits from each account's last reply, and accounts failing without them.
const limits = new Map<string, { windows: PlanWindow[]; updatedAt: number }>();
const cooling = new Map<string, number>();
const listeners = new Set<() => void>();

export function onLimits(listener: () => void) {
  return void listeners.add(listener);
}
function changed() {
  return listeners.forEach((listener) => listener());
}

export function limitsOf(id: string) {
  return limits.get(id);
}
export function allLimits() {
  return [...limits];
}

export function restoreLimits(
  saved: [string, { windows: PlanWindow[]; updatedAt: number }][],
) {
  for (const [id, value] of saved) if (!limits.has(id)) limits.set(id, value);
}

export function forgetLimits(id: string) {
  limits.delete(id);
  cooling.delete(id);
  changed();
}

/** Reads the plan's rate-limit headers off a reply, when it has them. */
export function recordLimits(id: string, headers: Record<string, string>) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const windows = limitWindows(lower);
  if (!windows.length) return;
  limits.set(id, { windows, updatedAt: Date.now() });
  cooling.delete(id);
  changed();
}

/** The plan windows still running; extra usage is paid, so it never counts. */
export function openWindows(id: string, now = Date.now()) {
  return (limits.get(id)?.windows ?? []).filter(
    (w) => w.key !== 'overage' && (w.resetsAt === null || w.resetsAt > now),
  );
}

// 0: has room, 1: past SWITCH_AT, 2: blocked or failing.
function tier(id: string, now: number) {
  const windows = openWindows(id, now);
  if ((cooling.get(id) ?? 0) > now || windows.some((w) => w.limited)) return 2;
  if (windows.some((w) => w.utilization >= SWITCH_AT)) return 1;
  return 0;
}

/** The accounts to try for a model, best first; unknown limits count as room. */
export function pickOrder(models: MutableModels, provider: string) {
  const now = Date.now();
  return accountsOf(models, provider)
    .map((id, i) => ({ id, rank: tier(id, now) * 1000 + i }))
    .sort((a, b) => a.rank - b.rank)
    .map((a) => a.id);
}

function said(content: AssistantMessage['content']) {
  return content.some((b) =>
    b.type === 'text'
      ? !!b.text
      : b.type === 'thinking'
        ? !!(b.thinking || b.redacted || b.thinkingSignature)
        : true,
  );
}

// Errors another account might not have: limits, sign-ins, and keys. Not
// overloaded: that's the provider's, and moving would only cost the cache.
const ACCOUNT_ERROR =
  /\b(401|402|403|429)\b|rate.?limit|usage limit|quota|not configured|not signed in|oauth|credential|billing/i;

function coolDown(id: string, reason: unknown) {
  if (tier(id, Date.now()) < 2) cooling.set(id, Date.now() + COOL_DOWN_MS);
  console.error('[accounts]', id, reason);
}

/**
 * Wraps `streamSimple` so requests on a provider with extra accounts go to
 * the first account with room, and move on when one fails before it says
 * anything. Every reply's limits are recorded, for the meters too.
 */
export function routeAccounts(models: MutableModels) {
  const stream = models.streamSimple.bind(models);

  // One account's request. A sign-in that fails here ends the stream with an
  // error, as any other failure does.
  const send = (
    id: string,
    ...[model, context, options]: Parameters<typeof stream>
  ) => {
    const onResponse: SimpleStreamOptions['onResponse'] = (response, m) => {
      recordLimits(id, response.headers);
      return options?.onResponse?.(response, m);
    };
    if (id === model.provider)
      return stream(model, context, { ...options, onResponse });
    return lazyStream(model, async () => {
      const resolved = await models.getAuth(id, { signal: options?.signal });
      if (!resolved?.auth.apiKey) throw new Error(`${id} is not signed in`);
      const { apiKey, headers, baseUrl } = resolved.auth;
      return stream(baseUrl ? { ...model, baseUrl } : model, context, {
        ...options,
        onResponse,
        apiKey,
        headers: { ...headers, ...options?.headers },
        env: resolved.env ? { ...resolved.env, ...options?.env } : options?.env,
      });
    });
  };

  models.streamSimple = (model, context, options) => {
    const order = pickOrder(models, model.provider);
    if (order.length < 2) return send(model.provider, model, context, options);
    const out = createAssistantMessageEventStream();
    void (async () => {
      for (const [i, id] of order.entries()) {
        const last = i === order.length - 1;
        const source = send(id, model, context, options);
        // Events wait until the reply says something, so a failure before
        // that can still move to the next account without the reader noticing.
        const held: Parameters<typeof out.push>[0][] = [];
        let flowing = false;
        for await (const event of source) {
          if (!flowing) {
            if (
              event.type === 'error' &&
              !last &&
              !options?.signal?.aborted &&
              ACCOUNT_ERROR.test(event.error.errorMessage ?? '')
            ) {
              coolDown(id, event.error.errorMessage);
              break;
            }
            if (
              event.type !== 'error' &&
              event.type !== 'done' &&
              !said(event.partial.content)
            ) {
              held.push(event);
              continue;
            }
            for (const e of held) out.push(e);
            flowing = true;
          }
          out.push(event);
        }
        if (!flowing) continue;
        out.end(await source.result());
        return;
      }
    })().catch(async (error) => {
      console.error('[accounts]', error);
      const failed = await lazyStream(model, () =>
        Promise.reject(error),
      ).result();
      out.push({ type: 'error', reason: 'error', error: failed });
      out.end(failed);
    });
    return out;
  };
}
