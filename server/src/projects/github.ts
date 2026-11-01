import type { PullRequest } from '@bica/shared/protocol';

// gh goes over the network; the projects poll is much faster than this.
const TTL_MS = 60_000;

interface Entry {
  byBranch: Map<string, PullRequest>;
  at: number;
  loading?: Promise<void>;
}

const cache = new Map<string, Entry>();

/**
 * The newest PR of each branch in the repo at `path`, by its head branch.
 * Answers from cache at once; when that is stale it asks gh in the
 * background and calls `changed` once the answer is in.
 */
export function pullRequests(path: string, changed: () => void) {
  let entry = cache.get(path);
  if (!entry) cache.set(path, (entry = { byBranch: new Map(), at: 0 }));
  if (Date.now() - entry.at > TTL_MS && !entry.loading) {
    const e = entry;
    e.loading = load(path)
      .then((byBranch) => {
        e.byBranch = byBranch;
        changed();
      })
      // No gh, not logged in, or not a GitHub repo: no PRs, ask again later.
      .catch(() => {})
      .finally(() => {
        e.at = Date.now();
        e.loading = undefined;
      });
  }
  return entry.byBranch;
}

async function load(path: string) {
  // Only mine: in a fork, someone else's branch can share a name like "main".
  // gh picks the upstream repo of a fork by itself.
  const gh = Bun.spawn(
    [
      'gh',
      'pr',
      'list',
      '--author',
      '@me',
      '--state',
      'all',
      '--limit',
      '100',
      '--json',
      'number,title,url,state,isDraft,headRefName,headRefOid',
    ],
    { cwd: path, timeout: 20_000, stderr: 'ignore' },
  );
  const [stdout, code] = await Promise.all([gh.stdout.text(), gh.exited]);
  if (code !== 0) throw new Error(`gh pr list failed with ${code}`);
  const list = JSON.parse(stdout) as {
    number: number;
    title: string;
    url: string;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
    isDraft: boolean;
    headRefName: string;
    headRefOid: string;
  }[];
  const STATES = { OPEN: 'open', CLOSED: 'closed', MERGED: 'merged' } as const;
  const byBranch = new Map<string, PullRequest>();
  // Newest first, so a reused branch name shows its latest PR.
  for (const pr of list)
    if (!byBranch.has(pr.headRefName))
      byBranch.set(pr.headRefName, {
        number: pr.number,
        title: pr.title,
        url: pr.url,
        head: pr.headRefOid,
        state: pr.state === 'OPEN' && pr.isDraft ? 'draft' : STATES[pr.state],
      });
  return byBranch;
}
