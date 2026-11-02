// Bica's production server in the terminal, with keys to open the UI, the way
// Vite's dev server does. Both ways to run a build start here: start.ts from
// the repo, and the `bica` binary that cli/build.ts compiles with the client
// and codemode's files embedded.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { TELEMETRY_DOCS } from '@bica/shared/telemetry';

/** The server and the built app, and in the binary the paths of codemode's embedded files. */
export interface Build {
  version: string;
  /** The `bica` binary, or `bun run start` from the repo. */
  kind: 'binary' | 'source';
  /** The server, server/src/serve.ts. */
  load: () => Promise<typeof import('../src/serve')>;
  /** URL path, such as `/assets/app.js`, to the file of Vite's build, dist/client. */
  client: Record<string, string>;
  wasm?: string;
  worker?: string;
}

const HELP = `Usage: bica [--port <port>]

  --port <port>  port to listen on, default 3141
  -v, --version  print the version
  -h, --help     show this

Data lives in ~/.bica/data, or in BICA_DATA_DIR.`;

// Printed once per data folder, the first time telemetry is on.
const NOTICE = `  Bica sends anonymous usage data and its own errors, to see what to fix
  and build next: counts, durations, and which features run. Never your
  prompts, code, file names, or paths.
  Turn it off in Settings, or set DO_NOT_TRACK=1. More: ${TELEMETRY_DOCS}
`;

const mac = platform() === 'darwin';
const CHROME_STATE = mac
  ? join(homedir(), 'Library/Application Support/Google/Chrome/Local State')
  : join(homedir(), '.config/google-chrome/Local State');

