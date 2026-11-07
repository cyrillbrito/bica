import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { startBica, type Bica } from '../testing/bica';

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

function get(path: string) {
  return fetch(`http://127.0.0.1:${bica.port}${path}`);
}

test('a path from a reply opens in its workspace, or by link outside every workspace', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab);
  await mkdir(join(ref.cwd, 'docs'));
  await writeFile(join(ref.cwd, 'docs/report.md'), '# Report\n');
  const outside = join(bica.root, 'elsewhere.txt');
  await writeFile(outside, 'not in a workspace\n');

  for (const path of [join(ref.cwd, 'docs/report.md:3'), 'docs/report.md'])
    expect(await tab.request('path.find', { path, cwd: ref.cwd })).toEqual({
      workspace: ref,
      path: 'docs/report.md',
      folder: false,
    });
  expect(
    await tab.request('path.find', { path: join(ref.cwd, 'docs') }),
  ).toMatchObject({ workspace: ref, path: 'docs', folder: true });

  const found = await tab.request('path.find', { path: outside });
  expect(found).toMatchObject({ workspace: null, path: outside });
  expect(await (await get(found.url!)).text()).toBe('not in a workspace\n');
});

test('files are served only through a link from the socket, and HTML never runs', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab, 'served');
  await writeFile(join(ref.cwd, 'page.html'), '<script>alert(1)</script>');

  const link = await tab.request('file.link', { ...ref, path: 'page.html' });
  const shown = await get(link);
  expect(shown.headers.get('content-type')).toStartWith('text/plain');
  expect(await shown.text()).toBe('<script>alert(1)</script>');
  const saved = await get(`${link}?download`);
  expect(saved.headers.get('content-disposition')).toStartWith('attachment');

  const forged = link.replace(
    /\/download\/[^/]+/,
    `/download/${crypto.randomUUID()}`,
  );
  expect((await get(forged)).status).toBe(404);
  const escape = tab.request('file.link', { ...ref, path: '../../x' });
  expect(escape).rejects.toThrow('outside the workspace');
  await escape.catch(() => {});
});
