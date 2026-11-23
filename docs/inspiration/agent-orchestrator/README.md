# Agent Orchestrator

From https://orchestrator.inc. Kind: orchestrator. Every project has a main agent that plans the work, starts a worker per piece in its own worktree, and comes back only when something needs you.

- It watches every pull request its workers open. Failed checks (with the log link), review comments, and merge conflicts go back to the worker that owns the branch, until the pull request is approved.
- A reviewer agent reads each pull request before a person does and sends its findings to the worker in one click.
- Sessions sort themselves on a board from live facts: what the agent does, its pull request, CI, and reviews.
- Each worker has its own browser it can click through to check its work.
- Chat view or the agent's own terminal UI for the same session, and 38 agents supported.
- A phone app paired by QR code, with notifications when an agent needs you.

For Bica, routing CI failures and review comments back to the session that owns the branch is the strongest idea here. It fits the hub.
