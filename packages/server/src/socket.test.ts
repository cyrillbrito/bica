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

test("a website that points its own name at this machine can't open the socket or read diffs", async () => {
  const blob = (host: string) =>
    fetch(`http://127.0.0.1:${bica.port}/blob/${'0'.repeat(40)}`, {
      headers: { Host: host },
    }).then((r) => r.status);
  for (const [host, known] of [
    [`evil.example:${bica.port}`, false],
    ['laptop.tailnet.ts.net', true],
  ] as const) {
    expect(await refused(bica.connect({ host }))).toBe(!known);
    expect(await blob(host)).toBe(known ? 404 : 403);
  }
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