export async function run(build: Build) {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: '3141' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return console.log(HELP);
  if (values.version) return console.log(build.version);
  const port = Number(values.port);
  if (!Number.isInteger(port)) return fail(`Not a port: ${values.port}`);

  // Set before the server loads: its modules read them once.
  const data = (process.env.BICA_DATA_DIR ||= join(homedir(), '.bica/data'));
  if (build.wasm) process.env.BICA_CODEMODE_WASM = build.wasm;
  if (build.worker) process.env.BICA_CODEMODE_WORKER = build.worker;

  const { serve } = await build.load();
  // Loaded here, not at the top: it reads BICA_DATA_DIR as it loads.
  const telemetry = await import('../src/telemetry/telemetry');
  let server: ReturnType<typeof serve>;
  try {
    server = serve(port, {
      fallback: (req) => sendClient(build.client, req),
      build: { version: build.version, installKind: build.kind },
    });
  } catch (error) {
    return fail(
      (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
        ? `Port ${port} is in use. Pick another with --port.`
        : (error as Error).message,
    );
  }
  const url = `http://localhost:${port}`;
  console.log(`\n  Bica ${build.version} running\n\n  Local:  ${url}\n`);
  if (await telemetry.noticeDue()) console.log(NOTICE);
  if (process.stdin.isTTY) keys(url, join(data, 'chrome.json'));

  let quitting = false;
  const quit = async () => {
    // A second Ctrl-C doesn't wait for the flush.
    if (quitting) process.exit(0);
    quitting = true;
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    void server.stop();
    await telemetry.shutdownTelemetry();
    // Shells and agent runs end with the process; Pi Durable resumes runs on the next start.
    process.exit(0);
  };
  process.on('SIGINT', quit);
  process.on('SIGTERM', quit);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function sendClient(client: Record<string, string>, req: Request) {
  const { pathname } = new URL(req.url);
  // A page's URL, such as /s/<id>, gets the app, which routes in the browser.
  const path =
    client[pathname] ?? (extname(pathname) ? undefined : client['/index.html']);
  if (!path || (req.method !== 'GET' && req.method !== 'HEAD'))
    return new Response(null, { status: 404 });
  return new Response(Bun.file(path), {
    headers: {
      // Vite hashes the names of what it puts in assets/.
      'Cache-Control': pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
    },
  });
}

// Keys

interface Profile {
  dir: string;
  name: string;
}

function keys(url: string, settingsFile: string) {
  let profile = savedProfile(settingsFile);
  /** Digits typed after `p`, until Enter picks one. */
  let picking: string | null = null;
  let profiles: Profile[] = [];

  const menu = () =>
    console.log(
      [
        `  a  open as app (Chrome, profile ${profile?.name ?? 'none'})`,
        '  o  open in browser',
        '  p  pick Chrome profile',
        '  q  quit',
        '',
      ].join('\n'),
    );

  const pick = (index: number) => {
    picking = null;
    const chosen = profiles[index - 1];
    if (!chosen) return console.log('  No such profile.\n');
    profile = chosen;
    mkdirSync(dirname(settingsFile), { recursive: true });
    writeFileSync(settingsFile, JSON.stringify({ profile: chosen.dir }) + '\n');
    console.log(`  Profile: ${chosen.name}\n`);
    menu();
  };

  menu();
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (key: string) => {
    // Raw mode turns Ctrl-C into a plain byte instead of SIGINT.
    if (key === '\x03' || key === '\x04')
      return process.kill(process.pid, 'SIGINT');
    if (picking !== null) {
      if (/^\d$/.test(key)) {
        picking += key;
        process.stdout.write(key);
        // One digit is enough when there are fewer than ten.
        if (profiles.length < 10) {
          process.stdout.write('\n');
          pick(Number(picking));
        }
      } else if (key === '\r' || key === '\n') {
        process.stdout.write('\n');
        if (picking) pick(Number(picking));
        else picking = null;
      } else {
        picking = null;
        console.log('\n  Cancelled.\n');
      }
      return;
    }
    if (key === 'q') return process.kill(process.pid, 'SIGINT');
    if (key === 'o') return openBrowser(url);
    if (key === 'a') {
      if (!hasChrome()) {
        console.log(
          '  Chrome is not installed. Opening the default browser.\n',
        );
        return openBrowser(url);
      }
      return openApp(url, profile?.dir ?? 'Default');
    }
    if (key === 'p') {
      profiles = chromeProfiles();
      if (!profiles.length) return console.log('  No Chrome profiles found.\n');
      console.log(
        profiles.map((p, i) => `  ${i + 1}  ${p.name} (${p.dir})`).join('\n'),
      );
      process.stdout.write('  Number: ');
      picking = '';
      return;
    }
    if (key === '\r' || key === '\n' || key === 'h' || key === '?') menu();
  });
}

function chromeProfiles(): Profile[] {
  try {
    const state = JSON.parse(readFileSync(CHROME_STATE, 'utf8'));
    const cache: Record<string, { name: string }> =
      state.profile?.info_cache ?? {};
    return Object.entries(cache).map(([dir, info]) => ({
      dir,
      name: info.name,
    }));
  } catch {
    return [];
  }
}

function savedProfile(file: string): Profile | undefined {
  const profiles = chromeProfiles();
  let dir = 'Default';
  try {
    dir = JSON.parse(readFileSync(file, 'utf8')).profile ?? dir;
  } catch {}
  return profiles.find((p) => p.dir === dir) ?? profiles[0];
}

function hasChrome() {
  return mac
    ? Bun.spawnSync(['open', '-Ra', 'Google Chrome']).exitCode === 0
    : Bun.which('google-chrome') !== null;
}

function openApp(url: string, profileDir: string) {
  const args = [`--profile-directory=${profileDir}`, `--app=${url}`];
  if (mac) launch('open', ['-na', 'Google Chrome', '--args', ...args]);
  else launch('google-chrome', args);
}

function openBrowser(url: string) {
  launch(mac ? 'open' : 'xdg-open', [url]);
}

function launch(command: string, args: string[]) {
  Bun.spawn([command, ...args], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  }).unref();
}
