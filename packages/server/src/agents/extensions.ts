import type { Context } from '@earendil-works/chord';
import {
  defineExtension,
  section,
  type Extension,
  type PromptInput,
} from '@earendil-works/pi-durable';
import { isLongLived } from '@bica/shared/agents';
import { AskTool } from '../tools/ask';
import { Codemode } from '../tools/codemode';
import { CodingTools, HubFileTools } from '../tools/coding';
import { ToolSummary } from '../tools/summary';
import { createWebTools } from '../tools/web';
import { exaKey } from '../models/exa';
import { install } from '../harness';
import { SessionDoc, agentIdOf } from '../sessions/session-doc';
import { HubSessionTools, SessionTools } from '../orchestration/tools';
import { HubTerminalTools, TerminalTools } from '../terminals/tools';
import { coding } from './coding';
import {
  HEAD_SECTIONS,
  LONG_LIVED,
  TAIL_SECTIONS,
  type Agent,
  type SectionInput,
  type SectionKey,
} from './common';
import { allAgents, extensionNames, getAgent } from './registry';
import { skillsSection } from './skills';

/** The text of section `key` for a session of `agent`, or nothing. */
async function renderSection(
  agent: Agent,
  key: SectionKey,
  input: SectionInput,
) {
  if (key === 'skills')
    return agent.skills ? skillsSection(input.cwd) : undefined;
  // From isLongLived, so the prompt and housekeeping can't disagree.
  if (key === 'long_lived')
    return isLongLived(agent.id) ? LONG_LIVED : undefined;
  const render = agent.sections[key];
  return typeof render === 'function' ? render(input) : render;
}

/** Renders the section `key` of the session's agent, or nothing. */
function on(key: SectionKey, options?: { tag: boolean }) {
  return section(
    key,
    async (input: PromptInput, context: Context) => {
      const meta = await input.read.snapshot(
        SessionDoc,
        input.conversationId,
        context,
      );
      const text = await renderSection(getAgent(agentIdOf(meta)), key, {
        tools: input.agent.tools.map((t) => t.name),
        cwd: input.agent.cwd ?? '',
        memory: meta?.memory || undefined,
        projects: meta?.projects || undefined,
      });
      return text ?? undefined;
    },
    options,
  );
}

/**
 * The instructions, as sections Pi Durable renders before every request, in
 * the order of the selected extensions: this one before the tools, so the
 * codemode section follows the tool list and rules.
 */
const BicaPrompt = defineExtension({
  name: 'bica-prompt',
  sections: HEAD_SECTIONS.map((key) =>
    on(key, key === 'preamble' ? { tag: false } : undefined),
  ),
});

/**
 * The rest, after the tools: the folder's files, the agent's role, and the
 * reply rules. Durable sends only the sections that changed, so AGENTS.md and
 * skill edits apply from the next request without breaking the prompt cache.
 * Memory and the hub's project list are copies kept in SessionDoc
 * (server/src/sessions/prompts.ts). The name predates the folder sections and
 * stays, since sessions store their extension list.
 */
const BicaContext = defineExtension({
  name: 'bica-replies',
  sections: TAIL_SECTIONS.map((key) => on(key)),
});

// The extensions behind the names sessions store, so the names stay as they are.
const BY_NAME: Record<string, Extension> = {
  'bica-prompt': BicaPrompt,
  'coding-tools': CodingTools,
  'terminal-tools': TerminalTools,
  // Web tools read the Exa key per call, so adding one needs no restart.
  web: createWebTools(exaKey),
  'session-tools': SessionTools,
  ask: AskTool,
  codemode: Codemode,
  'hub-file-tools': HubFileTools,
  'hub-session-tools': HubSessionTools,
  'hub-terminal-tools': HubTerminalTools,
  'bica-replies': BicaContext,
  'bica-tool-summary': ToolSummary,
};

function extensionsOf(a: Agent) {
  return extensionNames(a).map((name) => {
    const extension = BY_NAME[name];
    if (extension?.name !== name)
      throw new Error(`No extension is named ${name}`);
    return extension;
  });
}

/** Installs every extension an agent picks, before the harness opens. */
export function installAgents() {
  install(new Set(allAgents().flatMap(extensionsOf)), extensionsOf(coding));
}
