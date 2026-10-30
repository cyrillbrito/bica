# Sessions

A session is one conversation with an agent. It runs in one workspace ([projects.md](./projects.md)), with its own model and effort, a transcript, and a queue of prompts. You can run many at once and watch them all stream.

Sessions run on Pi Durable, which saves every turn and tool call before anyone sees it. A crash or restart loses nothing, and unfinished runs pick up where they stopped.

## Starting one

The home page's composer picks a workspace, a model, and whether to turn on [assistant mode](./assistant-mode.md), then starts the session with your first prompt. The moon button holds the prompt for tonight's [night run](./night-runs.md) instead. The fast model names the session, and renaming by hand wins. Model and effort can change at any time, for that session only. Defaults live in Settings ([models.md](./models.md)).

## The transcript

The transcript shows your prompts with their images, the agent's replies, its thinking, tool calls, errors, and compactions.

- Thinking and tool calls between two replies fold into one activity list, with a header such as "Worked for 18s · 6 tools, 1 thought". Each call opens to its command and output, its diff, or its arguments.
- Running calls show a spinner, slow ones a timer, and failed ones say "Failed" in red.
- From your prompt until the run ends, one working line sits at the bottom, timed from the prompt, as Claude Code and Codex keep one status line per turn. The activity header shows only its counts while it runs. A provider error waiting to retry shows on that line too, with a countdown.
- The line picks at random, once per run, a coffee cup (steam rising, or filling up) and an espresso phrase such as "Pulling a shot". Bica writes the phrases, so they cost no tokens.
- A streaming reply types in. Pi Durable saves it in chunks every ~100 ms, and the browser reveals each chunk over the next frames, faster when it falls behind, so it trails the model by at most about a quarter second (`markdown/smooth-text.ts`, after [assistant-ui's `useSmooth`](https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/utils/smooth/useSmooth.ts)). Replies already there when the page opens show at once, and so does a catch-up of more than 400 characters, such as a reply that grew while its session was closed.
- Each new paragraph, list item, or code block of a streaming reply fades in as it starts, except in a catch-up.
- While you're at the bottom, the transcript follows new lines on a spring instead of jumping, so a steady stream scrolls as one motion (`ui/stick-to-bottom.ts`, with the spring of StackBlitz's [use-stick-to-bottom](https://github.com/stackblitz-labs/use-stick-to-bottom)). Opening a session still lands at the end at once.
- Hover a reply to copy or fork it. Code blocks get their own copy button.
- A ` ```mermaid ` block renders as a diagram once its fence closes, with the same renderer as `.mmd` files (`markdown/Mermaid.tsx`): hand-drawn, in the theme's colors. Mermaid loads on the first diagram. One that fails to parse shows as code, with the reason under it, so you can ask the agent to fix it. Every agent is told replies render Mermaid.
- Notes from Bica and messages from other sessions show as a quiet row with the sender.
- Hide thinking, in Settings → Appearance, leaves thinking out on that device.

`bun server/scripts/demo-session.ts` seeds a session with every kind of row.

## Steer, queue, stop

While the agent works, sending steers: the prompt joins the current run after the turn in progress, as Enter does in Pi, Codex, and Cursor, since a prompt sent mid-run is nearly always about the work at hand. One control sits in the send spot: send when idle, stop while the agent works with nothing typed, and a split button once you type, send now plus a chevron with Queue and Stop, as in Cursor. ⌘Enter, or Queue under the chevron, queues the prompt instead, to start the next run. On a phone the chevron is the only way to queue or stop while typing. Both wait on a tray above the composer until taken, one quiet line each, marked by an icon: accent for sending now, grey for queued. Every tab sees the same queue.

- Send now on a queued line turns it into a steer.
- Clicking a line, or its arrow, takes the prompt back into the composer, to edit or to clear. There is no separate remove.
- When the agent takes a prompt from the queue, it glides from its line into the transcript, after affectUI's [Agent Steering](https://www.affectui.com/components/agent-steering), so you see which note went in (`sessions/queue-glide.ts`).
- Stop ends the run, and what waits comes back into the composer. Esc twice in the composer stops too, even while typing.
- A run that fails doesn't hold up the queue: the next queued prompt runs anyway, so notes to a session nobody has open still get read.

## Other sessions

Agents start and follow sessions of their own, which stay normal sessions you can open and write to. A session an agent started shows a "Parent in charge" strip, and one the hub watches a "Hub watching" strip. [orchestration.md](./orchestration.md) covers who leads a session and who hears of its runs.

## Composer

- Each session, the home page, and each workspace page keep their own draft on the device. Attached images last until a reload.
- ↑ at the very start of the box steps back through the prompts you sent, and ↓ at the very end steps forward again.
- A long paste folds into a marker like `[Pasted text #1 · 40 lines]` and goes out in full.
- A pasted, picked, or dropped image puts a marker like `[Image #1]` at the caret, and its thumbnail shows the same number. The model gets each image right after its marker, so you can talk about images in order, as with Claude Code's `[Image #N]`. Removing the thumbnail removes the marker, and one Backspace right after a marker removes it with its image, as in Codex. An image whose marker you edit away goes after the text.
- An image shows at once, dimmed with a spinner, while the browser shrinks it, which takes seconds for a phone photo. While a prompt's images upload, the send button spins.
- The server saves each sent image as a file in the data folder's `attachments/`, named by its content hash, and the prompt gives the agent its path right after the image. The model sees the pixels, and its tools can hand the file to a script, such as a barcode reader. Codex does the same with a [`<local_image path=…>`](https://github.com/openai/codex/issues/40595) tag next to each image.
- The transcript names the file instead of carrying the image, and the browser loads it over HTTP at `/attachment/<name>` and keeps it for good. Older images are saved the first time their session opens.

## Forks

A fork is a new session with another one's history up to a chosen reply. It runs in the same workspace, so files are shared, not rolled back. It keeps the project, agent, and voice of the original, and it is yours: it has no [parent](./orchestration.md).

## Status

Each session in the sidebar shows its status:

- Running: the agent is working.
- Retrying: the provider failed, and Pi Durable will try again.
- Failed: the last run ended in an error, or its work is stuck.
- Waiting for you: the agent asked a question.
- Unread: finished with a reply you haven't opened.
- Idle: everything else.

The right end of a row shows a live clock while it runs, a tag when it needs you, or how long ago it last moved. Needs you means waiting for you, unread, or failed. Tabs on top of the sidebar filter to All or Needs you, which also keeps running sessions and any that moved in the last few minutes. The home page stacks the sessions that need you under the composer, most urgent first.

Work is stuck when Pi Durable won't run it. Work that was cut off by crashes too many times in a row, such as a tool that runs Bica out of memory, is paused instead of crashing Bica again. Work whose code is gone from Bica, such as a removed extension's tool, can't run at all. A strip above the composer says which, with Retry for paused work. Stop ends either.

Read state lives on the server, so opening a session on the phone marks it read on the laptop too. A chime plays when a session stops, different for done, asking, and failed. The installed app's icon shows a badge with the sessions waiting or unread.

## Archiving

Archive moves a session to the sidebar's Archived section, and unarchive brings it back. Nothing is deleted. A running session can't be archived. Archiving a parent asks which of its child sessions go with it, none by default, and detaches the rest ([orchestration](./orchestration.md)).

To archive many at once, ⌘ click or shift click sessions in the sidebar, then use the bar at the bottom.
