// Usage data and Bica's own errors, sent to PostHog (docs/telemetry.md).
// The rest of the server calls `track` and `captureError`, which do nothing
// while telemetry is off and never throw.
import { arch, platform } from 'node:os';
import { PostHog } from 'posthog-node';

import type { InstallKind, TelemetryConfig } from '@bica/shared/protocol';
import { live } from '../live';
import { settings } from '../settings';
import { jsonFile } from '../storage';
import type { ErrorProperties, EventName, Events } from './events';
import { scrubDeep, scrubError } from './scrub';

// Read once. The `bica` binary has both built in (server/cli/build.ts), so
// forks and dev runs only report where their own environment says.
const KEY = process.env.BICA_POSTHOG_KEY || '';
/** Where events go: PostHog's ingest host, EU cloud unless set. */
export const HOST = (
  process.env.BICA_POSTHOG_HOST || 'https://eu.i.posthog.com'
).replace(/\/+$/, '');

/** Where posthog-js sends from the browser; serve.ts relays it to `HOST`. */
export const RELAY = '/relay';

type Off = TelemetryConfig['off'];

// What only a restart changes: the key and the environment.
const fixedOff: Off = !KEY
  ? 'no-key'
  : said(process.env.DO_NOT_TRACK)
    ? 'DO_NOT_TRACK'
    : process.env.BICA_TELEMETRY !== undefined &&
        !said(process.env.BICA_TELEMETRY)
      ? 'BICA_TELEMETRY'
      : null;

/** Whether a yes/no environment variable says yes, the way DO_NOT_TRACK=1 does. */
function said(value: string | undefined) {
  return !!value && !/^(0|false|no|off)$/i.test(value.trim());
}

function off(): Off {
  if (fixedOff) return fixedOff;
  try {
    return settings().telemetry ? null : 'setting';
  } catch {
    // An unreadable settings.json sends nothing.
    return 'setting';
  }
}

export function telemetryOn() {
  return !off();
}

/** Off until a restart: no key, or the environment said no. */
export function offForGood() {
  return !!fixedOff;
}

// One random id per data folder: the PostHog person for this install.
const file = jsonFile<{ installId?: string; noticeShown?: boolean }>(
  'telemetry.json',
  { initial: () => ({}) },
);
let id: string | undefined;
let newInstall = false;

/** The install id, made and saved on first use. */
function installId() {
  if (id) return id;
  const saved = file.read().installId;
  if (saved) return (id = saved);
  const made = (id = crypto.randomUUID());
  newInstall = true;
  void file
    .update((draft) => void (draft.installId ??= made))
    .catch((error) => console.error('[telemetry]', error));
  return made;
}

/** What a session or run id becomes before it's sent, so it can't be matched to the data. */
export function hashId(raw: string) {
  // Callers hash before `track` drops the event, and an install id is only
  // made while telemetry is on.
  if (off()) return '';
  return new Bun.CryptoHasher('sha256')
    .update(`${installId()}:${raw}`)
    .digest('hex')
    .slice(0, 16);
}

let about: { version: string; installKind: InstallKind } = {
  version: '0.0.0-dev',
  installKind: 'dev',
};

function superProperties() {
  return {
    app: 'bica',
    bica_version: about.version,
    install_kind: about.installKind,
    os: platform(),
    arch: arch(),
  };
}

let client: PostHog | undefined;

function posthog() {
  return (client ??= new PostHog(KEY, {
    host: HOST,
    // Its own handlers would send errors unscrubbed, and wait 30 seconds on
    // a crash; startTelemetry installs Bica's.
    enableExceptionAutocapture: false,
    fetchRetryCount: 1,
    before_send: (event) =>
      event && {
        ...event,
        properties: scrubDeep(cleanException(event.properties)),
      },
  }));
}

type Frame = Record<string, unknown>;
type Exception = {
  mechanism?: { handled?: boolean };
  stacktrace?: { frames?: Frame[] };
};

/**
 * Drops the source lines posthog-node reads around each frame, which could
 * be any file's, and marks crashes as unhandled: captureException can't.
 */
