import type { Server, ServerWebSocket, WebSocketHandler } from 'bun';
import {
  diffRevisions,
  type JsonValue,
  type Op,
} from '@earendil-works/chord/delta';

import {
  type Call,
  type Calls,
  type ClientMessage,
  type EntriesHeld,
  type ServerMessage,
  type Topic,
  type Topics,
  type WorkspaceRef,
} from '@bica/shared/protocol';
import { archive, markSeen, rename, setAgent, setVoice } from './sessions/meta';
import { removeWorktree } from './projects/worktrees';
import {
  pruneContext,
  compact,
  configure,
  push as pushSubmission,
  stop,
  submit,
  withdraw,
} from './sessions/prompts';
import { createSession, fork } from './sessions/create';
import { detach, unwatch } from './orchestration/notes';
import { conversationDetail, watchConversation } from './sessions/conversation';
import { watchSessions } from './sessions/store';
import { openHub, updateHub } from './hub/hub';
import { cancelTonight, runTonight, saveTonight } from './night-runs/night';
import { watchModels } from './models/models';
import { updateSettings, watchSettings } from './settings';
import { wsLogger } from './ws-log';
import {
  addAccount,
  answer,
  cancel,
  signIn,
  signOut,
  useFirst,
  watchAccounts,
} from './models/accounts';
import { voiceLog } from './voice/log';
import { addPhotos, startCall, stopCall, transcribe } from './voice/voice';
import { watchPlanUsage } from './models/usage';
import {
  addProject,
  listDirs,
  reorderProjects,
  pinProject,
  updateProject,
  watchProjects,
} from './projects/projects';
import { suggestCommitMessage } from './git/commit-message';
import { log, show } from './git/history';
import { findPath, openInEditor, openPath } from './files/editor';
import { workspaceFileLink } from './files/download';
import {
  createTerminal,
  detachTerminal,
  removeTerminal,
  resizeTerminal,
  restartTerminal,
  stopTerminal,
  watchTerminal,
  watchTerminals,
  writeTerminal,
} from './terminals/terminals';
import {
  commit,
  diff,
  discard,
  pull,
  push,
  stage,
  unstage,
  watchStatus,
} from './git/workspace';
import { readText, watchFiles } from './files/files';

type Sink = {
  snapshot: (value: unknown, kept?: number) => void;
  changes: (ops: readonly Op[]) => void;
};

// A call whose result is null may end without one: run() sends null.
type Handlers = {
  [K in Call]: (
    args: Calls[K]['args'],
  ) => Promise<
    [Calls[K]['result']] extends [null] ? void | null : Calls[K]['result']
  >;
};

