import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import { $ } from 'bun';

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { startBica, type Bica } from '../testing/bica';

setDefaultTimeout(15_000);

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

async function commitFiles(cwd: string, message: string) {
  await $`git add -A && git commit -q -m ${message}`.cwd(cwd);
  return (await $`git rev-parse HEAD`.cwd(cwd).text()).trim();
}

test('an opened commit lists the files it changed with their lines, the first commit included', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab, 'opened');
  const { cwd } = ref;
  await writeFile(join(cwd, 'keep.txt'), 'one\ntwo\nthree\n');
  await writeFile(join(cwd, 'gone.txt'), 'bye\n');
  await writeFile(join(cwd, 'old-name.txt'), 'the same words\n'.repeat(20));
  const first = await commitFiles(cwd, 'Start');

  await writeFile(join(cwd, 'keep.txt'), 'one\n2\nthree\nfour\n');
  await rm(join(cwd, 'gone.txt'));
  await $`git mv old-name.txt new-name.txt`.cwd(cwd);
  await writeFile(join(cwd, 'fresh.txt'), 'hello\n');
  const second = await commitFiles(cwd, 'Change things\n\nWhy they changed.');

  const opened = await tab.request('git.show', { ...ref, hash: second });
  expect(opened.subject).toBe('Change things');
  expect(opened.body).toBe('Why they changed.');
  expect(opened.author).toBe('Bica Test');
  const files = Object.fromEntries(
    opened.files.map((f) => [
      f.path,
      [f.status, f.added, f.removed, f.oldPath ?? null],
    ]),
  );
  expect(files).toEqual({
    'keep.txt': ['M', 2, 1, null],
    'gone.txt': ['D', 0, 1, null],
    'new-name.txt': ['R', 0, 0, 'old-name.txt'],
    'fresh.txt': ['A', 1, 0, null],
  });

  // Each side loads the way a staged change's does.
  const keep = opened.files.find((f) => f.path === 'keep.txt')!;
  const q = new URLSearchParams({
    project: ref.projectId,
    cwd,
    path: 'keep.txt',
  });
  const before = await fetch(
    `http://127.0.0.1:${bica.port}/blob/${keep.blobs!.old}?${q.toString()}`,
  );
  expect(await before.text()).toBe('one\ntwo\nthree\n');

  const root = await tab.request('git.show', { ...ref, hash: first });
  const byPath = (a: string[], b: string[]) => a[0]!.localeCompare(b[0]!);
  expect(root.files.map((f) => [f.path, f.status]).sort(byPath)).toEqual([
    ['gone.txt', 'A'],
    ['keep.txt', 'A'],
    ['old-name.txt', 'A'],
  ]);

  // A merge shows what it brought in: the diff against its first parent.
  await $`git checkout -q -b side`.cwd(cwd);
  await writeFile(join(cwd, 'side.txt'), 'from the side\n');
  await commitFiles(cwd, 'Side work');
  await $`git checkout -q - && git merge -q --no-ff -m Merge side`.cwd(cwd);
  const merge = (await $`git rev-parse HEAD`.cwd(cwd).text()).trim();
  const merged = await tab.request('git.show', { ...ref, hash: merge });
  expect(merged.files.map((f) => f.path)).toEqual(['side.txt']);
});

test('commits no remote has yet are marked, and only those', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab, 'pushing');
  const { cwd } = ref;
  await writeFile(join(cwd, 'a.txt'), 'a\n');
  await commitFiles(cwd, 'Pushed one');
  await writeFile(join(cwd, 'a.txt'), 'b\n');
  await commitFiles(cwd, 'Pushed two');

  // No remote at all: nowhere to push, so nothing is marked.
  const alone = await tab.request('git.log', { ...ref, count: 10 });
  expect(alone.commits.map((c) => [c.subject, c.unpushed])).toEqual([
    ['Pushed two', false],
    ['Pushed one', false],
  ]);

  const remote = join(bica.root, 'pushing-remote.git');
  await mkdir(remote);
  await $`git init -q --bare`.cwd(remote);
  await $`git remote add origin ${remote} && git push -q -u origin HEAD`.cwd(
    cwd,
  );
  await writeFile(join(cwd, 'a.txt'), 'c\n');
  await commitFiles(cwd, 'Local three');
  await writeFile(join(cwd, 'a.txt'), 'd\n');
  await commitFiles(cwd, 'Local four');

  const page = await tab.request('git.log', { ...ref, count: 3 });
  expect(page.commits.map((c) => [c.subject, c.unpushed])).toEqual([
    ['Local four', true],
    ['Local three', true],
    ['Pushed two', false],
  ]);
  expect(page.more).toBe(true);
  const next = await tab.request('git.log', { ...ref, skip: 3, count: 3 });
  expect(next.commits.map((c) => [c.subject, c.unpushed])).toEqual([
    ['Pushed one', false],
  ]);
  expect(next.more).toBe(false);

  const opened = await tab.request('git.show', {
    ...ref,
    hash: page.commits[0]!.hash,
  });
  expect(opened.unpushed).toBe(true);
});

test('a commit links to its page on GitHub or GitLab, from any form of origin', async () => {
  const tab = await bica.connect();
  const ref = await bica.project(tab, 'linked');
  const { cwd } = ref;
  await writeFile(join(cwd, 'a.txt'), 'a\n');
  const hash = await commitFiles(cwd, 'One');
  await $`git remote add origin placeholder`.cwd(cwd);

  const cases: [string, string | null][] = [
    ['git@github.com:acme/widgets.git', 'https://github.com/acme/widgets'],
    [
      'ssh://git@github.com:22/acme/widgets.git',
      'https://github.com/acme/widgets',
    ],
    ['https://github.com/acme/widgets', 'https://github.com/acme/widgets'],
    [
      'https://someone@github.com/acme/widgets.git',
      'https://github.com/acme/widgets',
    ],
    [
      'git@gitlab.com:acme/tools/widgets.git',
      'https://gitlab.com/acme/tools/widgets/-',
    ],
    [
      'https://gitlab.example.org/acme/widgets.git',
      'https://gitlab.example.org/acme/widgets/-',
    ],
    ['git@bitbucket.org:acme/widgets.git', null],
    ['/srv/git/widgets.git', null],
  ];
  for (const [remote, page] of cases) {
    await $`git remote set-url origin ${remote}`.cwd(cwd);
    const { commitUrl } = await tab.request('git.log', { ...ref, count: 1 });
    expect([remote, commitUrl && commitUrl + hash]).toEqual([
      remote,
      page && `${page}/commit/${hash}`,
    ]);
  }
});
