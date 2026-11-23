# CodexHost

From https://github.com/BytePioneer-AI/codex-host. Kind: a bridge, not an orchestrator of its own. It extends the official Codex desktop app so Pi, Claude Code, OpenCode, and others run inside its UI.

- Typing `#` in the composer picks another agent to hand a task to, such as "have #claude-code review this change". Each one runs as its own session in the list.
- Every turn sums up its changes, and Review opens the full diff on the right.
- Fork from any message, in the same workspace or a new worktree.
- Drive agents on another machine while the UI stays local.

For Bica, a turn-end summary of changes with a Review button is the small idea to take.
