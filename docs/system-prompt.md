# System prompt and skills

The system prompt is built from named prompt sections that every [agent](./agents.md) shares, as in the Pi coding agent. Edits apply to running sessions. The memory index, the hub's project list, and the connected apps are copies taken at a session's first prompt and after each compaction, so their changes don't break the prompt cache. The sections that change least come first, so a change keeps most of the prompt cache.

1. What Bica is and what this session does.
2. The tools the session has, one line each, with their rules, such as git staying read-only unless asked. A session without a tool gets neither its line nor its rules.
3. The connected apps and how to reach them ([connectors.md](./connectors.md)), then the declarations of the tools code mode scripts can call.
4. Project instructions: your `~/.bica/AGENTS.md`, then the `AGENTS.md` or `CLAUDE.md` of each folder down to the workspace, then the memory index, the hub's project list, the skills, a line on where [artifacts](./artifacts.md) live for agents with skills, and the workspace's path.
5. Rules shared by kind: handoffs to child sessions, and keeping memory for long-lived sessions such as [assistant mode](./assistant-mode.md) and the [hub](./hub.md).
6. The agent's own role, such as a [night run](./night-runs.md)'s rules to finish alone.
7. How to reply, below.

## Skills

Skills are Agent Skills folders, each with a `SKILL.md`. Only their names and descriptions go into the system prompt, and the agent reads a skill when it fits. Bica looks in the workspace's `.agents/skills`, `.claude/skills`, and `.bica/skills`, then the same folders in your home, then the skills Bica ships, such as `artifacts` ([artifacts.md](./artifacts.md)). On a name clash the workspace wins, and Bica's own lose to any other.

This repo's own skills are installed with the [skills](https://skills.sh) CLI: `bunx skills add <owner/repo> -s <skill> -a pi`, and `bunx skills update -p` refreshes them.

## Short replies

The system prompt ends with rules for replies, since you run many sessions and skim each reply. They give the reason as a fact about you, because a preference like "be concise" gets traded away and a fact doesn't. They set limits in numbers, since without them replies to long dictated prompts doubled. A check before sending asks whether the first and last lines alone say what happened and what to do next. The rules sit last, where they weigh the most.

## Sources

- The Pi coding agent's [system prompt](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/system-prompt.ts): named sections, and tool rules that come only with the tool.
- [i-have-adhd](https://github.com/ayghri/i-have-adhd): the shape of the reply rules, the limits, and the check before sending.
- [caveman](https://github.com/JuliusBrussee/caveman): answer first and cut ceremony.
- [unslop](https://github.com/theclaymethod/unslop) and Wikipedia's [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing): say what something does, not how it feels.
- The [Codex system prompt](https://github.com/openai/codex/blob/main/codex-rs/core/prompt.md): short flat lists ordered by importance.
- Anthropic's [prompting best practices](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices): say what to do rather than what not to do, and repeat a short reminder near the end.
