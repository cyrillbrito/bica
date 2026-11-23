# Bica

Bica is a fast web UI for Pi agents, built on Pi Durable. It runs on the dev machine and works from any browser, on desktop or phone.

The name is Bica, a Lisbon espresso, everywhere: the UI, docs, code, the binary, env vars, the data folder, the GitHub repo, and the package name. The domain is `bica.sh`. There is no second name ([naming record](docs/records/naming.md)).

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
- Server, scripts, and tests use Bun's own APIs before Node's or a package: `Bun.spawn`, `Bun.sleep`, `Bun.file`, `Bun.serve`, `bun:sqlite`, and so on. The client runs in the browser, so it has none of them.
- A Bun workspace with every package under `packages/`: `client` (the Solid app), `server` (plain Bun), `shared` (the code both run, as `@bica/shared/...`), and `web` (the React mock, below). Versions more than one package uses sit in the root `package.json`'s `catalog`. See [architecture.md](docs/architecture.md#packages).
- `site` is the website at bica.sh: an Astro home page plus the user docs at `/docs` in Starlight, with D2 diagrams through `astro-d2`, deployed to Cloudflare. See [website.md](docs/website.md).
- Solid 2 (release candidate) through `@solidjs/vite-plugin` in client start mode: the app renders only in the browser, with no server-side rendering. This is not SolidStart.
- `web` is the UI's move to React ([React record](docs/records/react.md)), a mock in progress: React 19 on Vite, TanStack Router, and BoardUI's free components copied in as source, on fake data with no server. BoardUI's design rules apply there instead of `docs/UI.md`, and the Solid sections below don't. See [its README](packages/web/README.md).
- Pi Durable, with `pi-ai` for models, runs the agent and stores it in SQLite.
- Tailwind v4 with no component library, see [docs/UI.md](docs/UI.md).
- Pierre for diffs, file views, and the file tree, through their plain JavaScript entries, not the React ones.
- Oxlint and Oxfmt for linting and formatting.

[docs/architecture.md](docs/architecture.md) explains how the parts fit together.

## Commands

Each package owns its scripts (`dev`, `build`, `test`, `typecheck`), and the root forwards to them: `--cwd packages/<name>` for one package, `--filter` or `--workspaces` for several. Lint, format, and `checks` cover the whole repo, so they live only at the root.

- `bun run checks` runs every check: types, lint, the format check, and the tests. Run it before every commit, and fix what fails.
- `bun run typecheck` type-checks with `bun check`, Bun's built-in checker, so `typescript` is not a dependency. `bun run lint` lints, and `bun run fmt` formats.
- `bun run test` runs the behavior tests with `bun test`, each file in its own process. `bun test <path>` runs one file. See [docs/testing.md](docs/testing.md) before writing a test.
- `bun run dev` is the dev server: Vite on port 3142, forwarding the socket to the server on 3143. It usually runs already, see Verifying UI below.
- `bun run dev:site`, `bun run build:site`, and `bun run deploy:site` run, build, and deploy the website.
- `bun run dev:web` runs the React mock on port 3145.
- `bun run build` and `bun run start` run a built copy, see [docs/deploy.md](docs/deploy.md).
- `bun run build:bica` compiles the `bica` binary into `dist/bica/bica`, and the `release` workflow publishes it as a draft GitHub release, see the same doc.
- `bunx skills add <owner/repo> -a codex -y` adds a skill for agents working on this repo. `-a codex` keeps it in `.agents/skills` alone, with no `.claude/` link. The CLI also records it in `skills-lock.json`, so commit both.
- Ports: 3141 for `bica` and `bun run start`, 3142 for Vite in dev, 3143 for the dev server, 3144 for the website, 3145 for the React mock. `BICA_PORT` moves the dev pair.

## Next

- Quick edits in Pierre's edit mode.
- Opening pull requests, and comparing a worktree against its branch base.
- Installing as an app on the phone.
- A file watcher instead of polling.
- Live data in artifacts, and clicks inside one that send a prompt.
- A file mode in the command palette: `/` searches the workspace's files, and ⌘P opens straight into it.
- A new look after BoardUI's design. Two branches on GitHub hold the trials: `boardui-solid-port-prototype` ports its free components to Solid 2 (`prototypes/boardui-solid/README.md` there), and `monorepo-react-client` mocks every screen in React with them.

## Library docs

Pi Durable, Solid 2, and Pierre are new and change often, and the web may describe a newer version than the one installed. Read the installed copy first.

