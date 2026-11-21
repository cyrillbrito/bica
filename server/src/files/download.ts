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
  const type = save ? 'application/octet-stream' : await shownType(file!);
  return new Response(Bun.file(file!), {
    headers: {
      'Content-Type': type,
      ...(SANDBOXED.has(type) && { 'Content-Security-Policy': SANDBOX }),
      'Content-Disposition': `${save ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(basename(file!))}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// HTML and SVG would run on Bica's own origin and could drive the socket.
// The sandbox, without allow-same-origin, gives them an opaque origin: the
// socket refuses its `Origin: null`, and other routes are cross-origin.
// Agents' reports load scripts from CDNs, so scripts still run.
const SANDBOX = 'sandbox allow-scripts allow-popups allow-forms';
const SANDBOXED = new Set(['text/html', 'image/svg+xml']);

// Text shows as plain text, and media and sandboxed pages as themselves.
async function shownType(file: string) {
  const type = Bun.file(file).type.split(';')[0]!;
  if (
    SANDBOXED.has(type) ||
    type === 'application/pdf' ||
    /^(audio|video)\//.test(type) ||
    (type.startsWith('image/') && type !== 'image/svg+xml')
  )
    return type;
  if (
    type.startsWith('text/') ||
    /json|javascript|typescript|xml|yaml|toml/.test(type)
  )
    return 'text/plain; charset=utf-8';
  // Git's own test for names it doesn't know, such as Makefile or .py: a NUL
  // in the first 8000 bytes means binary.
  const head = await Bun.file(file).slice(0, 8000).bytes();
  return head.includes(0)
    ? 'application/octet-stream'
    : 'text/plain; charset=utf-8';
}
