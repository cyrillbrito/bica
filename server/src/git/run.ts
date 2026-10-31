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
