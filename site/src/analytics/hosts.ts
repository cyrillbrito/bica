// The PostHog hosts for one project, shared by the page script (PostHog.astro)
// and the Worker that relays it (relay.ts).

export const defaultHost = 'https://eu.i.posthog.com';

// The path on bica.sh that the Worker relays to PostHog. Blockers match
// names such as /posthog or /analytics, so it borrows the app's word.
export const relayPath = '/relay';

// PostHog Cloud serves events, its scripts, and its app from three hosts. Any
// other host, such as a self-hosted PostHog or a fake one in a test, serves all
// three itself.
export function posthogHosts(host: string) {
  const origin = new URL(host || defaultHost).origin;
  const cloud = /^https:\/\/(eu|us)\.i\.posthog\.com$/.exec(origin)?.[1];
  return {
    ingest: origin,
    assets: cloud ? `https://${cloud}-assets.i.posthog.com` : origin,
    app: cloud ? `https://${cloud}.posthog.com` : origin,
  };
}
