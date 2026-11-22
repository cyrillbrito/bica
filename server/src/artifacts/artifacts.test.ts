import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import { startBica, type Bica } from '../testing/bica';

let bica: Bica;
let folder: string;
beforeAll(async () => {
  bica = await startBica();
  folder = join(bica.root, 'data', 'artifacts');
  await mkdir(folder, { recursive: true });
});
afterAll(() => bica?.stop());

function get(path: string, headers: Record<string, string> = {}) {
  return fetch(`http://127.0.0.1:${bica.port}${path}`, { headers });
}

function page(title: string, body = '') {
  return `<!doctype html><html><head><title>${title}</title><script src="/artifact-kit/kit.js"></script></head><body>${body}</body></html>`;
}

test('an artifact the agent writes is listed by its title, newest first, and its path opens it', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'writer');
  await writeFile(join(folder, 'older.html'), page('Older &amp; wiser'));
  await utimes(
    join(folder, 'older.html'),
    new Date(2020, 0),
    new Date(2020, 0),
  );

  // The prompt names the folder and the skill; the agent reads the skill
  // and writes the page there, as it would.
  let skill = '';
  bica.reply((context) => {
    // Durable sends the system prompt as sections of a system message.
    const prompt = JSON.stringify(
      context.messages.filter((m) => (m.role as string) === 'system'),
    );
    skill =
      /<location>([^<]*artifacts[^<]*SKILL\.md)<\/location>/.exec(
        prompt,
      )?.[1] ?? '';
    expect(prompt).toContain(folder);
    return fauxAssistantMessage(
      fauxToolCall('write', {
        path: join(folder, 'q3-sales.html'),
        content: page('Q3 sales'),
        summary: 'Build the report',
      }),
      { stopReason: 'toolUse' },
    );
  }, fauxAssistantMessage('Done'));
  const artifacts = tab.watch('artifacts', {});
  await tab.request('session.create', {
    projectId,
    prompt: 'Make a sales report',
    requestId: crypto.randomUUID(),
  });

  const listed = await artifacts.until((a) => a.list.length === 2);
  expect(listed.list.map((a) => [a.name, a.title])).toEqual([
    ['q3-sales', 'Q3 sales'],
    ['older', 'Older & wiser'],
  ]);
  expect(listed.themes.map((t) => t.id)).toEqual([
    'bica',
    'paper',
    'dashboard',
  ]);
  expect(await readFile(skill, 'utf8')).toContain('/artifact-kit/kit.js');

  await writeFile(join(folder, 'older.html'), page('Renamed'));
  await artifacts.until(
    (a) => a.list[0]?.name === 'older' && a.list[0].title === 'Renamed',
  );

  expect(
    await tab.request('path.find', { path: join(folder, 'q3-sales.html') }),
  ).toMatchObject({ workspace: null, artifact: 'q3-sales' });
});

test('an artifact is served sandboxed, and the kit it includes reaches its opaque origin', async () => {
  await writeFile(join(folder, 'served.html'), page('Served'));

  const shown = await get('/artifact-page/served');
  expect(shown.headers.get('content-type')).toStartWith('text/html');
  expect(shown.headers.get('content-security-policy')).toStartWith('sandbox');
  expect(await shown.text()).toBe(page('Served'));
  for (const name of ['missing', '..%2Fartifacts%2Fserved', '.hidden'])
    expect((await get(`/artifact-page/${name}`)).status).toBe(404);
  const rebound = await get('/artifact-page/served', { host: 'evil.example' });
  expect(rebound.status).toBe(403);

  const kit = await get('/artifact-kit/kit.js');
  expect(kit.headers.get('content-type')).toStartWith('text/javascript');
  expect(kit.headers.get('access-control-allow-origin')).toBe('*');
  const code = await kit.text();
  for (const part of ['echarts', 'text/tailwindcss', "data-theme='paper'"])
    expect(code).toContain(part);
  const again = await get('/artifact-kit/kit.js', {
    'if-none-match': kit.headers.get('etag')!,
  });
  expect(again.status).toBe(304);

  const font = await get('/artifact-kit/fonts/Libron-Regular.woff2');
  expect(font.status).toBe(200);
  expect(font.headers.get('access-control-allow-origin')).toBe('*');
  expect((await get('/artifact-kit/fonts/constructor')).status).toBe(404);
});

test('an export is one file in the picked theme that needs nothing from Bica', async () => {
  await writeFile(
    join(folder, 'dashboard.html'),
    page(
      'Dashboard',
      `<div class="grid gap-4 sm:grid-cols-3"><div id="c" class="h-64 bg-surface"></div></div>
<script>echarts.init(document.getElementById('c')).setOption({ series: [{ type: 'bar', data: [1, 2] }] });</script>`,
    ),
  );
  const res = await get(
    '/artifact-page/dashboard?download&theme=paper&mode=dark',
  );
  expect(res.headers.get('content-disposition')).toStartWith('attachment');
  expect(res.headers.get('content-disposition')).toContain('dashboard.html');
  const html = await res.text();

  expect(html).not.toContain('/artifact-kit/');
  expect(html).not.toMatch(/<script[^>]+src=/);
  // Only the classes the page uses, compiled; the browser build stays out.
  expect(html).toContain('.sm\\\\:grid-cols-3');
  expect(html).toContain('.bg-surface');
  expect(html).not.toContain('.grid-cols-7');
  expect(html).not.toContain('virtual:tailwindcss');
  // The picked theme with its fonts inlined, and ECharts for the chart.
  expect(html).toContain("data-theme='paper'");
  expect(html).not.toContain("data-theme='dashboard'");
  expect(html).toContain('data:font/woff2;base64,');
  expect(html).toContain('})({"themes":["paper"],"mode":"dark"');
  expect(html).toContain('Apache Software Foundation');
  // One script for the kit, and the page's own, both whole.
  expect(html.match(/<\/script>/g)).toHaveLength(2);

  await writeFile(join(folder, 'plain.html'), '<p>No kit</p>');
  expect(await (await get('/artifact-page/plain?download')).text()).toBe(
    '<p>No kit</p>',
  );
});
