# Layout

Every page has three parts: the sidebar on the left, the page itself in the centre, and the side panel on the right.

- The sidebar lists the hub, your projects and their workspaces, and each workspace's sessions, terminals, and kept files ([projects.md](./projects.md)).
- The centre shows what you opened: a session, a workspace page with a file or diff ([files.md](./files.md)), a terminal, or Settings.
- The side panel shows the open workspace in two tabs, Files and Git ([git.md](./git.md)). Hub sessions don't work in a project, so they have no side panel.

## On each screen

| Screen | Sidebar | Side panel |
| --- | --- | --- |
| Phone | Slides in from the left | Slides up from the bottom |
| Tablet | A column | Slides in from the right |
| Wide screen | A column | A column |

⌘B shows or hides the sidebar, ⌥⌘B the side panel, and Esc closes whichever slid in. On a wide screen, drag a column's inner edge to resize it, and double-click the edge to reset it. The centre always keeps enough room to read.

## Side panel tabs

The tab you pick is part of the address, such as `?panel=git`, so a reload or a shared link opens the same tab. A link without it keeps the tab you picked last, since you usually want the same kind of view when switching sessions. A link to a tab that no longer exists shows Git instead.

Each tab lives in its feature's folder, and `client/src/app/SidePanel.tsx` lists them in the order they show.

## Sources

- VS Code's side views, which each say where they show: https://code.visualstudio.com/api/references/contribution-points#contributes.views
