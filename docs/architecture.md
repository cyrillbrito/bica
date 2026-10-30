# Architecture

Bica is a Bun server on the dev machine and a web app that talks to it over one WebSocket. The server owns the agent, the data, the disk, and git. The browser only shows what the server sends.

```
 Browser (laptop, phone)                     Server (dev machine, one process)
┌───────────────────────────┐              ┌──────────────────────────────────────┐
│ Solid app                 │              │ Pi Durable harness                   │
│  sessions · transcript    │   one        │  conversations, runs, tools, queue   │
│  project page · git       │◀─WebSocket──▶│  → .data/harness.sqlite              │
│  terminals · settings     │   per tab    │ Projects, settings, keys, usage      │
│                           │              │  → small JSON files in .data/        │
│ no disk access            │              │ Git, files, and terminal shells      │
└───────────────────────────┘              └──────────────────────────────────────┘
```

## Concepts

[GLOSSARY.md](./GLOSSARY.md) names every concept. These are the ones the rest builds on.

- A project is a folder on the dev machine, usually a git repo. A workspace is the exact folder work happens in: the project's main folder or one of its worktrees. See [projects.md](./projects.md).
- A session is one agent conversation in one workspace. See [sessions.md](./sessions.md).
- An agent is what a session runs as: its system prompt, model, extensions, and skills. See [agents.md](./agents.md).
- A run is the agent working on a prompt until it replies, made of turns: one model response and its tool calls each.
- A terminal is a shell in a workspace, shared by you and the agents. See [terminals.md](./terminals.md).
- The harness is Pi Durable's engine inside the server. It runs every session and saves each turn before anyone sees it.

## Packages

The repo is three Bun workspace packages, one per side, so each runs and type-checks on its own:

- `client`: the Solid app, built by Vite, which runs in the browser. Its types have the DOM and no Bun or Node. `vite.config.ts` runs in Node, so `tsconfig.node.json` checks it apart, with Node's types.
- `server`: plain Bun, with the socket, the agents, git, and the shells. Its types have Bun and no DOM.
- `shared`: the code both run, imported as `@bica/shared/...`: the message types, the agents' names, and the transcript projection.

The client can't import the server, because its `package.json` doesn't list it.

## Feature folders

Inside the client and the server, code is grouped by feature, and a feature has the same folder name on both sides: terminals is `client/src/terminals` and `server/src/terminals`. A feature gets a folder on a side once it has two files there. A single file joins the feature it builds on: the Tonight strip sits in `client/src/sessions`, and housekeeping in `server/src/sessions`.

