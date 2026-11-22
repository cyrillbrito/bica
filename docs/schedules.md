# Schedules

A schedule is a saved prompt that fires later, once or on a repeat: "remind me Friday to pay rent", "every weekday at 8, check my inbox and calendar", "every Monday at 2, update the dependencies and run the tests". Reminders and routines are the same thing, told apart only by where the prompt goes when it fires.

## Making one

- Ask any session, a bot, or a call. The agent makes it with the `schedule` tool ([tools.md](./tools.md)), says when it fires, and picks a sensible time of day when you didn't give one.
- Schedule…, under the home composer's send button, opens a dialog that picks once at a date and time, or a repeat: weekdays, every day, every week, or a cron expression. Each run starts a new session in the project and workspace below the composer, on the model picked in it.

Times are the dev machine's local time. A repeat can't fire more often than every few minutes, and a one-off can't be in the past.

## Where it goes

- Back into the session that made it, with that conversation's context, as a note from Bica that waits for the current turn to end. That is what a reminder is: the agent says it, out loud on a call. An archived session comes back to the list first, and a bot's schedule follows the bot to its next session after Start a new session.
- A new session each run, as `session_start` would make it, with its folder, worktree, and effort. A schedule a session made leads its runs as child sessions and hears each one end ([orchestration.md](./orchestration.md)); one from the composer starts sessions that are yours. Its prompt tells it nobody watches: work until done or blocked, take the choice easiest to undo, prove the work, and end with a short report. A run that replies exactly "Nothing new" goes to the archive and its parent hears nothing, so a quiet morning costs one run and no turn in the bot.

Gated connector calls in a run wait on an approval card as always ([connectors.md](./connectors.md#approvals)): a prompt that fired is not your yes.

## The Schedules page

Schedules, in the sidebar under Artifacts, lists every schedule, soonest first: the prompt, when it fires and how long until the next time, where it goes, and Delete. A one-off leaves the list once it fired. There is no pause or edit: delete it and ask again.

## When Bica is off or asleep

Bica checks at least once a minute, and wakes for the soonest schedule, with no browser tab needed. A schedule due while Bica was off or the machine slept fires once when it's back, and its prompt says when it was due. A repeat missed several times fires once, not once per missed time.

A sleeping machine runs nothing. Keep it awake while plugged in, or run Bica as a background service on a machine that stays on ([deploy.md](./deploy.md)). For a reminder that must reach you anyway, ask the agent to also add a Google Calendar event, whose alert reaches the phone with Bica off.

The code is in `server/src/schedules/` and `client/src/schedules/`; schedules are kept in `.data/schedules.json`.

## Sources

- Claude Code's [scheduled tasks](https://code.claude.com/docs/en/routines), formerly routines: one-off and recurring in one concept, and a fired prompt that "can't act as approval or consent". Its [in-session schedules](https://code.claude.com/docs/en/scheduled-tasks) fire between turns.
- ChatGPT and Codex [scheduled tasks](https://learn.chatgpt.com/docs/automations): a task returns to the chat that made it or starts a new chat each run, and runs with nothing to report are archived.
- Grok Bot's routines, a labelled "standing order firing on schedule", and the silent replies of Hermes and NanoClaw ([bots exploration](./explorations/bots.md#coming-to-you)).
- [Bun's cron](https://bun.com/docs/runtime/cron): local time, `Bun.cron.parse` for the next fire, and in-process timers that stop with the process.
