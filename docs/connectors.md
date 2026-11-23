# Connected apps

Connected apps let the agent read and act on your own apps, such as Gmail, Slack, GitHub, or Strava. [Composio](https://composio.dev) handles the sign-ins and tokens, and Bica never sees them. Every session that has code mode can use them once a Composio key is saved.

## Setting it up

Settings → Connected apps starts with a field for a Composio project API key. Composio isn't a model provider, so its key lives here rather than in Providers, though it's saved with their keys in `auth.json`. Save checks the key with Composio first. The key comes from a developer project on [Composio's platform](https://platform.composio.dev), under the project's Settings → API Keys, and starts with `ak_`. Composio's free plan is enough for one person. Its consumer product, Composio Connect, uses other keys and only works over MCP, and apps connected there don't show in Bica: Composio keeps projects apart.

The card then shows which key is saved, with Remove key, and lists your apps with their status. Connect app searches Composio's catalog and opens the app's sign-in page, and the row turns Connected once you finish. Disconnect removes the app and revokes its access. The agent can also send a sign-in link in the chat when it needs an app that isn't connected.

Bica makes one Composio user and one Composio session for itself, saved in `.data/composio.json`, and makes a new session when the key or the session's config changes.

## More than one account

An app can be connected more than once, such as a personal and a work Gmail: Connect app again and sign in with the other account. Each shows as its own row, with the address or name it signed in as, which Composio reads from the app once the sign-in is done.

Composio's sessions use only the newest account of each app unless multi-account mode is on, so Bica's session turns it on, with explicit selection. The prompt's apps line names each app's accounts, such as "Gmail (ana@example.com, ana@work.example)". Search lists them under the app's connection status, each with an id such as `gmail_coffee-licit` and its email. A call to an app with several then needs `account` set to one of those ids. Without it the call fails and Composio names the choices, so the agent never quietly picks the wrong account. An approval card shows which account the call runs on.

`composio_manage_connections` lists an app's accounts by default. Its `add` makes a new sign-in link every time it's called, even for an app already connected. Composio's tool can also rename and remove accounts, but Bica's copy offers only list and add: it's script-only, so a removal would skip approval. Disconnect in Settings removes one.

## What the agent sees

The system prompt names the apps that were connected when the session started or last compacted, such as "Connected apps: Gmail, GitHub." A connection made later shows after the next compaction, so the prompt cache holds. The same prompt section explains Composio's tools and the rule for sending. Each session pays about 540 tokens for it, plus about 240 for the one listed tool. Its rules for running tools come from Composio's own `composio` skill, installed in `.agents/skills/` for agents working on this code: never guess slugs, connect only what the task needs, pick the connected one of an app's two toolkits, reconnect on an auth error, don't retry a blocked call, and quote the log id of a failure. Bica adds one: prefer what can be undone, so trash over a permanent delete, archive over delete, and a draft over a send.

The tools are Composio's general ones, not one per app: search for tools, get their schemas, run several at once, and manage connections. Bica writes its own short copy of each, which forwards to Composio's. Search, schemas, and connections are reads, so the agent calls them only from [code mode](./tools.md#code-mode) scripts. Code mode doesn't list them, so their schemas stay out of the prompt, and a script prints only what it needs from big results. All four as plain tools, with Composio's own descriptions, would cost about 3,700 tokens.

The tool that runs app tools, `composio_multi_execute_tool`, is listed as well. The agent reads from a script, to keep only the fields it needs, and calls the tool directly for anything that changes something. Each write that needs your yes is then its own approval card in the transcript. Composio's remote workbench and remote bash are off: Bica has code mode and bash, and scripts there could slip past approvals.

## Approvals

Composio hints what each tool does: reads, creates, updates, or deletes. Bica's Composio session asks before every tool that creates, updates, or deletes, using Composio's approval feature, which Composio marks experimental.

- Reads run at once.
- A send, a post, or an edit waits. Its call ends the turn on an approval card, a [request](./requests.md) like the agent's questions, with the app, the action, and its arguments, and the session shows Waiting for you. One call with several actions gets one card and one answer.
- Approve runs the call again from what the card kept, and the agent reads your choice and its result in the next prompt. Deny tells the agent no. Always approve also stops asking for that tool on that account until Bica's Composio session changes.
- A delete waits the same way, on a red card, without Always approve.
- Writing to the session instead of answering leaves the card unanswered, and the call doesn't run.
- A call from a code mode script that needs approval fails, telling the agent to make it as a tool call, since a script can't wait.
- A [scheduled](./schedules.md) run waits on its card like any session: the prompt that fired it is not your yes.

Hints are Composio's best guess. Always approve is the way out of a wrongly gated read. A write wrongly hinted as a read would run without asking.

The prompt also says to send only when you named what to send and to whom. "Handle my inbox" is not an ask, and replying is sending.

Nothing waits in memory, so a card survives a restart and can be answered hours later. Approving starts the call over instead of resuming Composio's held one, since Composio's `request_state` may expire, as MCP asks of it. The card's new questions get your answer if they ask about the same calls; otherwise nothing runs and the agent is told to call again.

The code is in `packages/server/src/connectors/` and `packages/client/src/connectors/`. The connected apps line is taken where the memory index is ([system-prompt.md](./system-prompt.md)).

## Sources

- Composio's [`composio` skill](https://github.com/ComposioHQ/composio/tree/next/skills/composio), its references for Platform and errors in particular.
- Composio's [configuring sessions](https://docs.composio.dev/docs/configuring-sessions), [tool hints](https://docs.composio.dev/docs/governance/tool-hints), [approvals](https://docs.composio.dev/docs/governance/approvals), and its [agent skill](https://github.com/ComposioHQ/composio/blob/next/skills/composio/SKILL.md), which says an app with its own agent loop uses sessions and a project key, and to reuse one session.
- Grok Bot's rule never to send unasked: a send needs the user to name the message and the recipient.
- Pi Durable's deferred, script-only tools, the way it reaches an MCP server's tools from code mode.
