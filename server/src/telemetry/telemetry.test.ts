import { afterAll, beforeAll, expect, test } from 'bun:test';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { startBica, type Bica } from '../testing/bica';
import { causeBug, fakePostHog, type FakePostHog } from '../testing/posthog';

// Before startBica points HOME at a scratch folder.
const home = homedir();
const repo = join(import.meta.dir, '../../..');

let posthog: FakePostHog;
let bica: Bica;
beforeAll(async () => {
  posthog = await fakePostHog();
  bica = await startBica({
    env: { BICA_POSTHOG_KEY: 'phc_test', BICA_POSTHOG_HOST: posthog.url },
  });
});
afterAll(() => posthog?.stop());

test('the relay forwards the browser to PostHog, without its cookies', async () => {
  const relay = (path: string, init?: RequestInit) =>
    fetch(`http://127.0.0.1:${bica.port}/relay${path}`, init);

  const sent = await relay('/e/?ip=0&ver=1.2', {
    method: 'POST',
    headers: { 'content-type': 'text/plain', cookie: 'session=secret' },
    body: '{"event":"from_the_browser"}',
  });
  expect(sent.status).toBe(200);
  expect(await sent.json()).toEqual({ status: 1 });
  const script = await relay('/static/array.js');
  expect(await script.text()).toBe('/* posthog */');

  const [event, asset] = posthog.requests.slice(-2);
  expect(event).toMatchObject({
    method: 'POST',
    path: '/e/',
    query: '?ip=0&ver=1.2',
    body: { event: 'from_the_browser' },
  });
  expect(event!.headers['content-type']).toBe('text/plain');
  expect(event!.headers.cookie).toBeUndefined();
  expect(asset).toMatchObject({ method: 'GET', path: '/static/array.js' });
});

test("the server's events and its own errors reach PostHog scrubbed, until the setting turns it off", async () => {
  const tab = await bica.connect();
  const config = tab.watch('telemetry', {});
  const on = await config.until((c) => c.off === null);
  expect(on).toMatchObject({ key: 'phc_test', relay: '/relay', replays: true });

  await causeBug(tab);
  await tab.request('settings.update', { telemetry: false });
  const off = await config.until((c) => c.off === 'setting');
  expect(off).toMatchObject({ key: null, installId: null, replays: false });
  const relay = await fetch(`http://127.0.0.1:${bica.port}/relay/e/`, {
    method: 'POST',
    body: '{}',
  });
  expect(relay.status).toBe(404);
  await causeBug(tab);
  // Stopping sends what's queued, as quitting does.
  await bica.stop();

  const events = posthog.events();
  const start = events.find((e) => e.event === 'server_start');
  expect(start).toMatchObject({
    api_key: 'phc_test',
    distinct_id: on.installId!,
    properties: {
      app: 'bica',
      bica_version: '0.0.0-dev',
      install_kind: 'dev',
      os: process.platform,
      arch: process.arch,
      is_new_install: true,
    },
  });
  const errors = events.filter((e) => e.event === '$exception');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatchObject({
    distinct_id: on.installId!,
    properties: {
      source: 'socket_request',
      call: 'session.submit',
      $exception_list: [{ type: 'TypeError' }],
    },
  });
  const sent = JSON.stringify(errors[0]);
  expect(sent).toContain('bica/server/src/socket.ts');
  expect(sent).not.toContain(repo);
  expect(sent).not.toContain(home);
  expect(sent).not.toMatch(/\/(Users|home)\/[^/"]+\//);
});
