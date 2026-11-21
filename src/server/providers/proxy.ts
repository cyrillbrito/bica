import 'server-only';
import {
  createProvider,
  envApiKeyAuth,
  type Api,
  type ImageModel,
  type Model,
} from '@earendil-works/pi-ai';
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy';
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all';

import type {
  PlanUsage,
  PlanWindow,
  ProviderUsage,
  ProxyStatus,
} from '#lib/protocol';
import { credentials } from './credentials';
import { models } from './registry';
import { live } from '#server/live';
import { refreshModels } from './models';
import { OPENAI_IMAGES, openAIImagesApi } from './openai-images';

/*
 * A CLIProxyAPI server as one provider (docs/proxy.md). It holds many plan
 * sign-ins and picks between them, so Bica sends every request to one URL.
 *
 * Its key, URL and management key are one credential in .data/auth.json:
 * the key as the key, the rest in its env.
 */

export const PROXY_ID = 'cliproxy';

interface Config {
  url: string;
  apiKey: string;
  managementKey: string | null;
}

export async function config(): Promise<Config | null> {
  const saved = await credentials.read(PROXY_ID);
  if (saved?.type !== 'api_key' || !saved.key || !saved.env?.URL) return null;
  return {
    url: saved.env.URL,
    apiKey: saved.key,
    managementKey: saved.env.MANAGEMENT_KEY || null,
  };
}

// The proxy's /v1/models gives names only. The details (context, thinking,
// images, price) come from pi-ai's entry for the same name, and that entry
// also picks the wire format: the proxy speaks Claude's, OpenAI's Responses
// and Chat Completions on the same port.
const PLANS = ['anthropic', 'openai-codex', 'openai'] as const;

function template(id: string): Model<Api> | undefined {
  const find = (provider: string, match: (m: Model<Api>) => boolean) =>
    (getBuiltinModels(provider as 'anthropic') as Model<Api>[]).find(match);
  for (const provider of PLANS) {
    const found = find(provider, (m) => m.id === id);
    if (found) return found;
  }
  // Other models usually reach the proxy through OpenRouter, under a short
  // alias without the vendor: kimi-k3 for moonshotai/kimi-k3.
  const other =
    find('openrouter', (m) => m.id.endsWith(`/${id}`)) ??
    find('google', (m) => m.id === id) ??
    find('xai', (m) => m.id === id);
  if (other) return other;
  // A Claude newer than pi-ai's list borrows the newest of its kind.
  const kind = id.match(/^claude-([a-z]+)-/)?.[1];
  const sibling = (getBuiltinModels('anthropic') as Model<Api>[])
    .filter((m) => m.id.startsWith(`claude-${kind}-`) && !/\d{8}$/.test(m.id))
    .at(-1);
  return sibling && { ...sibling, name: titleOf(id) };
}

// claude-haiku-5-5 → Claude Haiku 5.5
const titleOf = (id: string) =>
  id
    .split('-')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/(\d) (?=\d)/g, '$1.');

function toModel(id: string, url: string): Model<Api> {
  // A prefix like work/ pins an account; the model is the same.
  const slash = id.indexOf('/');
  const prefix = slash > 0 ? id.slice(0, slash) : null;
  const bare = prefix ? id.slice(slash + 1) : id;
  const base = template(bare);
  const api = !base
    ? 'openai-completions'
    : base.api === 'anthropic-messages'
      ? 'anthropic-messages'
      : // Only OpenAI's own models are sure to have a Responses endpoint.
        base.provider === 'openai' || base.provider === 'openai-codex'
        ? 'openai-responses'
        : 'openai-completions';
  // Fallbacks name other providers, and grammar tools may not survive the
  // proxy's translation to the plan's own endpoint.
  const { allowedFallbackModels: _, ...compat } = (base?.compat ??
    {}) as Record<string, unknown>;
  if (api === 'openai-responses') compat.supportsOpenAIGrammarTools = false;
  const name = base?.name ?? bare;
  return {
    ...(base ?? {
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 16_384,
    }),
    id,
    name: prefix ? `${name} · ${prefix}` : name,
    api,
    provider: PROXY_ID,
    baseUrl: api === 'anthropic-messages' ? url : `${url}/v1`,
    compat,
  } as Model<Api>;
}

// Image models such as gpt-image-2.5 serve /v1/images, not chat. Agents
// reach them through codemode's models.generateImages() (docs/tools.md).
const isImage = (id: string) => id.includes('image');

