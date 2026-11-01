# Distribution

What is left to install and update `bica` on another machine. The binary, its keys, and draft releases are built ([deploy.md](../deploy.md)).

## Decided

- A client always loads its UI from the server it talks to, so the UI and the server never mismatch, and swapping the binary updates both.
- The window is a browser: any browser, or Chrome in app mode from the main profile with extensions blocked on Bica's addresses. A separate Chrome profile was tried and dropped, because links then open in that empty profile.

## What's left

- `bica upgrade` and an in-app update button. Find the binary through `process.execPath` (or say `brew upgrade` when it sits in Homebrew), download the new one next to it, check it against `SHA256SUMS`, rename it over the old path, and restart. A rename is atomic, and the running process keeps the old file open.
- An install script at `bica.sh` (`curl -fsSL bica.sh | sh`) or a Homebrew tap that drops the file in `~/.local/bin`. Files from curl or Homebrew get no quarantine flag, so an unsigned binary runs.
- `bica service install`: a launchd or systemd user unit, so it runs at login with no terminal, like Ollama and `opencode service`.
- A first-run screen for providers, since a new machine has no `auth.json`.
- Windows, where terminals need a PTY that Bun doesn't have there.

## A desktop app, if ever needed

Agent apps with a window (OpenCode, T3 Code, Codex, Claude desktop) start the same local server and load the same web UI. The choice is the engine.

- Electron with the Bun binary as a child process is the proven route, at the size of Chromium plus Bun. Electron itself can't run on Bun, since its main process is Node built into Chromium's V8.
- System webviews (Tauri, `webview-bun`) mean WebKit on macOS. OpenCode left Tauri for Electron because WebKit drew its Solid UI slower and differently.
- Electrobun runs on Bun, but its 2.0 moved to its author's own runtime by default, a lot of one-person stack underneath.

## Sources

- Bun single-file executables: https://bun.com/docs/bundler/executables
- OpenCode's move from Tauri to Electron: https://dev.to/brendonovich/moving-opencode-desktop-to-electron-4hip
- T3 Code, a CLI service and an Electron app: https://github.com/pingdotgg/t3code
- Ollama's background app: https://docs.ollama.com/faq
- Electron declining a Bun runtime: https://github.com/electron/electron/issues/34876
- Electrobun 2.0: https://blackboard.sh/blog/electrobun-2-0/
