# T3 Code

From https://t3.codes and https://github.com/pingdotgg/t3code. Kind: orchestrator. It drives the agent CLIs already on your machine (Claude Code, Codex, Cursor, OpenCode, Grok, Antigravity) from a desktop, web, and native mobile app.

- One button commits, pushes, and opens a pull request with a generated title, body, and changelog. Draft, stacked, and amended pull requests too.
- Every thread works on its own branch, with inline diff review before the push.
- `t3` starts a server and opens the web app, and `t3 service install` keeps it running in the background. Remote access from a phone or another machine works without Tailscale.
- Switch model mid-thread, several accounts per provider, permission modes.
- Open source and meant to be forked and restyled.

For Bica, the one-button pull request with a generated body is the part we don't have yet.

![](diff-panel.png)

![](file-view.png)
