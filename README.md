<div align="center">

<img src="client/public/favicon.svg" alt="Bica" width="96" height="96" />

# Bica

**A lean agent harness for coding, used from the browser.**<br /> It runs on your dev machine and works from any browser, on desktop or phone.

[bica.sh](https://bica.sh) · [Releases](https://github.com/cyrillbrito/bica/releases) · [Docs](docs/architecture.md)

</div>

Bica is built for the way developers work with agents day to day:

- Remote first: sessions keep running on your machine, and you can watch, steer, or join them from the phone.
- Git at the center: a worktree per feature, so parallel agents never collide, and a Git tab to commit and push.
- Review that works: full-size files and diffs, not a cramped side panel.
- Many sessions at once, with streaming transcripts, shared terminals, voice calls, and a view of context and spend.

The agent runs on [Pi Durable](https://github.com/earendil-works/pi/tree/main/packages/durable), so a run survives a restart. Bica is its own harness on Pi Durable, not the Pi coding agent. The name is a Lisbon espresso: _Vai Bica!_ means "go, Bica!".

## For users

Bica is early. Grab the `bica` binary for your system from [Releases](https://github.com/cyrillbrito/bica/releases) and run it. It opens on `http://localhost:3141`. Add a provider in Settings, add a project folder, and start a session.

Bica has no login, so keep it on localhost or a private network. [docs/deploy.md](docs/deploy.md) covers reaching it from the phone over Tailscale.

## For developers

Requires [Bun](https://bun.sh).

```sh
git clone https://github.com/cyrillbrito/bica.git && cd bica
bun install
bun run dev   # http://localhost:3142, data in .data/
```

| Command | Does |
| --- | --- |
| `bun run checks` | Types, lint, format, and Bun tests: run before each commit |
| `bun run test` | Bun tests only; `bun test <path>` runs one file |
| `bun run dev:site` | The website and docs, on port 3144 |
| `bun run build:bica` | Compile the binary into `dist/bica/bica` |
| `bun run build` / `start` | Production build, served on port 3141 |

Built with Bun, [Solid 2](https://v2.solidjs.com), Tailwind v4, Pi Durable, and [Pierre](https://diffs.com). Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Start with [AGENTS.md](AGENTS.md) and [docs/architecture.md](docs/architecture.md).
