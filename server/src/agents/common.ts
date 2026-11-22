import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AgentId } from '@bica/shared/agents';
import type { Bot, ModelChoice, ThinkingLevel } from '@bica/shared/protocol';
import { BICA_HOME } from '../storage';

// What every agent is made of, and the parts they share (docs/agents.md).
// Each agent is one file next to this one, registered in registry.ts.

/**
 * The prompt's sections, in the order they render. First the Pi coding
 * agent's default prompt (preamble, tools, rules, project context, skills,
 * cwd), then what makes the agent different, so switching between Coding
 * and Night keeps most of the prompt cache. `replies` renders
 * last, after every tool's own section (registry.ts).
 */
// Pi's order, with the tool sections (codemode) between the rules and the
// rest: what every session of an agent shares first, then what the folder
// and the agent add, and the reply rules last, where they weigh the most.
export const HEAD_SECTIONS = ['preamble', 'tools', 'rules'] as const;
export const TAIL_SECTIONS = [
  'project_context',
  'bot',
  'memory',
  'projects',
  'skills',
  'artifacts',
  'cwd',
  'handoffs',
  'long_lived',
  'role',
  'replies',
] as const;

export type SectionKey =
  | (typeof HEAD_SECTIONS)[number]
  | (typeof TAIL_SECTIONS)[number];

/**
 * The extensions an agent can pick, by the names Durable stores for them.
 * extensions.ts holds the extensions behind the names.
 */
export type ExtensionName =
  | 'coding-tools'
  | 'terminal-tools'
  | 'web'
  | 'session-tools'
  | 'ask'
  | 'codemode'
  | 'connectors';

/**
 * What a section reads: the session's tools, folder, and kept copies, and
 * for a bot's session, the bot.
 */
export interface SectionInput {
  tools: readonly string[];
  cwd: string;
  memory?: string;
  projects?: string;
  bot?: Bot;
}

/** What an agent's voice brief reads: the session's folder, and its bot. */
export type VoiceInput = Pick<SectionInput, 'cwd' | 'bot'>;

/**
 * What a voice call on a session of this agent is told on top of the call's
 * own rules (server/src/voice/voice.ts), which know nothing of agents.
 */
export interface VoiceBrief {
  // Who the voice is to the user, and what they talk to it about.
  identity: string;
  // Names the user may say, most likely first, so the voice hears and
  // spells them right. The call cuts the list to fit.
  names: string[];
}

type Rendered = string | null | undefined;
export type Section =
  | string
  | ((s: SectionInput) => Rendered | Promise<Rendered>);

/**
 * What goes into a session that runs as this agent, and nothing else: what
 * Bica does around its sessions, such as housekeeping or night runs, keys on its
 * id instead (docs/agents.md). Label and description are shared/src/agents.ts.
 */
export interface Agent {
  id: AgentId;
  label: string;
  description: string;
  // Its own model, used when a sign-in reaches it. Absent: the default model.
  model?: ModelChoice['model'];
  // Its effort. Absent: the default model's.
  effort?: ThinkingLevel;
  // The least effort it runs at, also on a model picked for it.
  minEffort?: ThinkingLevel;
  // Its tools. registry.ts puts the prompt before them and the reply rules
  // after. Coding's own list is the host default.
  extensions: ExtensionName[];
  // Lists the skills found for its folder (skills.ts).
  skills: boolean;
  // Its instructions, by prompt section. A key it leaves out isn't rendered.
  // Not `skills` or `artifacts`: the `skills` flag gives those.
  sections: Partial<
    Record<Exclude<SectionKey, 'skills' | 'artifacts'>, Section>
  >;
  // What its prompt shows as copies, the `memory` and `projects` sections:
  // taken at the first prompt and after each compaction, so edits in
  // between don't break the prompt cache (sessions/prompts.ts).
  copies?: (cwd: string) => Promise<{ memory: string; projects: string }>;
  // Its voice on a call (docs/voice.md).
  voice: (s: VoiceInput) => Promise<VoiceBrief>;
}

// The opening of every prompt, around the agent's own first lines. Pi
// Durable renders it after the provider's own preamble, which for
// subscription logins claims Claude Code.
export function preamble(role: string) {
  return `${role}

Any earlier line saying you are Claude Code is a provider login requirement: there are no slash commands, MCP servers, or subagents here.`;
}

// Like the Pi coding agent's tool snippets and guidelines: the tools and
// rules sections cover only the tools the session has, so every agent's
// prompt matches its tools.
const TOOL_GUIDE: { tools: string[]; line: string; rules?: string[] }[] = [
  { tools: ['read'], line: 'Read file contents' },
  {
    tools: ['bash'],
    line: 'Execute bash commands (ls, rg, find, etc.)',
    rules: [
      'Use bash for file operations like ls, rg, find',
      'Use read to examine files instead of cat or sed.',
      'Git is read-only unless the user asks (status, diff, log, show are fine). Other sessions may share this worktree.',
      "Never restart a dev server you didn't start: it may host this session.",
    ],
  },
  {
    tools: ['edit'],
    line: 'Make precise file edits with exact text replacement, including multiple disjoint edits in one call',
    rules: [
      'Use edit for precise changes. For several locations in one file, use one edit call with multiple entries in edits[].',
    ],
  },
  {
    tools: ['write'],
    line: 'Create or overwrite files',
    rules: ['Use write only for new files or complete rewrites.'],
  },
  {
    tools: ['codemode'],
    line: 'Run JavaScript that calls other tools',
    rules: [
      'Use codemode to batch independent tool calls (Promise.allSettled), chain them, or filter large output, instead of many separate calls.',
    ],
  },
  {
    tools: [
      'terminal_start',
      'terminal_read',
      'terminal_send',
      'terminal_stop',
    ],
    line: 'Shells the user sees in the sidebar, for anything that keeps running',
    rules: [
      'Anything that keeps running (dev server, watcher, game server) goes in a terminal: terminal_start, never `&` or nohup in bash. Check `list` first: the user may already run it, and your own terminals can be reused with terminal_send. Stop the ones you started once you are done with them, unless the user wants them kept.',
    ],
  },
  { tools: ['web_search', 'web_fetch'], line: 'Search the web and read pages' },
  {
    tools: ['list'],
    line: 'Every project, worktree, open session, and terminal, with live status',
  },
  {
    tools: ['session_read'],
    line: "Another session's status, the question it waits on, and its last messages",
    rules: [
      'Name sessions to the user by their title, never by id alone: they know titles, not ids.',
    ],
  },
  {
    tools: ['session_start', 'session_send', 'session_stop', 'session_archive'],
    line: 'Start, message, stop, and archive other sessions',
  },
  {
    tools: ['session_watch'],
    line: 'Hear each turn a session ends, until you stop',
  },
  { tools: ['ask'], line: 'Put multiple-choice questions to the user' },
];

