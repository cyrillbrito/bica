# Rich replies

How the agent could show cards and forms in the middle of a reply, such as a comparison or a small form, to read once and move on. Nothing is built. Today replies render Markdown, links, images, and ` ```mermaid ` blocks ([sessions.md](../sessions.md)). Pages the agent builds and keeps are artifacts ([artifacts.md](../artifacts.md)).

## How others do it

- Claude's custom visuals. The model calls a `show_widget` tool with an HTML fragment. The page draws it straight into the chat as the arguments stream, using its own CSS variables, and runs scripts once the fragment is complete. A `sendPrompt()` function turns a click into a follow-up message. Design rules sit behind a `read_me` tool, loaded by module (chart, diagram, mockup) only before the first widget, at 17–59K characters each. The visuals don't persist unless saved as an artifact.
- ChatGPT's interactive replies. The model writes Markdown with JSX-like tags from a catalog of about 70 native components, plus a little JavaScript for state. The server recompiles the partial output every chunk, so the interface grows while it streams, and drops unknown props with a diagnostic. An iframe block is the escape hatch for anything outside the catalog.
- A2UI 1.0, Google's open protocol (Apache 2.0, November 2026). The agent sends a flat list of components from a catalog the app registers, a data model the components bind to, and actions that go back to the agent. Its basic catalog has 18 components: text, image, icon, row, column, list, card, tabs, divider, modal, button, text field, checkbox, choice picker, slider, date input, video, and audio. 1.0 adds function calls in both directions, nesting rules in the catalog, several catalogs per surface, and "Express", a compact syntax that cuts output tokens by about half against JSON. Renderers exist for React, Angular, Lit, Flutter, and SwiftUI. There is none for Solid, and its TypeScript agent SDK generates the prompt that teaches the catalog.
- OpenUI Lang, an open format along the same lines, one assignment per line so each line renders as it arrives. It measured about half the tokens of JSON across seven layouts.
- Codex only previews files beside the chat, and an open issue asks for inline HTML.

What they share: a fixed catalog the app draws natively, so output looks like the app and can be checked; teaching material loaded only when needed; and streaming that draws while the model writes.

## A `show` tool with A2UI components

Cards and forms go through a tool, not a fenced block:

- Bica checks the components against the catalog before drawing. A mistake returns as an error the agent fixes, which is how A2UI's own SDKs work.
- A form needs your answer back as data. With a wait option, `show` ends the run like `ask` does, and submitting the form answers it. `ask` could become the simple case of it.
- The text before and after the call still reads around the card. pi-ai parses tool arguments while they stream, so the card can fill in live.

The catalog would be A2UI's basic one drawn with `client/src/ui/` parts, so it looks native in both themes, plus a few Bica components that point at data: a file slice, a diff, a session card. Pointing costs a path instead of the content, and Bica draws the real thing. Using A2UI's message shape instead of an invented one gives a written spec, nesting rules, and Express for free. Models don't know A2UI yet, so a skill teaches the catalog when the agent first needs it, as `read_me` does.

Mermaid stays a fenced block. Models write it reliably, it streams with the text at no extra cost, and a tool call would add a model request per diagram. A diagram that fails to parse already shows as code with the reason. If that turns out to be common, Mermaid can become a second content type of `show`.

Not every reply needs this. Like Claude's ladder, prose stays the default, and a card earns its place for a comparison, a choice with fields, or data with a shape.

## Open questions

- How much of A2UI's spec to take: the basic catalog and actions first, function calls in both directions only if a form needs them.
- How a `show` card folds once answered, and how it reads in a session's notes to its parent.

## Sources

- Google, A2UI 1.0: https://developers.googleblog.com/a2ui-10-build-delightful-fast-reliable-agentic-experiences/
- Flutter, what's new in A2UI 1.0: https://flutter.dev/blog/a2ui-launch
- What A2UI is, messages and security: https://www.greyscript.ai/blog/what-is-a2ui-agent-ui-protocol/
- Curiosity, A2UI's basic catalog: https://blog.curiosity.ai/blog/2026-11-a2ui-agentic-ui-in-curiosity-studio
- Claude, custom visuals in chat: https://support.claude.com/en/articles/13979539-custom-visuals-in-chat-and-cowork
- Reverse-engineering Claude's visuals, and a Pi port: https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/
- How ChatGPT's interactive replies work: https://www.openui.com/blog/how-chatgpt-intelligent-ui-works
- OpenUI Lang token benchmark: https://mer.vin/2026/05/openui-lang-mit-generative-ui-that-cuts-llm-output-tokens-versus-json/
- Codex, inline HTML preview request: https://codexissues.com/issue/29642-inline-html-artifact-webview-preview-in-codex-desktop
