import type { WorkspaceRef } from '@bica/shared/protocol';
import { askFast, fastModelId } from '../models/fast-model';
import { recentPrompts } from '../sessions/read';
import { pendingChanges } from './workspace';

const SYSTEM = `You write git commit messages. You get the changes the commit will record (<changes>), the repository's recent commit subjects (<recent_commits>), and sometimes what the developer asked their coding agents to do since the last commit (<agent_requests>).

Match the recent commits' format first: their prefixes ("feat(scope): ", ticket keys), casing, and length. That format wins over every rule below. Ignore vague subjects like "WIP" when judging it. When the recent commits show no clear format, use Conventional Commits: a type prefix ("feat: ", "fix: ", "chore: ", "docs: ", "refactor: ") and a lowercase summary.

Write one short line: aim for 3 to 7 words after any prefix.
- Say what the commit does at a high level, the way a teammate would sum it up: "feat: add commit button to Git panel", "fix(git): crash when a session has no title". Name the feature or fix, not the files, functions, or individual edits.
- Imperative mood ("add", "fix", not "added", "fixes"). No trailing period.
- When the commit does several things, name only the main one. No lists of changes, no "and" chains.
- Agent requests tell you the intent, but they can cover work outside this commit. Never describe something the diff doesn't show.
- Plain text only: no body, no markdown, no quotes, no preamble. Reply with the line only.`;

const cache = new Map<number | bigint, Promise<string>>();
const MAX_CACHED = 40;

/**
 * A commit message for what's staged (all: for every change), or null when
 * no fast model is set. The same changes and context reuse the last answer
 * unless `fresh`.
 */
export async function suggestCommitMessage(
  ref: WorkspaceRef,
  {
    all = false,
    fresh = false,
    repo,
  }: {
    all?: boolean;
    fresh?: boolean;
    repo?: string;
  } = {},
): Promise<string | null> {
  if (!fastModelId()) return null;
  const pending = await pendingChanges(ref, all, repo);
  if (!pending.files.length) throw new Error('Nothing to commit');
  const requests = await recentPrompts(pending.cwd, pending.lastCommit).catch(
    (error) => {
      // Intent is a bonus; the diff alone still makes a message.
      console.error('[commit message] sessions', error);
      return [];
    },
  );
  const prompt = [
    pending.branch && `<branch>${pending.branch}</branch>`,
    pending.recentSubjects.length &&
      `<recent_commits>\n${pending.recentSubjects.join('\n')}\n</recent_commits>`,
    // Said outright: models drift back to plain subjects otherwise.
    conventional(pending.recentSubjects) &&
      'This repository uses Conventional Commits. Start with a type and, if the recent commits use one, a scope: "feat(scope): ", "fix: ", "docs: ", "chore: ".\nPick the type from the main change: feat adds or changes behavior, fix repairs a bug, refactor restructures code without changing behavior, docs only when every changed file is documentation, test only touches tests, chore covers tooling, config, and dependencies.',
    requests.length &&
      `<agent_requests>\n${requests
        .map(
          (s) =>
            `Session "${s.title}":\n${s.prompts.map((p) => `- ${p.replace(/\s+/g, ' ')}`).join('\n')}`,
        )
        .join('\n\n')}\n</agent_requests>`,
    `<changes>\nFiles:\n${pending.files.join('\n')}\n\n${pending.stat}\n\n${pending.diff}\n</changes>`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const key = Bun.hash(prompt);
  let answer = fresh ? undefined : cache.get(key);
  if (!answer) {
    answer = askFast(SYSTEM, prompt, { maxTokens: 60 }).then(clean);
    cache.set(key, answer);
    answer.catch(() => cache.delete(key));
    while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  }
  const message = await answer;
  if (!message) throw new Error('The model wrote no message; try again');
  return message;
}

/** Most recent subjects start with `type:` or `type(scope):`. */
function conventional(subjects: string[]) {
  return (
    subjects.length >= 3 &&
    subjects.filter((s) => /^[a-z]+(\([^)]*\))?!?: /.test(s)).length * 2 >
      subjects.length
  );
}

/** The reply's first line, without fences, quotes, labels, or a period. */
function clean(reply: string) {
  const line =
    reply
      .replace(/```[a-z]*/g, '')
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? '';
  return line
    .replace(/^(commit message:)\s*/i, '')
    .replace(/^["'`*]+|["'`*]+$/g, '')
    .replace(/\.$/, '')
    .trim();
}
