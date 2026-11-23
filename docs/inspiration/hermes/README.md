# Hermes Agent

From https://hermes-agent.nousresearch.com and https://github.com/NousResearch/hermes-agent. Kind: a personal agent, not an orchestrator. It has a terminal UI and a desktop app, and is close to Bica's assistant mode.

- One agent reached from Telegram, Discord, Slack, WhatsApp, Signal, email, and the terminal, with one memory.
- It writes skills from tasks it finished and improves them as it uses them. Past sessions are searchable, with summaries.
- A scheduler in plain language for reports and backups, delivered to any of those apps.
- Subagents, and Python scripts that call tools so long pipelines don't fill the context (like Bica's code mode).
- Runs local, in Docker, over SSH, or in cloud sandboxes that sleep when idle.

For Bica, search across past sessions and skills the agent writes itself fit assistant mode.
