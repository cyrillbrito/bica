# Command palette

The command palette is one search box for going anywhere and doing anything in Bica. ⌘K (Ctrl+K) opens it from any page, even while typing in the composer or a terminal. On the phone, the search button at the top of the sidebar opens it full screen.

## What it lists

Opened empty, it answers "what needs me?" first:

- Needs you: sessions waiting for you, then unread replies, then failures, newest first in each ([sessions.md](./sessions.md#status)).
- Recent: the other sessions, by their last activity.
- This session: the open session's own actions, like Rename, Fork, Stop, Mark as unread, and Archive.
- Actions: everything else Bica can do from anywhere.

Typing searches sessions (archived ones last), workspaces ([projects.md](./projects.md)), terminals, and actions together, best match first. Letters can be out of place, so "nwe sess" still finds New session, and actions have extra words, so "chat" finds it too. Files aren't listed, since there are too many.

## Second pages

New session in… is also the way to start in any existing workspace, and New assistant session opens the home page set for [assistant mode](./assistant-mode.md).

An action ending in "…" opens a second page instead of running, like New session in…, Go to workspace…, Theme…, and Rename. The page's name shows as a chip before the search box. Backspace in an empty box, Esc, or a click on the chip goes back.

## Shortcuts

Every row shows its shortcut, so the palette teaches them. Only actions you take many times a day get one, and each uses a modifier, since the composer usually has focus. ⌘/ lists them all.

- ⌘K opens the palette.
- ⇧⌘O starts a session in this page's workspace. The browser keeps ⌘N for new windows.
- ⌥⇧↓ opens the next session that needs you, in the order above. It skips the open one, so pressing again moves on.
- ⌃` opens a terminal in this page's workspace.
- ⌘B and ⌥⌘B show or hide the sessions and files columns.

The Hub action opens the [hub](./hub.md). It has no shortcut, since it sits at the top of the sidebar.

The palette lives in `client/src/app/palette/`: `CommandPalette.tsx` draws it, `pages.tsx` lists what it offers, shortcuts included, and `commands.ts` holds the search.

## Sources

- [Superhuman, How to build a remarkable command palette](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/): one shortcut for everything, typo-tolerant search with extra words per command, and a shortcut shown on every row.
- [Linear's command menu](https://linear.app/now/invisible-details): actions for what you're looking at, and lists that open from an action, like Open project.
- [Raycast's search bar](https://manual.raycast.com/search-bar): recent and frequent items first when the box is empty, and Esc to step back.
