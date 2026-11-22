# Artifacts: live data and clicks

What artifacts ([artifacts.md](../artifacts.md)) could do next. Today a page shows the data the agent wrote into it, and a click inside it stays inside it. Nothing here is built.

## Live data

A dashboard of Jira cards should show the cards as they are when you open it, not as they were when the agent built it.

### How others do it

- Claude Code artifacts call MCP connectors when the page loads. The `Artifact` tool takes a `capabilities` input naming the connectors the page may call, and the page calls them through `window.claude.mcp`. An `artifact-capabilities` skill, loaded before any of this, carries the typed contract. claude.ai makes each call with the viewer's own account, so the page never sees credentials, and asks the viewer once before the first call. The page fetches on load, on an interval, or from a refresh button, and caches responses in the browser so a reopened page draws at once and then updates. Controls can also act, such as updating an issue. Only claude.ai connectors work: local MCP servers can feed the page while it's built, but not when it's viewed.
- MCP Apps, the MCP extension for UI, works the same way underneath. The host renders an HTML page in a sandboxed iframe and talks to it over JSON-RPC through `postMessage`. The page receives tool results and can call more tools through the host, which may ask for consent first. The page is a data-free shell, and data always arrives through the bridge.

The shared pattern: the page holds no secrets and makes no network calls of its own. It asks the host, the host runs a call the page declared up front with credentials it already has, and sends back the data.

### Options for Bica

- The page fetches the API itself. Simplest, but the token would sit in the HTML, and the sandbox's opaque origin fails the CORS check of most APIs, unless the API allows any origin.
- A bridge to declared data sources. The page calls something like `kit.data("jira")` through `postMessage`, which the kit already uses for themes, and Bica's server runs the matching source and returns JSON. A source could be a shell command or a small script the agent writes next to the page, run with the CLIs and credentials already on the dev machine, such as `gh` or a Jira CLI. The page would declare its sources, as Claude's `capabilities` does, so it can't run anything else.
- The same bridge to connected apps through Composio ([connectors.md](../connectors.md)), with an approval card for calls that change something.
- No live data: the agent refreshes the numbers by editing the page, on demand or from a scheduled run.

An export would keep the data from its last load and drop the live calls, since they need Bica.

## Clicks that prompt

A button inside the page could send a prompt to a session, the way `sendPrompt()` does in Claude's visuals: "dig into the Porto numbers" from a row of the table. The kit would post the text to the viewer, and the viewer would ask which session gets it, since an artifact belongs to none.

## Open questions

- Which way live data goes, and whether a data source asks before its first run.
- Which session a click's prompt goes to: a new one, the last one that edited the page, or one you pick.

## Sources

- Claude Code v2.1.209, artifact capabilities and `window.claude.mcp`: https://changelogs.core-directive.com/v/2.1.209/e/artifact-runtime-capabilities-mcp
- MCP Apps: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- MCP Apps, data-free shells and the bridge: https://litro.dev/docs/mcp-apps
- Reverse-engineering Claude's visuals, `sendPrompt()`: https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/
