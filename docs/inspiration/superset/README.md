# Superset

From https://superset.sh and https://github.com/superset-sh/superset. Screenshots come from its README. Kind: orchestrator. A desktop app that runs any agent CLI, each task in its own worktree.

![Superset](changes-panel.png)

The idea to look at is a changes list that stays on the right while the diff fills the center.

- The right panel has Files, Changes, and Review tabs, with the branch and its base at the top.
- Each file has a "Viewed" checkbox, and changes are grouped by folder.
- Agents (Claude, Codex, OpenCode) are tabs in the same strip as the changes.
- Automations start agents on a schedule or an event (issue triage, changelog drafts, dependency bumps), and they open pull requests for review.
- Any machine can be a host, so workspaces keep running while the laptop sleeps.
- A CLI, an SDK, and an MCP server let scripts and agents drive it. One click opens a worktree in VS Code, Cursor, Xcode, or JetBrains.

This is close to Bica's project page today. Automations on events and "open in editor" are what's new.
