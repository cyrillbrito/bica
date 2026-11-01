# Bica

Bica is a fast web UI for Pi agents, built on Pi Durable. It runs on the dev machine and works from any browser, on desktop or phone.

The name is Bica, a Lisbon espresso, in the UI, docs, code, the binary, env vars, and the data folder. `vaibica` ("Vai Bica", go, Bica!) is only for what you find or install it by: the domains `vaibica.com` and `vaibica.dev`, the GitHub repo, the package name, and an npm scope.

## Mindset

Bica is built first for its author's own daily work: a complete development tool for one developer, not a product for teams. The repo is public, so anyone can read, run, or fork it, and everything in it is written for that stranger too. It should cover everything needed to build features with agents, from start to finish:

- Agent sessions are the core, but not the whole tool.
- Each feature gets its own worktree, so parallel agents never collide.
- Review happens in full-screen diffs, not a cramped side panel.
- Git covers commit, push, pull requests, and removing merged worktrees.
- Files can be opened, searched, and quickly edited.

If a daily dev task forces a switch to another app, that is a gap worth closing. Heavy editing in a full editor is the one accepted exception.

There is no time to prove every idea here, so borrow from people who already built or measured it: other apps, Pi packages, studies, and posts. Look at several sources, take the part that gives the most benefit for the least complexity, and leave the rest. Treat their numbers with care, since anyone can find a benchmark that flatters their tool, but still link them: they show the direction is sound and where the idea came from. A doc for a feature built this way ends with its sources.

## Goals

- Remote first. The server runs on the dev machine, and the UI works in any browser and installs as an app on the phone.
- Fast and polished. Interactions feel instant, output streams, and nothing jumps. Design quality counts as a feature.
- Many sessions at once. You can watch them stream, steer or queue prompts while the agent works, and reconnect or join late without losing anything.
- Reviewing the agent's work in full-size files and diffs.

## Out of scope

- The Pi coding agent itself. Bica runs its own agent on Pi Durable. The coding agent's code and extensions are a good source of ideas, since the APIs are close, but Bica never runs them.
- A full IDE. Heavy editing opens your editor.
- Native mobile or desktop apps. The web app is the app.
- A plugin system. Features are plain code in their own folders, and agent behavior uses Pi Durable's extensions where that's simple ([extensibility record](docs/records/extensibility.md)).

## Stack

