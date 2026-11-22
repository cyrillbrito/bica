import { credentials } from '../models/credentials';
import { jsonFile } from '../storage';

/*
 * Composio's REST API, v3.1 (docs/connectors.md). Composio calls an app
 * integration like Bica's "Platform": a project API key, one user id, and a
 * session whose meta tools search, run, and connect apps. The SDK wraps these
 * same endpoints, so a few fetch calls replace it.
 * https://docs.composio.dev/docs/configuring-sessions
 */

export const COMPOSIO = 'composio';

// Tests point this at a fake Composio.
const API = `${process.env.BICA_COMPOSIO_URL ?? 'https://backend.composio.dev'}/api/v3.1`;

// Composio asks before any tool hinted to create, update, or delete, and its
// remote workbench and bash are off: Bica has code mode and bash, and
// Composio says scripts there can slip past approvals.
const SESSION_CONFIG = {
  workbench: { enable: false },
  tags: { require_approval: ['createHint', 'updateHint', 'destructiveHint'] },
};

type Saved = {
  // Composio keeps connections per user id; Bica has one user.
  userId?: string;
  // Reused, as Composio recommends, until the key or the config changes.
  session?: { id: string; key: string; config: string };
};
const file = jsonFile<Saved>('composio.json', { initial: () => ({}) });

// The key is saved with the providers' keys in auth.json, though Composio
// isn't one: Settings shows it in Connected apps.
export async function composioKey() {
  const saved = await credentials.read(COMPOSIO);
  return saved?.type === 'api_key' ? saved.key : undefined;
}

/** Saves the key once Composio accepts it. */
export async function saveKey(key: string) {
  key = key.trim();
  if (!key) throw new Error('Expected a key');
  const response = await fetch(`${API}/connected_accounts?limit=1`, {
    headers: { 'x-api-key': key },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 401 || response.status === 403)
    throw new Error(
      key.startsWith('ak_')
        ? 'Composio refused this key'
        : "Composio refused this key. Use a project API key, which starts with ak_, from your project's Settings → API Keys.",
    );
  if (!response.ok)
    throw new Error(`Composio didn't answer (${response.status}); try again`);
  await credentials.modify(COMPOSIO, async () => ({ type: 'api_key', key }));
}

export async function removeKey() {
  await credentials.delete(COMPOSIO);
}

export class ComposioError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Request = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: object;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
};

export async function composio<T>(
  path: string,
  { method = 'GET', body, query, signal }: Request = {},
): Promise<T> {
  const key = await composioKey();
  if (!key)
    throw new Error(
      'No Composio key: the user can add one in Bica under Settings → Connected apps',
    );
  const url = new URL(`${API}${path}`);
  for (const [name, value] of Object.entries(query ?? {}))
    if (value !== undefined) url.searchParams.set(name, String(value));
  const timeout = AbortSignal.timeout(120_000);
  const response = await fetch(url, {
    method,
    headers: {
      'x-api-key': key,
      ...(body && { 'content-type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const text = await response.text();
  if (!response.ok)
    throw new ComposioError(
      `Composio ${method} ${path} failed (${response.status}): ${text.slice(0, 300)}`,
      response.status,
    );
  return (text ? JSON.parse(text) : null) as T;
}

/** The one user Composio keeps this Bica's connections under. */
export async function userId() {
  const saved = file.read().userId;
  if (saved) return saved;
  const id = `bica-${crypto.randomUUID()}`;
  await file.update((draft) => void (draft.userId = draft.userId ?? id));
  return file.read().userId!;
}

let creating: Promise<string> | undefined;

async function sessionId() {
  const key = await composioKey();
  const keyId = key ? String(Bun.hash(key)) : '';
  const config = JSON.stringify(SESSION_CONFIG);
  const saved = file.read().session;
  if (saved && saved.key === keyId && saved.config === config) return saved.id;
  creating ??= (async () => {
    const created = await composio<{ session_id: string }>(
      '/tool_router/session',
      {
        method: 'POST',
        body: { user_id: await userId(), ...SESSION_CONFIG },
      },
    );
    await file.update((draft) => {
      draft.session = { id: created.session_id, key: keyId, config };
    });
    return created.session_id;
  })().finally(() => (creating = undefined));
  return creating;
}

/** A call on the session, made again on a new one if Composio forgot it. */
export async function inSession<T>(
  path: string,
  request: Request = {},
): Promise<T> {
  const id = await sessionId();
  try {
    return await composio<T>(`/tool_router/session/${id}${path}`, request);
  } catch (error) {
    if (!(error instanceof ComposioError) || error.status !== 404) throw error;
    await file.update((draft) => void delete draft.session);
    return composio<T>(
      `/tool_router/session/${await sessionId()}${path}`,
      request,
    );
  }
}

/** An MCP-style question Composio asks before a gated tool runs. */
export type InputRequest = {
  type?: string;
  message?: string;
  requested_schema?: {
    properties?: Record<
      string,
      { title?: string; oneOf?: { const: string; title?: string }[] }
    >;
  };
};

export type InputResponse =
  | { action: 'accept'; content: Record<string, string> }
  | { action: 'cancel' | 'decline' };

export type MetaResult =
  | {
      result_type?: 'completed' | 'failed';
      data?: unknown;
      error?: string | null;
      log_id?: string;
    }
  | { result_type: 'blocked'; reason?: string; message?: string }
  | {
      result_type: 'input_required';
      input_requests: Record<string, InputRequest>;
      request_state: string;
    };

/** Runs one of the session's meta tools. */
export function executeMeta(
  slug: string,
  args: object,
  signal?: AbortSignal,
  answers?: {
    input_responses: Record<string, InputResponse>;
    request_state: string;
  },
) {
  return inSession<MetaResult>('/execute_meta', {
    method: 'POST',
    body: { slug, arguments: args, ...answers },
    signal,
  });
}

type ToolInfo = {
  tags?: string[];
  toolkit?: { slug?: string; name?: string; logo?: string };
};
const tools = new Map<string, Promise<ToolInfo | null>>();

/** A tool's hints and app, kept once read; null when Composio doesn't say. */
export function toolInfo(slug: string) {
  let info = tools.get(slug);
  if (!info) {
    info = composio<ToolInfo>(`/tools/${encodeURIComponent(slug)}`).catch(
      () => {
        tools.delete(slug);
        return null;
      },
    );
    tools.set(slug, info);
  }
  return info;
}

type ToolkitInfo = { slug: string; name?: string; meta?: { logo?: string } };
const toolkits = new Map<string, Promise<ToolkitInfo | null>>();

/** An app's name and logo, kept once read. */
export function toolkitInfo(slug: string) {
  let info = toolkits.get(slug);
  if (!info) {
    info = composio<ToolkitInfo>(`/toolkits/${encodeURIComponent(slug)}`).catch(
      () => {
        toolkits.delete(slug);
        return null;
      },
    );
    toolkits.set(slug, info);
  }
  return info;
}
