import type { Context } from '@earendil-works/chord/context';
import {
  defineExtension,
  section,
  type Extension,
  type PromptInput,
} from '@earendil-works/pi-durable';
import { AskTool } from '../tools/ask';
import { Codemode } from '../tools/codemode';
import { CodingTools } from '../tools/coding';
import { ToolSummary } from '../tools/summary';
import { createWebTools } from '../tools/web';
import { exaKey } from '../models/exa';
import { Connectors } from '../connectors/tools';
import { install } from '../harness';
import { SessionDoc, agentIdOf } from '../sessions/session-doc';
import { SessionTools } from '../orchestration/tools';
import { TerminalTools } from '../terminals/tools';
import { getBot } from '../bots/store';
import { coding } from './coding';
import {
  HEAD_SECTIONS,
  TAIL_SECTIONS,
  type Agent,
  type SectionInput,
  type SectionKey,
} from './common';
import { allAgents, extensionNames, getAgent } from './registry';
import { skillsSection } from './skills';
import { artifactsSection } from '../artifacts/artifacts';

/** The text of section `key` for a session of `agent`, or nothing. */
async function renderSection(
  agent: Agent,
  key: SectionKey,
  input: SectionInput,
) {
  if (key === 'skills')
    return agent.skills ? skillsSection(input.cwd) : undefined;
  // Building one takes the artifacts skill, so only agents with skills.
  if (key === 'artifacts') return agent.skills ? artifactsSection() : undefined;
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
        bot: getBot(meta?.bot),
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
 * A bot's memory and project list are copies kept in SessionDoc
 * (Agent.copies). The name predates the folder sections and
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
  // Composio's tools read the key per call, like the web tools.
  connectors: Connectors,
  codemode: Codemode,
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
