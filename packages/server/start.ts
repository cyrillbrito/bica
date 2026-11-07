// `bun run start`: the built copy from the repo, through the same entry as the
// `bica` binary, but with its data in the repo's .data/.
import { Glob } from 'bun';
import { join } from 'node:path';

import { run } from './cli/bica.ts';

const dir = join(import.meta.dir, '../client/dist/client');

await run({
  version: '0.0.0-dev',
  load: () => import('./src/serve.ts'),
  client: Object.fromEntries(
    [...new Glob('**/*').scanSync(dir)].map((path) => [
      `/${path}`,
      join(dir, path),
    ]),
  ),
});
