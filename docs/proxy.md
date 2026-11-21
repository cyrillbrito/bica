# CLI proxy

Bica can send model requests to a CLIProxyAPI server, which holds many plan sign-ins and switches between them when one runs out. It shows in Bica as one provider ([providers.md](./providers.md)), added under Settings → Providers.

## Why a proxy

There are several sources of model access: personal Claude and ChatGPT plans, a second Claude account, work accounts, Copilot, and OpenRouter. Bica holds one sign-in per provider, while the proxy holds many and picks between them by priority. Plans whose limits reset on a timer go first, since unused time is lost. Work accounts billed by tokens come next, and OpenRouter, paid per request, comes last.

The proxy can run on another machine and be reached over Tailscale, so every machine running Bica shares one pool. Session affinity keeps a conversation on one account, so its prompt cache stays warm. Keep one direct sign-in in Bica as a backup for when the proxy's machine is off.

Anthropic's terms don't allow plan sign-ins in third-party apps, and the proxy poses as Claude Code, so an account can be blocked for it.

## Setting it up

Settings asks for the proxy's URL, one of its API keys, and optionally its management key. Saving checks them against the proxy first, and stores them in `.data/auth.json` like any other key. Until then, a half-filled form is kept on that device, so leaving the page or reloading doesn't lose it, and Discard drops it.

## Models

The proxy only lists model names, so Bica looks each one up in pi-ai's catalog to learn its context size, thinking levels, image input, and price. The match also picks the API to speak, since the proxy serves Anthropic's, OpenAI's, and the generic chat format on one port. A Claude model too new for pi-ai borrows the newest one of its kind. Names with an account prefix, like `work/claude-opus-5-5`, keep it.

The list loads when the server starts and on every save. If the proxy is down at start, Bica keeps trying while a tab is open.

## Image models

Names with `image` in them, like `gpt-image-2.5`, are image models: the proxy runs them on a ChatGPT plan through Codex, so they cost plan usage and no API credits. They never show in the model picker. Agents call them from codemode ([tools.md](./tools.md#images)). Bica speaks OpenAI's Images API to them, which pi-ai lacks: a prompt alone goes to `/v1/images/generations`, and a prompt with images goes to `/v1/images/edits`. An image takes 15 to 20 seconds. The proxy picks the size itself, often 1536×1024 or about 1254×1254, so ask for a shape in the prompt.

## Accounts and limits

With a management key, Settings lists the proxy's accounts with their limit bars, and the sidebar's foot shows the ones serving the open session's model. The proxy keeps each account's latest rate-limit headers, so reading them costs no request to the model provider. An account that hasn't answered since the proxy started has no numbers yet.

## Sources

- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI). Copilot is only in its community fork, CLIProxyAPIPlus. Its image routes are in `internal/runtime/executor/codex_openai_images.go`.
