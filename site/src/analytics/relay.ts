// The Worker in front of the site's static files. It only runs for the relay
// path (wrangler.jsonc), and forwards it to PostHog so blockers that match
// PostHog's hosts still let the site's events through. Adapted from PostHog's
// Cloudflare proxy: posthog.com/docs/advanced/proxy/cloudflare

import { posthogHosts, relayPath } from './hosts';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  // The project's PostHog host, given by the deploy script.
  POSTHOG_HOST?: string;
}

interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${relayPath}/`))
      return env.ASSETS.fetch(request);

    const hosts = posthogHosts(env.POSTHOG_HOST ?? '');
    const path = url.pathname.slice(relayPath.length) + url.search;
    if (path.startsWith('/static/') || path.startsWith('/array/')) {
      return asset(request, `${hosts.assets}${path}`, ctx);
    }

    const headers = new Headers(request.headers);
    headers.delete('cookie');
    // Capture sends the public project key as a bearer token; any other
    // credential stays here.
    if (!headers.get('authorization')?.startsWith('Bearer phc_'))
      headers.delete('authorization');
    // Cookieless mode counts visitors by a hash that includes their IP, and
    // the country comes from it too.
    headers.set(
      'x-forwarded-for',
      request.headers.get('cf-connecting-ip') ?? '',
    );
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    return fetch(`${hosts.ingest}${path}`, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : null,
    });
  },
};

// PostHog's scripts and remote config, kept in Cloudflare's cache for as long
// as PostHog's own cache headers allow.
async function asset(
  request: Request,
  target: string,
  ctx: Context,
): Promise<Response> {
  const cache = await caches.open('posthog');
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(target);
  if (response.ok) ctx.waitUntil(cache.put(request, response.clone()));
  return response;
}
