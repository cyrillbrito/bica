# Telemetry

Telemetry is the usage data, Bica's own errors, and screen recordings that Bica sends to PostHog, so its author can see how many installs and sessions there are, which features and tools get used, which errors people hit, and where agents flail. The app, the server, and the website ([website.md](./website.md#analytics)) share one PostHog project. Off means nothing leaves the machine: no events, no errors, no replays, and no PostHog script. The user doc is the site's [Telemetry page](../site/src/content/docs/docs/reference/telemetry.mdx); keep it in step with this one.

## On and off

Telemetry is on only when a PostHog project key is present. The key (`phc_...`) is public by design, but it stays out of the code, so forks and dev runs never report to the author's project.

- Source and dev runs read `BICA_POSTHOG_KEY` and `BICA_POSTHOG_HOST` from the environment, which Bun loads from `.env`. The host defaults to PostHog's EU cloud.
- The `bica` binary has both built in from the same variables at build time ([deploy.md](./deploy.md#releases)), and never reads them where it runs.
- The test server runs with it off, unless a test turns it on against a fake PostHog.

Anyone can turn it off:

- `DO_NOT_TRACK=1` ([the cross-tool convention](https://consoledonottrack.com)) or `BICA_TELEMETRY=0` on the server turns everything off. Settings then shows the switches off and says why.
- Settings → Telemetry has two switches, saved in `settings.json`: usage data and errors, and screen recordings. Both start on, and recordings need usage data on.

The first time a data folder's server starts with telemetry on, the `bica` CLI prints a short notice: what is sent, how to turn it off, and a link to the user doc.

## Identity

Each data folder gets one random install id, kept in `telemetry.json` there. It is the PostHog person for the server's events, and the browser starts posthog-js with the same id, so an install is one person in PostHog, with the server's events and the browser's replays on one timeline.

Session and run ids go as a hash of the install id and the id, so they can be counted and grouped but not matched to anything on the machine.

Every event carries `app` (`bica`, or `site` for the website), `bica_version`, `install_kind` (`binary`, `source` for `bun run start`, or `dev`), and on the server `os` and `arch`.

## The relay

The browser never talks to PostHog. posthog-js sends to `/relay` on Bica's own origin, and the server forwards `/relay/static/*` to PostHog's assets host and everything else to the ingest host, with the method, query, body, and content headers only. No cookies and no client address go along, so PostHog sees every request come from the dev machine's address. Ad blockers leave it alone, the host lives in one place, and while telemetry is off the relay answers 404. In dev, Vite forwards `/relay/` to the server like the file links.

The browser learns whether telemetry is on, and why not, from the `telemetry` topic, along with the key, the relay path, the PostHog app host for toolbar links, the install id, whether replays may record, the version, and the install kind. The topic is never cached on the device, so an old copy can't start sending after it was turned off.

## The browser app

The app loads posthog-js only once the `telemetry` topic says on, after the page is up, so an install with telemetry off never downloads it. It uses the build that bundles its extensions, so no script from PostHog's servers runs in the app, and the replay recorder loads only while replays may record. The moment the topic says off, posthog-js opts out, stops recording, and drops any request it still holds, such as a queued batch or a replay's last chunk. Turning it on again resumes without a reload. Its state is kept in `localStorage` per install id, with no cookies.

What the app sends:

- `$pageview` for each page, with the address rewritten to its route, such as `http://bica/s/:id`, and a `page_kind` such as `session`, `workspace`, or `settings`. A file opened over a page isn't a new page. `$pageleave` when the tab closes or reloads.
- Clicks through autocapture with every text and attribute masked, so a click is its element's tag and place in the page, plus rage clicks, dead clicks, and heatmaps of clicks and pointer moves.
- Web vitals, without naming the slow element.
- Its own events, from [client/src/telemetry/events.ts](../client/src/telemetry/events.ts): `palette_open`, `command_run` (the action's id, or the kind of row for sessions, workspaces, and terminals), `shortcut_use`, `side_panel_tab_open`, `file_open` and `diff_open` (the page kind, and staged or changes), `setting_change` (the setting's name, with its value only for a switch or a fixed choice, and never for the telemetry switch itself), `theme_change`, and `dictation_start`. Prompts are counted on the server.
- `$exception` for uncaught errors, unhandled rejections, and errors an error boundary catches. An error the server answered with, a permission the user denied, and a cancelled request are not bugs and stay home.

Before any event leaves, every property at every depth is scrubbed: addresses become route patterns on `http://bica`, the host becomes `bica`, referrers become `$direct`, page titles and element texts go, and other text goes through the same rules as the server's errors, below.

### Replays

While replays are on, posthog-js records the page as rrweb does: the DOM, then each change, with mouse moves, clicks, scrolls, and the window size. The app's settings win over the PostHog project's, which can't turn on anything below.

- Every text shows as asterisks, and every input's value is masked.
- Attributes that can hold a name, a path, or a title (links, labels, titles, placeholders, ids, and data fields) show as `*`. Classes, inline styles, roles, and states such as selected or expanded stay, so the replay keeps its layout.
- Images, video, canvases, and frames show as empty boxes of the same size. Terminals draw on canvas, so they do too.
- No console logs and no network requests are recorded.
- The page's address in the replay's events is its route pattern, and the host is taken out of the recorded styles and posthog-js's own config.

A replay still shows the layout and styles, where things sit and how big they are, how long each masked text is, where the pointer goes and what it clicks, and which states change. A text's length can hint at a title's shape, but not at its words.

## What is never sent

- Prompt, reply, thinking, or note text; tool arguments or output; terminal content.
- File paths or names; project, worktree, folder, or branch names; session titles, commit messages, PR titles.
- The Bica URL's host, page titles, and URLs with ids or paths in them.
- Account names, emails, keys, environment values, skill names, custom instructions.
- Raw error messages from tools, git, providers, or the shell.

What may be sent: names from Bica's own code (agent ids, Bica's tool names, page kinds, command ids, side panel tabs, setting names), the model provider, model id, and effort, counts, durations, tokens, costs, booleans, coarse buckets, and hashed ids.

## Errors

Bica's own bugs go to PostHog's error tracking as `$exception`: uncaught exceptions and unhandled rejections, the harness's reports, and socket requests or topics that fail with a TypeError, ReferenceError, or RangeError. A failure with a system code, such as a missing file or a refused connection, is not a bug, and neither is an error Bica throws on purpose for a bad input. Tool failures are the agent's world, and tool events count them.

Before an error leaves, its message and stack lose the home folder and the Bica folder's own path, `/Users/<name>` and `/home/<name>` become `~`, tailnet hosts become `<host>`, emails `<email>`, and keys `<key>`, and long text is cut. The server and the browser share these rules ([shared/src/telemetry.ts](../shared/src/telemetry.ts)). The source lines PostHog reads around each frame are dropped.

A crash still ends the server, printing the error and exiting with code 1, after at most a second to send it. Quitting waits at most as long for what's queued.

## Events

Each side keeps its events and their properties in one typed catalog: [server/src/telemetry/events.ts](../server/src/telemetry/events.ts) for the server, and the browser's under [The browser app](#the-browser-app). Names follow [PostHog's guide](https://posthog.com/docs/product-analytics/best-practices): lowercase `object_verb` in the present tense, `is_` and `has_` for booleans, and `_ms`, `_count`, and `_usd` suffixes.

The server sends these. Each answers one question.

| Event | The question it answers |
| --- | --- |
| `server_start` | How many installs start, and how many are new. |
| `server_heartbeat` | Which installs are still in use: once a day, counts of projects, worktrees, open sessions, and sessions active that day. |
| `session_create` | How many sessions start, as which agent, and from where: the user, another session, the hub, a night run, or a fork. |
| `session_archive` | How many sessions get archived, by agent. |
| `prompt_send` | Who sends prompts (the user, another session, or Bica's notes), as a new prompt, a steer, or queued, with images or not, and roughly how long. |
| `run_end` | How runs go: model, effort, outcome (done, error, stopped, or waiting on `ask`), duration, turns, tool calls and errors, the longest error streak, the most repeated call, tokens, cost, and compactions. |
| `tool_use` | Which tools make agents flail: once per tool per run, its calls, errors, durations, longest error streak, and most repeated call. |
| `worktree_create`, `worktree_remove` | How often worktrees are made, and removed with or without force. |
| `commit_create` | How often the Git tab commits, and amends. |
| `terminal_start` | How often the user or an agent opens a terminal. |
| `voice_call_start`, `voice_call_end` | How many voice calls there are, and how long they last. |
| `provider_connect` | Which providers people connect, by key or sign-in. |
| `night_run_start` | How many night runs start, at the start time or by Run now. |
| `$exception` | Which of Bica's own bugs people hit, scrubbed. |

Runs and tools are counted from what the harness saves, so a call the model got wrong, such as one with bad arguments or to a tool that doesn't exist, counts as an error. A code mode script's calls count under their own tools, as nested. Two calls repeat when they have the same tool and the same arguments, compared only on the machine. A tool name Bica doesn't define goes as `other`, and a provider or model outside pi-ai's own list goes as `custom`, since its name could be private. A run that a restart cut off is sent once it ends, marked as resumed, with only what came after the restart. See [server/src/telemetry/runs.ts](../server/src/telemetry/runs.ts).

## Sources

- [PostHog's event naming guide](https://posthog.com/docs/product-analytics/best-practices).
- [PostHog's reverse proxy guide](https://posthog.com/docs/advanced/proxy), which the relay follows.
- [Console Do Not Track](https://consoledonottrack.com) for `DO_NOT_TRACK`.
