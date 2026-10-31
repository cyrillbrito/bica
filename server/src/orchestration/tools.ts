import { Type } from '@earendil-works/pi-ai';
import { defineExtension, defineTool } from '@earendil-works/pi-durable';
import type {
  ConversationId,
  ToolRegistration,
} from '@earendil-works/pi-durable';
import type { SessionStatus } from '@bica/shared/protocol';
import { CHATS_ID, listProjects } from '../projects/projects';
import { allTerminals } from '../terminals/terminals';
import { terminalState } from '../terminals/tools';
import { spawnSession } from '../sessions/create';
import { archiveWithWorktree } from '../sessions/meta';
import { archiveIfAsked, watch } from './notes';
import { stop, submit } from '../sessions/prompts';
import {
  lastSender,
  named,
  readSession,
  recentMessages,
} from '../sessions/read';
import { editSession, getConversation, listSessions } from '../sessions/store';

function text(value: string) {
  return {
    output: [{ type: 'text' as const, text: value }],
  };
}

const STATUS: Record<SessionStatus, string> = {
  running: 'running',
  retrying: 'running, retrying after an error',
  waiting: 'waiting for an answer',
  error: 'stopped with an error',
  // Unread: the agent should know the user hasn't seen this reply yet.
  done: "idle, with a reply the user hasn't opened",
  idle: 'idle',
};

/** Another session; acting on your own one would loop. */
function other(id: string, self: ConversationId) {
  if (id === String(self)) throw new Error('That is this session');
  return id;
}

const USER_ASKED = Type.Optional(
  Type.Boolean({
    description:
      'true: the user told you to, for a session you started that is theirs now. Only then',
  }),
);

/**
 * A session's starter backs off once it's no longer the parent, unless the
 * user says so.
 */
function checkInCharge(
  target: {
    id: string;
    title: string;
    startedBy: string | null;
    parent: string | null;
  },
  me: string,
  userAsked: boolean | undefined,
  action: 'archive' | 'message' = 'message',
) {
  if (target.startedBy !== me || target.parent === me || userAsked) return;
  const why = `You started ${named(target)}, but it has no parent now, so it's the user's`;
  throw new Error(
    action === 'archive'
      ? `${why}, and the user may still want it. Leave it open, or ask them in your reply. Pass \`user_asked\` only if they told you to archive it.`
      : `${why}. Leave it to the user: tell them what you wanted it to know instead. Pass \`user_asked\` only if they told you to do this.`,
  );
}

