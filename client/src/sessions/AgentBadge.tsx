import { Dynamic, type JSX } from '@solidjs/web';
import { Show } from 'solid-js';

import { AGENTS, isLongLived, type AgentId } from '@bica/shared/agents';
import { BLOATED, LONG_LIVED_COMPACT_AT } from '@bica/shared/context-usage';
import { formatTokens } from '../ui/format';
import { AssistantIcon, CodeIcon, HubIcon, MoonIcon } from '../ui/icons';

const LONG_LIVED_HINT = `While it sits idle, Bica clears old tool output once the cache is cold, and past ${formatTokens(LONG_LIVED_COMPACT_AT)} it has the agent save to its memory files, then compacts. Past ${formatTokens(BLOATED)} it does that at the first pause.`;

const AGENT_ICON: Record<AgentId, () => JSX.Element> = {
  coding: CodeIcon,
  assistant: AssistantIcon,
  night: MoonIcon,
  hub: HubIcon,
};

/** Which agent a session runs as, when it isn't the usual Coding one. */
export default function AgentBadge(props: { agent: AgentId }) {
  return (
    <Show when={props.agent !== 'coding'}>
      <span
        class="shrink-0 text-muted"
        title={`${AGENTS[props.agent].label}: ${AGENTS[props.agent].description}.${isLongLived(props.agent) ? ` ${LONG_LIVED_HINT}` : ''}`}
      >
        <Dynamic component={AGENT_ICON[props.agent]} />
      </span>
    </Show>
  );
}
