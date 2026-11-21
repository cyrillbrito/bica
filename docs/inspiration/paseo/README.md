# Paseo

From https://paseo.sh and https://github.com/getpaseo/paseo. Kind: orchestrator, the closest to Bica. A daemon runs on your machine, and desktop, web, native mobile, and CLI clients connect to it.

- Agents in Paseo create worktrees, launch other agents on any provider, and talk to them. Example: "take the issues labeled ready and fan them out to worktree agents".
- Skills for orchestration patterns: `/paseo-advisor` asks one other agent for advice, and `/paseo-committee` has two contrasting agents do a root cause analysis and a plan.
- Schedules, and triggers from GitHub, Slack, and Discord.
- Voice mode and dictation.
- Remote over an end-to-end encrypted relay with QR pairing, plain TCP, or Tailscale.
- Plugins add screens, sidebar items, composer pills, and themes to every client. Agents can change the UI without a restart.
- A built-in browser to check each worktree's app, split panes, and pull requests.

For Bica, the committee and advisor patterns and the triggers from GitHub are worth a look. Plugins are out of scope.