/** The session tools; the hub's descriptions drop the "leave others alone" limits. */
function sessionTools(hub: boolean): ToolRegistration[] {
  const sessionStart = defineTool({
    name: 'session_start',
    description: hub
      ? "Start a session for one thread of work, when the user asked for it: a normal session in the user's session list, which they can watch and steer too. Pass `folder`, a project folder or worktree from your projects list; with `worktree`, it gets a new worktree of that folder's project. It runs on the user's default model. It's your child session: you get a note whenever it finishes a turn, until the user detaches it. With `detached`, it's the user's from the start and you hear nothing of it. Its prompt must stand alone, like a ticket: it sees nothing of this conversation. Sessions in one folder share its files, so code work gets its own worktree."
      : "Start a new, separate session in the user's session list: same model as you, in your folder unless you pass `folder` or `worktree`. Use it when the user asks to split work across sessions, e.g. one session per bug. The user watches and steers it too. It's your child session: you get a note whenever it finishes a turn, until the user detaches it, and can talk to it with session_send. With `detached`, it's the user's from the start and you hear nothing of it. Its prompt must stand alone: it sees nothing of this conversation. Sessions in one folder share its files, so give each its own part of the code, or its own worktree.",
    parameters: Type.Object({
      prompt: Type.String({
        description:
          'The full task for the new session, with every detail it needs: files, findings, what done looks like',
      }),
      folder: Type.Optional(
        Type.String({
          description: hub
            ? 'Absolute path of a project folder or git worktree to start in. Required'
            : 'Absolute path of an existing project folder or git worktree to start in, e.g. one you just made with `git worktree add`; absent: your folder',
        }),
      ),
      worktree: Type.Optional(
        Type.Boolean({
          description: hub
            ? "true: start in a new git worktree of `folder`'s project, on a new branch from the default branch, named after the session"
            : 'true: start in a new git worktree of your project, on a new branch from the default branch, named after the session. Ignores `folder`',
        }),
      ),
      detached: Type.Optional(
        Type.Boolean({
          description:
            "true: hand it off instead of leading it: no parent, so it's the user's and you hear nothing of its turns. Default: your child session",
        }),
      ),
      assistant: Type.Optional(
        Type.Boolean({
          description:
            'true: an assistant-mode session, a long-running helper for one project that keeps memory in files and compacts on its own. Default: a coding session',
        }),
      ),
      tonight: Type.Optional(
        Type.Boolean({
          description:
            "true: hold it for tonight's night run, when the user asks for work to run overnight. It starts at the night start time from Settings, one at a time, with no `ask`, and ends with a morning report. Write the prompt so it can finish alone: the goal, the scope, and the command that proves it done",
        }),
      ),
      effort: Type.Optional(
        Type.Union(
          [Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')],
          {
            description:
              'How hard it thinks, only when the user asked for an effort. Default: yours',
          },
        ),
      ),
    }),
    execute: async (
      { prompt, folder, worktree, detached, assistant, tonight, effort },
      api,
    ) => {
      if (!prompt.trim()) throw new Error('The prompt is empty');
      const me = named(await readSession(String(api.conversationId)));
      const id = await spawnSession(
        api.conversationId,
        `${prompt}\n\n(${
          detached
            ? `${me} started this session and handed it off: it hears nothing of your turns, so work for the user and answer them in your replies. Message it with session_send only if this task asks you to.`
            : `${me} started this session and is in charge of it: it reads each turn you end, so report in your replies, and ask it things with session_send. The user may write to you too: answer them in your replies, and their words come before its plan.`
        })`,
        `start_session:${api.callId}`,
        folder,
        worktree,
        detached,
        assistant ? 'assistant' : 'coding',
        tonight,
        effort,
      );
      return {
        ...text(
          tonight
            ? `Session ${id} is held for tonight's run.`
            : `Started session ${id}.`,
        ),
        details: { sessionId: id },
      };
    },
  });

  const sessionRead = defineTool({
    name: 'session_read',
    description:
      "Read another session's title, folder, status (running, idle, waiting for an answer, error), the questions it waits on, and its last messages. `list` shows all sessions.",
    parameters: Type.Object({
      id: Type.String({ description: 'The session id' }),
      messages: Type.Optional(
        Type.Number({
          description:
            'How many recent messages to read, prompts and its replies, oldest first, without tool calls (default 1: its last reply)',
        }),
      ),
    }),
    execute: async ({ id, messages }, api) => {
      const s = await readSession(other(id, api.conversationId));
      const count = Math.min(Math.max(Math.round(messages ?? 1), 1), 50);
      const [recent, sender, all] = await Promise.all([
        recentMessages(s.id, count),
        lastSender(s.id),
        listSessions(),
      ]);
      const me = String(api.conversationId);
      const name = (id: string) => {
        const found = all.find((o) => o.id === id);
        return found ? named(found) : `session ${id}`;
      };
      const whose = s.parent
        ? s.parent === me
          ? ' It is your child session: you hear each turn it ends.'
          : ` Its parent is ${name(s.parent)}.`
        : s.startedBy === me
          ? " You started it, but it has no parent now, so it is the user's."
          : " It has no parent, so it is the user's.";
      const watched = s.watchedBy.includes(me) ? ' You watch it.' : '';
      const last =
        sender === undefined
          ? ''
          : ` Last prompt from: ${sender === 'user' ? 'the user' : sender === 'bica' ? 'a Bica note' : sender === me ? 'you' : name(sender)}.`;
      const parts = [
        `${named(s)} in ${s.cwd}: ${s.archivedAt ? 'archived' : STATUS[s.status]}.${whose}${watched}${last}`,
      ];
      if (s.status === 'waiting' && recent.questions.length)
        parts.push(
          `It asks the user:\n${recent.questions
            .map(
              (q, i) =>
                `${i + 1}. ${q.question}\n${q.options
                  .map(
                    (o) =>
                      `   - ${o.label}${o.description ? `: ${o.description}` : ''}`,
                  )
                  .join('\n')}`,
            )
            .join(
              '\n',
            )}\nAnswer for the user with session_send only if they told you the answer.`,
        );
      parts.push(
        count === 1
          ? `Last reply:\n${s.reply || '(none yet)'}`
          : recent.messages
              .map(
                (m) =>
                  `${m.from === 'prompt' ? 'Prompt' : 'Reply'}:\n${m.text}`,
              )
              .join('\n\n') || '(no messages yet)',
      );
      return {
        ...text(parts.join('\n\n')),
        details: { sessionId: s.id },
      };
    },
  });

  const sessionArchive = defineTool({
    name: 'session_archive',
    description: `Archive a session once its work is done: it leaves the session list (the user can bring it back), and the terminals it started close. With \`remove_worktree\`, its worktree folder and local branch go too, unless another open session works there, or it has uncommitted files or commits no other branch has.${hub ? ' Only when the user asked for it.' : " Only archive sessions you started or the user named, or this one when the user told you to. A running session, this one included, goes once its turn ends, unless that turn ends with an error or a question. Archive one you started once its result is in your reply and the user wouldn't want to open it themselves: a lookup, a check, one child session of many. Keep it when the user might want to read or continue it: they asked for it, it holds a decision, a long back and forth, unmerged work, or a question for them. Name what you archived in your reply, so they can bring it back. A session you started that has no parent now is theirs: archive it only if they told you to."}`,
    parameters: Type.Object({
      id: Type.String({ description: 'The session id' }),
      remove_worktree: Type.Optional(
        Type.Boolean({
          description:
            "true: also remove the session's worktree, if it is merged and clean",
        }),
      ),
      user_asked: USER_ASKED,
    }),
    execute: async ({ id, remove_worktree, user_asked }, api) => {
      const self = id === String(api.conversationId);
      if (self && !user_asked)
        throw new Error(
          'Archive this session only when the user told you to, then pass `user_asked`.',
        );
      const s = await readSession(id);
      if (!self)
        checkInCharge(s, String(api.conversationId), user_asked, 'archive');
      const running = (status: string) =>
        status === 'running' || status === 'retrying';
      if (!self && !running(s.status)) {
        const worktree = await archiveWithWorktree(id, !!remove_worktree);
        return text(`Archived ${named(s)}. ${worktree}`.trim());
      }
      // A session that reports done with session_send is still in its turn,
      // so it waits for the end (notes.ts), and its final reply lands first.
      const conversation = (await getConversation(id)).id;
      await editSession(conversation, (meta) => {
        meta.archiveAfterRun = { worktree: !!remove_worktree };
      });
      // Ended between the read and the flag: nothing would archive it now.
      if (!self && !running((await readSession(id)).status))
        await archiveIfAsked(conversation);
      const worktree = remove_worktree
        ? ', and its worktree removed if nothing would be lost'
        : '';
      return text(
        self
          ? `This session is archived once this turn ends${worktree}. Finish your reply as usual.`
          : `${named(s)} is still in its turn: it is archived once that ends${worktree}, unless it ends with an error or a question.`,
      );
    },
  });

  const sessionSend = defineTool({
    name: 'session_send',
    description: `Send a message to another session, signed with your name so it can answer with session_send. It lands at that session's next step, even mid-run; an idle session starts a turn. You hear back only when it answers with session_send, or when it's your child session${hub ? ' or you watch it' : ''}: then you get a note at the end of each turn.${hub ? ' New work, decisions, and steering only when the user asked for it.' : ' Only message your child sessions, your parent, or sessions the user named. To get an answer from another session, ask it to reply with session_send.'}`,
    parameters: Type.Object({
      id: Type.String({ description: 'The session id' }),
      message: Type.String({ description: 'What to tell or ask it' }),
      user_asked: USER_ASKED,
    }),
    execute: async ({ id, message, user_asked }, api) => {
      other(id, api.conversationId);
      const [me, target] = await Promise.all([
        readSession(String(api.conversationId)),
        readSession(id),
      ]);
      if (target.archivedAt)
        throw new Error(
          `${named(target)} is archived, so nothing reads it. Say it in your reply instead, or ask the user to bring the session back.`,
        );
      checkInCharge(target, me.id, user_asked);
      // A sender that reads its turns anyway needs no answer by message.
      const hears = target.parent === me.id || target.watchedBy.includes(me.id);
      await submit(
        id,
        `[Message from ${named(me)}${hears ? ', which reads your replies' : ". It doesn't see your replies: if it asks for something, answer with session_send, and don't answer a reply that needs none"}] ${message}`,
        [],
        `session_send:${api.callId}`,
        me.id,
        'steer',
      );
      return text(`Sent to ${named(target)}.`);
    },
  });

  const sessionStop = defineTool({
    name: 'session_stop',
    description: `Stop the turn another session is running, and drop its queued messages. The session stays, and a later session_send starts it again.${hub ? ' Only when the user asked for it.' : ' Only stop sessions you started or the user named.'}`,
    parameters: Type.Object({
      id: Type.String({ description: 'The session id' }),
      user_asked: USER_ASKED,
    }),
    execute: async ({ id, user_asked }, api) => {
      other(id, api.conversationId);
      const s = await readSession(id);
      checkInCharge(s, String(api.conversationId), user_asked);
      await stop(id);
      return text(`Stopped ${named(s)}.`);
    },
  });

  const sessionWatch = defineTool({
    name: 'session_watch',
    description:
      "Start or stop watching a session: while you watch it, you get a note at the end of each of its turns, with its reply, as with your child sessions. Watch one when the user wants to hear how its work goes, or you messaged it and need its result; stop once that thread closes, since every note costs you a turn. Archiving ends a watch. Your child sessions report anyway, and any session's questions and errors reach you without a watch.",
    parameters: Type.Object({
      id: Type.String({ description: 'The session id' }),
      watch: Type.Boolean({ description: 'true: start watching; false: stop' }),
    }),
    execute: async ({ id, watch: on }, api) => {
      other(id, api.conversationId);
      const s = await readSession(id);
      if (on && s.archivedAt)
        throw new Error(
          `${named(s)} is archived, so it has no turns to watch.`,
        );
      await watch(id, String(api.conversationId), on);
      return text(
        on
          ? `Watching ${named(s)}: you hear each turn it ends, until you stop or it's archived.`
          : `Stopped watching ${named(s)}.`,
      );
    },
  });

  const list = defineTool({
    name: 'list',
    description: `List every project, folder or worktree, open session, and terminal in Bica, as a tree, with each one's status, which one is you, and what you started. With \`archived\`, the archived sessions instead, newest first.${hub ? '' : " Leave others' sessions and terminals alone unless the user names them."}`,
    parameters: Type.Object({
      archived: Type.Optional(
        Type.Boolean({
          description:
            'true: list the last 50 archived sessions, newest first, instead of the tree. session_read reads them too',
        }),
      ),
    }),
    execute: async ({ archived }, api) => {
      const me = String(api.conversationId);
      const mine = (by: string | null) => (by === me ? ', started by you' : '');
      const yours = (s: {
        startedBy: string | null;
        parent: string | null;
        watchedBy: string[];
      }) =>
        (s.parent === me
          ? ', your child session'
          : s.startedBy === me
            ? ", started by you, now the user's"
            : '') + (s.watchedBy.includes(me) ? ', watched by you' : '');
      const [projects, all] = await Promise.all([
        listProjects(),
        listSessions(),
      ]);
      if (archived) {
        const gone = all
          .filter((s) => s.archivedAt)
          .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
          .slice(0, 50);
        return text(
          gone
            .map(
              (s) =>
                `${named(s)} in ${s.cwd}, archived ${new Date(s.archivedAt ?? 0).toISOString().slice(0, 10)}${mine(s.startedBy)}`,
            )
            .join('\n') || 'No archived sessions.',
        );
      }
      const open = all.filter((s) => !s.archivedAt);
      const terminals = allTerminals();
      const lines: string[] = [];
      const self = open.find((s) => s.id === me);
      if (self) lines.push(`You are ${named(self)}, in ${self.cwd}.`, '');
      for (const p of projects) {
        if (p.id === CHATS_ID) continue;
        lines.push(p.name);
        for (const w of p.workspaces) {
          const here = open.filter((s) => s.cwd === w.path);
          const shells = terminals.filter((t) => t.cwd === w.path);
          if (!w.main && !here.length && !shells.length) continue;
          lines.push(
            `  ${w.main ? 'main' : `worktree ${w.branch ?? '(detached)'}`}  ${w.path}`,
          );
          for (const s of here)
            lines.push(
              `    ${named(s)}: ${STATUS[s.status]}${s.id === me ? ' (you)' : yours(s)}`,
            );
          for (const t of shells)
            lines.push(
              `    terminal ${t.id} "${t.title}": ${terminalState(t)}${t.parent === me ? ', yours' : t.startedBy === me ? ", started by you, now the user's" : ''}`,
            );
        }
      }
      return text(lines.join('\n'));
    },
  });

  return [
    sessionStart,
    sessionRead,
    sessionSend,
    sessionStop,
    sessionArchive,
    ...(hub ? [sessionWatch] : []),
    list,
  ] as unknown as ToolRegistration[];
}

export const SessionTools = defineExtension({
  name: 'session-tools',
  tools: sessionTools(false),
});

// Only the hub agent selects it (server/src/hub/agent.ts).
export const HubSessionTools = defineExtension({
  name: 'hub-session-tools',
  tools: sessionTools(true),
});
