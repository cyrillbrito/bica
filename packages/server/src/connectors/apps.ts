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
  // The id Composio's session tools name the account by: gmail_asop-nodus.
  word_id?: string;
  // Composio fills displayName with the app's own name for the sign-in, such
  // as the Gmail address, once the connection is active.
  data?: { displayName?: string };
  state?: { val?: { displayName?: string } };
};

// A sign-in link nobody finished stays INITIATED until Composio expires it.
const STALE_LINK_MS = 30 * 60_000;

async function listAccounts() {
  const { items = [] } = await composio<{ items?: Account[] }>(
    '/connected_accounts',
    { query: { user_ids: await userId(), limit: 100 } },
  );
  return items;
}

function accountName(a: Account) {
  return a.state?.val?.displayName ?? a.data?.displayName ?? null;
}

/**
 * The sign-in an account id stands for, such as a Gmail address, for the
 * approval card; Composio's session tools name accounts by word id.
 */
export async function accountNamed(id: string) {
  try {
    const found = (await listAccounts()).find(
      (a) => a.word_id === id || a.id === id,
    );
    return found ? accountName(found) : null;
  } catch {
    return null;
  }
}

async function listApps(): Promise<ConnectedApp[]> {
  const items = await listAccounts();
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
        account: accountName(a),
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
      // Each app once, with the accounts it's signed in as, so the agent
      // knows when an app has several: Gmail (ana@example.com, ana@work.com).
      const accounts = new Map<string, string[]>();
      for (const a of await listApps())
        if (a.status === 'ACTIVE')
          accounts.set(a.name, [
            ...(accounts.get(a.name) ?? []),
            ...(a.account ? [a.account] : []),
          ]);
      const names = [...accounts].map(([name, signIns]) =>
        signIns.length ? `${name} (${signIns.join(', ')})` : name,
      );
      return names.length
        ? `Connected apps: ${names.join(', ')}.`
        : 'No app is connected yet.';
    } catch {
      return "Composio didn't answer when this session started, so which apps are connected is unknown: search to find out.";
    }
  })();
  taken = { at: Date.now(), text };
  return text;
}
