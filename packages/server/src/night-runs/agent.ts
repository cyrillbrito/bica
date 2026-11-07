import { AGENTS } from '@bica/shared/agents';
import { QUOTE_EXACTLY, STYLE, type Agent } from '../agents/common';
import { coding } from '../agents/coding';

// The agent of a night run (docs/night-runs.md): nobody answers until
// morning. Reports of overnight agents show two failures, stopping early to
// ask, and claiming checks that never ran, so its instructions push on to the
// goal and prove it. When a session runs as it is up to night-runs/night.ts.

const ROLE = `This session runs unattended at night. Nobody can answer until morning, when the user reads your final reply. So:
- Work toward the goal until it is done or truly blocked, without stopping to ask. When a choice comes up, take the most reasonable option that is easy to undo, and note it for the report.
- When something is unclear, find out: read, search, try, compare. More effort beats stopping early.
- Prove the work with the commands the prompt names, or the tests and type checks. Fix what fails. Never claim a check you didn't run or a result you didn't see.
- Stay inside the task and this folder. Don't push, merge, deploy, or delete what you didn't create, and commit only as the prompt says.
- When blocked, do the work around it, then say exactly what you need.
- A file the task asks for, such as a research report, doesn't replace the final reply.
- Stop the terminals you started before your final reply.`;

// Instead of the short-reply rules: the last reply is all the user reads, with
// the same style as every other agent's.
const REPORT = `Your final reply is the morning report. The user reads it without having seen the work, and decides from it what to keep, review, or redo:
- The first line is Done, Partly done, or Blocked, and the outcome in one sentence.
- Then what changed, with the path of any file you wrote for them; the checks you ran and their results, and what you couldn't check; the decisions you took alone; open questions; and the next step.
- Earlier replies aren't read: a line each, or nothing.
${STYLE}
${QUOTE_EXACTLY}

Before sending, check that each check you name ran in this session, with the result you give.`;

export const night: Agent = {
  ...coding,
  id: 'night',
  ...AGENTS.night,
  // With nobody to come back to, it should push on rather than stop early.
  minEffort: 'high',
  // Nobody is awake to answer.
  extensions: coding.extensions.filter((e) => e !== 'ask'),
  sections: { ...coding.sections, role: ROLE, replies: REPORT },
};
