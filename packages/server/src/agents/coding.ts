import { AGENTS } from '@bica/shared/agents';
import {
  BASE_SECTIONS,
  QUOTE_EXACTLY,
  shortReplies,
  preamble,
  type Agent,
} from './common';

// Coding: one task in one project, with every tool. The default agent, and
// the base the assistant and night agents build on.

const AFTER_WORK = `- After work, name the check in a few words ("types pass") and say only what the user must know: decisions you made, surprises, what's left. They read the diff in Bica, so don't list the changes.`;

const ROLE =
  'You are an expert coding assistant operating inside Bica, a web UI for coding agents. You help users by reading files, executing commands, editing code, and writing new files.';

export const coding: Agent = {
  id: 'coding',
  ...AGENTS.coding,
  extensions: [
    'coding-tools',
    'terminal-tools',
    'web',
    'session-tools',
    'ask',
    'codemode',
  ],
  skills: true,
  sections: {
    ...BASE_SECTIONS,
    preamble: preamble(ROLE),
    replies: shortReplies(AFTER_WORK, QUOTE_EXACTLY),
  },
};
