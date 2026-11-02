import { useLocation } from '@solidjs/router';
import { createEffect, createMemo } from 'solid-js';

import type { TelemetryConfig } from '@bica/shared/protocol';
import { openFromSearch } from '../files/files';
import { hideThinking } from '../sessions/thinking';
import { useTopicWhenReady } from '../socket/socket';
import { motion } from '../ui/motion';
import { soundOn } from '../ui/sound';
import { theme } from '../ui/theme';
import type { EventName, Events } from './events';
import { isBug, pageInfo } from './scrub';

type PostHog = typeof import('./posthog');

/**
 * Whether telemetry is on, and why not, with what posthog-js needs: the key,
 * the relay, and the install id (docs/telemetry.md). Undefined until the
 * server answers, never an old copy.
 */
export function useTelemetry() {
  return useTopicWhenReady('telemetry', () => ({}));
}

// Set while telemetry is on and posthog-js has loaded; until then, and
// once it's off, events go nowhere.
let client: PostHog | undefined;
let wanted: TelemetryConfig | undefined;
let loading: Promise<PostHog> | undefined;

async function turnOn(config: TelemetryConfig) {
  wanted = config;
  loading ??= import('./posthog');
  const posthog = await loading;
  await posthog.prepare(config);
  // Turned off, or changed again, while it loaded.
  if (wanted !== config) return;
  posthog.turnOn(config);
  const first = !client;
  client = posthog;
  if (first) posthog.pageview(location.pathname);
}

function turnOff() {
  wanted = undefined;
  client?.turnOff();
  client = undefined;
}

/** Sends one of the browser's events (events.ts), if telemetry is on. */
export function track<E extends EventName>(
  event: E,
  ...[properties]: Events[E] extends Record<string, never> ? [] : [Events[E]]
) {
  client?.capture(event, properties);
}

const reported = new WeakSet<object>();

/**
 * Sends an error an error boundary caught, if it's one of Bica's own bugs,
 * once. Returns it, so a boundary can pass it on to `Failed`.
 */
export function reportError<T>(error: T): T {
  if (error && typeof error === 'object') {
    if (reported.has(error)) return error;
    reported.add(error);
  }
  const type = error instanceof Error ? error.name : undefined;
  const message = error instanceof Error ? error.message : String(error);
  if (client && isBug(type, message)) client.captureException(error);
  return error;
}

/**
 * Starts posthog-js while the server says telemetry is on, and stops it the
 * moment it says off. Sends a page view per page, and the opens and setting
 * changes that happen in many places. Renders nothing.
 */
export function Telemetry() {
  const telemetry = useTelemetry();
  const location = useLocation();

  const on = createMemo(
    () => {
      const config = telemetry();
      return config && !config.off && config.key && config.installId
        ? config
        : undefined;
    },
    { name: 'telemetryOn' },
  );
  createEffect(on, (config) => {
    if (config) void turnOn(config).catch(() => {});
    else turnOff();
  });

  // One page view per page: a session, a workspace, Settings. A file opened
  // over it isn't another page.
  const page = createMemo(
    () => ({
      pathname: location.pathname,
      w: new URLSearchParams(location.search).get('w'),
    }),
    {
      name: 'telemetryPage',
      equals: (a, b) => a.pathname === b.pathname && a.w === b.w,
    },
  );
  createEffect(page, ({ pathname }) => client?.pageview(pathname), {
    defer: true,
  });

  // A diff that moves from Changes to Staged as it's viewed is still one open.
  const opened = createMemo(
    () => ({
      open: openFromSearch(location.search),
      pathname: location.pathname,
    }),
    {
      name: 'telemetryOpened',
      equals: (a, b) =>
        a.open?.path === b.open?.path &&
        (a.open?.view === 'file') === (b.open?.view === 'file'),
    },
  );
  createEffect(
    opened,
    ({ open, pathname }) => {
      if (!open) return;
      const page_kind = pageInfo(pathname).kind;
      if (open.view === 'file') track('file_open', { page_kind });
      else track('diff_open', { page_kind, view: open.view });
    },
    { defer: true },
  );

  // Settings kept on this device change from Settings, the sidebar's menu,
  // and ⌘K; watching them is one place for all.
  createEffect(theme, (t) => track('theme_change', { theme: t }), {
    defer: true,
  });
  createEffect(
    motion,
    (m) => track('setting_change', { setting: 'motion', value: m }),
    { defer: true },
  );
  createEffect(
    soundOn,
    (on) => track('setting_change', { setting: 'sounds', value: String(on) }),
    { defer: true },
  );
  createEffect(
    hideThinking,
    (on) =>
      track('setting_change', { setting: 'hideThinking', value: String(on) }),
    { defer: true },
  );

  return null;
}
