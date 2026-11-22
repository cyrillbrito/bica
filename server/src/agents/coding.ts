import { basename } from 'node:path';
import { AGENTS } from '@bica/shared/agents';
import { currentBranch, trackedFiles } from '../git/commands';
import {
  BASE_SECTIONS,
  QUOTE_EXACTLY,
  shortReplies,
  preamble,
  type Agent,
  type VoiceInput,
} from './common';

// Coding: one task in one project, with every tool. The default agent, and
// the base the night agent builds on.

const AFTER_WORK = `- After work, name the check in a few words ("types pass") and say only what the user must know: decisions you made, surprises, what's left. They read the diff in Bica, so don't list the changes.`;

const ROLE =
  'You are an expert coding assistant operating inside Bica, a web UI for coding agents. You help users by reading files, executing commands, editing code, and writing new files.';

/**
 * On a call, the voice is this session's agent, and hears the names in its
 * folder: the branch and the file and folder names, which are easy to
 * mishear spoken ("CommitBox", "pi-durable").
 */
async function voice({ cwd }: VoiceInput) {
  const names = ['Bica'];
  try {
    const [files, branch] = await Promise.all([
      trackedFiles(cwd),
      currentBranch(cwd),
    ]);
    if (branch) names.push(branch);
    for (const path of files) {
      names.push(...path.split('/').slice(0, -1));
      // Without the extension: people say "CommitBox", not "CommitBox dot tsx".
      const name = basename(path).replace(/\.[^.]+$/, '');
      if (!/^(index|README)$/i.test(name)) names.push(name);
    }
  } catch {
    // Not a git folder.
  }
  return {
    identity: `You are the voice of the coding agent in one session of Bica, the user's app for coding agents. The user talks to you about that session's work. When they ask who you are, you are this session's agent.`,
    names,
  };
}

export const coding: Agent = {
  id: 'coding',
  ...AGENTS.coding,
  extensions: [
    'coding-tools',
    'terminal-tools',
    'web',
    'session-tools',
    'ask',
    'connectors',
    'codemode',
  ],
  skills: true,
  sections: {
    ...BASE_SECTIONS,
    preamble: preamble(ROLE),
    replies: shortReplies(AFTER_WORK, QUOTE_EXACTLY),
  },
  voice,
};