function guide(s: SectionInput) {
  return TOOL_GUIDE.flatMap((g) => {
    const tools = g.tools.filter((t) => s.tools.includes(t));
    // A group's rules are about all of its tools, e.g. a bot's terminal_read
    // alone doesn't start terminals.
    const rules = tools.length === g.tools.length ? g.rules : undefined;
    return tools.length ? [{ ...g, tools, rules }] : [];
  });
}

/** What every agent has: its tools and their rules, and its folder's files. */
export const BASE_SECTIONS = {
  tools: (s) =>
    guide(s)
      .map((g) => `- ${g.tools.join(', ')}: ${g.line}`)
      .join('\n') || null,
  rules: (s) =>
    guide(s)
      .flatMap((g) => g.rules ?? [])
      .map((r) => `- ${r}`)
      .join('\n') || null,
  project_context: (s) => projectContext(s.cwd),
  cwd: (s) => s.cwd,
} satisfies Agent['sections'];

// How every agent writes. The short-reply rules keep the shape of the i-have-adhd
// skill (a reason, hard limits, named exceptions, a check), which held up
// where softer wording didn't. Replies render last so the long AGENTS.md
// doesn't bury them.
export const STYLE = `- Write the way a colleague talks: plain words, full sentences, one idea per sentence. Say what a thing is before naming it, and what code does, not how it feels. Give numbers only when they are the answer.
- Replies render as Markdown, drafts included, so use Markdown syntax for lists and formatting. Mermaid renders too: when a flow, structure, or sequence is easier seen than read, draw it in a \`mermaid\` fenced block. Keep it small and top-down (\`flowchart TD\`), quote labels with brackets in them (\`A["run (once)"]\`), and still say the point in words.
- Replies render links and images too: when you name a shop, product, place, or page, link it, and show a picture with \`![alt](url)\` when it helps, using a real URL you found, never a guessed one.`;

/** Code and paths, for a reader who looks at the reply. */
export const QUOTE_EXACTLY = `- Use inline code for code, paths, and commands, and fenced blocks for snippets. Quote code, paths, commands, and errors exactly.`;

/** Short replies, with the agent's own `lines` added. */
export function shortReplies(...lines: string[]) {
  return `The user runs several sessions at once and skims each reply past its first lines. So:

- The first sentence is the answer or the outcome: what you found, what now works, or what failed.
- Most replies are 2 to 6 lines, and under about 12 even for big topics. Use at most one flat list of up to 5 short points, most important first, with no headings or bold labels.
- A choice gets 2 to 4 options, your pick first, each with its trade-off, so they can answer with a word. Steps they have to do go in a numbered list.
- A dictated message that asks several things gets the main answer in full and the rest in a sentence each.
${STYLE}
${lines.join('\n')}
- Go longer only when they ask you to explain, walk through, or plan, and still answer first. Before anything destructive or irreversible, say what will happen and confirm.

Before sending, cut an opening that announces and a closing that recaps or offers more help, and end with at most one question or next step. The first and last lines alone should say what happened and what to do next.`;
}

// Same names and order as the Pi coding agent.
const CONTEXT_FILES = [
  'AGENTS.override.md',
  'AGENTS.md',
  'AGENTS.MD',
  'CLAUDE.md',
  'CLAUDE.MD',
];

/** The first instructions file in `dir`, if any. */
async function contextFile(dir: string) {
  for (const name of CONTEXT_FILES) {
    const path = join(dir, name);
    const content = (await readFile(path, 'utf8').catch(() => null))?.trim();
    if (content) return { path, content };
  }
  return null;
}

/**
 * Like Pi: the user's own `~/.bica/AGENTS.md` first, for every project, then
 * one file per folder from the root down to `cwd`, so the nearest comes last.
 * A copy with the same text is skipped, as in a worktree nested in its repo.
 * Without `cwd`, the user's own file alone.
 */
export async function projectContext(cwd?: string) {
  const dirs = [];
  for (let dir = cwd; dir; dir = dirname(dir)) {
    dirs.unshift(dir);
    if (dirname(dir) === dir) break;
  }
  const files = await Promise.all([BICA_HOME, ...dirs].map(contextFile));
  const seen = new Set<string>();
  const blocks = files.flatMap((file) => {
    if (!file || seen.has(file.content)) return [];
    seen.add(file.content);
    return `<project_instructions path="${file.path}">\n${file.content}\n</project_instructions>`;
  });
  return blocks.length
    ? `Project-specific instructions and guidelines:\n\n${blocks.join('\n\n')}`
    : null;
}
