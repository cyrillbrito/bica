# Bots

A bot is a long-lived agent you make, with a name, a color, a home folder, and a workspace. You talk to it in one session that never resets, often from the phone, about all your work. It answers what its memory and a quick look can answer, and gets bigger work done through sessions it starts, briefs, and follows. You can have as many as you like, such as one for your code and one for your notes.

## Making one

New bot, in the sidebar's app menu after Add project or in ⌘K, opens a dialog. With no bots yet, the sidebar shows a New bot row too.

- Name and color. The color only fills the bot's mark, a small tile with its first letter, so status colors keep their meaning.
- Workspace, required: the folder that holds your projects, such as `~/Repos`. Sessions it starts outside a project run there. A folder that doesn't exist is refused, since it is more likely a typo than a folder to create.
- Home, empty for a folder in Bica's data folder: where its files and memory live, such as a folder in your notes vault.

Edit bot, in its session's ⋯ menu, its sidebar row, or ⌘K, opens the same dialog with its three files below the fields: Instructions (`AGENTS.md`), Soul (`SOUL.md`), and About you (`USER.md`). Only the files you changed are saved. A file the bot changed since the dialog opened is refused, so your save never erases its edits: close and open again to see its version. Heavy edits go to your editor.

Bots live in `bots.json` in the data folder, in sidebar order, read every time, so a hand edit applies at once (`server/src/bots/`).

## Its session

Each bot has a row at the top of the sidebar with its mark, name, and its session's status when it isn't idle. The row opens the bot's session, starting it in its home the first time, and stays highlighted while that session is open. The row's + starts a session in its workspace, and its menu has Open, the workspace's usual actions, Edit bot, and Delete bot. ⌘K lists each bot by its name or "bot".

The bot's session opens on the normal session page ([sessions.md](./sessions.md)), with the context chip, the model picker, the composer, and a [voice call](./voice.md) button. The top bar shows the bot's mark and name instead of a title. A few things differ:

- No side panels, since it works in its home, not a workspace.
- No Rename, Fork, or Archive. Its ⋯ menu adds Edit bot, Start a new session, and Delete bot. Start a new session archives the current one and starts fresh: its memory stays in its home.
- A Watching strip above the transcript.

The Watching strip lists the open sessions the bot hears from: its child sessions and the ones it watches, what needs you first, then the newest. Each row shows the session's status, workspace, last change, and cost at list prices, and opens that session. The header counts what needs you, what runs, and what they spent. The strip folds away, and stays as you left it.

## Its model

A bot has no model setting: its model is its session's, picked with the model picker like any session's. A new bot starts on the Bot agent's default, a model that talks and routes well at low effort. Start a new session keeps the model the last session ran on. Sessions it starts run on your default model, not the bot's.

## Its files and memory

The home holds the files its system prompt loads, read live like project instructions, so an edit applies from the next request:

- `AGENTS.md`: its instructions, what it is for and how to work.
- `SOUL.md`: how it talks, its opinions and boundaries. It may edit it, and tells you when it does.
- `USER.md`: what it knows about you, as short lines starting with Always, Never, or Prefer. A changed preference replaces its line.

The name and color live in Bica, not in a file, and the system prompt says the name. Your own `~/.bica/AGENTS.md` loads too, but not the instructions of folders above the home.

`MEMORY.md` is its memory index. It starts with a plain list of open work, one line per open session: what it is for, where it stands, and whose move it is. Below it, it links one memory file per area. Live status comes from the sessions themselves, so the files hold only what Bica can't know. The bot saves only what you said or it verified, and writes facts, not orders, since an order gets read later as a new instruction.

## Housekeeping

A bot's session is a long-lived session: it lasts months, so the conversation is short-term memory, trimmed regularly, and the files in its home are long-term memory. Housekeeping is what Bica does for it while it sits idle, so it never interrupts your work.

- Once the prompt cache has expired, it prunes old tool output. Your prompts and the bot's replies stay.
- If the session is still big, a memory save asks the bot to write what's worth keeping to its memory files, then Bica compacts the older context, just before the cache expires, while that is still cheap.
- If a session gets very big during heavy use, it does the same at the first idle minute.

Why it works this way:

- Every change to old context breaks the prompt cache once, so Bica changes it rarely, in large steps, and only when the cache is cold or about to be ([context-usage.md](./context-usage.md)).
- Pruning old tool output keeps nearly all the value of a summary at no cost, so it comes first.
- A summary of a summary forgets more each time. Saving to files first means the summary never has to carry what matters most.

It needs a model with a known cache lifetime, which means Anthropic's.

## The memory index

Every session, a bot's or not, starts with the memory index in its system prompt: `MEMORY.md`, or `PROFILE.md`, in its workspace, or a bot's home. Bica takes a copy when the session starts and refreshes it only after a compaction, automatic or not, so the prompt cache holds. A long index is cut, and the agent is told so. A bot's session keeps a copy of your project list the same way.

## What it can do

A bot's session runs as the Bot [agent](./agents.md), with the same tools as a Coding session ([tools.md](./tools.md)): files and bash, terminals, web search and fetch, `list` and the session tools across every project ([orchestration.md](./orchestration.md#the-session-tools)), `ask`, code mode with [connected apps](./connectors.md), and skills. Its prompt says what only a bot should do with them:

- It writes freely in its home, and outside it makes only a small edit you asked for.
- It reads terminals with `terminal_read`, to see why a child session's tests or dev server failed without messaging it, but starts no terminals or long commands: anything that keeps running belongs in a session.

