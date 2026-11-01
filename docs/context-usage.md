# Context usage

Bica shows what fills a session's context window, what it cost, and whether the prompt cache is warm, and nudges you to shrink a session before it gets slow and forgetful.

## What you see

A chip in the session's top bar shows how full the window is. While idle, it counts down the prompt cache's last minutes, and shows a snowflake once the cache has expired. It turns yellow, then red, as the window fills or the session grows past the size where models get slower, pricier, and more forgetful.

A line above the composer speaks up only when there is something worth doing, and × hides it until things change:

- The cache has expired on a big session: it offers Prune, since the next prompt resends everything anyway. Compact shows too when pruning alone wouldn't be enough.
- The cache is warm and the session is very big: it offers Compact, and says so when the cache is about to expire, the cheapest moment to compact.
- Pi Durable is about to compact on its own: it says when, so you can pick the moment instead.

Progress and results show as lines in the transcript, with a sound when they land.

The chip's menu offers Compact, Prune, and the details. Every place that offers Compact and Prune (the chip, the nag above the composer, the field of cells, the details) shares one busy state and one rule for when each can run, in `client/src/context-usage/context-usage.ts`. Compact says how much it keeps as it is, Pi Durable's `keepRecentTokens`, sent with the model catalog. The details show the window as a field of cells, filled by the system prompt, tools, the conversation, and tool output. Pointing at a part lights its cells. Below are the biggest prompts, replies, and tool results, the cache hit rate, and the spend per model.

## Where the numbers come from

- The total is measured the way Pi Durable measures it before compacting on its own: what the newest reply reported, plus pi-ai's estimate of what came after, minus what pruning freed since. So the chip and auto-compaction agree. The parts are rough counts, scaled to add up to it.
- The server works it out once per change and sends it with the conversation (`shared/src/context-usage.ts`, and `context-breakdown.ts` for the details). The color, the cache countdown, and when the nag and housekeeping act are rules in the same file.
- Spend comes from Pi Durable's usage tracking, at API prices even on a subscription.
- Before the first reply or right after a compaction, nothing is measured yet, and the details say "estimated".

## The prompt cache

Rereading a cached prompt costs about a tenth of sending it fresh. Anthropic keeps a cache for 5 minutes, or for 1 hour if asked, at a higher price for writing it. Bica asks for 1 hour, like Claude Code on a subscription, and Settings → Models switches back. Replaying past sessions showed 1 hour cost about 15% less. The countdown only shows for models whose cache lifetime is known, which means Anthropic's.

## Compaction and pruning

Compaction summarizes the older part of the context. Pi Durable does it on its own when the window is nearly full, and Compact does it on demand, where you can say what to keep. The transcript marks it, and the marker opens to the summary.

Pruning clears old tool output from what the model reads, with no model call, as opencode's prune does. Long tool results and images become a short note with their first and last lines, and long tool arguments a note with their first line. Images in older prompts become a note too, and the path after each still lets the agent open its file again. The text of prompts, replies, thinking, the latest turns, and tasks sent to other sessions stay whole: an agent rereads what it delegated, and writes new tasks like the ones it sees. Old sessions lose about three quarters of their size this way. The transcript still shows everything. Pruning can run while the agent works, but not during a compaction, whose summary would hide what it clears. Every Prune button and the server follow that one rule. Pruning is best on a cold cache, where compacting would first reread the whole session at full price.

Both lines in the transcript have a fork button, which starts a new session from the context as it is after them.

## Sources

- affectUI's [Context Window](https://www.affectui.com/components/context-window) and [Compact Breakdown](https://www.affectui.com/components/compact-breakdown) for the field of cells and the spend per model.
- Pi's context extensions ([`pi-context-usage`](https://pi.dev/packages/pi-context-usage), `@that-yolanda/pi-context`, `pi-context-breakup`) for the breakdown method.
- Claude Code's `/context` for the categories, and OpenCode's `/context` for marking estimates.
- [tool-output-pruning-lab](https://github.com/Dymyt-ry/tool-output-pruning-lab): on about 1,000 real tool calls, nothing beat keeping the start and end of each output.
- Claude Code's [prompt caching docs](https://code.claude.com/docs/en/prompt-caching): compacting after the cache expired rereads the whole history uncached.
