// The agents a session can run as (docs/agents.md): what goes into it. This
// is the half the browser needs; the rest of each one, its model, tools, and
// instructions, is on the server, listed in server/src/agents/registry.ts.
export const AGENTS = {
  coding: {
    label: 'Coding',
    description: 'Works on code with every tool',
  },
  assistant: {
    label: 'Assistant',
    description: 'Keeps going for months in one project, with memory in files',
  },
  night: {
    label: 'Night',
    description:
      'Runs alone at night, without questions, and ends with a report',
  },
  hub: {
    label: 'Hub',
    description: 'Coordinates other sessions and does no work itself',
  },
} as const;

export type AgentId = keyof typeof AGENTS;

// The agents a person picks for a session, when starting it or later. Bica
// sets the others itself: the hub from its page, Night for tonight's runs.
export type PickableAgent = Extract<AgentId, 'coding' | 'assistant'>;

export function isAgent(value: unknown): value is AgentId {
  return typeof value === 'string' && Object.hasOwn(AGENTS, value);
}

// Long-lived sessions, which housekeeping prunes and compacts while they sit
// idle (server/src/sessions/housekeeping.ts): assistant mode
// (docs/assistant-mode.md) and the hub (docs/hub.md). It also gives them the
// `long_lived` prompt section (server/src/agents/extensions.ts).
export function isLongLived(agent: AgentId) {
  return agent === 'assistant' || agent === 'hub';
}
