import { expect, test } from 'bun:test';

import { useBicaWith } from '../testing/posthog';

test('without a PostHog key, nothing leaves the machine', async () => {
  const sent = await useBicaWith((host) => ({ BICA_POSTHOG_HOST: host }));
  expect(sent.config).toMatchObject({
    off: 'no-key',
    key: null,
    installId: null,
  });
  expect(sent.relay).toBe(404);
  expect(sent.requests).toEqual([]);
});
