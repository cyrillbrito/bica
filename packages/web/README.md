# @bica/web

Bica's UI in React and BoardUI, as a front-end mock in progress. Every screen runs on fake data from `src/fixtures.ts`, with no server, socket, or cache. A timer plays a scripted agent turn in running sessions and after each prompt, so it feels alive. Why it exists is in [docs/records/react.md](../../docs/records/react.md).

## Run it

```sh
bun run dev:web        # http://localhost:3145
```

`bun run build` and `bun run typecheck` work from this folder too.

## Screens

| Route | What it shows |
| --- | --- |
| `/` | The home composer, with the project and Main folder or New worktree. |
| `/s/$id` | A session: the transcript, the composer with the model picker and queue, and the side panel. `/s/hub` is the hub. |
| `/p/$id` | A workspace page: the workspace card, or with `?file=` or `?diff=` a file or diff full size from Pierre. |
| `/t/$id` | A terminal, with static output. |

Any route takes `?settings=general`, `providers`, `models`, or `shortcuts` to open Settings, and `?panel=git` or `files` for the side panel's tab. ⌘K opens the command palette, ⌘B and ⌥⌘B hide the sidebar and side panel, and ⌘, opens Settings.

## How it is built

- React 19 on Vite, client only. TanStack Router with code-based routes in `src/router.tsx`.
- Tailwind v4 through `@tailwindcss/vite`.
- BoardUI's components live in `src/components`, `src/styles`, `src/utils`, and `src/hooks`, copied as source the way `npx boardui add` installs them, and imported through `@/`. Their design rules apply here: semantic color tokens, the composite type utilities such as `text-body-medium`, and `cx()` to merge classes. Bica's `docs/UI.md` does not.
- The mock's own code sits in feature folders: `app` (the frame, sidebar, side panel, palette, Settings), `sessions`, `files`, `git`, and `terminals`.
- Pierre's React entries draw the file tree, files, and diffs, themed from BoardUI's tokens in `src/app.css`.
- The command palette is React Aria's Autocomplete and Menu with BoardUI's menu recipe, since BoardUI's free tier has no palette.

## Credit

The tokens, type scale, components, and blocks come from [BoardUI](https://www.boardui.com) by Mertcan Dundar Esmergul, from the free tier at [github.com/BoardUI/boardui](https://github.com/BoardUI/boardui) (commit `ec5c5eb`), under the MIT licence in [`LICENSE-boardui`](LICENSE-boardui). No BoardUI Pro source is used. Icons are [Remix Icon](https://remixicon.com). Fonts are Inter and JetBrains Mono through Fontsource.
