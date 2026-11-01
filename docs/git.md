# Git

The [side panel](./layout.md)'s Git tab is where you stage, commit, and push the agent's work. It is modelled on VS Code's source control.

## The Git tab

- The branch row offers pull (fast-forward only), push, or publish for a new branch.
- Commit takes what's staged, or everything when nothing is staged. Commit and push, and amend, are extra actions.
- Staged and Changes list files with line counts. A click opens the diff ([files.md](./files.md)), and the menu stages, unstages, or discards.
- Commits lists the branch's history below, see [Commits](#commits).

Stage on view, a setting, stages a file when you open its diff, so staging marks what you reviewed. Whatever the agent writes afterwards shows under Changes as only the new part.

A submodule gets its own section while it has changes or commits to push or pull.

## Commits

The Commits list holds the current branch's commits, newest first, as a flat list with no graph. It loads 40 at a time, and the next 40 once you scroll to its end. It loads again after a commit, push, or pull.

A commit no remote branch has yet is marked with an arrow and reads Not pushed. That is the commits ahead of the upstream, or, on a branch with no upstream, the ones not on the default branch either. A repo with no remote marks nothing.

A click opens the commit full size, in the URL like a file (`?c=<hash>`): its subject, body, author, date, short hash, and changed files with line counts. A file opens its diff, read by blob hash like a staged change's ([files.md](./files.md#loading-diffs)), and the arrow goes back to the commit. A merge shows its diff against its first parent, and the first commit against nothing.

Open on remote, in the commit's header and in the row's menu with Copy hash and Copy message, opens the commit on GitHub or GitLab. The link comes from the `origin` remote, in its ssh or https form, so it shows only for those hosts and only once the commit is pushed.

## Commit messages

With a fast model ([models.md](./models.md#which-model-does-what)) set, an empty commit box means "write it for me": Commit has the model write the message. Write drafts it into the box first for review, and Rewrite asks for another.

The message is one short line that says what the commit does. The model works from the diff, the repo's recent commit subjects so it copies their style, and the prompts you gave agents in this workspace, which hold the why a diff can't show.

## Folders without git

New projects and chats without git get `git init`, unless they sit inside another repo. Any other folder without git has no Git tab.
