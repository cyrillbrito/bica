// Git on test data: staging, committing, pushing and pulling play out on
// the test data's git status (files move between lists, commits land,
// counts roll), and changes without file contents in the test data get
// made-up diffs. See ./index.ts.
import { createSignal } from 'solid-js';

import type { FileText, GitChange, GitStatus } from '@bica/shared/protocol';

let v = 0;

// A file that looks like its kind, so the diff highlights.
function lines(path: string, n: number, salt: number): string[] {
  const ext = path.slice(path.lastIndexOf('.') + 1);
  return Array.from({ length: n }, (_, i) => {
    const k = i + salt;
    if (ext === 'md')
      return k % 6 === 0
        ? `## Section ${k / 6 + 1}`
        : `Line ${k} of the notes says what changed and why it matters.`;
    if (ext === 'css')
      return k % 4 === 0
        ? `.row-${k} {`
        : k % 4 === 3
          ? '}'
          : `  padding: ${k % 12}px;`;
    if (ext === 'json') return `  "key${k}": "value ${k}",`;
    return k % 9 === 0
      ? `export function step${k}(input: string) {`
      : k % 9 === 8
        ? '}'
        : `  const value${k} = input.slice(${k % 7}, ${(k % 7) + 4});`;
  });
}

function text(t: string[]): FileText {
  return { text: `${t.join('\n')}\n` };
}
const missing: FileText = { text: null, reason: 'missing' };

/** Before and after for a test change; counts capped to stay light. */
function diffFor(c: GitChange): { old: FileText; new: FileText } {
  if (c.added === undefined && c.removed === undefined)
    return {
      old: { text: null, reason: 'binary' },
      new: { text: null, reason: 'binary' },
    };
  const added = Math.min(c.added ?? 0, 400);
  const removed = Math.min(c.removed ?? 0, 400);
  if (c.status === 'U' || c.status === 'A')
    return { old: missing, new: text(lines(c.path, added, 0)) };
  if (c.status === 'D')
    return { old: text(lines(c.path, removed, 0)), new: missing };
  // Unchanged lines around two edits, so hunks and context show.
  const base = lines(c.path, 60 + removed, 0);
  const cut = Math.min(14, base.length);
  const after = [
    ...base.slice(0, cut),
    ...lines(c.path, Math.ceil(added / 2), 1000),
    ...base.slice(cut + Math.ceil(removed / 2), cut + 30),
    ...lines(c.path, Math.floor(added / 2), 2000),
    ...base.slice(cut + 30 + Math.floor(removed / 2)),
  ];
  return { old: text(base), new: text(after) };
}

export interface GitFixtures {
  repos: () => Record<string, GitStatus>;
  play: (
    call: string,
    args: Record<string, unknown>,
  ) => Promise<unknown> | undefined;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MESSAGES = [
  'Let sidebar columns resize by dragging their edge',
  'Drag the sidebar edge to resize it, and remember the width per device',
];

export function gitFixtures(start: Record<string, GitStatus>): GitFixtures {
  const [repos, setRepos] = createSignal(start, { name: 'fixtureRepos' });
  let drafts = 0;
  const update = (cwd: string, edit: (s: GitStatus) => GitStatus) =>
    setRepos((all) => (all[cwd] ? { ...all, [cwd]: edit(all[cwd]) } : all));
  const pick = (list: GitChange[], paths?: string[]) =>
    paths ? list.filter((c) => paths.includes(c.path)) : list;
  const drop = (list: GitChange[], paths?: string[]) =>
    paths ? list.filter((c) => !paths.includes(c.path)) : [];
  // Moved files are new on that side: a new version, so diffs re-read.
  const moved = (list: GitChange[]) =>
    list.map((c) => ({ ...c, version: `v${++v}` }));

  const play = (call: string, a: Record<string, unknown>) => {
    const cwd = a.cwd as string;
    const paths = a.paths as string[] | undefined;
    if (!repos()[cwd]) return undefined;
    switch (call) {
      case 'git.stage':
        update(cwd, (s) => ({
          ...s,
          staged: [...s.staged, ...moved(pick(s.unstaged, paths))],
          unstaged: drop(s.unstaged, paths),
        }));
        return wait(120).then(() => null);
      case 'git.unstage':
        update(cwd, (s) => ({
          ...s,
          unstaged: [...moved(pick(s.staged, paths)), ...s.unstaged],
          staged: drop(s.staged, paths),
        }));
        return wait(120).then(() => null);
      case 'git.discard':
        update(cwd, (s) => ({ ...s, unstaged: drop(s.unstaged, paths) }));
        return wait(200).then(() => null);
      case 'git.suggest':
        return wait(1400).then(() => MESSAGES[drafts++ % MESSAGES.length]);
      case 'git.commit':
        return wait(1100).then(() => {
          update(cwd, (s) => ({
            ...s,
            ahead: s.ahead + 1,
            staged: [],
            unstaged: a.all ? [] : s.unstaged,
            recent: [
              {
                hash: Math.random().toString(16).slice(2, 9),
                subject: String(a.message).split('\n')[0]!,
                time: Date.now(),
              },
              ...s.recent,
            ],
          }));
          return null;
        });
      case 'git.push':
        return wait(1600).then(() => {
          update(cwd, (s) => ({
            ...s,
            ahead: 0,
            upstream: s.upstream ?? `origin/${s.branch}`,
          }));
          return null;
        });
      case 'git.pull':
        return wait(1300).then(() => {
          update(cwd, (s) => ({ ...s, behind: 0 }));
          return null;
        });
      default:
        return undefined;
    }
  };

  return { repos, play };
}

/** Before and after for a test change, found by path in any list. */
export function fixtureDiff(
  git: GitFixtures,
  call: string,
  a: Record<string, unknown>,
): Promise<unknown> | undefined {
  const path = a.path as string;
  const cwd = a.cwd as string;
  const s = git.repos()[cwd];
  const all = s
    ? [s, ...s.submodules].flatMap((r) => [...r.staged, ...r.unstaged])
    : [];
  const c = all.find((x) => x.path === path);
  if (call === 'git.diff') return c && Promise.resolve(diffFor(c));
  if (call === 'file.read' && s) {
    if (c?.status === 'D') return Promise.resolve(missing);
    const d = c ? diffFor(c).new : text(lines(path, 80, 0));
    return Promise.resolve(d);
  }
  return undefined;
}
