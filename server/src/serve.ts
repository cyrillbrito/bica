import { serveBlob } from './git/blob';
import { serveDownload } from './files/download';
import { installAgents } from './agents/extensions';
import { startNight } from './night-runs/night';
import { watchRuns } from './orchestration/notes';
import { startWorktreeCleanup } from './projects/cleanup';
import { serveAttachment } from './sessions/attachments';
import { startHousekeeping } from './sessions/housekeeping';
import { upgrade, websocket } from './socket';

// There is no login (docs/deploy.md), and a page on any website can point its
// own name at 127.0.0.1 (DNS rebinding): the browser then treats Bica as that
// site, so the socket's Origin check passes. The `Host` header still says the
// site's name. Only the routes a page could use get the check: a download's
// token and an attachment's hash can't be guessed.
const KNOWN_HOST =
  /^(localhost|[\d.]+|\[[\da-f:.]+\]|[\w.-]+\.ts\.net)(:\d+)?$/i;

function knownHost(req: Request) {
  return KNOWN_HOST.test(req.headers.get('host') ?? '');
}

function forbidden() {
  return new Response('Forbidden', { status: 403 });
}

/**
 * Bica's HTTP server: the socket, and the files it hands out links to.
 * `fallback` answers every other URL with the built app in production; in
 * dev, Vite serves the app and forwards the rest here, and anything else is
 * a 404. GET routes answer HEAD too, and other methods get a 404. Bica's
 * background work starts only once the port is taken, so a port in use
 * fails before any run resumes.
 */
export function serve(
  port: number,
  fallback?: (req: Request) => Response | Promise<Response>,
) {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port,
    routes: {
      '/ws': (req, server) =>
        knownHost(req) ? upgrade(req, server) : forbidden(),
      '/download/:token/*': { GET: serveDownload },
      '/blob/:hash': {
        GET: (req) => (knownHost(req) ? serveBlob(req) : forbidden()),
      },
      '/attachment/:name': { GET: serveAttachment },
    },
    fetch: fallback,
    websocket,
  });
  // Before the harness opens: it finds the agents' extensions by name.
  installAgents();
  startHousekeeping();
  startWorktreeCleanup();
  startNight();
  // Opens the harness, which resumes runs a restart left unfinished, and
  // follows them at once: a parent hears when one ends, open tab or not.
  void watchRuns().catch((error) => console.error('[sessions]', error));
  return server;
}
