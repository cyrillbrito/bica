# Providers and models

Providers are where models come from. Settings → Providers connects any provider pi-ai knows, with pi-ai's names and sign-in options. Settings → Models then picks which model does what.

## Providers

Connect a provider with a plan sign-in, such as Claude Max or ChatGPT Plus, or with an API key. Plans are meant for the provider's own apps, so they may refuse Bica at any time. Keys and sign-ins come only from Settings, never from environment variables or other apps' logins, so Bica never uses an account it doesn't list.

A ChatGPT plan can sign in two ways: Sign in with ChatGPT under OpenAI, or the older OpenAI Codex (legacy). [Voice calls and dictation](./voice.md) need the legacy one.

Exa isn't a model provider. Its key turns on the agent's web search and fetch ([tools.md](./tools.md)), and the free plan is enough.

## More than one account

Add provider offers a signed-in plan again as Another account. Each request goes to the first account not near its limits, and moves to the next when one runs out or loses its sign-in. Use first sets the order. A switch resends the conversation once, since accounts don't share a prompt cache. The foot of the sidebar shows each account's usage for the open session's model.

## Which model does what

- The default model starts new sessions. `PI_MODEL` fills in until one is picked.
- The fast model writes session titles and [commit messages](./git.md#commit-messages). `PI_FAST_MODEL` fills in. Without one, titles are the prompt's first words.

## The picker

The Model picker card in Settings chooses which models the picker offers. The picker lists them by name, with a Thinking switch and an Effort choice where a model has them. Point at a model to see its context size and list price. A pick in a session applies to that session only. When a session's model is gone, say its provider was removed, the next prompt moves it to the same model through another provider, or else to the default model.

The picker's button shows a short name, such as Opus for Claude Opus 4.5. Only the newest version gets it, so an older Opus keeps its full name.

## Sources

- [opencode-auth-load-balancer](https://github.com/owjs3901/opencode-auth-load-balancer) for accounts that take turns.
- [LobeHub Icons](https://github.com/lobehub/lobe-icons) for the provider logos.
- affectUI's [Usage Meter](https://www.affectui.com/components/usage-meter) for the meters, and [Model Picker](https://www.affectui.com/components/model-picker) for the picker.
