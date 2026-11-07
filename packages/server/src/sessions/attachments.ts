import type { BunRequest } from 'bun';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { dataPath } from '../storage';

// A prompt's images, saved once by their content's hash: the agent's tools
// get a path, and the browser loads each over HTTP and keeps it for good,
// instead of as base64 inside every transcript snapshot.
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const NAME = /^[0-9a-f]{64}\.(png|jpg|gif|webp|bin)$/;

function folder() {
  const dir = dataPath('attachments');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Saves an image (base64) unless a copy is there already; returns its path.
 * Synchronous, since the transcript's projection calls it for older images.
 */
export function saveImage(mimeType: string, data: string) {
  const bytes = Buffer.from(data, 'base64');
  const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
  const file = join(folder(), `${hash}.${EXTENSIONS[mimeType] ?? 'bin'}`);
  if (!existsSync(file)) {
    // Written aside first: a half-written file would be kept by browsers.
    const part = `${file}.${process.pid}.part`;
    writeFileSync(part, bytes);
    renameSync(part, file);
  }
  return file;
}

export async function serveAttachment(req: BunRequest<'/attachment/:name'>) {
  const { name } = req.params;
  if (!NAME.test(name)) return new Response(null, { status: 404 });
  const file = Bun.file(join(folder(), name));
  if (!(await file.exists())) return new Response(null, { status: 404 });
  return new Response(file, {
    headers: {
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