function toImageModel(id: string, url: string): ImageModel<string> {
  return {
    type: 'image',
    id,
    name: titleOf(id.slice(id.indexOf('/') + 1)).replace(/^Gpt/, 'GPT'),
    api: OPENAI_IMAGES,
    provider: PROXY_ID,
    baseUrl: `${url}/v1`,
    input: ['text', 'image'],
    output: ['image'],
    // Plan sign-ins have no per-token price.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

async function listModels(
  c: Pick<Config, 'url' | 'apiKey'>,
  signal?: AbortSignal,
) {
  const res = await fetch(`${c.url}/v1/models`, {
    headers: { Authorization: `Bearer ${c.apiKey}` },
    redirect: 'error',
    signal: signal ?? AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`The proxy answered HTTP ${res.status}`);
  const body = (await res.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((m) => m.id).sort();
}

export const proxyProvider = createProvider({
  id: PROXY_ID,
  name: 'CLI proxy',
  auth: { apiKey: { ...envApiKeyAuth('CLI proxy key', []), login: undefined } },
  models: [],
  fetchModels: async ({ signal }) => {
    const c = await config();
    if (!c) return [];
    return (await listModels(c, signal)).map((id) =>
      isImage(id) ? toImageModel(id, c.url) : toModel(id, c.url),
    );
  },
  api: {
    'anthropic-messages': anthropicMessagesApi(),
    'openai-responses': openAIResponsesApi(),
    'openai-completions': openAICompletionsApi(),
  },
  images: { [OPENAI_IMAGES]: openAIImagesApi },
});

models.setProvider(proxyProvider);

let modelsError: string | null = null;
const listeners = new Set<() => void>();

export function onProxyChange(listener: () => void) {
  listeners.add(listener);
}

const changed = () => {
  for (const listener of listeners) listener();
};

export async function refreshProxy() {
  const result = await models.refresh({
    providers: [PROXY_ID],
    force: true,
    signal: AbortSignal.timeout(15_000),
  });
  const error = result.errors.get(PROXY_ID);
  modelsError = error ? error.message : null;
  if (error) console.error('[proxy]', error);
  await refreshModels();
  changed();
}

export async function proxyStatus(): Promise<ProxyStatus | null> {
  const c = await config();
  if (!c) return null;
  return {
    url: c.url,
    managementKey: !!c.managementKey,
    models: models.getModels(PROXY_ID).length,
    error: modelsError ?? usageError,
  };
}

const normalize = (url: string) =>
  url.trim().replace(/\/+$/, '').replace(/\/v1$/, '');

/** Checks the URL and keys against the proxy, then saves them. */
export async function saveProxy(input: {
  url: string;
  apiKey: string;
  managementKey: string;
}) {
  const current = await config();
  const url = normalize(input.url);
  if (!/^https?:\/\/[^/]+/.test(url))
    throw new Error('Expected a URL like https://host:8317');
  // Empty keys keep the saved ones, so editing the URL needs no retyping.
  const apiKey = input.apiKey.trim() || current?.apiKey;
  if (!apiKey) throw new Error('Expected the API key');
  const managementKey =
    input.managementKey.trim() || current?.managementKey || null;
  await listModels({ url, apiKey });
  if (managementKey) await management({ url, managementKey }, '/auth-files');
  await credentials.modify(PROXY_ID, async () => ({
    type: 'api_key',
    key: apiKey,
    env: { URL: url, ...(managementKey && { MANAGEMENT_KEY: managementKey }) },
  }));
  usage = [];
  usageError = null;
  checked = 0;
  await refreshProxy();
  void pollProxy(true);
}

export async function removeProxy() {
  await credentials.delete(PROXY_ID);
  usage = [];
  usageError = null;
  modelsError = null;
  await refreshProxy();
}

async function management<T>(
  c: Pick<Config, 'url' | 'managementKey'>,
  path: string,
): Promise<T> {
  const res = await fetch(`${c.url}/v0/management${path}`, {
    headers: { Authorization: `Bearer ${c.managementKey}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401 || res.status === 403)
    throw new Error('The proxy refused the management key');
  if (!res.ok) throw new Error(`Management API: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/*
 * Accounts and their limits. The proxy keeps the rate-limit headers of each
 * account's last reply, so reading /auth-files costs no request to the
 * providers. An account that hasn't answered since the proxy started has no
 * numbers yet.
 */

interface AuthFile {
  auth_index: string;
  provider: string;
  email?: string;
  label?: string;
  status?: string;
  disabled?: boolean;
  unavailable?: boolean;
  priority?: number;
  id_token?: { plan_type?: string };
  quota?: { observed_at?: string; signals?: Record<string, string> } | null;
}

const NAMES: Record<string, string> = {
  claude: 'Claude',
  codex: 'ChatGPT',
  gemini: 'Gemini',
};
// The model names each account serves, matched by the sidebar's footer.
const FAMILIES: Record<string, string> = {
  claude: 'claude',
  codex: 'gpt',
  gemini: 'gemini',
};

const seconds = (value: string | undefined) =>
  value && Number(value) ? Number(value) * 1000 : null;

function claudeWindows(s: Record<string, string>): PlanWindow[] {
  return (
    [
      ['5h', 'Session'],
      ['7d', 'Week'],
      ['overage', 'Extra'],
    ] as const
  ).flatMap(([key, label]) => {
    const used = s[`anthropic-ratelimit-unified-${key}-utilization`];
    if (used === undefined) return [];
    return [
      {
        key,
        label,
        utilization: Number(used),
        resetsAt: seconds(s[`anthropic-ratelimit-unified-${key}-reset`]),
        limited: s[`anthropic-ratelimit-unified-${key}-status`] === 'rejected',
        spent: null,
      },
    ];
  });
}

function codexWindows(s: Record<string, string>): PlanWindow[] {
  return (['primary', 'secondary'] as const).flatMap((key) => {
    const used = s[`x-codex-${key}-used-percent`];
    if (used === undefined) return [];
    const minutes = Number(s[`x-codex-${key}-window-minutes`]);
    return [
      {
        key,
        label:
          minutes === 300
            ? 'Session'
            : minutes === 10_080
              ? 'Week'
              : `${Math.round(minutes / 60)}h`,
        utilization: Number(used) / 100,
        resetsAt: seconds(s[`x-codex-${key}-reset-at`]),
        limited: Number(used) >= 100,
        spent: null,
      },
    ];
  });
}

function toUsage(file: AuthFile): ProviderUsage {
  const signals = Object.fromEntries(
    Object.entries(file.quota?.signals ?? {}).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ]),
  );
  const plan = file.id_token?.plan_type;
  const state = file.disabled
    ? 'Off'
    : file.unavailable
      ? 'Cooling down'
      : null;
  return {
    id: `${PROXY_ID}:${file.auth_index}`,
    provider: PROXY_ID,
    family: FAMILIES[file.provider] ?? file.provider,
    name: `${NAMES[file.provider] ?? file.provider} · ${file.email ?? file.label ?? file.auth_index}`,
    plan:
      [plan && plan[0]!.toUpperCase() + plan.slice(1), state]
        .filter(Boolean)
        .join(' · ') || null,
    windows:
      file.provider === 'claude'
        ? claudeWindows(signals)
        : file.provider === 'codex'
          ? codexWindows(signals)
          : [],
    updatedAt: Date.parse(file.quota?.observed_at ?? '') || Date.now(),
  };
}

let usage: ProviderUsage[] = [];
let usageError: string | null = null;
let checked = 0;

/** Reads the accounts at most once a minute, or every 5 seconds when `now`. */
async function pollProxy(now = false) {
  if (Date.now() - checked < (now ? 5_000 : 60_000)) return;
  checked = Date.now();
  const c = await config();
  // The proxy was down when the server started: try its models again.
  if (c && !models.getModels(PROXY_ID).length) await refreshProxy();
  if (!c?.managementKey) {
    const had = usage.length;
    usage = [];
    if (had) changed();
    return;
  }
  try {
    const { files } = await management<{ files: AuthFile[] }>(c, '/auth-files');
    usage = files
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map(toUsage);
    usageError = null;
  } catch (error) {
    usageError = error instanceof Error ? error.message : String(error);
    console.error('[proxy]', error);
  }
  changed();
}

/** The proxy's accounts and their limits, read once a minute while watched. */
const feed = live(
  async (): Promise<PlanUsage> => usage,
  () => {
    void pollProxy();
    const timer = setInterval(() => void pollProxy(), 60_000);
    return () => clearInterval(timer);
  },
);
onProxyChange(() => void feed.refresh());

export const watchPlanUsage = feed.watch;

/** The plans' limits, read at most a minute ago, for jobs nobody watches. */
export async function planUsageNow() {
  await pollProxy();
  return usage;
}

// The proxy's models come from the network; sessions on them resume after.
export const proxyReady = Promise.resolve().then(refreshProxy);
