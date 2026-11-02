import { scrubSecrets, TAILNET_HOST } from '@bica/shared/telemetry';

import { pageOf } from '../router';

// What PostHog sees instead of this Bica's address, which is often the
// machine's tailnet name.
export const HOST = 'bica';
const ORIGIN = `http://${HOST}`;

// The pages named by their first segment (routes/), so anything else is the
// not-found page and its path stays home.
const NAMED: Record<string, string> = {
  '': 'home',
  hub: 'hub',
  settings: 'settings',
  lab: 'lab',
  ui: 'ui',
};
const BY_ID = { s: 'session', t: 'terminal', p: 'workspace' } as const;

export type PageKind =
  | (typeof BY_ID)[keyof typeof BY_ID]
  | 'home'
  | 'hub'
  | 'settings'
  | 'lab'
  | 'ui'
  | 'not_found';

/** A page's kind and its route pattern, such as `/s/:id`, with no ids or query. */
export function pageInfo(pathname: string): { kind: PageKind; path: string } {
  const page = pageOf({ pathname, search: '' });
  if (page.kind !== 'other')
    return { kind: BY_ID[page.kind], path: `/${page.kind}/:id` };
  const named = NAMED[page.name];
  if (!named) return { kind: 'not_found', path: '/:unknown' };
  return { kind: named as PageKind, path: `/${page.name}` };
}

/** A URL as PostHog may see it: this Bica's pages as route patterns, others by their origin. */
export function scrubUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url, location.origin);
  } catch {
    return scrubText(url);
  }
  if (parsed.origin !== location.origin && parsed.origin !== ORIGIN)
    return scrubText(parsed.origin);
  return `${ORIGIN}${pageInfo(parsed.pathname).path}`;
}

// A path on this Bica: Bica's own code as it is (stack frames), pages as
// route patterns, and anything else, such as a file link, as unknown.
function scrubPath(path: string) {
  // The query goes, a stack frame's `:line:column` stays.
  const clean = path.replace(/[?#][^:]*/, '');
  if (/^\/(?:assets|src|node_modules|@id|@vite|@solid[\w-]*)\//.test(clean))
    return clean;
  // Vite serves code outside the client folder by its full path.
  const fs = /^\/@fs\/.*?\/((?:node_modules|client|shared)\/.*)$/.exec(clean);
  if (fs) return `/@fs/bica/${fs[1]}`;
  return pageInfo(clean).path;
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Text safe to send: this Bica's address as `http://bica`, its pages as
 * route patterns, and no home folder, tailnet name, email, or key.
 */
export function scrubText(text: string, max = 2000) {
  let out = text.split(location.origin).join(ORIGIN);
  // The host alone, as in `$host` or a message; not inside a longer name.
  if (location.host)
    out = out.replace(
      new RegExp(`(?<![\\w.-])${escape(location.host)}(?![\\w-])`, 'g'),
      HOST,
    );
  out = out.replace(
    /http:\/\/bica(\/[^\s"'`<>)]*)?/g,
    (_, path: string | undefined) => `${ORIGIN}${path ? scrubPath(path) : ''}`,
  );
  return scrubSecrets(out, max);
}

// What autocapture may keep of a clicked element: where it sits, never
// its text or attributes.
const ELEMENT_KEYS = new Set(['tag_name', 'nth_child', 'nth_of_type']);

function scrubValue(key: string, value: unknown): unknown {
  if (/(?:^|[$_])title$/.test(key) || key === '$el_text') return undefined;
  if (typeof value === 'string') {
    if (/(?:referrer|referring_domain)$/.test(key)) return '$direct';
    if (/(?:url|href)$/i.test(key)) return scrubUrl(value);
    if (key.endsWith('pathname')) return pageInfo(value).path;
    if (key === '$elements_chain')
      return value.replace(
        /(?:attr__[\w-]+|attr_id|href|text)="(?:[^"\\]|\\.)*"/g,
        '',
      );
    return scrubText(value);
  }
  if (key === '$elements' && Array.isArray(value))
    return value.map((el: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(el).filter(([k]) => ELEMENT_KEYS.has(k)),
      ),
    );
  // Heatmaps group clicks by the page's full address.
  if (key === '$heatmap_data' && value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([url, points]) => [scrubUrl(url), points]),
    );
  if (Array.isArray(value)) return value.map((v) => scrubValue('', v));
  if (value && typeof value === 'object') return scrubProperties(value);
  return value;
}

/**
 * A replay's events with this Bica's address taken out: rrweb writes it
 * into the styles' links and posthog-js into its config. Text, values, and
 * links in the page are masked as it records (posthog.ts).
 */
function scrubReplay(value: unknown): unknown {
  if (typeof value === 'string')
    return value.includes(location.host) || value.includes('.ts.net')
      ? value
          .split(location.origin)
          .join(ORIGIN)
          .split(location.host)
          .join(HOST)
          .replace(TAILNET_HOST, '<host>')
      : value;
  if (Array.isArray(value)) return value.map(scrubReplay);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, scrubReplay(v)]),
    );
  return value;
}

/** Every property at every depth, scrubbed as docs/telemetry.md lists. */
export function scrubProperties<T extends object>(properties: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key === '$snapshot_data') {
      out[key] = scrubReplay(value);
      continue;
    }
    const scrubbed = scrubValue(key, value);
    if (scrubbed !== undefined) out[key] = scrubbed;
  }
  return out as T;
}

// Thrown on purpose or by the browser for something the user did or
// denied: not a bug in Bica. ServerError is the server's answer, and the
// server reports its own bugs.
const NOT_BUGS = new Set(['ServerError', 'NotAllowedError', 'AbortError']);

/** Whether an exception PostHog would send is one of Bica's own bugs. */
export function isBug(type: unknown, message: unknown) {
  if (typeof type === 'string' && NOT_BUGS.has(type)) return false;
  // The browser's warning that a resize took two frames, harmless.
  return !(typeof message === 'string' && /ResizeObserver loop/.test(message));
}