It holds to delegation:

- It does a thing itself only when it takes at most two rounds of tool calls, such as an answer from memory, a file, `list`, or one search. Anything bigger goes to a session, so it stays quick to answer.
- A brief stands alone and states the problem, not the fix: symptoms, how to reproduce them, context, constraints, what done looks like, and the report to end with. A suspected cause goes in as a hunch to verify.
- Code work in a project gets its own worktree. Work outside any project, such as research across repos, runs in its workspace.
- One session per thread: a follow-up goes to that thread's session. A report is checked against the brief, and "running" is not done.
- The same error twice, and it stops and tells you instead of trying a third time.

## How it behaves

It acts on its own when a step can be undone and stays inside what you asked: starting, messaging, steering, and watching sessions, stopping a child session that went off track, and writing in its home. It says what it did. It asks first before anything destructive or that leaves the machine: removing worktrees, deleting files outside its home, merging, pushing, committing to main, opening pull requests, archiving sessions it doesn't lead. A standing instruction you gave covers what it names.

A session with no parent is yours, whoever started it ([orchestration.md](./orchestration.md)). The bot only reports on it.

## What it hears

A bot hears what any parent hears: each run its child sessions end. A question or failure further down reaches it through the child session, which passes up what it can't settle in its own reply. To follow a session it doesn't lead, such as one you started or one it messaged for you, it watches it until that thread closes ([orchestration.md](./orchestration.md#watching)).

On a [voice call](./voice.md), what it says after a note is spoken too, so you hear results and questions without asking. The voice speaks as the bot, with its name and the tone in its `SOUL.md`, and it hears your projects and open session titles right.

## Its workspace

Bica lists each bot's workspace as a project under the bot's id, so sessions there get terminals, the Files and Git panels, and voice like any other. In the sidebar they sit under the bot's row with the workspace's terminals and kept files, never with your projects, never in Parked. The project picker and ⌘K's New session in… call the folder "Ada's workspace", after the bot's name. A bot's workspace has no worktrees: code work goes to a real project's worktree. Sessions it starts in a project show in that project, with the usual parent link. A session started without a folder by one of the bot's child sessions stays in the workspace too.

## Deleting one

Delete bot asks first. It archives the bot's session and every open session in its workspace, closes their terminals, and ends the bot's watches. Sessions it started in projects stay open and become yours. The home stays on disk with its files and memory, since they are your data.

## Sources

Their numbers come from their own setups, so they show the direction, not proof.

- Anthropic, [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system): the lead keeps its plan in memory, gives each subagent an objective, output format, and boundaries, and has subagents write to files.
- Anthropic, [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents): a progress file lets each fresh context find its bearings.
- Manus, [Context engineering lessons](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus): rewriting a to-do file keeps the goals in recent attention.
- Claude Code, [subagents](https://code.claude.com/docs/en/sub-agents): background results arrive as notes instead of polling.
- OpenClaw, [session tools](https://docs.openclaw.ai/session-tool): reports from spawned sessions with status, result, and notes. Its [workspace templates](https://docs.openclaw.ai/reference/templates/SOUL): `SOUL.md`, and `USER.md` as Always, Never, and Prefer lines.
- Devin, [managed Devins](https://docs.devin.ai/work-with-devin/advanced-capabilities): the coordinator wakes when a child finishes or needs input.
- Grok Bot, [engineering guide](https://x.ai/bot/guides/grok-bot-for-engineering): briefs that state the problem and not the fix, the two-rounds rule, and [stopping after the same error twice](https://teslanorth.com/2026/11/20/grok-bot-usage-two-error-rule/).
- [Hermes Agent](https://github.com/NousResearch/hermes-agent): save only what was said, and write facts, not orders.
- [agent-board](https://github.com/questpie/agent-board): "long-running agent work fails when the plan lives only in chat."
- openai/codex [#36404](https://github.com/openai/codex/issues/36404): the backend behind ChatGPT's voice gets thread tools much like a bot's, including `read_thread_terminal`.
- [The Complexity Trap](https://arxiv.org/abs/2508.21433), a JetBrains study: hiding old tool output solved as many coding tasks as LLM summaries, at about half the cost.
- Anthropic's [context management](https://www.anthropic.com/news/context-management) and [context editing docs](https://platform.claude.com/docs/en/build-with-claude/context-editing): clearing old tool results in batches, because each clear breaks the cache.
- [The Compaction Cliff](https://arxiv.org/abs/2608.22752): instructions survive one compaction about half the time, and five in a row about a tenth of the time.
- OpenClaw's [memory flush](https://docs.openclaw.ai/reference/session-management-compaction/housekeeping): a silent turn that saves to memory files before compacting.
- Memory in markdown files: [Claude Code's memory](https://code.claude.com/docs/en/memory), [OpenClaw's memory](https://docs.openclaw.ai/concepts/memory), Letta's [context repositories](https://www.letta.com/blog/context-repositories/), [pi-memory-md](https://pi.dev/packages/pi-memory-md), and [pi-markdown-memory](https://pi.dev/packages/@abarisain/pi-markdown-memory).
- [obsidian-mind](https://github.com/breferrari/obsidian-mind): load the memory up front instead of asking the agent to read it, say when it was cut, and replace corrected facts.
- Taelin's [OptChat](https://gist.github.com/VictorTaelin/91837951a5ce5b38f341ec1ba1df6449): the compaction rules and batching changes to keep the cache.
