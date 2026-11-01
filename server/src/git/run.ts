import { $ } from 'bun';

/**
 * Runs git in `cwd` and returns what it printed. A failure throws git's own
 * words, such as "nothing to commit", which it sometimes prints to stdout.
 */
export async function git(cwd: string, args: string[]) {
  const result = await $`git ${args}`.cwd(cwd).quiet().nothrow();
  if (result.exitCode === 0) return result.text();
  const said = [result.stderr, result.stdout]
    .map((out) => out.toString().trim())
    .find(Boolean);
  throw new Error(said || `git ${args[0]} failed`);
}

/**
 * Runs a git command that goes over the network. It never waits on a
 * password prompt nobody can see, and gives up after `timeout` ms.
 */
export async function remote(cwd: string, args: string[], timeout = 120_000) {
  const p = Bun.spawn(['git', ...args], {
    cwd,
    timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const [stderr, code] = await Promise.all([p.stderr.text(), p.exited]);
  if (p.signalCode)
    throw new Error(`git ${args[0]} got no answer in ${timeout / 1000} s`);
  if (code !== 0) throw new Error(stderr.trim() || `git ${args[0]} failed`);
}
