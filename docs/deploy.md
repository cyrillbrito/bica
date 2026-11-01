# Running and remote access

Bica runs on the dev machine and listens on localhost only. There are three ways to run it:

- The `bica` binary, on port 3141, for using Bica.
- A built copy from the repo (`bun run build`, then `bun run start`), also on 3141.
- The dev server (`bun run dev`), for working on Bica. That is two processes: Vite serves the pages on 3142 and forwards the socket, file links, diff blobs, and prompt images to the server on 3143.

Each port is pinned and fails instead of moving to the next free one, so a proxy in front of it never points at the wrong process.

## Remote access

Phones and other machines reach Bica through [`tailscale serve`](https://tailscale.com/kb/1312/serve), which proxies a port to `https://<machine>.<tailnet>.ts.net:<port>`:

```sh
tailscale serve --bg --https=3141 http://localhost:3141
tailscale serve status
```

Use 3142 for the dev server, and 3144 for the website's (`bun run dev:site`). The serve config survives reboots, so only Bica has to be running.

It gives HTTPS with a real certificate, which the installed app and the microphone ([voice.md](./voice.md)) need, proxies WebSockets, and stays inside the tailnet. Never use `funnel`: there is no login, and the tailnet is the only protection. The dev servers accept only `localhost` and `.ts.net` hosts, so another proxy needs its host added to `allowedHosts` in `client/vite.config.ts`.

## Installing as an app

Bica installs as an app with its own window and Dock icon. In Chromium browsers, use the install icon in the address bar. In Safari, use File → Add to Dock. The app keeps the extensions of the browser profile it was installed from, so install it from a profile without extensions to run it clean.

## A built copy

`bun run build` and `bun run start` run a built copy on port 3141. The build is only the browser app, in `client/dist/client`; the server runs from source and serves it. It starts through the same entry as the `bica` binary below, so it takes the same `--port` flag and keys. `BICA_PORT` picks another port for a second dev server, and its server takes the port above it.

Data lives in the repo's `.data/` ([architecture.md](./architecture.md#where-data-lives)). Never run two servers against the same `.data/`, since only one process may own the harness.

## The `bica` binary

`bun run build:bica` compiles the same production server into one file, `dist/bica/bica`, that runs from any folder with no repo or `node_modules`. The client and codemode's worker and wasm are embedded. `bica` listens on `localhost:3141` (`--port` picks another) and keeps its data in `~/.bica/data`, or in `BICA_DATA_DIR`, so it never shares the repo's `.data/`.

One server owns a data folder at a time. Two would corrupt Pi Durable's store, which has no lock of its own, so the server writes its PID to `server.pid` there and refuses to start while that process lives.

In a terminal it prints its address and a few keys, the way Vite does:

- `a` opens Bica as a Chrome app window (`--app`) in your own Chrome profile, so links open there too. Block extensions on Bica's address once in `chrome://extensions/sites`. Without Chrome it opens the default browser.
- `o` opens the default browser.
- `p` picks the Chrome profile from Chrome's `Local State`, saved in `chrome.json` in the data folder.
- `q` and Ctrl-C stop it, which ends its shells. Pi Durable resumes agent runs on the next start.

Without a terminal, as a background service, it only logs. See [server/cli/bica.ts](../server/cli/bica.ts), the entry both start through, and [server/cli/build.ts](../server/cli/build.ts), which embeds the files and compiles it.

`bica --version` prints the version, which comes from `BICA_VERSION` at build time. A local build without it says `0.0.0-dev`. `bun run build:bica --target bun-linux-x64` cross-compiles, into `dist/bica/linux-x64/bica`, and takes several `--target` flags at once.

## Releases

A release is a draft GitHub release with `bica` for macOS arm64 and x64 and Linux x64 and arm64, plus a `SHA256SUMS` file. The version lives only in its `vX.Y.Z` tag, never in `package.json`.

1. Start the `release` workflow: on GitHub, Actions → release → Run workflow, pick `patch`, `minor`, or `major`. From a terminal: `gh workflow run release -f bump=minor`.
2. The workflow raises the latest tag's version by that part, starting from `v0.0.0`, builds, pushes the tag, and creates the draft. A failed build leaves no tag.
3. Review the draft under Releases. Its notes list the commit subjects since the previous tag and a compare link. Edit them there or with `gh release edit`, then publish.

It runs on macOS so `codesign --sign -` can sign the macOS binaries, which Apple Silicon needs to run them. See [release.yml](../.github/workflows/release.yml).
