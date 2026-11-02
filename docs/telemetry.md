# Telemetry

Telemetry is the usage data, Bica's own errors, and screen recordings that Bica sends to PostHog, so its author can see how many installs and sessions there are, which features and tools get used, which errors people hit, and where agents flail. The app, the server, and the website share one PostHog project. Off means nothing leaves the machine: no events, no errors, no replays, and no PostHog script.

## On and off

Telemetry is on only when a PostHog project key is present. The key (`phc_...`) is public by design, but it stays out of the code, so forks and dev runs never report to the author's project.

- Source and dev runs read `BICA_POSTHOG_KEY` and `BICA_POSTHOG_HOST` from the environment, which Bun loads from `.env`. The host defaults to PostHog's EU cloud.
- The `bica` binary has both built in at build time, from the same variables ([deploy.md](./deploy.md#releases)). It never reads them where it runs.
- The test server always runs with it off, unless a test turns it on against a fake PostHog.

Anyone can turn it off:

- `DO_NOT_TRACK=1` ([the cross-tool convention](https://consoledonottrack.com)) or `BICA_TELEMETRY=0` on the server turns everything off. Settings then shows the switches off and says why.
- Settings → Telemetry has two switches, saved in `settings.json` like the other settings: usage data and errors, and screen recordings. Both start on, and recordings need usage data on.

The first time a data folder's server starts with telemetry on, the `bica` CLI prints a short notice: what is sent, how to turn it off, and a link to the user doc.

## Identity

Each data folder gets one random install id, kept in `telemetry.json` there. It is the PostHog person for the server's events, and the browser starts posthog-js with the same id, so an install is one person in PostHog, with the server's events and the browser's replays on one timeline.

Session and run ids are never sent raw. They go as a hash of the install id and the id, so they can be counted and grouped but not matched to anything on the machine.

Every event carries `app` (`bica`, or `site` for the website), `bica_version`, `install_kind` (`binary`, `source` for `bun run start`, or `dev`), and on the server `os` and `arch`.

## The relay

The browser never talks to PostHog. posthog-js sends to `/relay` on Bica's own origin, and the server forwards it: `/relay/static/*` to PostHog's assets host and everything else to the ingest host, with the method, query, body, and content headers only. No cookies and no client address go along. Ad blockers leave it alone, the host lives in one place, and while telemetry is off the relay answers 404. In dev, Vite forwards `/relay/` to the server like the file links.

The browser learns whether telemetry is on, and why not, from the `telemetry` topic: the key, the relay path, the PostHog app host for toolbar links, the install id, whether replays may record, the version, and the install kind. The topic is never cached on the device, so an old copy can't start sending after it was turned off. See [server/src/telemetry/telemetry.ts](../server/src/telemetry/telemetry.ts).

## What is never sent

- Prompt, reply, thinking, or note text; tool arguments or output; terminal content.
- File paths or names; project, worktree, folder, or branch names; session titles, commit messages, PR titles.
- The Bica URL's host, page titles, and URLs with ids or paths in them.
- Account names, emails, keys, environment values, skill names, custom instructions.
- Raw error messages from tools, git, providers, or the shell.

What may be sent: names from Bica's own code (agent ids, Bica's tool names, page kinds, command ids, side panel tabs, setting names), the model provider, model id, and effort, counts, durations, tokens, costs, booleans, coarse buckets, and hashed ids.

## Errors

Bica's own bugs go to PostHog's error tracking as `$exception`: uncaught exceptions and unhandled rejections, the harness's reports, and socket requests or topics that fail with a TypeError, ReferenceError, or RangeError. A failure with a system code, such as a missing file or a refused connection, and any error Bica throws on purpose for a bad input, is not a bug. Tool failures are the agent's world, not exceptions, and tool events count them.

Before anything leaves, the message and the stack lose the home folder and the Bica folder's own path, `/Users/<name>` and `/home/<name>` become `~`, tailnet hosts become `<host>`, emails `<email>`, and keys `<key>`, and long text is cut. The source lines PostHog reads around each frame are dropped.

A crash still ends the server as it did, printing the error and exiting with code 1, after at most a second to send it. Quitting waits at most as long for what's queued.

## Events

Each side keeps its events and their properties in one typed catalog: [server/src/telemetry/events.ts](../server/src/telemetry/events.ts) for the server. Names follow [PostHog's guide](https://posthog.com/docs/product-analytics/best-practices): lowercase `object_verb` in the present tense, `is_` and `has_` for booleans, `_ms`, `_count`, and `_usd` suffixes.

The server sends `server_start`, `server_heartbeat`, and `$exception` itself. The others are declared in the catalog for the features to send.

| Event | When |
| --- | --- |
| `server_start` | The server starts, and whether the install id is new. |
| `server_heartbeat` | Once a day: counts of projects, worktrees, open sessions, and sessions active that day. |
| `session_create`, `session_archive` | A session starts or is archived: its agent, whether it's a child, where it came from. |
| `prompt_send` | A prompt is sent: who sent it, steer or queue, images, a length bucket. |
| `run_end` | Each run: model, effort, outcome, duration, turns, tool calls and errors, repeated calls, tokens, cost. |
| `tool_use` | Each tool used in a run, once: calls, errors, durations, error streaks, repeated calls. |
| `$ai_generation` | Each model response, for PostHog's LLM analytics, with tokens, latency, and cost but never its input or output. |
| `worktree_create`, `worktree_remove`, `commit_create`, `terminal_start`, `voice_call_start`, `voice_call_end`, `provider_connect`, `night_run_start` | The main action of each feature. |
| `$exception` | One of Bica's own bugs, scrubbed. |

## Sources

- [PostHog's event naming guide](https://posthog.com/docs/product-analytics/best-practices).
- [PostHog's reverse proxy guide](https://posthog.com/docs/advanced/proxy), which the relay follows.
- [PostHog's LLM analytics manual capture](https://posthog.com/docs/llm-analytics/manual-capture) for `$ai_generation`.
- [Console Do Not Track](https://consoledonottrack.com) for `DO_NOT_TRACK`.
