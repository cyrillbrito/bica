# Inspiration

Screenshots of other agent UIs. These are ideas to pick from, not designs to copy. Each app has some concepts worth taking, and plenty we don't want.

Under each app, "Take" and "Skip" are for you to fill in.

Each app's README says what kind it is. Not every "AI orchestrator" on tier lists is one:

- Orchestrators run many agents at once, each in its own worktree, and give you one place to watch and review them: T3 Code, Orca, Superset, Paseo, Agent Orchestrator, Traycer.
- Omnigent is a meta-harness: one session format, policies, and sandboxes over other agents.
- CodexHost is a bridge that runs other agents inside the Codex desktop app.
- Hermes Agent, Oh My Pi, and mini-swe-agent are agents themselves: a personal assistant, and two coding agents.
- OpenBot and MausBot are agent teams: named agents or bots, each with a job, that run on the agent CLIs you already have.

## T3 Code

`t3-code/`: an orchestrator with web, desktop, and mobile apps over the agent CLIs, and a one-button pull request. See `t3-code/README.md`. Screenshots: session list with project and branch, inline "N changed files" card in the transcript, a right panel with Diff / file / terminal tabs, and a workspace and branch picker under the prompt.

- Take: _TODO_
- Skip: _TODO_

## OpenCode Desktop

`opencode-desktop/`: a project home page (projects on the left, sessions grouped by Today / Older), one tab per session, and a "Files Changed" view with a tree beside a split diff.

- Take: _TODO_
- Skip: _TODO_

## Claude desktop (Code)

`claude-desktop/`: sessions grouped by project, a branch bar with the diff size and a "Create PR" button above the prompt, and a right panel that switches between diff (tree plus diff), terminal, and browser preview (it detects the dev server).

- Take: _TODO_
- Skip: _TODO_

## herdr

`herdr/`: a terminal-style app with "spaces" (repo and branch) and an "agents" list with status and priority, wrapping the Pi TUI.

- Take: _TODO_
- Skip: _TODO_

## Orca

`orca/`: an orchestrator with diff comments sent back to the agent and a built-in browser with design mode. See `orca/README.md`. Screenshots: projects with worktrees listed underneath (branch, latest agent message, PR state), tabs for agent, diff, and files, a Git panel with staging and Create PR, a new-tab menu to pick an agent (Pi, Claude, Codex, …), and a file tree with name and content search.

- Take: _TODO_
- Skip: _TODO_

## Delta (name unsure)

`delta/`: Projects plus loose "Threads", a file viewer and tree beside the chat, and the worktree and branch shown under the prompt.

- Take: _TODO_
- Skip: _TODO_

## GitHub Copilot app (name unsure)

`copilot/`: Home / My work / Automations, sessions grouped by repo with quick "Chats", a worktree-ready status in the transcript, and a right panel with Changes / Terminal / file tabs that includes a rich markdown editor.

- Take: _TODO_
- Skip: _TODO_

## Agent Inbox

`agent-inbox/`: one queue of questions from agents across all projects, answered in place. See `agent-inbox/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Jean

`jean/`: a Recent tab across projects beside a Projects tab with a page per project. See `jean/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Ouijit

`ouijit/`: one project as a task board or a stack of task terminals with attached previews. See `ouijit/README.md`.

- Take: _TODO_
- Skip: _TODO_

## cmux

`cmux/`: rings on panes that wait for you, and a shortcut to the latest unread. See `cmux/README.md`.

- Take: _TODO_
- Skip: _TODO_

## ccanvas

`ccanvas/`: agents, files, and diffs on a zoomable canvas, with files gathering around the agent that touched them. See `ccanvas/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Craft Agents

`craft-agents/`: sessions with a status you set, browsed like a mail inbox. See `craft-agents/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Mux

`mux/`: review as a full half of the screen, with every changed file stacked and a read counter. See `mux/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Superset

`superset/`: a changes list on the right with a "Viewed" checkbox per file, and agents started on a schedule or event. See `superset/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Paseo

`paseo/`: a daemon with desktop, web, mobile, and CLI clients, agents that start other agents, voice, and triggers from GitHub. See `paseo/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Agent Orchestrator

`agent-orchestrator/`: a main agent per project, with CI failures and review comments routed back to the worker that owns the branch. See `agent-orchestrator/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Omnigent

`omnigent/`: a meta-harness with spend caps, sandboxes, and a debate between models. See `omnigent/README.md`.

- Take: _TODO_
- Skip: _TODO_

## CodexHost

`codexhost/`: other agents inside the Codex desktop app, handed tasks with `#`. See `codexhost/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Hermes Agent

`hermes/`: a personal agent in chat apps, with skills it writes itself and a scheduler. See `hermes/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Oh My Pi

`oh-my-pi/`: a Pi fork with typed subagent results and a ranked review with a verdict. See `oh-my-pi/README.md`.

- Take: _TODO_
- Skip: _TODO_

## Traycer

`traycer/`: agents that message each other, with specs shared across a task. See `traycer/README.md`.

- Take: _TODO_
- Skip: _TODO_

## OpenBot

`openbot/`: named agents in shared channels, workflows with approval steps, and a backup model when a plan runs out. See `openbot/README.md`.

- Take: _TODO_
- Skip: _TODO_

## MausBot

`mausbot/`: bots listed like chats in a messaging app, scheduled runs on a calendar, and a recorder that turns a chat into a skill. See `mausbot/README.md`.

- Take: _TODO_
- Skip: _TODO_

## mini-swe-agent

`mini-swe-agent/`: a bash-only coding agent in about 100 lines, and the Harness Leaderboard that ranks it with Pi, Claude Code, Codex, and others on the same models. See `mini-swe-agent/README.md`.

- Take: _TODO_
- Skip: _TODO_
