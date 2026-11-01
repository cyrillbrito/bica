# Glossary

The words Bica uses for its concepts, one name per concept. Docs, code names, comments, and UI labels use these names, and avoid the words under _Avoid_. A name comes from Pi Durable when Pi Durable has one, else from the word other agent tools share, such as Claude Code, Codex, and opencode. Each group links the doc that explains it.

## Projects

[projects.md](./projects.md)

**Project**: A folder you added to Bica for agents to work in, usually a git repo, together with its worktrees. _Avoid_: repo, codebase

**Main folder**: A project's own folder, as opposed to its worktrees. Git calls it the main worktree. _Avoid_: project folder, root

**Worktree**: A git worktree of a project: its own folder and branch, usually one per feature. _Avoid_: checkout, branch (for the folder)

**Workspace**: The exact folder a session or terminal works in: a project's main folder or one of its worktrees, as in Conductor. _Avoid_: folder, cwd, directory, working directory

**Remove a worktree**: Deleting a worktree's folder and local branch, as `git worktree remove` does, and archiving its sessions and closing its terminals. _Avoid_: clean up, delete

**Chat**: A session with no project, in its own new folder. _Avoid_: scratch session

**Parked**: The sidebar section for workspaces with nothing open. A pinned project's main folder never parks. _Avoid_: hidden, inactive

## Sessions

[sessions.md](./sessions.md)

**Session**: One conversation with an agent, in one workspace. _Avoid_: conversation (Pi Durable's record behind it), thread (Codex's word for it), task, chat (a session with no project)

**Transcript**: What a session shows of its history: prompts, replies, thinking, tool calls, and markers. _Avoid_: log, history, chat

**Prompt**: What a session is given to work on: what you send from the composer, a note, or a message. _Avoid_: input, submission (Pi Durable's words for it), request

**Attachment**: An image sent with a prompt, saved on the dev machine by its content's hash, so the agent's tools can open it and the browser loads it by URL. The UI calls it an image. _Avoid_: upload, paste

**Reply**: What the agent writes back. Its last reply in a run, Pi Durable's final answer, is what other sessions read of it. _Avoid_: answer (that is yours, to a question), response

**Run**: The agent working from a prompt until it replies, stops, or fails, as in Pi Durable. _Avoid_: job, task

**Turn**: One model response and the tool calls it makes, as in Pi Durable. A run is one or more turns. _Avoid_: step, round

**Steer**: A prompt that joins the current run after the turn in progress, as in Pi Durable (`whenBusy: 'steer'`). Sending while a run works steers; the UI says "Send now". _Avoid_: interrupt, push

**Queue**: To hold a prompt while a run works, so it starts the next run (⌘Enter, or Queue under the send chevron). Pi Durable calls it a follow-up, so code keeps `followUp`. The queue holds queued prompts and steers not yet taken. _Avoid_: follow-up in the UI and docs

**Fork**: A new session with another session's history up to a chosen reply. _Avoid_: branch, clone

**Status**: Where a session stands: Running, Retrying, Failed, Waiting for you, Unread, or Idle. Needs you groups Waiting for you, Unread, and Failed. _Avoid_: error (for Failed), done (for Unread)

**Archive**: Hiding a finished session from the list, keeping everything. _Avoid_: delete, close

## Orchestration

[orchestration.md](./orchestration.md)

**Orchestration**: Sessions working with other sessions: starting, reading, messaging, and hearing of each other's runs. _Avoid_: delegation, multi-agent

**Parent**: The session in charge of a child session, or of a terminal its agent started: it hears each run the child ends, and archiving it closes the terminal. A session gets one only when another starts it, and loses it for good when you detach it. _Avoid_: starter (the session that started it may not be its parent), owner, orchestrator

**Child session**: A session with a parent, which another session started to orchestrate several things at once. "Child" for short once the context is clear. _Avoid_: worker, subagent (Bica has none hidden), helper

**In charge**: Who leads a session: its parent while it has one, and you otherwise. _Avoid_: driver, owner, handoff (that is the voice's)

**Detach**: Taking a child session or a terminal from its parent, so it's yours and the parent hears no more of it. A session started detached never had a parent. _Avoid_: take over, unlink, release

**Watch**: The hub following a session it doesn't lead, hearing each run it ends, until it or you stop. _Avoid_: subscribe, follow, notify

**Message**: A prompt one session sends another with `session_send`, signed with the sender, like Claude Code's `SendMessage`. _Avoid_: note (that is Bica's), mail

**Note**: A prompt from Bica itself, such as a child session's finished run or that you detached a session. _Avoid_: alert, event

## Agents

[agents.md](./agents.md), [system-prompt.md](./system-prompt.md)

**Agent**: What a session runs as: its system prompt, model and effort, extensions, and skills, as in Pi Durable. Coding, Assistant, Night, or Hub. _Avoid_: profile, persona, mode (except Assistant mode)

**System prompt**: Everything the agent is told before the transcript, built from prompt sections. _Avoid_: instructions (that is the `AGENTS.md` files), prompt (that is what a session works on)

**Prompt section**: One named part of the system prompt, as in Pi Durable. _Avoid_: block

**Project instructions**: The `AGENTS.md` or `CLAUDE.md` files that go into the system prompt. _Avoid_: rules, memory (that is the memory files)

**Extension**: A named bundle of tools and prompt sections that an agent picks, as in Pi Durable. _Avoid_: tool pack, plugin, toolset

**Skill**: An Agent Skills folder whose name and description go into the system prompt, read when it fits.

## Tools

[tools.md](./tools.md)

**Code mode**: The `codemode` tool, which runs a short script that calls the other tools, as in Pi Durable and Cloudflare. _Avoid_: script tool

**Question**: A multiple-choice question an agent puts to you with `ask`. You answer it. _Avoid_: prompt, poll

**Session tools**: The tools that list, start, read, message, stop, and archive other sessions. _Avoid_: subagent tools

## Context

[context-usage.md](./context-usage.md)

**Context**: What the model reads on the next request: the system prompt, tools, and the transcript since the last compaction, after pruning. _Avoid_: memory (that is the memory files), history

**Context window**: How much context a model can read at once. _Avoid_: context size, token limit

**Context chip**: The chip in a session's top bar that shows how full the context window is, with its menu of Compact, Prune, and the details. _Avoid_: context meter

**Active**: The sidebar tab that keeps what is in play: sessions that need you, run, or moved in the last few minutes. Wider than Needs you. _Avoid_: inbox

**Prompt cache**: The provider's copy of the context so far, cheap to reread while it is warm, gone once it expires. _Avoid_: cache (alone, when it could mean the browser's)

