# Agent tools

The agent works through tools. Every call carries a short summary, so the transcript reads as a list of intentions.

- Read, write, edit, and bash work in the session's folder. Read also shows images to the model, shrunk or converted with Bun's image library when they are too big for the API or in a format it doesn't take.
- Web search and fetch go through Exa, when its key is set.
- Terminal tools share the workspace's terminals with you, see [terminals.md](./terminals.md).

## Codemode

Codemode lets the model write a short JavaScript script that calls the other tools, so it can run them in parallel, chain them, and filter big output. Only what the script prints reaches the model. It is Pi Durable's codemode, which matches the Pi coding agent's: each call a script makes is a tool call of its own, and a script survives a restart, picking up where it was without running finished calls again. The prompt lists the tools scripts can call. Scripts can't call the tools that need the model itself: `ask`, `list`, and the session tools. While a script runs, its row lists the calls it made so far.

Scripts can also call classifier models. A classifier doesn't chat: it answers typed yes/no, choice, or score questions about JSON, in well under a second and for a fraction of a cent. That makes it cheap to label many items, such as the steps of past agent runs, and read only the flagged ones. Any provider with a key that offers classifiers works.

## Asking you

`ask` puts one to four multiple-choice questions to you and ends the run. Nothing waits, so a question survives restarts and can be answered hours later from another device. Your answer is an ordinary prompt, so typing in the composer answers too. Number keys pick the options of the question you're on and ⌘↵ sends, also with nothing focused. Once answered, the card folds into one row that opens to the questions.

## Other sessions

Agents can see everything open in Bica and work with other sessions the way they work with terminals: start, read, send, and stop.

- `list` shows every project, workspace, open session, and terminal as a tree, with their status and which one is the caller. With `archived`, it lists the last 50 archived sessions instead. The agent is told to leave the rest alone unless you name it. The [hub](./hub.md) has no such limit, but waits for your go before it changes anything.
- `session_start` starts a normal session with the same model and a prompt that stands on its own, in any workspace or in a new worktree.
- `session_read` returns a session's status, who started it, who sent its last prompt (you, another session, a note, or the user), whether the user ever prompted it himself, the `ask` questions it waits on, and its last reply, or with `messages` its last few prompts and replies.
- `session_send` sends a signed message, so the receiver can answer. It waits for the current turn, or joins it with `steer`.
- `session_stop` stops a session's turn. The session stays.
- `session_archive` archives a finished session and closes the terminals it started. With `remove_worktree`, its worktree and branch go too, unless another open session works there or it holds uncommitted files or commits no other branch has.

The starter gets a note whenever a session it started finishes a turn, with its last reply, unless it started it with `notify: false`. A `session_send` with `notify` gets a note for that one turn. A session that already messaged its starter during that turn sends no note, unless it stopped with an error or waits on a question. Notes arrive as queued prompts marked as coming from Bica, and say when the user prompts that session himself. Who started a session is stored with it, so notes survive restarts. Notes that pile up while a session works merge into one.

Bica has no hidden subagents. Every helper is a normal session you can open, read, and steer, and a short job that reports back is a session with a clear task.

## Sources

- Claude Code's `SendMessage` with `notify_when_idle`, and Codex's `send_input` and `wait_agent`, which the session tools follow.
- Pi Durable's [`codemode`](https://github.com/earendil-works/pi/tree/main/packages/durable), on the `pi-codemode` sandbox.
- The open [web search benchmark for coding agents](https://github.com/openbenchmarks-labs/web-search-for-coding-agents), where Exa leads search and fetch.
- [Expand Fetch](https://expand.ai), which reads the rendered page with a vision model. On 43 pages that past sessions fetched, it read two that Exa missed but returned about 1.7 times as much text, so fetch stays on Exa.
