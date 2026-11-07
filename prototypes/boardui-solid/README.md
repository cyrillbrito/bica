# BoardUI in Solid 2: a throwaway prototype

A look at how Bica would read in BoardUI's design language. It ports BoardUI's free components and tokens to Solid 2 and shows them on two pages with fake data. Nothing here talks to a server, and none of it is meant to ship.

- `/` is a gallery of every ported component and block, light and dark side by side.
- `/app` is a mock Bica screen: a sidebar of projects and sessions, a transcript with prompts, Markdown replies, collapsed tool calls, a plan list, and a thinking line, and a composer. A timer plays a scripted turn on load and after each prompt. It works at a 390×844 phone viewport, where the sidebar becomes a drawer.

## Run it

```sh
bun install
bun run dev        # http://localhost:3190
```

Add `?theme=dark` or `?theme=light` to `/app` to pick a theme for screenshots. The sidebar's toggle does the same.

## What's where

- `src/styles/theme.css` and `typography.css`: BoardUI's tokens and type scale, values unchanged. `globals.css` holds the parts of their global styles the components need, then a few rules of this prototype's own.
- `src/ui/`: the base components. Each file names the BoardUI source it ports.
- `src/blocks/`: Sidebar, Stat Cards, Settings Modal, and the chat screen.
- `src/app/`: the mock Bica screen, with the agent progress list, the thinking line, tool calls, and the composer glow written from scratch.
- `scripts/icons.ts` writes `src/ui/icons.ts` from the `remixicon` package. Add a name there and run `bun scripts/icons.ts`.

## How the port works

- Class recipes are copied from BoardUI as they ship, and `cx()` is their tailwind-merge wrapper.
- React Aria became plain HTML: the native `popover` attribute for Select, Dropdown, and Tooltip, `<dialog>` for the settings modal, and hidden native inputs for Checkbox and Switch. States that came from React Aria render props (`isHovered`, `isFocusVisible`) are CSS variants now.
- Framer Motion became CSS: `@starting-style` entrances, keyframes, and transitions.
- Dark mode is BoardUI's `.dark` class. The gallery's dark half is a `.dark` region inside a light page.

## Credit and licence

The tokens, type scale, and component designs come from [BoardUI](https://www.boardui.com) by Mertcan Dundar Esmergul, from the free tier at [github.com/BoardUI/boardui](https://github.com/BoardUI/boardui) (commit `ec5c5eb`), under the MIT licence in [`LICENSE-boardui`](LICENSE-boardui). No BoardUI Pro source was used. The working composer glow, the agent progress list, and the thinking dots are this prototype's own.

Icons are [Remix Icon](https://remixicon.com), from the `remixicon` package. Fonts are Inter and JetBrains Mono through Fontsource.
