// Builds the `bica` binary into dist/bica/bica: the server and cli/bica.ts,
// with Vite's build of the client and codemode's wasm embedded as files.
// Each `--target bun-<os>-<arch>` builds dist/bica/<os>-<arch>/bica instead.
// BICA_VERSION sets the version `bica --version` prints, and
// BICA_POSTHOG_KEY and BICA_POSTHOG_HOST where its telemetry goes.
import { $, Glob } from 'bun';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { target: { type: 'string', multiple: true } },
});
const version = process.env.BICA_VERSION || '0.0.0-dev';
// Telemetry's project (docs/telemetry.md); without a key, the binary sends nothing.
const posthogKey = process.env.BICA_POSTHOG_KEY || '';
const posthogHost = process.env.BICA_POSTHOG_HOST || '';

const server = join(import.meta.dir, '..');
const root = join(server, '..');
const out = join(root, 'dist/bica');

await $`bun run build`.cwd(root);
await $`rm -rf ${out} && mkdir -p ${out}`;

const imports: string[] = [];
function embed(path: string) {
  const name = `f${imports.length}`;
  imports.push(
    `import ${name} from ${JSON.stringify(path)} with { type: 'file' };`,
  );
  return name;
}

// Vite's own manifest in .vite/ isn't served; the glob skips dot folders.
const dist = join(root, 'client/dist/client');
const client = [...new Glob('**/*').scanSync({ cwd: dist })].map(
  (path) => `${JSON.stringify(`/${path}`)}: ${embed(join(dist, path))}`,
);
const codemode = Bun.resolveSync('@earendil-works/pi-codemode', server);
const wasm = embed(
  Bun.resolveSync('quickjs-wasi/quickjs.wasm', dirname(codemode)),
);

const entry = join(out, 'entry.js');
await Bun.write(
  entry,
  `${imports.join('\n')}
import { run } from ${JSON.stringify(join(server, 'cli/bica.ts'))};

await run({
  version: ${JSON.stringify(version)},
  kind: 'binary',
  load: () => import(${JSON.stringify(join(server, 'src/serve.ts'))}),
  client: { ${client.join(', ')} },
  wasm: ${wasm},
  // Bun resolves this form from the binary's own module graph.
  worker: './server/cli/codemode-worker.ts',
});
`,
);

for (const target of values.target ?? [undefined]) {
  const outfile = join(out, target?.replace(/^bun-/, '') ?? '', 'bica');
  const result = await Bun.build({
    entrypoints: [entry, join(server, 'cli/codemode-worker.ts')],
    compile: target
      ? { target: target as Bun.Build.CompileTarget, outfile }
      : { outfile },
    root,
    minify: true,
    define: {
      'process.env.NODE_ENV': '"production"',
      // Built in, so the binary never reads them from where it runs.
      'process.env.BICA_POSTHOG_KEY': JSON.stringify(posthogKey),
      'process.env.BICA_POSTHOG_HOST': JSON.stringify(posthogHost),
    },
  });
  if (!result.success) throw new AggregateError(result.logs, 'build failed');
  console.log(`built ${relative(process.cwd(), outfile)}`);
}
await $`rm ${entry}`;
