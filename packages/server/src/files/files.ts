// A workspace's files: how each one can be shown, reading it, and the list
// of every file in it (docs/files.md).
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import type { FileText, WorkspaceRef } from '@bica/shared/protocol';
import * as git from '../git/commands';
import { polled } from '../live';
import { inside, isRepo, open } from '../projects/workspace';
import { onToolRan } from '../tools/tool-ran';

export const MAX_FILE = 2 * 1024 * 1024;
// Media is shown as itself, not as text, so it gets a looser cap.
export const MAX_MEDIA = 25 * 1024 * 1024;
// Plain folders are walked by hand; stop somewhere sane.
const MAX_FILES = 20_000;
const SKIP_DIRS = new Set(['.git', 'node_modules']);
// No file watcher: open views poll, and only while someone looks.
const FILES_MS = 4000;

const MEDIA: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

// By extension, else by magic bytes: screenshots often land with odd names.
function extension(path: string) {
  return /\.([^./]+)$/.exec(path)?.[1]?.toLowerCase();
}

function mediaType(path: string, buffer: Buffer) {
  const ext = extension(path);
  if (ext && MEDIA[ext]) return MEDIA[ext];
  const head = buffer.subarray(0, 12).toString('latin1');
  if (head.startsWith('\x89PNG')) return 'image/png';
  if (head.startsWith('\xff\xd8\xff')) return 'image/jpeg';
  if (head.startsWith('GIF8')) return 'image/gif';
  if (head.startsWith('RIFF') && head.endsWith('WEBP')) return 'image/webp';
  if (head.startsWith('%PDF')) return 'application/pdf';
  return undefined;
}

/** The most of this file worth reading: media gets more room than text. */
export function maxSize(path: string) {
  return MEDIA[extension(path) ?? ''] ? MAX_MEDIA : MAX_FILE;
}

/** How a file can be shown: as text, as media of a type, or not at all. */
export function kindOf(
  buffer: Buffer,
  path: string,
): 'text' | 'binary' | 'too large' | { mimeType: string } {
  const mimeType = mediaType(path, buffer);
  if (mimeType) return buffer.length > MAX_MEDIA ? 'too large' : { mimeType };
  if (buffer.length > MAX_FILE) return 'too large';
  // Git's own test: a NUL in the first 8000 bytes means binary.
  if (buffer.subarray(0, 8000).includes(0)) return 'binary';
  return 'text';
}

export function toText(buffer: Buffer | null, path: string): FileText {
  if (!buffer) return { text: null, reason: 'missing' };
  const kind = kindOf(buffer, path);
  if (kind === 'text') return { text: buffer.toString('utf8') };
  if (typeof kind === 'string') return { text: null, reason: kind };
  return {
    text: null,
    reason: 'media',
    mimeType: kind.mimeType,
    data: buffer.toString('base64'),
  };
}

/** Null: no such file. */
export function readDisk(full: string) {
  return readFile(full).catch(() => null);
}

export async function readText(ref: WorkspaceRef, path: string) {
  const { cwd } = await open(ref);
  return toText(await readDisk(inside(cwd, path)), path);
}

// ---------- the file list: one poller per workspace, shared by watchers ----------

const fileLists = polled(FILES_MS, async (cwd) =>
  (await isRepo(cwd)) ? gitFiles(cwd) : walk(cwd),
);

/** Re-read the list now, after something added or deleted files. */
export function refreshFiles(cwd: string) {
  return fileLists.refresh(cwd);
}

// An agent's edit shows as soon as its tool call ends.
onToolRan((dir) => {
  for (const cwd of fileLists.keys())
    if (dir === cwd || dir.startsWith(cwd + sep)) void fileLists.refresh(cwd);
});

export async function watchFiles(
  ref: WorkspaceRef,
  listener: (paths: string[]) => void,
) {
  const { cwd } = await open(ref);
  return fileLists.get(cwd).watch(listener);
}

async function gitFiles(cwd: string): Promise<string[]> {
  const { files, submodules, untracked, deleted } = await git.fileList(cwd);
  // A submodule would otherwise show up as a file; list its own files instead.
  const nested = await Promise.all(
    submodules.map((sub) =>
      // Not checked out (no .git inside): nothing to show.
      stat(join(cwd, sub, '.git'))
        .then(() => gitFiles(join(cwd, sub)))
        .then((ps) => ps.map((p) => `${sub}/${p}`))
        .catch(() => []),
    ),
  );
  const gone = new Set(deleted);
  return [...new Set([...files, ...untracked])]
    .filter((p) => !gone.has(p))
    .concat(...nested)
    .sort();
}

async function walk(cwd: string) {
  const out: string[] = [];
  const visit = async (dir: string) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (out.length >= MAX_FILES) return;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await visit(full);
      } else if (e.isFile()) out.push(relative(cwd, full));
    }
  };
  await visit(cwd);
  return out.sort();
}
