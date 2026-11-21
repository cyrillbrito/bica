# Orca

From https://onorca.dev and https://github.com/stablyai/orca. Kind: orchestrator, sold as an "agent IDE". A desktop app that runs any agent CLI in a terminal, each in its own worktree, with a mobile companion.

- Fan one prompt across several agents, each in a worktree, compare, and merge the winner.
- Annotate diffs: markdown comments on any diff line, batched and sent back to the agent.
- Design mode: click an element in a built-in Chromium window to send its HTML, CSS, and a cropped screenshot into the prompt.
- GitHub and Linear inside the app: browse pull requests, issues, and boards, and open a worktree from a task. CI checks and conflicts are shown too.
- SSH worktrees with port forwarding, a quick open across worktrees, files, agents, and commands, Claude and Codex usage with rate-limit resets, and threads you can mark unread.
- An `orca` CLI the agents use to create worktrees and drive the browser.

For Bica, diff comments sent back to the agent and the browser preview are the two big gaps.

![](transcript-changes.png)

![](inline-diff.png)

![](new-tab-menu.png)

![](file-tree.png)