**Compaction**: Summarizing the older part of the context into one summary that the model reads instead, as Claude Code, opencode, and Pi do. _Avoid_: summarizing, compression, condensing

**Prune**: Clearing old tool output from the context without a model call, as opencode's prune does. The transcript keeps it. _Avoid_: clean up, trim, clear (Claude Code's `/clear` starts over)

## Long-lived sessions

[assistant-mode.md](./assistant-mode.md)

**Long-lived session**: A session that housekeeping keeps small: one running as Assistant or Hub. _Avoid_: persistent session

**Housekeeping**: What Bica does to a long-lived session while it sits idle: pruning, a memory save, and compaction, as OpenClaw names it. _Avoid_: upkeep, tending, maintenance

**Assistant mode**: A session that runs as the Assistant agent, a helper for one project that keeps going for months. _Avoid_: assistant session, companion

**Memory files**: Markdown files in a session's workspace where a long-lived session keeps what lasts, as Claude Code and OpenClaw keep memory. _Avoid_: notes (that is Bica's), memories

**Memory index**: The memory file loaded into the system prompt, `MEMORY.md` or `PROFILE.md`. _Avoid_: profile, memory doc

**Memory save**: A run Bica asks for before housekeeping compacts, where the agent writes to its memory files. OpenClaw calls it a memory flush. _Avoid_: memory dump

## Night runs

[night-runs.md](./night-runs.md)

**Night run**: A session held for tonight, which runs alone after the night start and ends with a morning report. _Avoid_: scheduled run, overnight job, nightly

**Hold**: Keeping a session's first prompt for tonight instead of sending it. Its sidebar row shows Tonight. _Avoid_: schedule, defer

**Morning report**: The reply a night run ends with: how far it got, what changed, the checks, decisions, and the next step. _Avoid_: summary

## Hub

[hub.md](./hub.md)

**Hub**: The one session that coordinates the others and does no work itself. _Avoid_: coordinator, orchestrator, manager

**Board**: The hub's list of the sessions it tracks and whose move each is: on its page, and at the top of its memory index. _Avoid_: dashboard, inbox

## Voice

[voice.md](./voice.md)

**Voice call**: Talking to a session through the voice, in the composer's place. _Avoid_: live session, realtime session

**The voice**: GPT-Live, which listens, talks, and decides when something needs the agent. It does no work. _Avoid_: voice agent

**Handoff**: Passing work on to an agent, as OpenAI's Agents SDK names it: the voice passing your words to the session, or a session starting a child session with a prompt that stands alone. _Avoid_: hand-off, request, delegation

**Hold music**: The quiet radio stream that plays during a call while the agent works in silence.

**Dictation**: Recording speech on the phone and writing its text into the composer. _Avoid_: voice input, transcription (that is the service behind it)

## Files and Git

[files.md](./files.md), [git.md](./git.md)

**Workspace page**: A workspace's own page: the workspace card, or a file or diff full size, with the side panel. _Avoid_: project page

**Workspace card**: The summary of a workspace's changes, pull request, branch, and sync state on its page. _Avoid_: overview

**Side panel**: The column on the right, with the open workspace's Files and Git tabs. _Avoid_: right panel, inspector

**Sidebar**: The column on the left, listing the hub, projects, workspaces, and their sessions, terminals, and kept files. _Avoid_: left panel, nav

**Kept file**: A file listed in the sidebar with Keep open, until you unpin it. _Avoid_: pinned file

## Terminals

[terminals.md](./terminals.md)

**Terminal**: A shell in a workspace that you and the agents share. _Avoid_: console, pty

**First command**: The command a terminal types when it opens, and again on restart. _Avoid_: startup command, script

## Models

[models.md](./models.md)

**Provider**: Where models come from, connected in Settings by a plan sign-in or an API key, as in pi-ai. _Avoid_: vendor, backend

**Account**: One sign-in to a provider. A plan can have more than one, taking turns. _Avoid_: login, credential

**Effort**: How hard a model thinks on a request, as Anthropic and OpenAI name it. _Avoid_: thinking level (pi-ai's name), reasoning

**Default model**, **fast model**: The model that starts new sessions, and the one that writes titles and commit messages. _Avoid_: small model, title model

## Command palette

[command-palette.md](./command-palette.md)

**Command palette**: The ⌘K search box for going anywhere and doing anything, as in VS Code and Linear. _Avoid_: launcher, quick open

**Action**: Something the command palette can do, as opposed to a place it can go.

**Second page**: The list an action ending in "…" opens inside the palette. _Avoid_: submenu