// The browser is our own typed client, so args arrive as protocol.ts says.
const calls: Handlers = {
  'session.create': async (args) =>
    createSession({ ...args, prompt: args.prompt.trim() }),
  'session.tonight': async ({ id, action, prompt }) => {
    if (action === 'cancel') return cancelTonight(id);
    if (action === 'save') await saveTonight(id, prompt ?? '');
    else await runTonight(id, prompt);
    return '';
  },
  'session.configure': async ({ id, ...choice }) => configure(id, choice),
  // Here because the hub reads settings, so settings can't call it.
  'settings.update': async (change) => {
    await updateSettings(change);
    if (change.hubModel !== undefined || change.hubFolder !== undefined)
      await updateHub();
  },
  'project.add': async ({ path }) => addProject(path),
  'project.reorder': async ({ ids }) => reorderProjects(ids),
  'project.pin': async ({ id, pinned }) => pinProject(id, pinned),
  'project.update': async ({ id, ...edit }) => updateProject(id, edit),
  'worktree.cleanUp': async (args) =>
    removeWorktree(args.projectId, args.cwd, args.force === true),
  'fs.dirs': async ({ path }) => listDirs(path),
  'session.submit': async (args) => {
    await submit(
      args.id,
      args.prompt.trim(),
      args.images ?? [],
      args.requestId,
      'user',
      args.whenBusy,
    );
  },
  'session.detach': async ({ id }) => detach(id),
  'session.unwatch': async ({ id }) => unwatch(id),
  'session.withdraw': async ({ id, submission }) => withdraw(id, submission),
  'session.push': async ({ id, submission }) => pushSubmission(id, submission),
  'session.stop': async ({ id }) => stop(id),
  'session.archive': async ({ id, archived }) => archive(id, archived),
  'session.rename': async ({ id, title }) => rename(id, title),
  'session.compact': async ({ id, instructions }) => compact(id, instructions),
  'hub.open': async () => openHub(),
  'session.agent': async ({ id, agent }) => setAgent(id, agent),
  'session.voice': async ({ id, voice }) => setVoice(id, voice),
  'session.cleanup': async ({ id }) => {
    await pruneContext(id);
  },
  'session.fork': async ({ id, at }) => fork(id, at),
  'session.detail': async ({ id, key }) => conversationDetail(id, key),
  'session.seen': async ({ id, seen }) => markSeen(id, seen !== false),
  'voice.start': async ({ id, sdp, trace }) => startCall(id, sdp, trace),
  'voice.log': async ({ trace, event, data }) =>
    voiceLog(trace, 'browser', event, data),
  'voice.transcribe': async ({ audio, mimeType }) =>
    transcribe(audio, mimeType),
  'voice.stop': async ({ callId }) => stopCall(callId),
  'voice.photos': async ({ callId, images }) => addPhotos(callId, images),
  'account.signIn': async ({ id, type }) => signIn(id, type),
  'account.answer': async ({ prompt, value }) => answer(prompt, value),
  'account.cancel': async () => cancel(),
  'account.add': async ({ provider }) => addAccount(provider),
  'account.useFirst': async ({ id }) => useFirst(id),
  'account.signOut': async ({ id }) => signOut(id),
  'git.stage': async (args) => stage(ref(args), args.paths, args.repo),
  'git.unstage': async (args) => unstage(ref(args), args.paths, args.repo),
  'git.commit': async (args) =>
    commit(ref(args), args.message.trim(), {
      all: args.all === true,
      amend: args.amend === true,
      repo: args.repo,
    }),
  'git.discard': async (args) => discard(ref(args), args.paths, args.repo),
  'git.push': async (args) => push(ref(args), args.repo),
  'git.pull': async (args) => pull(ref(args), args.repo),
  'git.suggest': async (args) =>
    suggestCommitMessage(ref(args), {
      all: args.all === true,
      fresh: args.fresh === true,
      repo: args.repo,
    }),
  'git.diff': async (args) =>
    diff(ref(args), args.path, args.staged, args.oldPath, args.repo),
  'git.log': async (args) =>
    log(ref(args), { skip: args.skip, count: args.count, repo: args.repo }),
  'git.show': async (args) => show(ref(args), args.hash, args.repo),
  'file.read': async (args) => readText(ref(args), args.path),
  'editor.open': async (args) => openInEditor(ref(args), args.path),
  'path.open': async ({ path, cwd, reveal }) =>
    openPath(path, cwd, reveal === true),
  'path.find': async ({ path, cwd }) => findPath(path, cwd),
  'file.link': async (args) => workspaceFileLink(ref(args), args.path),
  'terminal.create': async (args) =>
    createTerminal(ref(args), { command: args.command, title: args.title }),
  'terminal.input': async ({ id, data }) => writeTerminal(id, data),
  'terminal.resize': async ({ id, cols, rows }) =>
    resizeTerminal(id, cols, rows),
  'terminal.stop': async ({ id }) => stopTerminal(id),
  'terminal.restart': async ({ id }) => restartTerminal(id),
  'terminal.detach': async ({ id }) => detachTerminal(id),
  'terminal.remove': async ({ id }) => removeTerminal(id),
};

// A request re-sent after a reconnect (its reply was lost) gets the first
// run's answer instead of acting twice. Only in memory: after a restart,
// only prompts and new sessions are kept from running twice, by the id they
// pass to Pi Durable. These calls just run again, since running one twice
// does what running it once does: reads, cheap and with big replies, and a
// resize to a given size.
const REPEATABLE = new Set<Call>([
  'fs.dirs',
  'file.read',
  'file.link',
  'path.find',
  'git.diff',
  'git.log',
  'git.show',
  'git.suggest',
  'terminal.resize',
]);
const answered = new Map<string, Promise<unknown>>();

function run(id: string, call: Call, args: unknown) {
  const handler = calls[call] as (args: unknown) => Promise<unknown>;
  if (!handler) throw new Error(`Unknown call ${call}`);
  if (REPEATABLE.has(call)) return handler(args);
  let result = answered.get(id);
  if (!result) {
    result = handler(args);
    answered.set(id, result);
    setTimeout(() => answered.delete(id), 10 * 60_000).unref();
  }
  return result;
}

const topics: {
  [K in Topic]: (
    params: Topics[K]['params'],
    sink: Sink,
    have: EntriesHeld | undefined,
  ) => Promise<() => void>;
} = {
  sessions: (_params, sink) => watchSessions(sink.snapshot),
  projects: (_params, sink) => watchProjects(sink.snapshot),
  models: (_params, sink) => watchModels(sink.snapshot),
  settings: (_params, sink) => watchSettings(sink.snapshot),
  accounts: (_params, sink) => watchAccounts(sink.snapshot),
  'plan.usage': (_params, sink) => watchPlanUsage(sink.snapshot),
  conversation: ({ id }, sink, have) => watchConversation(id, sink, have),
  'git.status': (params, sink) => watchStatus(ref(params), sink.snapshot),
  files: (params, sink) => watchFiles(ref(params), sink.snapshot),
  terminals: (_params, sink) => watchTerminals(sink.snapshot),
  terminal: ({ id }, sink) => watchTerminal(id, sink),
};

