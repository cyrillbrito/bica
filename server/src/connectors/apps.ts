import type {
  AppChoice,
  ConnectedApp,
  Connectors,
} from '@bica/shared/protocol';
import { live } from '../live';
import {
  composio,
  composioKey,
  inSession,
  removeKey,
  saveKey,
  toolkitInfo,
  userId,
} from './composio';

// The apps connected through Composio, for Settings and the prompt.

type Account = {
  id: string;
  status: string;
  toolkit?: { slug?: string };
  created_at?: string;
};

// A sign-in link nobody finished stays INITIATED until Composio expires it.
const STALE_LINK_MS = 30 * 60_000;

async function listApps(): Promise<ConnectedApp[]> {
  const { items = [] } = await composio<{ items?: Account[] }>(
    '/connected_accounts',
    { query: { user_ids: await userId(), limit: 100 } },
  );
  const apps = await Promise.all(
    items.map(async (a): Promise<ConnectedApp | undefined> => {
      const toolkit = a.toolkit?.slug;
      const createdAt = a.created_at ? Date.parse(a.created_at) : 0;
      if (!toolkit) return undefined;
      if (
        ['INITIALIZING', 'INITIATED'].includes(a.status) &&
        Date.now() - createdAt > STALE_LINK_MS
      )
        return undefined;
      const info = await toolkitInfo(toolkit);
      return {
        id: a.id,
        toolkit,
        name: info?.name ?? toolkit,
        logo: info?.meta?.logo ?? null,
        status: a.status,
        createdAt,
      };
    }),
  );
  return apps.filter((a) => !!a).sort((a, b) => a.name.localeCompare(b.name));
}

async function read(): Promise<Connectors> {
  const key = await composioKey();
  if (!key) return { keyHint: null, apps: [], error: null };
  // Its last characters tell which key it is, as Providers shows them.
  const keyHint = key.slice(-4);
  try {
    return { keyHint, apps: await listApps(), error: null };
  } catch (error) {
    return {
      keyHint,
      apps: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// After Connect, look often until the sign-in lands.
let linkedAt = 0;
const LINK_WINDOW_MS = 10 * 60_000;

const feed = live(read, (refresh) => {
  const timer = setInterval(() => {
    if (Date.now() - linkedAt < LINK_WINDOW_MS) refresh();
  }, 3_000);
  const slow = setInterval(refresh, 60_000);
  return () => {
    clearInterval(timer);
    clearInterval(slow);
  };
});

export const watchConnectors = feed.watch;

/** Saves or removes the Composio key; another key may reach other apps. */
export async function setKey(key: string | null) {
  if (key === null) await removeKey();
  else await saveKey(key);
  taken = undefined;
  await feed.refresh();
}

export async function searchToolkits(search: string): Promise<AppChoice[]> {
  const { items = [] } = await composio<{
    items?: { slug: string; name?: string; meta?: { logo?: string } }[];
  }>('/toolkits', { query: { search: search.trim() || undefined, limit: 20 } });
  return items.map((t) => ({
    slug: t.slug,
    name: t.name ?? t.slug,
    logo: t.meta?.logo ?? null,
  }));
}

/** Starts connecting an app; returns the sign-in page. */
export async function connectApp(toolkit: string) {
  const link = await inSession<{ redirect_url: string }>('/link', {
    method: 'POST',
    body: { toolkit },
  });
  linkedAt = Date.now();
  void feed.refresh();
  return link.redirect_url;
}

export async function disconnectApp(id: string) {
  await composio(`/connected_accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    query: { revoke_on_delete: 'true' },
  });
  taken = undefined;
  await feed.refresh();
}

// The prompt's list, read at most this often: every new session takes it.
let taken: { at: number; text: Promise<string> } | undefined;
const TAKEN_MS = 60_000;

/**
 * The connected apps line for the prompt, or '' without a key. Taken at a
 * session's first prompt and after each compaction, like the memory index,
 * so it never breaks the prompt cache (server/src/sessions/prompts.ts).
 */
export function connectedAppsLine(): Promise<string> {
  if (taken && Date.now() - taken.at < TAKEN_MS) return taken.text;
  const text = (async () => {
    if (!(await composioKey())) return '';
    try {
      const names = (await listApps())
        .filter((a) => a.status === 'ACTIVE')
        .map((a) => a.name);
      return names.length
        ? `Connected apps: ${[...new Set(names)].join(', ')}.`
        : 'No app is connected yet.';
    } catch {
      return "Composio didn't answer when this session started, so which apps are connected is unknown: search to find out.";
    }
  })();
  taken = { at: Date.now(), text };
  return text;
}
