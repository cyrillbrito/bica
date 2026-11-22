// The agents a session can run as (docs/agents.md): what goes into it. This
// is the half the browser needs; the rest of each one, its model, tools, and
// instructions, is on the server, listed in server/src/agents/registry.ts.
// Bica picks the agent itself: Night for tonight's runs, Bot for a bot's
// session, and Coding for every other.
export const AGENTS = {
  coding: {
    label: 'Coding',
    description: 'Works on code with every tool',
  },
  night: {
    label: 'Night',
    description:
      'Runs alone at night, without questions, and ends with a report',
  },
  bot: {
    label: 'Bot',
    description:
      'Talks with you about all your work and gets it done through sessions',
  },
} as const;

export type AgentId = keyof typeof AGENTS;

export function isAgent(value: unknown): value is AgentId {
  return typeof value === 'string' && Object.hasOwn(AGENTS, value);
}

// A bot's session lasts months, so housekeeping prunes and compacts it while
// it sits idle (server/src/sessions/housekeeping.ts). It also gets the
// `long_lived` prompt section (server/src/agents/extensions.ts).
export function isLongLived(agent: AgentId) {
  return agent === 'bot';
}

// A bot's session works in its home, not a workspace, so it shows no Git,
// files, or terminal panels.
export function hasPanels(agent: AgentId) {
  return agent !== 'bot';
}
