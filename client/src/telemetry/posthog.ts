// posthog-js, loaded only once telemetry is on (telemetry.ts). The build
// that never fetches a script: its extensions come bundled from here, so
// nothing from PostHog's servers runs in the app.
import posthog from 'posthog-js/no-external';
import 'posthog-js/dist/exception-autocapture';
import 'posthog-js/dist/web-vitals';
import 'posthog-js/dist/dead-clicks-autocapture';
import type { CaptureResult } from 'posthog-js';

import type { TelemetryConfig } from '@bica/shared/protocol';
import { HOST, isBug, pageInfo, scrubProperties, scrubUrl } from './scrub';

// Attributes a replay may keep: layout and state, never a value, label,
// link, or title, which can hold paths and session titles. rrweb's own
// (`_cssText`, `rr_width`) carry the page's styles and blocked sizes.
const SAFE_ATTRIBUTES = new Set([
  'class',
  'style',
  'role',
  'type',
  'tabindex',
  'disabled',
  'hidden',
  'open',
  'inert',
  'popover',
  'dir',
  'lang',
  'rel',
  'media',
  'colspan',
  'rowspan',
  'viewBox',
  'xmlns',
  'd',
  'fill',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'width',
  'height',
  'points',
  'transform',
  'opacity',
]);

function maskAttribute(name: string, value: string) {
  if (
    SAFE_ATTRIBUTES.has(name) ||
    name.startsWith('_') ||
    name.startsWith('rr_') ||
    /^aria-(?:hidden|expanded|selected|checked|pressed|current|disabled)$/.test(
      name,
    ) ||
    /^data-(?:active|on|open|theme|motion)$/.test(name)
  )
    return value;
  return '*';
}

function beforeSend(event: CaptureResult | null) {
  if (!event) return null;
  if (event.event === '$exception') {
    const first = (
      event.properties.$exception_list as
        | { type?: unknown; value?: unknown }[]
        | undefined
    )?.[0];
    if (!isBug(first?.type, first?.value)) return null;
  }
  event.properties = scrubProperties(event.properties);
  if (event.$set) event.$set = scrubProperties(event.$set);
  if (event.$set_once) event.$set_once = scrubProperties(event.$set_once);
  return event;
}

let started = false;
let sending = false;

/** Loads what `turnOn` needs: the recorder only when replays may record, since it's most of the weight. */
export async function prepare(config: TelemetryConfig) {
  if (config.replays) await import('posthog-js/dist/posthog-recorder');
}

/** Starts capturing, or follows a change to the config once started. */
export function turnOn(config: TelemetryConfig) {
  sending = true;
  if (!started) {
    started = true;
    // Every request goes through these two. Opting out stops new events but
    // not what's queued, or a replay's last batch: off means not one more
    // request, so those are dropped, as posthog-js drops rate-limited ones.
    const send = posthog._send_request.bind(posthog);
    const sendRetriable = posthog._send_retriable_request.bind(posthog);
    posthog._send_request = (options) => {
      if (sending) send(options);
    };
    posthog._send_retriable_request = (options, transport) => {
      if (sending) sendRetriable(options, transport);
    };
    posthog.init(config.key!, {
      api_host: new URL(config.relay, location.origin).href,
      ui_host: config.uiHost,
      defaults: '2026-08-30',
      bootstrap: { distinctID: config.installId!, isIdentifiedID: true },
      person_profiles: 'identified_only',
      persistence: 'localStorage',
      // Kept per install, so a new data folder on the same address doesn't
      // keep the old one's id, which `bootstrap` alone would.
      persistence_name: `bica_${config.installId}`,
      // Bica usually runs on localhost, which isn't a test user here.
      internal_or_test_user_hostname: null,
      // Pages are sent by hand, as route patterns (telemetry.ts).
      capture_pageview: false,
      capture_pageleave: true,
      save_referrer: false,
      save_campaign_params: false,
      autocapture: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      capture_heatmaps: true,
      capture_dead_clicks: true,
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      // Attribution would name the slow element by its id and classes.
      capture_performance: {
        network_timing: false,
        web_vitals: true,
        web_vitals_attribution: false,
      },
      // Flags, surveys, tours, and chat aren't used.
      advanced_disable_feature_flags: true,
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_session_recording: !config.replays,
      enable_recording_console_log: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '*',
        maskAttributeFn: maskAttribute,
        // Terminals draw on canvas; images and frames show files.
        blockSelector:
          'img, picture, video, audio, canvas, iframe, object, embed, svg image',
        captureCanvas: { recordCanvas: false },
        recordHeaders: false,
        recordBody: false,
        captureJsonLd: false,
        // Left as plain JSON so `before_send` can take the address out;
        // each request is still gzipped whole.
        compress_events: false,
        // The page's address in the replay's own events, as a route pattern.
        maskCapturedNetworkRequestFn: (request) => ({
          ...request,
          name: scrubUrl(request.name),
        }),
      },
      before_send: beforeSend,
    });
    posthog.register({
      app: 'bica',
      bica_version: config.version,
      install_kind: config.installKind,
    });
  }
  // Turning off is saved on the device; the server's answer is what counts.
  if (posthog.has_opted_out_capturing())
    posthog.opt_in_capturing({ captureEventName: false });
  if (config.replays) posthog.startSessionRecording();
  else posthog.stopSessionRecording();
}

/** Stops everything at once: events, errors, and the recording. */
export function turnOff() {
  sending = false;
  if (!started) return;
  posthog.stopSessionRecording();
  posthog.opt_out_capturing();
}

export function capture(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

/** A `$pageview` for a route, with no ids or paths in it. */
export function pageview(pathname: string) {
  const { kind, path } = pageInfo(pathname);
  posthog.capture('$pageview', {
    $current_url: `http://${HOST}${path}`,
    $pathname: path,
    page_kind: kind,
  });
}

export function captureException(error: unknown) {
  posthog.captureException(error, { source: 'error_boundary' });
}
