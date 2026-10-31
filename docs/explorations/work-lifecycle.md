# Work lifecycle

Ideas for moving a piece of work from a first question to a merged pull request. Worktrees, removing them, the workspace picker's search, and pull request badges are built ([projects.md](../projects.md)).

## Where Bica stops

- A session in the main folder can't move into a new worktree, so committing to an idea means starting over.
- A worktree has no "try this in the main folder", where the heavy dev stack already runs.
- Pull requests are created on GitHub, and CI and review state live there.
- Merged worktrees wait in Parked for a day before the hourly cleanup removes them, and a merged one with uncommitted files stays until removed by hand.
- A branch with no worktree, such as a teammate's pull request, can't be picked as a place to start.

## Ideas

- Move to new worktree. In a main-folder session, make the worktree from the fast model's name, carry uncommitted changes over (stash, then apply), and move the session's folder. Codex's Hand off and Cursor's `/worktree` do this.
- Try in main folder. With a clean main folder, `git checkout --detach <branch>` there, and the header says "Trying <branch> · Back to main". Conductor's Spotlight and Cursor's `/apply-worktree` do this. For a merged branch, offer Pull main when the main folder is behind.
- Start from a branch or pull request. The workspace picker lists remote branches and your open pull requests below the workspaces. Picking one adds a worktree that tracks that branch. Superset's picker puts the action on each row.
- Parked by state. Group Parked rows: merged or closed (Remove, and Remove all), needs you (CI failed, changes requested), waiting (open pull request), no pull request (Open PR).
- Open PR next to Push: push, then `gh pr create` with a title and body the fast model drafts, the way commit messages are drafted.

Avoid Claude desktop's bug: its archive force-deletes worktrees with uncommitted work. Removing a worktree in Bica asks first.

## Sources

- Conductor workspaces and Spotlight: https://www.conductor.build/docs/concepts/workspaces-and-branches
- Superset workspaces and branch picker: https://docs.superset.sh/workspaces, https://github.com/superset-sh/superset/pull/3397
- Codex app Hand off, and Cursor worktrees: https://cursor.com/docs/configuration/worktrees
