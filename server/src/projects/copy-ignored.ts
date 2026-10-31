import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { git } from '../git/run';

// A copied virtualenv still points at the main folder, so its editable
// installs would run the main folder's code.
const SKIP = new Set(['.venv', 'venv']);

// clonefile(2) clones a whole folder in one call: `node_modules` in about
// two seconds, where `cp -c` clones file by file for a minute. It blocks, so
// it runs in a worker, off the server's event loop.
const CLONER = `
import { dlopen, FFIType } from 'bun:ffi';
const { symbols } = dlopen('/usr/lib/libSystem.B.dylib', {
  clonefile: { args: [FFIType.ptr, FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
});
const c = (s) => Buffer.from(s + '\\0');
// CLONE_NOFOLLOW: an ignored symlink stays a symlink.
self.onmessage = ({ data: [from, to] }) =>
  postMessage(symbols.clonefile(c(from), c(to), 1) === 0);
`;

function cloner() {
  if (process.platform === 'darwin') {
    const worker = new Worker(
      URL.createObjectURL(new Blob([CLONER], { type: 'text/javascript' })),
    );
    const clone = (from: string, to: string) =>
      new Promise<boolean>((done) => {
        worker.onmessage = (e) => done(e.data === true);
        worker.onerror = () => done(false);
        worker.postMessage([from, to]);
      });
    return { clone, close: () => worker.terminate() };
  }
  // btrfs and XFS clone; elsewhere `always` fails rather than copy in full.
  // Spawned, not through Bun Shell, whose built-in `cp` lacks `--reflink`.
  const clone = async (from: string, to: string) => {
    const cp = Bun.spawn(['cp', '-a', '--reflink=always', from, to], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    if ((await cp.exited) === 0) return true;
    await rm(to, { recursive: true, force: true });
    return false;
  };
  return { clone, close: () => {} };
}

/**
 * Copies the main folder's gitignored files, such as `.env` and
 * `node_modules`, into a new worktree, so it starts ready to run. Only as
 * copy-on-write clones, which share the disk until one side changes: where
 * the disk can't clone, nothing is copied, rather than doubling its use.
 * Ones already there are left alone.
 */
export async function copyIgnored(from: string, to: string) {
  const stdout = await git(from, [
    'ls-files',
    '-z',
    '--others',
    '--ignored',
    '--exclude-standard',
    '--directory',
  ]);
  const listed = stdout
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/\/$/, ''));
  // Git can list a folder and also folders inside it.
  const paths = listed.filter(
    (p) => !SKIP.has(basename(p)) && !listed.some((o) => p.startsWith(`${o}/`)),
  );
  if (!paths.length) return;
  const { clone, close } = cloner();
  try {
    for (const path of paths) {
      const target = join(to, path);
      if (existsSync(target)) continue;
      await mkdir(dirname(target), { recursive: true });
      await clone(join(from, path), target);
    }
  } finally {
    close();
  }
}
