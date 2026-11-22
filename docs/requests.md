# Requests

A request is something a session waits on you for, shown as a card in the transcript: the agent's [questions](./tools.md#asking-you), or an [approval](./connectors.md#approvals) for a call to a connected app. Every kind works the same way, so a new kind only adds its card and what its answer does.

## How a request waits

The tool that makes a request ends the run. The request lives in the transcript, in the tool call's arguments or its result, and nothing waits in memory. It survives a refresh, a restart, and switching devices, and the agent costs nothing while it waits. The session shows Waiting for you ([sessions.md](./sessions.md#status)).

Your answer comes back as the next prompt, and the agent picks up from there:

- A question takes a typed answer, from its card or the composer.
- Other requests take only an answer on their card. The server turns your choice into the prompt the agent reads, such as an approved call's result, and the transcript folds it into the card.
- A request stays open through notes and messages from other sessions, since only you can answer it. Your next prompt or answer closes it, and so does a compaction, since the agent no longer reads it.
- Writing something else instead leaves an approval unanswered: the call doesn't run, and the agent was told so when it asked.
- Answering one of several open requests closes the rest.

Once answered, a card folds into one row: a check for a yes or an answered question, a cross for a no, nothing for one nobody answered. The row opens to what was asked and answered.

Only you answer. Requests the agent can't make itself, such as approvals, come from the code around a tool, never from a tool the model calls.

## Adding a kind

A tool keeps its request in its result's details under `request`, with a `kind`, and ends the run with `control: { terminate: true }`. The browser draws the card from it; the frame every card shares is in `client/src/requests/RequestCard.tsx`. A kind whose answer needs the server registers a handler with `onAnswer` in `server/src/sessions/requests.ts`, which returns the text the model reads. The answer is stored as a `bica.answer` entry with the call, the value, and its label.

The tool result itself tells the model to end its turn and that the answer comes in the next message, so the model knows what it waits for.

## Sources

- Claude Code's `defer` permission decision: a headless session stops at a tool call, keeps its transcript, and resumes once the caller has the answer.
- The AI SDK's tool approvals and OpenAI's Agents SDK interruptions: the run ends with the request, and the answer is added to the history before the next one.
- MCP's elicitation and its multi round-trip requests, which Composio's approvals follow: accept, decline, or cancel, and a held call is repeated with the answer.
- Grok Bot's approval cards and question widgets: a widget ends the turn, and a card in a chat you started waits for you without a timer.