- Bun: https://bun.com/llms.txt indexes the docs, one Markdown page each. Look there before reaching for a Node API or a package.
- Pi Durable: `packages/server/node_modules/@earendil-works/pi-durable/README.md` and `CHANGELOG.md`, plus the READMEs of `pi-ai` and `chord` next to it. Examples: https://github.com/earendil-works/pi/tree/main/packages/durable.
- Pi packages as inspiration: https://github.com/earendil-works/pi/tree/main/packages. Before building or changing an agent tool, prompt, or session feature, look at how Pi does it, mostly `coding-agent` (its tools in `src/core/tools`, and `examples`), `agent`, and `ai`. Bica never runs that code, but the APIs are close, so borrow the ideas and adapt them to Pi Durable.
- Solid 2: `packages/client/node_modules/solid-js/CHEATSHEET.md` and the skills under SolidJS 2 below. Full docs for agents: https://v2.solidjs.com/llms.txt
- Markdown: the skills in `packages/client/node_modules/@tanstack/markdown/skills/` (the React ones don't apply).
- Pierre: https://diffs.com/llms.txt and https://trees.software/llms.txt.
- Vite: https://vite.dev/guide/ and `packages/client/node_modules/@solidjs/vite-plugin/README.md` for start mode.

## Docs

`docs/` is a short user manual of what exists, one doc per feature, written as [docs/writing.md](docs/writing.md) describes. Read the doc for the area before changing it, and follow its links to related docs. This list is the index: add new docs here.

- [GLOSSARY.md](docs/GLOSSARY.md): one name per concept, and the words to avoid. Read before naming anything, in code, docs, or the UI.
- [architecture.md](docs/architecture.md): concepts, server modules, the folder layout, how a prompt travels, where data lives. Start here for anything that crosses areas, and read its Feature folders before moving code or adding a folder.
- [sessions.md](docs/sessions.md): the transcript, queue, composer, forks, status, archive. Read for transcript or composer work.
- [tools.md](docs/tools.md): the agent's tools, code mode, and `ask`. Read before adding or changing a tool.
- [orchestration.md](docs/orchestration.md): sessions working with other sessions: parents and child sessions, Detach, watching, notes, and the session tools. Read before changing how sessions start, message, or hear of each other.
- [system-prompt.md](docs/system-prompt.md): the system prompt's sections, project instructions, skills, and reply rules. Read before changing what the agent is told.
- [context-usage.md](docs/context-usage.md): the context chip, prompt cache, spend, compaction, pruning.
- [agents.md](docs/agents.md): the Coding and Bot agents, what an agent holds, and what Bica does around it. Read before changing what a kind of session gets.
- [schedules.md](docs/schedules.md): reminders and routines, prompts that fire later, once or on a repeat, back into a session or as a new one; the Schedules page. Read before changing them.
- [bots.md](docs/bots.md): the long-lived agents you make, each with a home, a workspace, and one session that gets work done through others; their Watching strip, memory files, and housekeeping. Read before changing bots or long-lived sessions.
- [voice.md](docs/voice.md): voice calls, handoffs, hold music, and dictation.
- [projects.md](docs/projects.md): projects, worktrees, chats, pull requests, the sidebar.
- [layout.md](docs/layout.md): the sidebar, the centre, and the side panel on each screen size, and the side panel's tabs. Read before adding a side panel tab.
- [files.md](docs/files.md): the workspace page, file and diff views, file lists.
- [artifacts.md](docs/artifacts.md): the HTML report pages agents build, the kit with its themes and charts, the viewer, and export. Read before changing artifacts, the kit, or the artifacts skill.
- [git.md](docs/git.md): the Git tab and commit messages.
- [command-palette.md](docs/command-palette.md): ⌘K and every keyboard shortcut. Read before adding a shortcut.
- [terminals.md](docs/terminals.md): shared shells and the agent's terminal tools.
- [requests.md](docs/requests.md): requests, the cards a session waits on you with: questions and approvals, how they wait without running, and how an answer comes back. Read before adding a kind or changing how one is answered.
- [connectors.md](docs/connectors.md): connected apps through Composio, their tools in code mode, the apps line in the prompt, and approval cards. Read before changing them.
- [models.md](docs/models.md): providers and sign-ins, more than one plan account, Exa, the default and fast models, and the model picker.
- [realtime-communication.md](docs/realtime-communication.md): the WebSocket protocol, projection, and caching. Read before adding a topic or request.
- [deploy.md](docs/deploy.md): running Bica, Tailscale, the `bica` binary, releases.
- [UI.md](docs/UI.md): design rules, tokens, components, test data. Read before any UI work.
- [website.md](docs/website.md): the home page, the user docs at bica.sh, how to write them, and the Cloudflare deploy. Read before changing the site, and update its pages when a feature changes.
- [testing.md](docs/testing.md): what gets a test, how to write one, and the test server. Read before adding or changing a test.
- [writing.md](docs/writing.md): how to write docs, comments, and commit messages.

`docs/explorations/` holds research and plans for what isn't built. Read the matching one before building in its area, and delete or trim it once the feature's doc takes over. Write one only when the user asks for it.

- [fast-loading.md](docs/explorations/fast-loading.md): opening, switching, and reconnecting faster on the phone.
- [artifacts.md](docs/explorations/artifacts.md): live data in artifacts, and clicks inside one that send a prompt.
- [rich-replies.md](docs/explorations/rich-replies.md): cards and forms in the middle of a reply.
- [agent-memory.md](docs/explorations/agent-memory.md): dreaming, a pass that checks and tidies a bot's memory files.
- [bots.md](docs/explorations/bots.md): what other bot products do that Bica's bots don't yet: schedules, notifications, connectors, and better memory.
- [distribution.md](docs/explorations/distribution.md): installing and updating `bica`.
- [session-progress.md](docs/explorations/session-progress.md): agent to-do lists, the removed Recap tab, and what could show a session's progress instead.
- [self-hosted-auth.md](docs/explorations/self-hosted-auth.md): a token for the socket, so the network isn't the only lock.
- [themes.md](docs/explorations/themes.md): editor color themes.
- [ui-hierarchy.md](docs/explorations/ui-hierarchy.md): what the side panel next to a session belongs to.
- [voice-and-bots.md](docs/explorations/voice-and-bots.md): what's left from OpenAI's GPT-Live and Codex voice for calls and bots.
- [work-lifecycle.md](docs/explorations/work-lifecycle.md): from a first question to a merged pull request.

`docs/records/` holds big decisions the user asked to record: what was tried, what was found, and what was decided. Read the matching one before reopening its question. Write one only when the user asks for it; how the code is laid out today goes in `architecture.md`.

- [extensibility.md](docs/records/extensibility.md): why features aren't extensions.
- [naming.md](docs/records/naming.md): why the name is Bica and the domain is bica.sh.
- [react.md](docs/records/react.md): why the UI moves from Solid to React and BoardUI.

`docs/inspiration/` holds screenshots of other agent UIs, as ideas, not specs.

## Rules

- Write docs, comments, and commit messages as [docs/writing.md](docs/writing.md) describes. Comments are rare and say why, never what.
- Commit only when the user asks, and only your own files: other sessions share the worktree. Messages follow Conventional Commits, such as `chore: add the improve skill`. Check `git log` and match it, and run `bun run checks` first.
- Before adding something the repo already has more of, such as a skill, a package, or a config file, look at how the existing ones were added and match them. A tool's defaults are not the repo's conventions: check the diff it leaves for files and changes the others don't have.
- Use the terms in [docs/GLOSSARY.md](docs/GLOSSARY.md) for names, comments, docs, and UI labels. Stored fields, socket names, and Durable extension names keep older words so stored data still reads; their comments say so. Add a term there when a new concept appears.
- Read [docs/UI.md](docs/UI.md) before any UI work.
- Keep this file and `docs/` up to date with every change. Add a doc when a new area appears.
- The repo is public. Keep one machine's setup out of code, docs, comments, prompts, and test data: no personal paths, machine or tailnet names, accounts, or tools only the author uses. Use placeholders such as `<machine>`, and made-up names in fixtures. Prompts call the user "they".
- Simplicity first. If a change adds complexity, look for a smaller one.
- Keep each feature's code in its own folder, not spread across the app. Give a pattern a shared shape once three features repeat it, not before.
- Answer questions in the reply. Don't write a plan or an exploration doc unless the user asks for one.

## Verifying UI

After UI changes, check them in a real browser with [`agent-browser`](https://github.com/vercel-labs/agent-browser), a browser CLI for agents. Its skill explains how to use it. These are the facts for this repo:

- The dev server (`bun run dev`: Vite on 3142, the server on 3143) may host the Bica session you are running in. Don't restart or stop it. It has no live updates (`server.ws: false`), so reload the page to see page edits, but server code (`packages/server/src`) runs as it started until Bica restarts: test server changes on your own dev server on another port, such as `BICA_PORT=3199 BICA_DATA_DIR=/tmp/bica-test bun run dev`, which puts its server on 3200. Always give it its own `BICA_DATA_DIR`: the server refuses to start on a data folder another one uses. Another dev server may run on a different port; inspect running terminals before starting one.
- Open `http://localhost:3142`, then check `errors` and `console` for Solid warnings and socket errors.
- For a change to a building block in `packages/client/src/ui/`, open `http://localhost:3142/ui`: the playground shows every one in light and dark side by side.
- For the phone layout, run `set viewport 390 844` and check again.
- For worst-case data, open the page with `?data=worst`. See Test data in `docs/UI.md`.
- The data is real. Don't create, send to, or delete sessions, and don't commit, unless that is what you are testing.

## SolidJS 2

This project uses SolidJS 2. Solid is not React. Components run once and never re-render. Updates flow through signals to exactly the parts that read them, and effects and memos follow Solid's own rules. Don't bring React patterns over.

Read `packages/client/node_modules/solid-js/CHEATSHEET.md` before writing Solid code. It matches the installed version, and it ends with the corrections for habits from Solid 1 and React.

### Skills that ship with the installed packages

Read these when you need them. They match the installed versions.

- `packages/client/node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` maps every dev-mode warning code, such as `REACTIVE_WRITE_IN_OWNED_SCOPE` or `STRICT_READ_UNTRACKED`, to its fix. Read it whenever one of those codes shows up in test output or the browser console.
- `packages/client/node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` explains how to record which parts re-ran and why, find wasted work, and set limits on it, in tests and on live pages.

### Debugging updates

When something doesn't update, updates too often, or is slow, record what happened instead of guessing, as Debugging Solid updates in [docs/UI.md](docs/UI.md) describes. Give signals, memos, and effects a name with the `{ name: "..." }` option, because the reports identify them by name.