- `sessions/`: the transcript, the composer, prompts and the queue, notes from Bica, archive, and housekeeping ([sessions.md](./sessions.md)).
- `orchestration/`: sessions working with other sessions, built on `sessions/`: the session tools, parents and child sessions, Detach, watching, and the notes when a run ends ([orchestration.md](./orchestration.md)). The hub builds on it from its own folder.
- `agents/` (server): Coding and Assistant, the shared prompt sections, the registry that lists every agent, and `extensions.ts`, which installs the extensions behind the names agents pick into Pi Durable's registry at startup ([agents.md](./agents.md), [system-prompt.md](./system-prompt.md)). `tools/` holds the agent's general tools, and `harness.ts` opens Pi Durable ([tools.md](./tools.md)).
- `models/`: models, keys, sign-ins, and plan accounts ([models.md](./models.md)).
- `projects/`: projects, worktrees, chats, pull requests, and the workspace the current page is about ([projects.md](./projects.md)).
- `files/` and `git/`: file and diff views, kept files, and review comments; status, staging, and commits ([files.md](./files.md), [git.md](./git.md)).
- `markdown/` (client): rendered Markdown for replies, notes, and file previews, with code highlighting, links to paths, and a streaming reply typing in ([sessions.md](./sessions.md#the-transcript)).
- `terminals/`, `voice/`, `hub/`, `night-runs/`, `context-usage/`: one feature each, with its doc. Hub and Night define their agents in their own folders.

A file goes to the feature that owns it, not the one that uses it first. Features import each other freely, with no layering between them. The pieces every feature touches stay in one place each: `shared/src/protocol.ts`, the socket's table of calls in `server/src/socket.ts`, the sidebar in `client/src/app/sidebar/`, and ⌘K in `client/src/app/palette/`. A piece of one moves into its feature only when it owns state there, as terminal and kept-file rows did.

A client feature folder mixes components (`PascalCase.tsx`) with stores and helpers (`kebab-case.ts`). The file named after the feature, such as `sessions/sessions.ts`, holds its state and its requests to the server. The `shared` package stays flat: `protocol.ts` holds every call and topic in one file.

Some folders aren't features. In the client, `app/` is the frame around pages (sidebar, ⌘K, top bar, side panel), `ui/` the design system and DOM helpers, `socket/` the browser end of the socket, `fixtures/` the test data, and `routes/` the pages, one file per URL. On the server, the root files do one job each: `serve.ts` is the HTTP server and its few routes, `socket.ts` is the one table of calls and topics, and `testing/` starts a real Bica for the tests.

Features call each other directly, by relative path to the file they need, with no `index.ts` in between. Only `routes/` and `App.tsx` import `app/`, and `router.ts` is open to all. No package has import cycles, and lint fails on one. The session tools start sessions, and sessions need the tools, so nothing in `sessions/` imports `orchestration/`: `socket.ts` installs them through `agents/extensions.ts` before the harness opens, and sessions find them by name in Pi Durable's registry.

The app renders only in the browser. In development, `bun run dev` runs two processes: Vite serves the pages on 3142 and forwards the socket and the server's HTTP routes (`server/src/serve.ts`) to the server one port up. `bun run start` and the `bica` binary run one server that serves the built app too. The server doesn't hot-reload: it runs as it started until Bica restarts. Page edits still reload.

## How a prompt travels

1. You send from the composer, and the browser sends a request with a fresh id.
2. The server hands the prompt to the session, which queues it if a run is going.
3. The harness runs the agent in the workspace and saves every turn and tool call to SQLite.
4. Each save produces a small list of changes, which the server forwards to every tab watching that session.

A restart resumes unfinished runs, and a dropped phone reconnects to fresh data. See [realtime-communication.md](./realtime-communication.md).

## Where data lives

Bica's data sits in the repo's `.data/`. The browser keeps small preferences per device, such as the theme, and a cache of what it last showed.

| What | Where |
| --- | --- |
| Sessions, transcripts, queues | `harness.sqlite` |
| Projects | `projects.json` |
| Settings | `settings.json` |
| Keys and sign-ins | `auth.json`, readable only by you |
| Plan accounts' emails and order | `accounts.json` |
| Plan limits for the meters | `plan-usage.json` |
| Images sent with prompts, by content hash | `attachments/` |
| Worktrees, branches, files | git and the disk |

`server/src/storage.ts` is the one way to these files: it knows where `.data` is, keeps keys private, saves through a temporary file so a crash never leaves half a file, and refuses to overwrite a file it can't read. In `harness.sqlite`, each session has Pi Durable's documents (`pi.agent`, `pi.live`, `pi.inbox`, and more) and Bica's own, `bica.session`, with its title, project, archive, and what the features around it keep. Code reads and changes it through `sessionMeta` and `editSession` in `server/src/sessions/store.ts`.

Settings are the same on every device, and the server sends them as their own topic. Preferences of one device, like the theme, stay in its browser.

Your own files for Bica live in `~/.bica/`: an `AGENTS.md` and skills for every session ([system-prompt.md](./system-prompt.md)), and the chat folders ([projects.md](./projects.md#chats)).

## Safety

There is no login. Bica is reached on localhost or over Tailscale, and that network is the security boundary. The socket refuses other websites, and every file or git request must stay inside its workspace. See [deploy.md](./deploy.md).