// Just the workspace: a call's other args stay out of caches keyed on it.
function ref({ projectId, cwd }: WorkspaceRef): WorkspaceRef {
  return {
    projectId,
    cwd,
  };
}

type Connection = ReturnType<typeof connect>;
type Socket = ServerWebSocket<{ connection?: Connection }>;

/** Turns a request for the socket's URL into the socket. */
export function upgrade(req: Request, server: Server<Socket['data']>) {
  // There is no login (docs/deploy.md), so at least keep other websites from
  // driving the agent: browsers always send Origin on WebSocket handshakes.
  const origin = req.headers.get('origin');
  if (origin && hostOf(origin) !== req.headers.get('host'))
    return new Response('Forbidden', { status: 403 });
  if (server.upgrade(req, { data: {} })) return;
  return new Response('Expected a WebSocket', { status: 426 });
}

export const websocket: WebSocketHandler<Socket['data']> = {
  // A prompt's images travel inside it; this is the ws package's default.
  maxPayloadLength: 100 * 1024 * 1024,
  // Past this, Bun drops messages silently, which would leave a request
  // unanswered; closing makes the tab reconnect and start over.
  backpressureLimit: 64 * 1024 * 1024,
  closeOnBackpressureLimit: true,
  // Transcripts are JSON and shrink about 4x, which a phone on a slow link
  // feels; the CPU it costs is small for one user's tabs.
  perMessageDeflate: true,
  open: (ws) => void (ws.data.connection = connect(ws)),
  message: (ws, data) => ws.data.connection?.receive(String(data)),
  close: (ws) => ws.data.connection?.close(),
};

function connect(ws: Socket) {
  const subs = new Map<number, () => void>();
  const log = wsLogger();
  const send = (message: ServerMessage) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const text = JSON.stringify(message);
    log('out', text);
    ws.send(text);
  };

  async function request({
    id,
    call,
    args,
  }: Extract<ClientMessage, { type: 'request' }>) {
    try {
      const value = (await run(String(id), call, args ?? {})) ?? null;
      send({ type: 'reply', id, ok: true, value });
    } catch (error) {
      send({ type: 'reply', id, ok: false, error: messageOf(error) });
    }
  }

  async function subscribe({
    sub,
    topic,
    params,
    have,
  }: Extract<ClientMessage, { type: 'subscribe' }>) {
    let live = true;
    let n = 0;
    // Topics that only ever send whole values get each new one as the ops
    // from the last, so a small change stays small. A topic that sends its
    // own ops can't be diffed this way: `sent` would be out of date.
    let sent: { value: unknown } | undefined;
    let diffable = true;
    subs.set(sub, () => (live = false));
    try {
      const open = topics[topic] as (
        params: unknown,
        sink: Sink,
        have: EntriesHeld | undefined,
      ) => Promise<() => void>;
      if (!open) throw new Error(`Unknown topic ${topic}`);
      const stop = await open(
        params ?? {},
        {
          snapshot: (value, kept) => {
            if (!live) return;
            const before = sent;
            sent = { value };
            if (!before || !diffable || kept)
              return send({ type: 'snapshot', sub, n: (n = 0), value, kept });
            const ops = diffRevisions(
              before.value as JsonValue,
              value as JsonValue,
            );
            if (ops.length) send({ type: 'changes', sub, n: ++n, ops });
          },
          changes: (ops) => {
            diffable = false;
            if (live) send({ type: 'changes', sub, n: ++n, ops });
          },
        },
        have,
      );
      // Unsubscribed (or disconnected) while it was opening.
      if (!live) return stop();
      subs.set(sub, () => {
        live = false;
        stop();
      });
    } catch (error) {
      subs.delete(sub);
      if (live) send({ type: 'error', sub, error: messageOf(error) });
    }
  }

  return {
    receive(text: string) {
      let message: ClientMessage;
      try {
        message = JSON.parse(text);
        log('in', text);
      } catch {
        ws.close(1003, 'Bad message');
        return;
      }
      if (message.type === 'request') void request(message);
      else if (message.type === 'subscribe') void subscribe(message);
      else if (message.type === 'unsubscribe') {
        subs.get(message.sub)?.();
        subs.delete(message.sub);
      }
    },
    close() {
      for (const stop of subs.values()) stop();
      subs.clear();
    },
  };
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
