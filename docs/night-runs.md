# Night runs

A night run is a session held for tonight. Its prompt waits until the night start time in Settings, runs on its own while you sleep, and ends with a report for the morning. It is for work that can wait and finish without you, so the night's plan limits don't go unused.

## Holding one

Run tonight, under the chevron of the home composer's send button, holds the typed prompt instead of sending it, and its sidebar row shows a Tonight tag. Until it runs, the composer edits that one prompt: edits save as you type, Run now sends it, and the strip's × turns it back into a normal draft.

Other sessions can hold one with `session_start` and `tonight` ([orchestration.md](./orchestration.md#the-session-tools)). That is how the [hub](./hub.md) schedules work you dictate from the phone.

## What runs

A night run runs as the Night [agent](./agents.md): like Coding without `ask`, since nobody can answer, at high effort. It is told to push on instead of stopping to ask, to take choices that are easy to undo and note them, to prove the work with commands, and to stay out of push, merge, and deploy.

Sessions it starts run as Night too, and the next run waits until they finish. A fork of a night run is an ordinary Coding session.

It ends with a morning report: done, partly done, or blocked, then what changed, the checks and their results, decisions it took alone, open questions, and the next step. After that it runs as Coding again, an ordinary session you can continue.

## When it runs

- Runs start only in the first plan window after the start time, so a late one can't eat into your morning.
- One runs at a time, oldest first, since parallel runs would drain the plan twice as fast.
- A run starts only while its plan has room, keeping a reserve of the week for the next day. With [more than one account](./models.md#more-than-one-account), one with room is enough.
- A run that goes on too long is told to wrap up and write its report.
- A run that fails to start keeps its prompt held, and tries again a minute later.
- The schedule starts with Bica, so it needs no open browser tab.

Pick a start time at least 5 hours before your day starts, so the night's Claude window ends before yours begins.

## Sources

- [claude-overnight](https://github.com/rohanprichard/claude-overnight): a night queue that checks the plan meter before each job and keeps a reserve.
- [claude-nightshift](https://github.com/dujunyi416/claude-nightshift): night jobs timed to the plan's reset.
- [Codex Automations](https://developers.openai.com/codex/app/automations): unattended runs that report to an inbox.
- [Agent PRs by task type](https://arxiv.org/html/2602.08915v2): chores, docs, and refactors merge far more often than features.
- [Why agent fix PRs go unmerged](https://arxiv.org/html/2602.00164) and [an 8-hour overnight run](https://blog.devaubree.fr/en/blog/agent-autonome-nuit-retour-experience/): unattended agents claim work they never did, hence checks by command and a report.
- [Anthropic's long-running harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents): one goal, a check that proves it, and a clear end.
- [Mitchell Hashimoto's end-of-day agents](https://mitchellh.com/writing/my-ai-adoption-journey): handing off slow, low-risk work before leaving.
