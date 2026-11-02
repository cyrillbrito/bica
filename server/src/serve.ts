import { serveBlob } from './git/blob';
import { serveDownload } from './files/download';
import { installAgents } from './agents/extensions';
import { startNight } from './night-runs/night';
import { watchRuns } from './orchestration/notes';
import { startWorktreeCleanup } from './projects/cleanup';
import { serveAttachment } from './sessions/attachments';
import { startHousekeeping } from './sessions/housekeeping';
import { upgrade, websocket } from './socket';
import type { InstallKind } from '@bica/shared/protocol';
import { startHeartbeat } from './telemetry/heartbeat';
import { relay } from './telemetry/relay';
import { watchRunTelemetry } from './telemetry/runs';
import { startTelemetry } from './telemetry/telemetry';

/**
 * Bica's HTTP server: the socket, the files it hands out links to, and the
 * telemetry relay. `fallback` answers every other URL with the built app in
 * production; in dev, Vite serves the app and forwards the rest here, and
 * anything else is a 404. GET routes answer HEAD too, and other methods get
 * a 404. Bica's background work starts only once the port is taken, so a
 * port in use fails before any run resumes. `build` says which Bica this
 * is; without it, a dev run.
 */
export function serve(
  port: number,
  {
    fallback,
    build,
  }: {
    fallback?: (req: Request) => Response | Promise<Response>;
    build?: { version: string; installKind: InstallKind };
  } = {},
) {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port,
    routes: {
      '/ws': upgrade,
      '/download/:token/*': { GET: serveDownload },
      '/blob/:hash': { GET: serveBlob },
      '/attachment/:name': { GET: serveAttachment },
      '/relay/*': relay,
    },
    fetch: fallback,
    websocket,
  });
  startTelemetry(build);
  startHeartbeat();
  // Before the harness opens: it finds the agents' extensions by name.
  installAgents();
  startHousekeeping();
  startWorktreeCleanup();
  startNight();
  // Opens the harness, which resumes runs a restart left unfinished, and
  // follows them at once: a parent hears when one ends, open tab or not.
  void watchRuns().catch((error) => console.error('[sessions]', error));
  void watchRunTelemetry().catch((error) =>
    console.error('[telemetry]', error),
  );
  return server;
}
