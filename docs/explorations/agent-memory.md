# Agent memory

Ideas from Anthropic's [The components of agent memory](https://www.anthropic.com/research/components-of-agent-memory) for [bots](../bots.md). Today a bot writes memory files during its session, and a memory save runs before each compaction. Nothing ever goes back over those files later to check or tidy them. The post's main idea, dreaming, is that missing step.

## What the post found

- Memory is a prediction: writing a note bets that a future session will need it. Strong models judge this well on their own. Fixed rules such as "record only failures" made them worse, while older models gained from being told to read memory first.
- Good memory is small. In Pokémon, the model that kept a `global.md` dashboard and nine files got much further than one that wrote 413 files of things it could read off the screen anyway. Notes should hold what only the agent worked out: plans, rules it tested, traps.
- Notes written in the moment can be wrong, and a later session trusts them. Dreaming is a pass, run while the agent is idle, that checks notes against the original transcripts and rewrites the wrong ones. One corrected note decided whether a run got past a level.
- Dreaming can promote notes to the top layer that loads into every session, and push detail down with a link left behind. The top layer has to stay small, since long instruction files lower adherence. Claude Code loads only the head of `MEMORY.md`, as an index.
- Dreaming across many sessions finds what one session can't: repeated mistakes, patterns, broken links between notes.
- Wikis built by dreaming helped on questions that combine several documents, and did nothing when one search found the answer. One wiki grew bigger than its sources.
- Telling the dreaming pass what the memory is for matters. A wiki built around the facts that counted kept all of them, up from 72%.

## What Bica could do

- A dreaming pass for each bot. It reads the transcripts since the last pass and the memory folder, then fixes notes the transcripts contradict, merges duplicates, deletes what went stale, and keeps `MEMORY.md` a short index. It could run as part of [housekeeping](../bots.md#housekeeping) or as a [schedule](../schedules.md) that runs at night, so it costs no attention during the day.
- Changes stay reviewable. The memory files are plain markdown, often in a Git repo or notes vault, so a pass ends with a diff the user can read, and its report says what it changed and why.
- A bot dreams across sessions. It can read every session's transcript, so it could spot corrections the user keeps repeating and propose a line for `AGENTS.md` or a memory file, instead of each session learning it again.
- Search over past transcripts as a tool. The post suggests transcript search as the base of memory, with notes on top. Pi Durable already stores every transcript in SQLite.
- Keep the memory prompt short. The bot's prompt already says what memory is for. Check it doesn't grow into rules about what to write.

## Open questions

- Cadence and cost. Dreaming spends tokens, so it should probably run only after real activity, and look first at notes that change often.
- Whether dreaming needs its own agent with its own tools, or is a prompt for the existing one.
- Whether a wiki is worth it for a notes vault, or search plus a small index is enough.

## Sources

- Anthropic, [The components of agent memory](https://www.anthropic.com/research/components-of-agent-memory): dreaming, salience, the memory hierarchy, and the wiki results above. Their numbers come from their own benchmarks.
- Letta and UC Berkeley, [sleep-time compute](https://arxiv.org/abs/2504.13171): using idle time between interactions to reorganize context.
