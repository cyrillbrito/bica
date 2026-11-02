import { HOST, RELAY, telemetryOn } from './telemetry';

// PostHog Cloud serves its script from a host of its own.
const ASSETS = HOST.replace(
  /^https:\/\/(eu|us)\.i\.posthog\.com$/,
  'https://$1-assets.i.posthog.com',
);

// Only what PostHog needs to read the body: no cookies, no client address.
const REQUEST_HEADERS = ['content-type', 'content-encoding'];
// Fetch already undid the content encoding, so its header stays behind.
const RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag'];

function pick(headers: Headers, names: string[]) {
  const picked = new Headers();
  for (const name of names) {
    const value = headers.get(name);
    if (value) picked.set(name, value);
  }
  return picked;
}

/**
 * Forwards the browser's posthog-js traffic to PostHog from Bica's own
 * origin, so ad blockers leave it alone and off means off: a 404 then.
 */
export async function relay(req: Request) {
  if (!telemetryOn()) return new Response(null, { status: 404 });
  const url = new URL(req.url);
  const path = url.pathname.slice(RELAY.length) || '/';
  const target = `${path.startsWith('/static/') ? ASSETS : HOST}${path}${url.search}`;
  try {
    const res = await fetch(target, {
      method: req.method,
      headers: pick(req.headers, REQUEST_HEADERS),
      body:
        req.method === 'GET' || req.method === 'HEAD'
          ? undefined
          : await req.arrayBuffer(),
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    return new Response(res.body, {
      status: res.status,
      headers: pick(res.headers, RESPONSE_HEADERS),
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
