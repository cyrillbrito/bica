# Terminals

Terminals are shells in a workspace, for commands and long-running processes such as dev servers. You and the agents share them.

## What you see

- A terminal belongs to a workspace ([projects.md](./projects.md)), not a session. The sidebar lists it above the workspace's sessions.
- It is a normal login shell. It can type a first command for you, such as `bun run dev`, and anyone can Ctrl-C it and run something else. Restart opens a fresh shell and types the first command again.
- When the shell exits, the terminal keeps its output and exit code until you close it.
- Stop, Restart, and closing all end the shell the same way, like `docker stop`. Everything it started, on its tty or not, gets SIGTERM, so a dev server shuts down cleanly. Once they are gone the shell gets SIGHUP, as closing a terminal window sends, since an interactive shell ignores SIGTERM. Whatever still runs after a few seconds gets SIGKILL.
- It opens full size in the centre. On a phone, a key bar adds Esc, Tab, Ctrl-C, and arrows.
- Any number of tabs can show the same terminal and join late. They draw it with [ghostty-web](https://github.com/coder/ghostty-web), Ghostty compiled to WebAssembly.
- Restarting Bica ends every shell.

In zsh, Bica knows when each command starts and ends and its exit code, without touching your zsh config.

## Agents

Agents get four tools, shaped after Codex's and Claude Code's background shells:

- `terminal_start` opens a shell, maybe with a first command. Starting the same name again restarts it in place, so a restarted dev server leaves no dead terminal behind.
- `terminal_read` returns the latest output and whether a command is running. It can wait up to 30 minutes first, so agents wait for a test run or a build here instead of `sleep` in bash. The wait ends early when the command ends, however it ends (Ctrl-C from anyone, a crash, a restart, or a close), when a given text such as a server's ready line shows up, or when a message arrives for the agent, yours included.
- `terminal_send` types into it, optionally pressing Ctrl-C first.
- `terminal_stop` closes it, the same way Stop does.

With `notify`, the agent gets a note when the command finishes, even if it is idle by then. A dev server rarely finishes, so its note usually means it crashed. A stop on purpose sends none: `terminal_send` with its Ctrl-C, a restart, or a close. Agents are told to use terminals instead of `&`, to check for a running one first, and to stop what they started.

## Parent and Detach

A terminal an agent starts has that session as its parent, as a [child session](./orchestration.md) does, and follows the same rules:

- A "Parent in charge" strip under the terminal's top bar links to the parent. Detach there makes the terminal yours for good.
- Archiving the parent closes the terminals it leads. When one still runs a command, the archive dialog lists them checked; unchecking one detaches it, so it stays open. Ones idle at their prompt or exited close without asking.
- Once detached, the agent that started it can't type into it or close it, unless you tell it to (`user_asked`), and hears nothing more from it. `list` shows it as the user's.

Terminals you open have no parent. Unlike a session, a terminal is closed, not archived: its process is gone, so there is nothing to bring back.

The [hub](./hub.md) gets only `terminal_read`, to read any terminal without typing into it.

## Sources

- Zed's [tasks](https://zed.dev/docs/tasks): rerunning a task reuses its terminal, and `hide: on_success` closes it when it succeeds.
- Conductor's [run script](https://docs.conductor.build/core/scripts) kills the old run before starting the new one.
- [`docker stop`](https://docs.docker.com/reference/cli/docker/container/stop/) and foreman: SIGTERM, a grace period, then SIGKILL.
