import type { BunRequest } from 'bun';
import { gzipSync } from 'node:zlib';

import { kindOf } from '../files/files';
import { readBlob } from './workspace';

// Diffs read each side by its git blob hash from status, over plain HTTP:
// a hash always means the same bytes, so the browser keeps them for good
// and reopening a diff, or staging what you saw, fetches nothing. The
// socket has no login either (docs/deploy.md), so this opens no new door.
const KEEP = 'private, max-age=31536000, immutable';
function notFound() {
  return new Response(null, { status: 404 });
}

export function serveBlob(req: BunRequest<'/blob/:hash'>) {
  return send(req).catch(notFound);
}

async function send(req: BunRequest<'/blob/:hash'>) {
  const { hash } = req.params;
  const q = new URL(req.url).searchParams;
  const projectId = q.get('project');
  const cwd = q.get('cwd');
  const path = q.get('path');
  if (!/^[0-9a-f]{40,64}$/.test(hash) || !projectId || !cwd || !path)
    return notFound();
  const found = await readBlob({ projectId, cwd }, path, hash, {
    repoPath: q.get('repo') ?? undefined,
    onDisk: q.has('disk'),
  });
  if (!found) return notFound();
  const headers: Record<string, string> = {
    'Cache-Control': found !== 'too large' && found.exact ? KEEP : 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  const kind = found === 'too large' ? found : kindOf(found.bytes, path);
  let body: Buffer = Buffer.alloc(0);
  if (typeof kind === 'string' && kind !== 'text') {
    // Nothing to show but the reason, kept as long as the bytes would be.
    headers['X-Bica-Unshown'] = kind;
  } else if (found !== 'too large') {
    body = found.bytes;
    headers['Content-Type'] =
      kind === 'text' ? 'text/plain; charset=utf-8' : kind.mimeType;
    if (
      kind === 'text' &&
      /\bgzip\b/.test(req.headers.get('accept-encoding') ?? '')
    ) {
      body = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
    }
  }
  return new Response(body, { headers });
}
