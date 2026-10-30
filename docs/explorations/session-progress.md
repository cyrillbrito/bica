# Session progress

How to see where a session stands without reading its transcript. Nothing is built: a Recap tab was tried and removed.

## Agent to-do lists are going away

- The big harnesses are dropping their to-do tools for frontier models. Amp removed its to-dos in January 2026, Claude Code turned TodoWrite off for its newest models in v2.1.233, and OpenCode V2 dropped `todowrite` because it slowed the agent with no measured gain. Pi never had one.
- What people missed was the view, not the agent's focus. OpenCode put its list back behind a flag, mostly for the sidebar.
- A controlled study found a plan tool helps a weak model (+11.6 points) but barely changes a strong one's accuracy. Another found only 22–45% of runs keep the plan they declared, so a list on screen can show a route the agent isn't taking.
- Goals are replacing steps. Codex's `/goal` keeps one objective and how to check it's done, and leaves the path open.

So Bica gives the agent no plan tool. Anything that shows progress is for the person watching.

## What was tried: the Recap tab

A side panel tab on a session's page. The fast model read the prompts, replies, and tool call summaries, and wrote the goal, what the agent does now, what's done, and what likely comes next. Under it were the files the session's edit and write calls touched, and counts of calls and failures. It cost little: about 2k tokens and 2 seconds for a 27-call session.

It was removed because nobody used it:

- It repeated what was already there. Replies already open with the outcome ([system-prompt.md](../system-prompt.md)), the Git tab shows changed files, and the file list missed changes made through bash.
- It was in the wrong place. With many sessions running, the question is what each one is doing, asked from the sidebar, not from a tab inside one session.
- Its guesses at what comes next were often wrong, and it called the fast model on every status change for a view nobody opened.
- Claude Desktop's plan box, recap box, and session rail drew the same kind of complaints: plans that never advanced, recaps that replaced the answer, and a rail that took too much width.

## What might work instead

Smaller and placed where you already look:

- A recap line when you come back. Claude Code's `/recap` writes one line, under 40 words, after you've been away a few minutes: the goal, the current task, the next action. In Bica it could sit at the top of the transcript.
- A "now" line in the sidebar row, from the latest tool call summary, which costs no model call.
- A goal you set, with how to check it's done, shown above the composer, as Codex's `/goal` does. It overlaps with [night runs](../night-runs.md).

Try the sidebar line first: it's free, and it answers the question for every session at once.

## Sources

- Amp, TODOs Are Done: https://ampcode.com/news/todos-are-done
- Claude Code v2.1.233, to-do tools off for new models: https://www.claudeupdates.dev/version/2.1.233
- Claude Code, session recap: https://code.claude.com/docs/en/whats-new/2026-w17
- Claude Desktop changelog, the new Code tab: https://claude.com/docs/cowork/changelog
- Claude Desktop issues: the plan never advancing https://claudeissues.com/issue/102600-bug-desktop-app-task-list-plan-is-skipped-or-never-advances-mid-turn, the recap replacing the reply https://github.com/anthropics/claude-code/issues/103169
- OpenCode, removing the todo tool: https://github.com/anomalyco/opencode/pull/35989, and the issue asking for it back: https://github.com/anomalyco/opencode/issues/42421
- Mario Zechner, no built-in to-dos in Pi: https://www.mariozechner.at/posts/2025-11-30-pi-coding-agent/
- Codex Goals: https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex
- An Empirical Study of Harness Design for Coding Agents: https://arxiv.org/abs/2609.20804
- Do LLM Agents Execute the Plans They Declare?: https://arxiv.org/html/2609.38108
