# OpenBot

From https://openbot.run. Kind: an agent team. A desktop app (macOS, Windows, Linux) runs named agents on your computer or a server, and phone apps connect to it. Source on GitHub under PolyForm Noncommercial.

- Each agent has a name, a role, instructions, and its own workspace. Agents message each other in channels, hand off tasks, share files, and review each other's work, like coworkers in a chat app.
- Runs other agents on plans you already pay for: Codex, Claude Code, Gemini, Grok, OpenCode, Cursor, Cline, Pi, any ACP agent, OpenAI-compatible endpoints, Ollama, and LM Studio.
- An agent keeps its workspace and conversation when it moves to another provider. When a plan hits its limit, or a provider is down, it moves to a backup model, and a note in the chat shows the switch.
- Workflows chain a trigger (such as every Monday at 9:00), steps by different agents, and approval steps.
- Multiplayer: people and agents share channels and projects.
- Messages to a busy agent wait in a queue.

For Bica, the fallback to a backup model when a plan runs out, with a note in the transcript, and workflows with an approval step are worth a look. Named agent personas and multiplayer channels are out of scope for one developer.
