# Assistant mode

Assistant mode is for a session you never close. Most sessions are a task: you finish the work and move on. Some are a companion instead, like a notes vault you talk to every day and come back to for months. Assistant mode lets that kind of session keep going without you thinking about context size, cost, or when to start over.

Start one with ⌘K's New assistant session, which opens the home page set to run as the Assistant [agent](./agents.md), in the project's main folder. The top bar then shows an infinity sign next to the title. The session's menu (⋯ in the top bar, its sidebar row, or ⌘K) turns assistant mode on for a coding session, and off again.

## The idea

A long conversation gets expensive, because every prompt resends everything before it, and forgetful, because models work worse as the context grows and summaries lose detail each time.

Assistant mode splits memory in two. The conversation is short-term memory, trimmed regularly. Files in the project are long-term memory, and keep what matters. The agent writes to them as it goes, and always before anything is summarized away. The files are ordinary notes, so the memory follows you and doesn't depend on Bica.

## Housekeeping

Housekeeping is what Bica does for the session while it sits idle, so it never interrupts your work. The [hub](./hub.md) gets it too.

- Once the prompt cache has expired, it prunes old tool output. Your prompts and the agent's replies stay.
- If the session is still big, a memory save asks the agent to write what's worth keeping to its memory files, then Bica compacts the older context, just before the cache expires, while that is still cheap.
- If a session gets very big during heavy use, it does the same at the first idle minute.

The agent is told it is a long-running helper for its project, for notes, planning, research, answers, and quick fixes, and that bigger coding tasks go to sessions of their own. It writes decisions, preferences, and open tasks down as they come up, keeps only what will stay true, and replaces facts that changed.

## The memory index

Every session, assistant or not, starts with the memory index in its system prompt: `MEMORY.md`, or `PROFILE.md`, in the session's workspace. Bica takes a copy when the session starts and refreshes it only after a compaction, automatic or not, so the prompt cache holds. A long index is cut, and the agent is told so.

## Why it works this way

- Every change to old context breaks the prompt cache once, so Bica changes it rarely, in large steps, and only when the cache is cold or about to be ([context-usage.md](./context-usage.md)).
- Pruning old tool output keeps nearly all the value of a summary at no cost, so it comes first.
- A summary of a summary forgets more each time. Saving to files first means the summary never has to carry what matters most.

It needs a model with a known cache lifetime, which means Anthropic's.

## Sources

Their numbers come from their own setups, so they show the direction, not proof.

- [The Complexity Trap](https://arxiv.org/abs/2508.21433), a JetBrains study: hiding old tool output solved as many coding tasks as LLM summaries, at about half the cost.
- Anthropic's [context management](https://www.anthropic.com/news/context-management) and [context editing docs](https://platform.claude.com/docs/en/build-with-claude/context-editing): clearing old tool results in batches, because each clear breaks the cache.
- [The Compaction Cliff](https://arxiv.org/abs/2608.22752): instructions survive one compaction about half the time, and five in a row about a tenth of the time.
- OpenClaw's [memory flush](https://docs.openclaw.ai/reference/session-management-compaction/housekeeping): a silent turn that saves to memory files before compacting.
- Memory in markdown files: [Claude Code's memory](https://code.claude.com/docs/en/memory), [OpenClaw's memory](https://docs.openclaw.ai/concepts/memory), Letta's [context repositories](https://www.letta.com/blog/context-repositories/), [pi-memory-md](https://pi.dev/packages/pi-memory-md), and [pi-markdown-memory](https://pi.dev/packages/@abarisain/pi-markdown-memory).
- [obsidian-mind](https://github.com/breferrari/obsidian-mind): load the memory up front instead of asking the agent to read it, say when it was cut, and replace corrected facts.
- Taelin's [OptChat](https://gist.github.com/VictorTaelin/91837951a5ce5b38f341ec1ba1df6449): the compaction rules and batching changes to keep the cache.
