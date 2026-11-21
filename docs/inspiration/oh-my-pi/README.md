# Oh My Pi

From https://omp.sh and https://github.com/can1357/oh-my-pi. Kind: a coding agent, not an orchestrator. A fork of Pi's coding agent with a Rust core and a terminal UI.

- `task` fans out subagents into their own worktrees, and each returns a typed result the parent reads directly. Subagents can message each other.
- Agent Hub (`Alt+A`) lists every subagent with its activity and cost. You can read one live, steer it, revive it, or kill it without stopping the parent.
- `/review` starts reviewer subagents that rank each issue P0 to P3 with a confidence and end with a ship or no-ship verdict.
- `/annotate` pins your notes to diff lines or reply text and pastes them into the prompt.
- Many built-in tools: browser, desktop control, GitHub, image generation, text to speech, and a todo list.

For Bica, the review with ranked issues and a verdict, and typed results from child sessions, are worth borrowing.
