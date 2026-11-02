import { expect, test } from 'bun:test';

import { useBicaWith } from '../testing/posthog';

test('DO_NOT_TRACK=1 keeps everything on the machine, even with a key', async () => {
  const sent = await useBicaWith((host) => ({
    BICA_POSTHOG_KEY: 'phc_test',
    BICA_POSTHOG_HOST: host,
    DO_NOT_TRACK: '1',
  }));
  expect(sent.config).toMatchObject({
    off: 'DO_NOT_TRACK',
    key: null,
    installId: null,
  });
  expect(sent.relay).toBe(404);
  expect(sent.requests).toEqual([]);
});
