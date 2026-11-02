import { expect, test } from 'bun:test';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { scrub } from './scrub';

test('errors lose home folders, tailnet hosts, emails, and keys before they leave', () => {
  const cases: [string, string][] = [
    [
      `at run (${join(import.meta.dir, '../socket.ts')}:3:7)`,
      'at run (bica/server/src/socket.ts:3:7)',
    ],
    [`${homedir()}/notes/plan.md`, '~/notes/plan.md'],
    [
      'at run (/Users/alice/work/app/server.ts:3:7)',
      'at run (~/work/app/server.ts:3:7)',
    ],
    ['ENOENT: /home/bob/.ssh/id', 'ENOENT: ~/.ssh/id'],
    ['C:\\Users\\carol\\code\\x.ts', '~\\code\\x.ts'],
    [
      'fetch https://studio.tail1a2b.ts.net:3141/s/12 failed',
      'fetch https://<host>:3141/s/12 failed',
    ],
    ['signed in as dana@example.co.uk', 'signed in as <email>'],
    ['git push ed@studio.tail1a2b.ts.net:repo', 'git push <email>:repo'],
    ['key sk-ant-api03-abcdefghijklmnop refused', 'key <key> refused'],
    // Bica's own names stay.
    [
      'node_modules/.bun/posthog-node@5.61.1/node_modules/@earendil-works/pi-durable',
      'node_modules/.bun/posthog-node@5.61.1/node_modules/@earendil-works/pi-durable',
    ],
  ];
  for (const [raw, clean] of cases) expect(scrub(raw)).toBe(clean);
  expect(scrub('x'.repeat(5000), 100)).toBe(`${'x'.repeat(100)}…`);
});
