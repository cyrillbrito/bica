# Agent tools

The agent works through tools. Every call the model makes carries a short summary, so the transcript reads as a list of intentions. Bica adds the field only to the copy of each tool sent to the model, marked required so the model rarely skips it, and removes it before the tool runs. A call without one still runs, since Pi Durable checks it against the tool as registered, and its row shows the command or path instead.

- Read, write, edit, and bash work in the session's folder. Read also shows images to the model, shrunk or converted with Bun's image library when they are too big for the API or in a format it doesn't take.
- Web search and fetch go through Exa, when its key is set.
- Terminal tools share the workspace's terminals with you, see [terminals.md](./terminals.md).
- What the agent is told about using them is in [instructions.md](./instructions.md).

## Codemode

Codemode lets the model write a short JavaScript script that calls the other tools, so it can run them in parallel, chain them, and filter big output. Only what the script prints reaches the model. It is Pi Durable's codemode, which matches the Pi coding agent's: each call a script makes is a tool call of its own, and a script survives a restart, picking up where it was without running finished calls again. The prompt lists the tools scripts can call, exactly as Pi Durable defines them, without the summary field: a script's calls show no summary. Scripts can't call the tools that need the model itself: `ask`, `list`, and the session tools. While a script runs, its row lists the calls it made so far.

Scripts can also call classifier models. A classifier doesn't chat: it answers typed yes/no, choice, or score questions about JSON, in well under a second and for a fraction of a cent. That makes it cheap to label many items, such as the steps of past agent runs, and read only the flagged ones. Any provider with a key that offers classifiers works.

### Images

Scripts can also generate and edit images with `models.generateImages()`, the way the Pi coding agent does since 1.0. There is no image tool of its own, so no session pays for one in its prompt. A rule under codemode tells the agent this exists, since without it the agent drew icons as SVG instead. `image(block)` shows the result to the model and saves it to a temp file, and the agent moves that file into the project with bash. To edit, the script adds the source image to the input. The image models come from the [CLI proxy](./proxy.md#image-models) and from OpenRouter. The transcript shows a script's text, not its images, so open the saved file to see one.

## Asking you

`ask` puts one to four multiple-choice questions to you and ends the run. Nothing waits, so a question survives restarts and can be answered hours later from another device. Your answer is an ordinary prompt, so typing in the composer answers too. Number keys pick the options of the question you're on and ⌘↵ sends, also with nothing focused. Once answered, the card folds into one row that opens to the questions and your answers. The answer shows there instead of as a prompt of its own, and one typed in the composer shows whole under the questions.

## Other sessions

Agents can see everything open in Bica and work with other sessions the way they work with terminals: start, read, send, and stop.

- `list` shows every project, workspace, open session, and terminal as a tree, with their status and which one is the caller. With `archived`, it lists the most recent archived sessions instead. The agent is told to leave the rest alone unless you name it. The [hub](./hub.md) has no such limit, but waits for your go before it changes anything.
- `session_start` starts a normal session with the same model and a prompt that stands on its own, in any workspace or in a new worktree. `effort` sets low, medium, or high when you ask for one. With `assistant`, the new session runs in [assistant mode](./assistant-mode.md). With `tonight`, it is held for the [night run](./night-runs.md) instead of started, so the hub can schedule work you dictate.
- `session_read` returns a session's status, who started it, who sent its last prompt (you, another session, a note, or the user), whether the user drives it himself, the `ask` questions it waits on, and its last reply, or with `messages` its last few prompts and replies.
- `session_send` sends a signed message, so the receiver can answer. It waits for the current turn, or joins it with `steer`.
- `session_stop` stops a session's turn. The session stays.
- Both refuse a parent whose session the user took over ([sessions.md](./sessions.md#who-drives-a-session)), unless it passes `user_asked` because he told it to.
- `session_archive` archives a finished session and closes the terminals it started. Its description tells the agent to archive the sessions it started once their result is in its reply and you wouldn't open them, to keep the ones you may want to read or continue, and to name what it archived. A session you took over is refused unless the agent passes `user_asked`, meaning you told it to. With `remove_worktree`, its worktree and branch go too, unless another open session works there or it holds uncommitted files or commits no other branch has.

The starter gets a note whenever a session it started finishes a turn, with its last reply, unless it started it with `notify: false` or the user took the session over. It hears of the take over and of a hand back once each. A `session_send` with `notify` gets a note for that one turn. A session that already messaged its starter during that turn sends no note, unless it stopped with an error or waits on a question. Notes arrive as queued prompts ([sessions.md](./sessions.md#queue-push-stop)) marked as coming from Bica, and say when the user drives that session himself. Who started a session, and who asked with `notify`, is stored with it, so notes survive restarts. Notes that pile up while a session works merge into one.

Bica has no hidden subagents. Every helper is a normal session you can open, read, and steer, and a short job that reports back is a session with a clear task.

## Sources

- Claude Code's `SendMessage` with `notify_when_idle`, and Codex's `send_input` and `wait_agent`, which the session tools follow.
- Taking over a session: Zendesk and Intercom stop their bot once a human takes a conversation, and the Pi package [`pi-cmux-orchestrator`](https://www.npmjs.com/package/@mporenta/pi-cmux-orchestrator) holds back the orchestrator once you type in a worker, until it is released.
- Pi Durable's [`codemode`](https://github.com/earendil-works/pi/tree/main/packages/durable), on the `pi-codemode` sandbox.
- Image generation: Pi 1.0's [`models.generateImages()` in codemode](http://pi.dev/changelog), which Bica follows. Codex's built-in `image_gen` tool and its [imagegen skill](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/imagegen/SKILL.md), the opencode plugins [opencode-gpt-image](https://github.com/plfavreau/opencode-gpt-image) (`image_generate`, `image_edit`) and [opencode-gpt-imagegen](https://github.com/yuji-hatakeyama/opencode-gpt-imagegen), and Kilo Code's [`generate_image`](https://github.com/Kilo-Org/kilocode/pull/11566) all add a dedicated tool that writes the file, which costs prompt space in every session.
- The open [web search benchmark for coding agents](https://github.com/openbenchmarks-labs/web-search-for-coding-agents), where Exa leads search and fetch.
- [Expand Fetch](https://expand.ai), which reads the rendered page with a vision model. On 43 pages that past sessions fetched, it read two that Exa missed but returned about 1.7 times as much text, so fetch stays on Exa.
