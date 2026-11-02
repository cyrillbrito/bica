// A fake PostHog that keeps every request, for tests and for checking by
// hand what Bica sends:
//   bun server/src/testing/posthog.ts [port]
// prints each request as one JSON line. Point BICA_POSTHOG_HOST at it.
import { gunzipSync } from 'node:zlib';

import { startBica, type Tab } from './bica';

export interface Received {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  /** The body, unzipped, parsed when it's JSON. */
  body: unknown;
}

export interface Event {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
  api_key?: string;
}

export type FakePostHog = Awaited<ReturnType<typeof fakePostHog>>;

export async function fakePostHog(
  port = 0,
  onRequest?: (received: Received) => void,
) {
  const requests: Received[] = [];
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port,
    async fetch(req) {
      const url = new URL(req.url);
      let bytes = new Uint8Array(await req.arrayBuffer());
      if (
        req.headers.get('content-encoding') === 'gzip' ||
        url.searchParams.get('compression') === 'gzip-js'
      )
        bytes = gunzipSync(bytes);
      const text = new TextDecoder().decode(bytes);
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {}
      const received = {
        method: req.method,
        path: url.pathname,
        query: url.search,
        headers: Object.fromEntries(req.headers),
        body,
      };
      requests.push(received);
      onRequest?.(received);
      if (url.pathname.startsWith('/static/'))
        return new Response('/* posthog */', {
          headers: { 'content-type': 'application/javascript' },
        });
      return Response.json({ status: 1 });
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    requests,
    /** Every event received so far, from batches and single sends alike. */
    events(): Event[] {
      return requests.flatMap(({ body }) => {
        if (!body || typeof body !== 'object') return [];
        const { batch, api_key } = body as {
          batch?: Event[];
          api_key?: string;
        };
        const list = batch ?? (Array.isArray(body) ? body : [body]);
        return (list as Event[])
          .filter((e) => typeof e?.event === 'string')
          .map((e) => ({ api_key, ...e }));
      });
    },
    stop: () => server.stop(true),
  };
}

if (import.meta.main) {
  const fake = await fakePostHog(Number(process.argv[2] ?? 0), (received) =>
    console.log(JSON.stringify(received)),
  );
  console.log(`fake PostHog on ${fake.url}`);
}

/**
 * Starts Bica with `env` against a fake PostHog, then does what would send
 * something: opens a tab, fetches the relay, and hits a bug. Resolves once
 * Bica stopped, with what PostHog received.
 */
export async function useBicaWith(
  env: (host: string) => Record<string, string>,
) {
  const posthog = await fakePostHog();
  const bica = await startBica({ env: env(posthog.url) });
  const tab = await bica.connect();
  const config = await tab.watch('telemetry', {}).until(() => true);
  const relay = await fetch(`http://127.0.0.1:${bica.port}/relay/e/`, {
    method: 'POST',
    body: '{"event":"from_the_browser"}',
  });
  await causeBug(tab);
  await bica.stop();
  await posthog.stop();
  return { config, relay: relay.status, requests: posthog.requests };
}

/** Sends a request the typed browser never sends, which fails inside Bica with a TypeError. */
export async function causeBug(tab: Tab) {
  const failed = await tab.request('session.submit', {} as never).then(
    () => false,
    () => true,
  );
  if (!failed) throw new Error('The bug is fixed: find another one to cause');
}
