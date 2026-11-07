import type { BunRequest } from 'bun';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';

import type { WorkspaceRef } from '@bica/shared/protocol';
import { inside, open } from '../projects/workspace';

// Files reach the browser as plain HTTP, so a big PDF or video needn't fit
// in a socket message. There is no login (docs/deploy.md), so a file is only
// served through a link the socket handed out: an unguessable token keeps
// other websites, including DNS rebinding ones, from reading the disk.
const PREFIX = '/download/';
const TTL = 60 * 60_000;
const links = new Map<string, string>();

/**
 * A URL serving one file for an hour, shown in the browser. Add `?download`
 * to save it instead.
 */
export function fileLink(file: string) {
  const token = crypto.randomUUID();
  links.set(token, file);
  setTimeout(() => links.delete(token), TTL).unref();
  // The name at the end is what the browser shows and saves it as.
  return `${PREFIX}${token}/${encodeURIComponent(basename(file))}`;
}

export async function workspaceFileLink(ref: WorkspaceRef, path: string) {
  const { cwd } = await open(ref);
  return fileLink(inside(cwd, path));
}

export async function serveDownload(req: BunRequest<'/download/:token/*'>) {
  const file = links.get(req.params.token);
  const info = file ? await stat(file).catch(() => undefined) : undefined;
  if (!info?.isFile()) return new Response(null, { status: 404 });
  const save = new URL(req.url).searchParams.has('download');
  return new Response(Bun.file(file!), {
    headers: {
      'Content-Type': save
        ? 'application/octet-stream'
        : await shownType(file!),
      'Content-Disposition': `${save ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(basename(file!))}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// The page runs on Bica's own origin, so HTML or SVG shown as itself could
// drive the socket. Text shows as plain text, and media as itself.
async function shownType(file: string) {
  const type = Bun.file(file).type.split(';')[0]!;
  if (
    type === 'application/pdf' ||
    /^(audio|video)\//.test(type) ||
    (type.startsWith('image/') && type !== 'image/svg+xml')
  )
    return type;
  if (
    type.startsWith('text/') ||
    /json|javascript|typescript|xml|yaml|toml/.test(type) ||
    type === 'image/svg+xml'
  )
    return 'text/plain; charset=utf-8';
  // Git's own test for names it doesn't know, such as Makefile or .py: a NUL
  // in the first 8000 bytes means binary.
  const head = await Bun.file(file).slice(0, 8000).bytes();
  return head.includes(0)
    ? 'application/octet-stream'
    : 'text/plain; charset=utf-8';
}