function cleanException(properties: Record<string, unknown> = {}) {
  const list = properties.$exception_list as Exception[] | undefined;
  if (!list) return properties;
  const crashed = /^(uncaught_exception|unhandled_rejection)$/.test(
    String(properties.source),
  );
  return {
    ...properties,
    $exception_list: list.map((exception) => ({
      ...exception,
      mechanism: { ...exception.mechanism, handled: !crashed },
      stacktrace: exception.stacktrace && {
        ...exception.stacktrace,
        frames: exception.stacktrace.frames?.map(
          ({ pre_context: _, context_line: __, post_context: ___, ...frame }) =>
            frame,
        ),
      },
    })),
  };
}

/** Sends an event from the catalog in events.ts. */
export function track<E extends EventName>(event: E, properties: Events[E]) {
  try {
    if (off()) return;
    posthog().capture({
      distinctId: installId(),
      event,
      properties: { ...superProperties(), ...properties },
    });
  } catch (error) {
    console.error('[telemetry]', error);
  }
}

const sent = new WeakSet<Error>();

/**
 * Sends one of Bica's own errors, a bug in its code, scrubbed. A tool's,
 * git's, or a provider's failure is not one: tool events count those.
 */
export function captureError(error: unknown, properties: ErrorProperties) {
  try {
    if (off()) return;
    // A request resent after a reconnect fails with the same error again.
    if (error instanceof Error) {
      if (sent.has(error)) return;
      sent.add(error);
    }
    posthog().captureException(scrubError(error), installId(), {
      ...superProperties(),
      ...properties,
    });
  } catch (error) {
    console.error('[telemetry]', error);
  }
}

/**
 * Whether a failure is a bug in Bica rather than the user's or the world's:
 * a TypeError, ReferenceError, or RangeError from Bica's own code. System
 * errors (a missing file, a refused connection) carry a `code` and aren't.
 */
export function isBug(error: unknown) {
  return (
    (error instanceof TypeError ||
      error instanceof ReferenceError ||
      error instanceof RangeError) &&
    !('code' in error)
  );
}

/** Sends what's queued, waiting at most `ms`, so quitting never hangs on it. */
export async function shutdownTelemetry(ms = 1000) {
  if (!client) return;
  await Promise.race([client.shutdown(ms).catch(() => {}), Bun.sleep(ms)]);
}

/**
 * Sends `server_start`, and reports crashes. serve.ts calls it once its port
 * is taken; the CLI says which build this is.
 */
export function startTelemetry(build?: {
  version: string;
  installKind: InstallKind;
}) {
  if (build) about = build;
  // Off for good: the process dies exactly as it would without Bica.
  if (fixedOff) return;
  let dying = false;
  // With a listener, the runtime no longer exits on its own, so this
  // prints and exits 1 the way it would, after a short flush.
  const crash = (source: ErrorProperties['source']) => (error: unknown) => {
    console.error(error);
    if (dying) return;
    dying = true;
    captureError(error, { source });
    void shutdownTelemetry().finally(() => process.exit(1));
  };
  process.on('uncaughtException', crash('uncaught_exception'));
  process.on('unhandledRejection', crash('unhandled_rejection'));
  if (!telemetryOn()) return;
  installId();
  track('server_start', { is_new_install: newInstall });
}

/**
 * True once per data folder, the first time it starts with telemetry on;
 * the CLI prints its notice then.
 */
export async function noticeDue() {
  try {
    if (off() || file.read().noticeShown) return false;
    const made = installId();
    await file.update((draft) => {
      draft.installId ??= made;
      draft.noticeShown = true;
    });
    return true;
  } catch (error) {
    console.error('[telemetry]', error);
    return false;
  }
}

// The PostHog app for an ingest host, for posthog-js's toolbar links.
function uiHost() {
  const cloud = /^https:\/\/(eu|us)\.i\.posthog\.com$/.exec(HOST);
  return cloud ? `https://${cloud[1]}.posthog.com` : HOST;
}

function config(): TelemetryConfig {
  const why = off();
  return {
    off: why,
    key: why ? null : KEY,
    relay: RELAY,
    uiHost: why ? null : uiHost(),
    installId: why ? null : installId(),
    replays: !why && settings().replays,
    version: about.version,
    installKind: about.installKind,
  };
}

const feed = live(async () => config());

export const watchTelemetry = feed.watch;

/** After the telemetry or replays setting changes. */
export function refreshTelemetry() {
  return feed.refresh();
}
