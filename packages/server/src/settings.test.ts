import { afterAll, beforeAll, expect, test } from 'bun:test';

import { startBica, type Bica } from './testing/bica';

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

test('a setting changed on one device shows on the others, and a bad one is refused', async () => {
  const phone = await bica.connect();
  const laptop = await bica.connect();
  const seen = laptop.watch('settings', {});
  await seen.until((s) => s.nightStart === '01:00');

  await phone.request('settings.update', { nightStart: '02:30' });
  await seen.until((s) => s.nightStart === '02:30');

  const refusal = (change: object) =>
    phone.request('settings.update', change).then(
      () => 'saved',
      (error: Error) => error.message,
    );
  expect(await refusal({ nightStart: 'tonight' })).toContain('Pick a time');
  expect(
    await refusal({ fastModel: { provider: 'faux', modelId: 'missing' } }),
  ).toContain('Unknown model');
  const after = await phone.watch('settings', {}).until(() => true);
  expect(after.nightStart).toBe('02:30');
  expect(after.fastModel).toBeNull();
});
