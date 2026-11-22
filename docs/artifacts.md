# Artifacts

An artifact is one self-contained HTML page an agent builds as a report: a dashboard, an explainer, a comparison, anything easier to see than to read. Bica keeps it, lists it, and shows it full page in a theme you pick. Cards inside a reply are a different idea ([rich-replies.md](./explorations/rich-replies.md)), and what artifacts can't do yet is in [explorations/artifacts.md](./explorations/artifacts.md).

## Where they live

Each artifact is one `<name>.html` file in the data folder's `artifacts/`, and its `<title>` is its title. Artifacts are global: they belong to no project, session, or owner, so any session can find and change any of them. Renaming or deleting one is done on its file.

## How the agent makes one

There is no artifact tool. The agent writes the page with `write` and changes it with `edit`, so an update costs a diff, not the whole page. Agents that read skills (Coding and Bot) get one line in the system prompt naming the folder and saying to read the `artifacts` skill first ([system-prompt.md](./system-prompt.md)). To update "the sales report", the agent greps the titles in the folder and edits that file.

The skill ships with Bica, in `server/src/artifacts/SKILL.md`. It teaches the contract below: the include line, the token names, Tailwind, no colors or fonts of its own, ECharts, page patterns (summary first, sections, tables over prose, SVG diagrams), and scripts last. There are no templates. Each start writes the skill to the data folder's `bundled-skills/`, since the `bica` binary holds it only in memory and the agent reads skills from disk. A skill named `artifacts` in the workspace or home folders replaces it.

## The kit

Every artifact includes the kit itself, with one line in `<head>`:

```html
<script src="/artifact-kit/kit.js"></script>
```

The line is explicit, so the file shows what it depends on and the viewer only displays it. Bica serves the kit as one script: ECharts, then the kit's own code, then Tailwind's browser build, all from the dev machine, never a CDN. It loads in `<head>` before the page's scripts, so they can draw charts at once, and is revalidated on each load.

The kit puts the themes' CSS first in `<head>`, so the page's own styles win. A theme works in three layers:

- Element styles, so plain HTML with no classes reads well: headings, lists, tables, code, quotes, `details`, form controls, and a centred column. They sit in a CSS layer between Tailwind's reset and its utilities, so any utility class beats them.
- Tokens as CSS variables, the same names in every theme: `bg`, `surface`, `well`, `fg`, `muted`, `line`, `accent`, `accent-fg`, `success`, `warn`, `danger`, `info`, `chart-1` to `chart-6`, three fonts, and a radius.
- The same tokens as Tailwind's theme, so `bg-surface` and `text-muted` work. Tailwind's palette and fonts are cleared, so `bg-blue-500` does nothing and nothing falls out of the theme. `dark:` follows the kit's light or dark.

Fonts are the app's own self-hosted files, served under `/artifact-kit/fonts/`.

## Themes

Three themes, each with a light and a dark side: Bica, the app's own look; Paper, a book face on cream for calm reading; and Dashboard, a cool canvas with vivid chart colors and heavy headings. A theme is one CSS file in `server/src/artifacts/kit/themes/` that sets every token under its `data-theme`, plus its line in `themes.ts`.

The viewer's pick wins, then the page's own `data-theme`, then Bica. Light and dark is Match Bica (Bica's own appearance, forced or not), Light, or Dark. Both picks are kept per device. The page runs on an opaque origin, so Bica can't reach into it: the viewer passes the picks in the URL when it loads the page and by `postMessage` after, and the kit applies them.

## Charts

Charts are ECharts. `echarts.init(el)` with no theme gets one the kit builds from the current tokens, so the agent never sets a color. When the theme or light and dark changes, the kit recolors every chart in place with ECharts' `setTheme`, and charts resize with their box. A page that names its own ECharts theme keeps it. For drawing of its own, a page reads tokens with `kit.token(name)` and listens for the `kit:theme` event.

## Viewing

Artifacts, at the top of the [sidebar](./layout.md), lists every artifact newest first, with its title, file name, and when it changed. One opens full page in the same sandbox as HTML files ([files.md](./files.md#safety)), with the theme, light and dark, open in a new tab, and export in the top bar. Artifacts have no workspace, so their pages have no side panel.

The list polls the folder while someone looks, and reads it again after every tool call. An open artifact reloads when its file changes and keeps its scroll, which the kit reports to the viewer. In a transcript, a write or edit of an artifact has an Open button, and a path to an artifact in a reply opens it in the viewer.

## Export

Export downloads one file that works anywhere, offline. The server swaps the include line for inline code: the picked theme only, its fonts as data URIs, ECharts when the page draws charts, and only the Tailwind classes the page uses, compiled with Tailwind's `compile()`, the API its browser build runs. Every word of the page is a candidate, and the compiler keeps the ones that are classes, so classes a script adds count too. With Match Bica, the file follows the reader's system. A page with charts comes to about a megabyte.

## Safety

Pages read the data folder, so their route checks the `Host` header against DNS rebinding, like diff blobs. The kit and fonts hold nothing private and allow any origin, since fonts load in CORS mode and the page's origin is opaque.

## Sources

- [Claude Code artifacts](https://code.claude.com/docs/en/artifacts): HTML files the agent edits, a design skill, and pages that refresh as the file changes.
- [html-chameleon](https://github.com/churin1116/html-chameleon): a contract of semantic CSS variables, preset themes picked with `data-theme`, and baking the theme into the file to share it.
- [claude.ai artifact rules](https://agricidaniel.github.io/fablesecondbrain/concepts/Artifacts-Usage-Criteria): only Tailwind's prebuilt core classes, for want of a compiler, which the browser build and `compile()` avoid.
- [Thariq Shihipar, The unreasonable effectiveness of HTML](https://claude.dev/blog/using-claude-code-the-unreasonable-effectiveness-of-html/): plain HTML first, and a skill once a pattern repeats.
- [Reverse-engineering Claude's visuals](https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/): design rules read only when needed, as the skill is.
- [Terse Tailwind for LLMs](https://casualdeveloper.net/post/2026-07-19-terse-tailwind/): stock Tailwind classes cost fewer tokens than handwritten CSS.
- [Tailwind's browser build](https://tailwindcss.com/docs/installation/play-cdn) and [`compile()` used directly](https://github.com/tailwindlabs/tailwindcss/discussions/16581).
- [ECharts themes](https://echarts.apache.org/handbook/en/concepts/style/#theme), registered from tokens and switched in place.