- Bun 1.4.3 or newer runs the server, installs packages, type-checks, and runs the tests. Vite runs on Node, its tested runtime, and `bun run` falls back to Bun when Node isn't installed.
- Three Bun workspace packages: `client` (the Solid app), `server` (plain Bun), and `shared` (the code both run, as `@bica/shared/...`). See [architecture.md](docs/architecture.md#packages).
- `site` is a prototype of the website: an Astro home page plus Starlight docs at `/docs`, with D2 diagrams through `astro-d2`. `bun run dev:site` runs it on port 3144.
- Solid 2 (release candidate) through `@solidjs/vite-plugin` in client start mode: the app renders only in the browser, with no server-side rendering. This is not SolidStart.
- Pi Durable, with `pi-ai` for models, runs the agent and stores it in SQLite.
- Tailwind v4 with no component library, see [docs/UI.md](docs/UI.md).
- Pierre for diffs, file views, and the file tree, through their plain JavaScript entries, not the React ones.
- Oxlint and Oxfmt for linting and formatting.

[docs/architecture.md](docs/architecture.md) explains how the parts fit together.

## Commands

Each package owns its scripts (`dev`, `build`, `test`, `typecheck`), and the root forwards to them: `--cwd <folder>` for one package, `--filter` or `--workspaces` for several. Lint, format, and `checks` cover the whole repo, so they live only at the root.

- `bun run checks` runs every check: types, lint, the format check, and the tests. Run it before every commit, and fix what fails.
- `bun run typecheck` type-checks with `bun check`, Bun's built-in checker, so `typescript` is not a dependency. `bun run lint` lints, and `bun run fmt` formats.
- `bun run test` runs the behavior tests with `bun test`, each file in its own process. `bun test <path>` runs one file. See [docs/testing.md](docs/testing.md) before writing a test.
- `bun run dev` is the dev server: Vite on port 3142, forwarding the socket to the server on 3143. It usually runs already, see Verifying UI below.
- `bun run dev:site` and `bun run build:site` run and build the website.
- `bun run build` and `bun run start` run a built copy, see [docs/deploy.md](docs/deploy.md).
- `bun run build:bica` compiles the `bica` binary into `dist/bica/bica`, and the `release` workflow publishes it as a draft GitHub release, see the same doc.
- Ports: 3141 for `bica` and `bun run start`, 3142 for Vite in dev, 3143 for the dev server, 3144 for the website. `BICA_PORT` moves the dev pair.

## Next

- Quick edits in Pierre's edit mode.
- Opening pull requests, and comparing a worktree against its branch base.
- Installing as an app on the phone.
- A file watcher instead of polling.
- A file mode in the command palette: `/` searches the workspace's files, and ⌘P opens straight into it.

## Library docs

Pi Durable, Solid 2, and Pierre are new and change often, and the web may describe a newer version than the one installed. Read the installed copy first.

- Pi Durable: `server/node_modules/@earendil-works/pi-durable/README.md` and `CHANGELOG.md`, plus the READMEs of `pi-ai` and `chord` next to it. Examples: https://github.com/earendil-works/pi/tree/main/packages/durable.
- Pi packages as inspiration: https://github.com/earendil-works/pi/tree/main/packages. Before building or changing an agent tool, prompt, or session feature, look at how Pi does it, mostly `coding-agent` (its tools in `src/core/tools`, and `examples`), `agent`, and `ai`. Bica never runs that code, but the APIs are close, so borrow the ideas and adapt them to Pi Durable.
- Solid 2: `client/node_modules/solid-js/CHEATSHEET.md` and the skills under SolidJS 2 below. Full docs for agents: https://v2.solidjs.com/llms.txt
- Markdown: the skills in `client/node_modules/@tanstack/markdown/skills/` (the React ones don't apply).
- Pierre: https://diffs.com/llms.txt and https://trees.software/llms.txt.
- Vite: https://vite.dev/guide/ and `client/node_modules/@solidjs/vite-plugin/README.md` for start mode.

## Docs

`docs/` is a short user manual of what exists, one doc per feature, written as [docs/writing.md](docs/writing.md) describes. Read the doc for the area before changing it, and follow its links to related docs. This list is the index: add new docs here.

- [GLOSSARY.md](docs/GLOSSARY.md): one name per concept, and the words to avoid. Read before naming anything, in code, docs, or the UI.
- [architecture.md](docs/architecture.md): concepts, server modules, the folder layout, how a prompt travels, where data lives. Start here for anything that crosses areas, and read its Feature folders before moving code or adding a folder.
- [sessions.md](docs/sessions.md): the transcript, queue, composer, forks, status, archive. Read for transcript or composer work.
- [tools.md](docs/tools.md): the agent's tools, code mode, and `ask`. Read before adding or changing a tool.
- [orchestration.md](docs/orchestration.md): sessions working with other sessions: parents and child sessions, Detach, watching, notes, and the session tools. Read before changing how sessions start, message, or hear of each other.
- [system-prompt.md](docs/system-prompt.md): the system prompt's sections, project instructions, skills, and reply rules. Read before changing what the agent is told.
- [context-usage.md](docs/context-usage.md): the context chip, prompt cache, spend, compaction, pruning.
- [agents.md](docs/agents.md): the Coding, Assistant, Night, and Hub agents, what an agent holds, and what Bica does around it. Read before changing what a kind of session gets.
- [night-runs.md](docs/night-runs.md): sessions held for tonight, run one at a time while the plan has room, ending with a report.
- [assistant-mode.md](docs/assistant-mode.md): sessions that run for months, with memory in files.
- [hub.md](docs/hub.md): the one session that coordinates the others.
- [voice.md](docs/voice.md): voice calls, handoffs, hold music, and dictation.
- [projects.md](docs/projects.md): projects, worktrees, chats, pull requests, the sidebar.
- [layout.md](docs/layout.md): the sidebar, the centre, and the side panel on each screen size, and the side panel's tabs. Read before adding a side panel tab.
- [files.md](docs/files.md): the workspace page, file and diff views, file lists.
- [git.md](docs/git.md): the Git tab and commit messages.
- [command-palette.md](docs/command-palette.md): ⌘K and every keyboard shortcut. Read before adding a shortcut.
- [terminals.md](docs/terminals.md): shared shells and the agent's terminal tools.
- [models.md](docs/models.md): providers and sign-ins, more than one plan account, Exa, the default and fast models, and the model picker.
- [realtime-communication.md](docs/realtime-communication.md): the WebSocket protocol, projection, and caching. Read before adding a topic or request.
- [deploy.md](docs/deploy.md): running Bica, Tailscale, the `bica` binary, releases.
- [UI.md](docs/UI.md): design rules, tokens, components, test data. Read before any UI work.
- [testing.md](docs/testing.md): what gets a test, how to write one, and the test server. Read before adding or changing a test.
- [writing.md](docs/writing.md): how to write docs, comments, and commit messages.

`docs/explorations/` holds research and plans for what isn't built. Read the matching one before building in its area, and delete or trim it once the feature's doc takes over. Write one only when the user asks for it.

- [fast-loading.md](docs/explorations/fast-loading.md): opening, switching, and reconnecting faster on the phone.
- [distribution.md](docs/explorations/distribution.md): installing and updating `bica`.
- [session-progress.md](docs/explorations/session-progress.md): agent to-do lists, the removed Recap tab, and what could show a session's progress instead.
- [self-hosted-auth.md](docs/explorations/self-hosted-auth.md): a token for the socket, and the DNS rebinding hole.
- [themes.md](docs/explorations/themes.md): editor color themes.
- [ui-hierarchy.md](docs/explorations/ui-hierarchy.md): what the side panel next to a session belongs to.
- [voice-and-hub.md](docs/explorations/voice-and-hub.md): what's left from OpenAI's GPT-Live and Codex voice for calls and the hub.
- [work-lifecycle.md](docs/explorations/work-lifecycle.md): from a first question to a merged pull request.

`docs/records/` holds big decisions the user asked to record: what was tried, what was found, and what was decided. Read the matching one before reopening its question. Write one only when the user asks for it; how the code is laid out today goes in `architecture.md`.

- [extensibility.md](docs/records/extensibility.md): why features aren't extensions.

`docs/inspiration/` holds screenshots of other agent UIs, as ideas, not specs.

## Rules

- Write docs, comments, and commit messages as [docs/writing.md](docs/writing.md) describes. Comments are rare and say why, never what.
- Use the terms in [docs/GLOSSARY.md](docs/GLOSSARY.md) for names, comments, docs, and UI labels. Stored fields, socket names, and Durable extension names keep older words so stored data still reads; their comments say so. Add a term there when a new concept appears.
- Read [docs/UI.md](docs/UI.md) before any UI work.
- Keep this file and `docs/` up to date with every change. Add a doc when a new area appears.
- The repo is public. Keep one machine's setup out of code, docs, comments, prompts, and test data: no personal paths, machine or tailnet names, accounts, or tools only the author uses. Use placeholders such as `<machine>`, and made-up names in fixtures. Prompts call the user "they".
- Simplicity first. If a change adds complexity, look for a smaller one.
- Keep each feature's code in its own folder, not spread across the app. Give a pattern a shared shape once three features repeat it, not before.
- Answer questions in the reply. Don't write a plan or an exploration doc unless the user asks for one.

## Verifying UI

After UI changes, check them in a real browser with [`agent-browser`](https://github.com/vercel-labs/agent-browser), a browser CLI for agents. Its skill explains how to use it. These are the facts for this repo:

- The dev server (`bun run dev`: Vite on 3142, the server on 3143) may host the Bica session you are running in. Don't restart or stop it. It has no live updates (`server.ws: false`), so reload the page to see page edits, but server code (`server/src`) runs as it started until Bica restarts: test server changes on your own dev server on another port, such as `BICA_PORT=3199 BICA_DATA_DIR=/tmp/bica-test bun run dev`, which puts its server on 3200. Another dev server may run on a different port; inspect running terminals before starting one.
- Open `http://localhost:3142`, then check `errors` and `console` for Solid warnings and socket errors.
- For a change to a building block in `client/src/ui/`, open `http://localhost:3142/ui`: the playground shows every one in light and dark side by side.
- For the phone layout, run `set viewport 390 844` and check again.
- For worst-case data, open the page with `?data=worst`. See Test data in `docs/UI.md`.
- The data is real. Don't create, send to, or delete sessions, and don't commit, unless that is what you are testing.

## SolidJS 2

This project uses SolidJS 2. Solid is not React. Components run once and never re-render. Updates flow through signals to exactly the parts that read them, and effects and memos follow Solid's own rules. Don't bring React patterns over.

Read `client/node_modules/solid-js/CHEATSHEET.md` before writing Solid code. It matches the installed version, and it ends with the corrections for habits from Solid 1 and React.

### Skills that ship with the installed packages

Read these when you need them. They match the installed versions.

- `client/node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` maps every dev-mode warning code, such as `REACTIVE_WRITE_IN_OWNED_SCOPE` or `STRICT_READ_UNTRACKED`, to its fix. Read it whenever one of those codes shows up in test output or the browser console.
- `client/node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` explains how to record which parts re-ran and why, find wasted work, and set limits on it, in tests and on live pages.

### Debugging updates

When something doesn't update, updates too often, or is slow, record what happened instead of guessing, as Debugging Solid updates in [docs/UI.md](docs/UI.md) describes. Give signals, memos, and effects a name with the `{ name: "..." }` option, because the reports identify them by name.
