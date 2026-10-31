# Orchestration

Orchestration is sessions working with other sessions. An agent can start a session, read it, message it, stop it, and archive it, and Bica tells the agent when that session finishes a run. Bica has no hidden subagents: every session an agent starts is a normal session in your list, which you can open and write to.

## Parents and child sessions

A session an agent starts is a child session, and the agent's session is its parent. The parent leads it and gets a note each time it ends a run, with its last reply.

```
          you ── write, Detach ──┐
                                 ▼
 parent ──── session_start ────▶ child session
        ◀── note after each run ──
```

- In the sidebar, a child session sits under its parent when both work in the same workspace. A "Parent in charge" strip above its composer links to the parent.
- You can write to a child session at any time, and it stays with its parent. Your words come before the parent's plan, and the parent reads them in its next note with the reply, so it spends no run of its own on them.
- Detach, in that strip, takes the child session from its parent for good. It's yours, the parent is told to leave it alone, and it hears nothing more of it. A line in the transcript marks where.
- An agent can start a session detached, for work it hands off and doesn't need to hear about. That session is yours from the start.
- Only starting gives a session a parent, and agents can't change who leads one. Sessions you start and forks have none.
- A session that started another one but no longer leads it can't message, stop, or archive it, unless you tell it to.

Archiving a parent asks which of its open child sessions go with it, with none picked, and which of the [terminals](./terminals.md#parent-and-detach) it leads to close, all picked. The ones left open are detached, as with Detach, since an archived parent hears nothing. With nothing to ask, it archives right away. Archiving from `session_archive` or removing a worktree detaches the child sessions too, and closes the terminals.

## Who hears what

Bica tells sessions about each other with notes: prompts from Bica itself, sent as steers, so a busy session hears of a finished child session or terminal at its next step instead of after its run. Notes that pile up before they land merge into one.

| When a session... | A note goes to |
| --- | --- |
| ends a run | its parent, and the hubs that watch it |
| ends a run with a question for you, or an error | also every hub |
| is archived | nobody |

A message from `session_send` is one prompt to the receiver. The sender hears back only when the receiver answers with a message of its own, or when it would get a note anyway, and the message tells the receiver which.

## Watching

The [hub](./hub.md) can watch a session it doesn't lead, such as one you started or one it messaged for you. While it watches, it hears each run that session ends, as it does for its child sessions. The session shows a "Hub watching" strip, and Stop there ends the watch and tells the hub. The hub stops a watch itself once that thread closes, and archiving ends it too.

Only the hub watches. Other sessions hear only from their child sessions, and ask the receiver of a message to answer back.

## The session tools

- `list` shows every project, workspace, session, and terminal. Agents are told to leave the rest alone unless you name it.
- `session_start` starts a child session with a prompt that stands on its own, in any workspace or a new worktree, optionally in [assistant mode](./assistant-mode.md) or held for the [night run](./night-runs.md). With `detached`, it has no parent.
- `session_read` returns a session's status, who leads it, the questions it waits on, and its last messages.
- `session_send` sends a message, signed with the sender's name, always as a steer: it joins the receiver's current run at its next step, or starts a run.
- `session_stop` stops a session's run.
- `session_archive` archives a finished session, and can remove its worktree when nothing would be lost. A session can archive itself only when you told it to, and it goes once its turn ends, after its last reply. A turn that ends with an error or a question keeps it open.
- `session_watch`, the hub's alone, starts or stops a watch.

The tools name sessions by title, then id, and agents are told to name them to you by title alone.

## Sources

- Claude Code's `SendMessage`, and Codex's `send_input` and `wait_agent`, which the session tools follow.
- Claude's desktop app, whose nested sessions report each turn to the session that started them ([changelog](https://claude.com/docs/cowork/changelog)). Its `detach_session` is the model for Detach. Users asked to keep the nesting but stop the reports ([#104683](https://github.com/anthropics/claude-code/issues/104683)), which a detached start covers.
- Zendesk and Intercom stop their bot once a human takes a conversation, and [`pi-cmux-orchestrator`](https://www.npmjs.com/package/@mporenta/pi-cmux-orchestrator) holds back the orchestrator once you type in one of its sessions.
- Claude Projects, [a coordinator with threads](https://support.claude.com/en/articles/9517075-what-are-projects), hears only from the threads it started, which is why the hub can watch others too.
- The subscribe button of GitHub issues and Linear, where you pick what you hear about.
