# Agents

An agent is what goes into a session: its system prompt, its model and effort, its extensions with their tools, and its skills. Every session runs as one agent. Pi Durable uses the same word for the bundle a conversation runs with, and so do Claude Code, opencode, and eve.

- Coding: one task in one workspace, with every tool. The default.
- Night: finishes alone, at high effort or more, and ends with a report ([night-runs.md](./night-runs.md)). It has no `ask`, since nobody can answer.
- Bot: a bot's session, which talks with you about all your work and gets it done through sessions, with memory in its home ([bots.md](./bots.md)). It has Coding's extensions, [connected apps](./connectors.md) included, and its prompt says what only a bot should do with them.

An agent holds nothing else. What Bica does around a session is a feature of its own that looks at which agent the session runs as:

- The night runs feature holds a session for tonight as Night, and switches it to Coding once it ran.
- [Housekeeping](./bots.md#housekeeping) prunes and compacts bots' sessions while they sit idle.
- The bots feature starts a bot's session as Bot in its home, on the model its last session ran on, and passes the bot to the prompt sections, so one agent serves every bot with its own name, files, and workspace. A Bot session has no side panels, and sessions it starts get the default model, not its own.

Nobody picks an agent: Bica sets Night and Bot itself, and every other session runs as Coding.

Each agent is one file, a plain object that names its extensions: Coding in `server/src/agents/`, Bot and Night in their features' folders, all listed in `server/src/agents/registry.ts`. `server/src/agents/extensions.ts` installs the extensions behind the names at startup, and a session picks its agent's from Pi Durable's registry by name. Its system prompt fills the shared prompt sections ([system-prompt.md](./system-prompt.md)). The browser's half, each agent's label and description, is `shared/src/agents.ts`.

## Sources

- Pi Durable's per-conversation agent, which `configure()` changes in one commit.
- Agents as data in [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) and [opencode agents](https://opencode.ai/docs/agents/).
