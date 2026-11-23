import type { BunRequest } from 'bun';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type { ArtifactInfo, Artifacts } from '@bica/shared/protocol';
import { live } from '../live';
import { dataPath } from '../storage';
import { onToolRan } from '../tools/tool-ran';
import { exportPage, type Mode } from './kit';
import { THEMES } from './kit/themes';

// Artifacts (docs/artifacts.md): HTML pages the agent builds as reports, one
// file each in Bica's data folder. They belong to no project or session; the
// agent writes and edits them with its usual tools.

export const ARTIFACTS_DIR = dataPath('artifacts');

const EXT = '.html';
const LIST_MS = 2000;
// Where a <title> would be; pages put big inline data further down.
const HEAD_BYTES = 16 * 1024;

/** The file of the artifact `name`, or undefined for a name that isn't one. */
function fileOf(name: string) {
  if (!name || name !== basename(name) || name.startsWith('.')) return;
  return join(ARTIFACTS_DIR, `${name}${EXT}`);
}

/** The artifact's name when `file` is one: an HTML file right in the folder. */
export function artifactName(file: string) {
  if (dirname(file) !== ARTIFACTS_DIR || !file.endsWith(EXT)) return;
  return basename(file, EXT);
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' ',
};

async function titleOf(file: string) {
  const head = await Bun.file(file).slice(0, HEAD_BYTES).text();
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? '';
  return raw
    .replace(/&(#39|[a-z]+);/gi, (m, e: string) => ENTITIES[e] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

async function listArtifacts(): Promise<ArtifactInfo[]> {
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  const names = (await readdir(ARTIFACTS_DIR)).filter(
    (f) => f.endsWith(EXT) && !f.startsWith('.'),
  );
  const found = await Promise.all(
    names.map(async (file) => {
      const path = join(ARTIFACTS_DIR, file);
      const info = await stat(path).catch(() => undefined);
      if (!info?.isFile()) return;
      const name = basename(file, EXT);
      return {
        name,
        title: (await titleOf(path)) || name,
        updated: info.mtimeMs,
      };
    }),
  );
  return found
    .filter((a): a is ArtifactInfo => !!a)
    .sort((a, b) => b.updated - a.updated);
}

// Polled while someone looks, and read again after each tool call, since
// the agent writes artifacts from whatever workspace it works in.
const artifacts = live<Artifacts>(
  async () => ({
    folder: ARTIFACTS_DIR,
    themes: THEMES.map(({ id, label }) => ({ id, label })),
    list: await listArtifacts(),
  }),
  (refresh) => {
    const timer = setInterval(refresh, LIST_MS);
    const off = onToolRan(refresh);
    return () => {
      clearInterval(timer);
      off();
    };
  },
);

export function watchArtifacts(listener: (value: Artifacts) => void) {
  return artifacts.watch(listener);
}

// As for HTML files (server/src/files/download.ts): the sandbox without
// allow-same-origin runs the page on an opaque origin, so it can't drive
// the socket or read Bica's other routes.
const SANDBOX = 'sandbox allow-scripts allow-popups allow-forms';

/**
 * An artifact's page, sandboxed, for the viewer. With `?download` it comes
 * back as one self-contained file in the `theme` and `mode` picked.
 */
export async function serveArtifact(req: BunRequest<'/artifact-page/:name'>) {
  const file = fileOf(req.params.name);
  const info = file ? await stat(file).catch(() => undefined) : undefined;
  if (!file || !info?.isFile()) return new Response(null, { status: 404 });
  const query = new URL(req.url).searchParams;
  if (!query.has('download'))
    return new Response(Bun.file(file), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': SANDBOX,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  const mode = query.get('mode');
  const html = await exportPage(
    await Bun.file(file).text(),
    query.get('theme') ?? '',
    mode === 'light' || mode === 'dark' ? (mode as Mode) : 'system',
  );
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(basename(file))}`,
      'Cache-Control': 'no-store',
    },
  });
}

/** The system prompt's line on artifacts, for agents that read skills. */
export function artifactsSection() {
  return `Artifacts are self-contained HTML pages you build as reports, which the user opens on Bica's Artifacts page. Each is one file in ${ARTIFACTS_DIR}, titled by its <title>, and belongs to no project or session. Read the artifacts skill before building or changing one. To update one, find its file there by name or title and edit it.`;
}
