import type { Extension } from '@earendil-works/pi-durable';
import type { AgentId } from '@bica/shared/agents';
import { registry } from '../harness';
import { assistant } from './assistant';
import { coding } from './coding';
import type { Agent } from './common';
import { hub } from '../hub/agent';
import { night } from '../night-runs/agent';

const AGENTS: Record<AgentId, Agent> = { coding, assistant, night, hub };

export function getAgent(id: AgentId) {
  return AGENTS[id];
}

export function allAgents() {
  return Object.values(AGENTS);
}

/**
 * An agent's extensions by name, in a fixed order: the prompt, the agent's
 * tools, then the folder's files and the reply rules, which come last.
 * agents/extensions.ts holds the extensions behind the names.
 */
export function extensionNames(a: Agent) {
  return ['bica-prompt', ...a.extensions, 'bica-replies', 'bica-tool-summary'];
}

function sameNames(a: string[], b: string[]) {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

/**
 * The extension list a session of `agent` stores. Null for agents that
 * resolve to the default, so switching between them keeps following it.
 */
export function selection(agent: Agent): Extension[] | null {
  const names = extensionNames(agent);
  if (sameNames(names, extensionNames(coding))) return null;
  const installed = registry.snapshot();
  return names.map((name) => {
    const extension = installed.extension(name);
    if (!extension) throw new Error(`Extension ${name} is not installed`);
    return extension;
  });
}
