import { CHATS_ID, listProjects } from '../projects/projects';
import { listSessions } from '../sessions/store';
import { telemetryOn, track } from './telemetry';

const DAY = 24 * 60 * 60_000;

/** Sends `server_heartbeat` once a day, at the time of day the server started. */
export function startHeartbeat() {
  const now = new Date();
  Bun.cron(`${now.getMinutes()} ${now.getHours()} * * *`, () =>
    beat().catch((error) => console.error('[telemetry]', error)),
  );
}

async function beat() {
  if (!telemetryOn()) return;
  const [projects, sessions] = await Promise.all([
    listProjects(),
    listSessions(),
  ]);
  const since = Date.now() - DAY;
  track('server_heartbeat', {
    project_count: projects.filter((p) => p.id !== CHATS_ID).length,
    worktree_count: projects.reduce(
      (n, p) => n + p.workspaces.filter((w) => !w.main).length,
      0,
    ),
    open_session_count: sessions.filter((s) => !s.archivedAt).length,
    active_session_count: sessions.filter((s) => s.updatedAt > since).length,
  });
}
