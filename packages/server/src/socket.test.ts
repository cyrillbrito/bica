import { afterAll, beforeAll, expect, test } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { startBica, type Bica } from './testing/bica';

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

function refused(attempt: Promise<unknown>) {
  return attempt.then(
    () => false,
    () => true,
  );
}

test("another website's page can't open the socket", async () => {
  expect(await refused(bica.connect({ origin: 'https://evil.example' }))).toBe(
    true,
  );
  expect(await refused(bica.connect())).toBe(false);
});

test('file reads stay inside the workspace', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab);
  await writeFile(join(bica.root, 'secret.txt'), 'outside');
  for (const path of ['../secret.txt', join(bica.root, 'secret.txt')])
    expect(await refused(tab.request('file.read', { ...ref, path }))).toBe(
      true,
    );
});
