# Projects and workspaces

A project is a folder on the dev machine you want agents to work in, usually a git repo. A workspace is the exact folder a session runs in: the project's main folder, or one of its git worktrees. Worktrees let parallel agents work without stepping on each other's files.

```
Project  vaibica
├─ main folder        ← sessions: "fix sidebar", "hi"
├─ worktree: projects ← sessions: "add project picker"
└─ worktree: diffs    ← sessions: "changes panel"
```

## Adding a project

Add project opens a folder browser on the dev machine, with git repos marked.

## Editing a project

Edit project, in a project's menu in the sidebar or on its name, renames it. The sidebar and pickers show the new name, and the folder stays where it is.

## Where a session starts

Under the home page's composer, the project menu lists projects, the ones used last first, then a new chat and adding a project. Beside it, a switch picks Main folder or New worktree, and each visit starts on Main folder. To continue in a worktree that exists, start from its + in the sidebar, or ⌘K's New session in…: it shows as a third choice in the switch. Pages that show a workspace offer a new session there too.

## Worktrees

- Git is the source of truth, so worktrees made in a terminal show up too.
- New worktree makes one per session. The session's name becomes the branch and a folder next to the project's, and the branch starts from the freshly fetched default branch. When origin needs a sign-in or doesn't answer within 10 seconds, it starts from the last fetched copy instead, and a toast says why.
- A new worktree gets the main folder's gitignored files, such as `.env` and `node_modules`, so it runs without an install. They are copy-on-write clones, which share the disk until one side changes, and a whole folder clones in one call: `node_modules` takes seconds on macOS. Where the disk can't clone (APFS on macOS, btrfs or XFS on Linux), nothing is copied. Files already in the worktree are left alone, and a Python `.venv` is skipped, since a copy still points at the main folder.
- There are no setup scripts: the agent runs an install itself when it needs one.
- Remove worktree, in a worktree's menu, deletes its folder and local branch, archives its sessions, and closes its terminals. A worktree whose pull request merged or closed shows it as a button too. It asks first when that would lose uncommitted files or unmerged commits. A branch whose pull request was squash-merged counts as merged.
- Archiving a worktree's last open session, however it's archived, offers Remove worktree in the toast, with the same check for lost work.
- Every hour, on the hour, Bica removes finished worktrees on its own, without a word: one whose pull request merged and that has sat idle for a day, or one unused for a week whose commits are all in the default branch. Use means a session there or a commit, checkout, or reset in it. Uncommitted files, a running session, or the check for lost work keep it, and its sessions go to Archived with the branch and pull request noted. Only worktrees in Bica's sibling folders, like `shop-sidebar`, are touched; other tools' worktrees can hold ignored files they need.

## Chats

A chat is a session with no project. Each starts in a new empty folder in `~/.bica/chats`, with its own git repo, so the agent can still write files. Chats are listed last in the sidebar.

## Pull requests

Each branch shows its pull request's number and state, and a click opens it on GitHub. Bica asks the GitHub CLI (`gh`) for your own pull requests and matches them by branch. Without `gh`, nothing shows.

## The sidebar

The sidebar starts with the [hub](./hub.md), then groups sessions by project and workspace, with each workspace's terminals and kept files above its sessions. How it shows on each screen is in [layout.md](./layout.md).

- A workspace's header opens its workspace page: the workspace card, files, and Git ([files.md](./files.md)).
- Drag a project's header to reorder projects.
- Branch names drop their prefix, and a leading ticket key becomes a small tag that opens the ticket when the project has a tickets link.
- Workspaces with nothing open drop into Parked, so a worktree waiting on review stays out of the way. Pin project keeps a main folder listed.
- Archived sessions sit in a collapsed section at the bottom.

## Safety

The folder browser can list any folder the server can read. That is fine only because Bica is reached from localhost or a private network.

## Sources

- Conductor searches workspaces by branch, repo, or PR number: https://www.conductor.build/changelog/0.26.0-search-workspaces-view-files-from-chat
- Superset's branch picker puts an Open action on rows that already have a worktree: https://github.com/superset-sh/superset/pull/3397
- Worktrunk's `copy-ignored` clones gitignored files into new worktrees: https://worktrunk.dev/step/. Conductor and Codex copy only listed ones, through `.worktreeinclude`: https://www.conductor.build/docs/reference/files-to-copy
- Claude Code's desktop archive deletes the worktree with no check, the bug the archive offer avoids: https://github.com/anthropics/claude-code/issues/56639
- T3 Code's storage cleanup removes worktrees an hour apart: on merge, after days unused, or once unchanged, and keeps ones with uncommitted work: https://github.com/pingdotgg/t3code/blob/main/apps/server/src/storageCleanup.ts
