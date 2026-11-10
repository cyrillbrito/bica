import { bool, num, obj, opt, str } from '@earendil-works/pi-schema';
import { defineExtension, defineTool } from '@earendil-works/pi-durable';
import type { TerminalInfo } from '@bica/shared/protocol';
import { sessionWorkspace } from '../sessions/store';
import { tell } from '../sessions/notes';
import { onSteer } from '../sessions/prompts';
import {
  commandDone,
  createTerminal,
  interruptTerminal,
  removeTerminal,
  restartTerminal,
  settle,
  STOP_GRACE_MS,
  tail,
  terminalInfo,
  terminalsIn,
  waitFor,
  writeTerminal,
} from './terminals';

// Like Codex's exec_command / write_stdin and Claude Code's background bash,
// but each terminal is a shell the user sees in the sidebar, can type into,
// restart, and stop. Output comes back as plain text, the tail only.
// Starting a name again reruns it in the same terminal, as Zed's tasks do,
// so restarting a dev server never leaves a dead one behind.

const MAX_WAIT = 120;
// Long enough for a test suite or a build; a message ends the wait early.
const MAX_READ_WAIT = 1800;
function seconds(value: number | undefined, fallback: number, max = MAX_WAIT) {
  return Math.min(Math.max(value ?? fallback, 0), max) * 1000;
}

/** What a terminal is doing, in a few words; `list` uses it too. */
export function terminalState(t: TerminalInfo) {
  if (t.status === 'exited') return `shell exited with code ${t.exitCode}`;
  if (t.busy) return 'running a command';
  if (t.busy === false)
    return t.lastExit === null
      ? 'at the prompt'
      : `at the prompt, last exit ${t.lastExit}`;
  return 'running';
}

function report(id: string, lines?: number) {
  const t = terminalInfo(id);
  const output = tail(id, lines);
  return {
    output: [
      {
        type: 'text' as const,
        text: `Terminal ${id} "${t.title}": ${terminalState(t)}.\n\n${output || '(no output yet)'}`,
      },
    ],
    details: { terminalId: id },
  };
}

const USER_ASKED = opt(
  bool({
    description:
      'true: the user told you to, for a terminal you started that is theirs now. Only then',
  }),
);

/** As with sessions, a terminal's starter backs off once it's detached. */
function checkInCharge(t: TerminalInfo, me: string, userAsked?: boolean) {
  if (t.startedBy !== me || t.parent === me || userAsked) return;
  throw new Error(
    `You started terminal ${t.id} "${t.title}", but it has no parent now, so it's the user's. Leave it to them: read it, or open your own with another name. Pass \`user_asked\` only if they told you to do this.`,
  );
}

/** The session hears when the terminal's command finishes. */
async function notifyWhenDone(id: string, session: string) {
  const code = await commandDone(id);
  // Read now: a terminal being closed is gone a moment later, and closing
  // one needs no note.
  let note: string;
  try {
    const t = terminalInfo(id);
    // Detached since: the user's now, so its starter hears nothing more.
    if (t.startedBy === session && t.parent !== session) return;
    note = `${
      code === null
        ? `The shell in terminal ${id} "${t.title}" ended.`
        : `In terminal ${id} "${t.title}", the command finished with exit code ${code}.`
    }\n\n${tail(id, 20)}`;
  } catch {
    return;
  }
  // Nothing awaits this, so a throw here would take the server down.
  try {
    await tell(session, note);
  } catch (error) {
    console.error('[terminal]', error);
  }
}

function notify(fallback: string) {
  return opt(
    bool({
      description: `true: when the command finishes (or someone stops it), you get a note with its exit code and last lines, even if you are idle by then. ${fallback}`,
    }),
  );
}

const terminalStart = defineTool({
  name: 'terminal_start',
  description:
    'Open a shell in a terminal in your folder, optionally running a command first: a dev server, watcher, game server, REPL. The user sees it in the sidebar and can type into it. Use this instead of `&`, nohup, or a long bash call for anything that keeps running. Starting a name again reuses that terminal: whatever it runs stops, and the new command starts in its place. So to restart a dev server, start it again with the same name. Check `list` first: one may already run. Returns once output settles (or after `wait` seconds) with the latest output.',
  parameters: obj(
    {
      command: opt(str({ description: 'A shell command to run first' })),
      name: opt(
        str({
          description:
            'A short name for the sidebar, e.g. "dev server". Default: the command',
        }),
      ),
      notify: notify('Default: true when you give a command.'),
      wait: opt(
        num({
          description: `Most seconds to wait for output to settle (default 10, max ${MAX_WAIT})`,
        }),
      ),
    },
    { open: true },
  ),
  execute: async ({ command, name, notify, wait }, api) => {
    const session = String(api.conversationId);
    const workspace = await sessionWorkspace(api.conversationId);
    const title = name?.trim() || command?.trim().slice(0, 60);
    const same = title
      ? terminalsIn(workspace.cwd).find((t) => t.title === title)
      : undefined;
    if (same && same.status !== 'exited' && same.parent !== session)
      throw new Error(
        `Terminal ${same.id} "${title}" is already open here and isn't yours. Read it with terminal_read, or pick another name.`,
      );
    const id =
      same?.id ??
      (await createTerminal(workspace, {
        command,
        title: name,
        startedBy: session,
      }));
    if (same) await restartTerminal(id, { command, startedBy: session });
    if (command?.trim() && notify !== false) void notifyWhenDone(id, session);
    await settle(id, seconds(wait, 10));
    return report(id);
  },
});

const terminalRead = defineTool({
  name: 'terminal_read',
  description:
    "Read a terminal's latest output and state: running a command, at the prompt, or exited. `list` shows all terminals. To wait for a long command, use `wait` here, not sleep in bash. Pick a wait about as long as you expect it to take, and read the output between waits, so a stuck command doesn't hold you for long.",
  parameters: obj(
    {
      id: str({ description: 'The terminal id' }),
      lines: opt(num({ description: 'How many last lines (default 100)' })),
      wait: opt(
        num({
          description: `Most seconds to wait first (default 0, max ${MAX_READ_WAIT}). Ends early when the command finishes, \`until\` shows up, or a message arrives for you`,
        }),
      ),
      until: opt(
        str({
          description:
            'Text to wait for in new output, e.g. a server\'s "ready" line',
        }),
      ),
    },
    { open: true },
  ),
  execute: async ({ id, lines, wait, until }, api, context) => {
    if (wait) {
      const steered = new AbortController();
      const stop = onSteer(String(api.conversationId), () => steered.abort());
      try {
        await waitFor(id, seconds(wait, 0, MAX_READ_WAIT), {
          until,
          signal: context.abortSignal
            ? AbortSignal.any([context.abortSignal, steered.signal])
            : steered.signal,
        });
      } finally {
        stop();
      }
    }
    return report(id, lines);
  },
});

const terminalSend = defineTool({
  name: 'terminal_send',
  description:
    'Type into a terminal: a command, input for a REPL or server console, or keys. Include "\\n" to press Enter. With `interrupt`, Ctrl-C stops what runs first, e.g. to run something else where a dev server ran. Only use terminals you started or the user named. Returns the output once it settles.',
  parameters: obj(
    {
      id: str({ description: 'The terminal id' }),
      input: str({
        description: 'The text to type; may be empty with `interrupt`',
      }),
      interrupt: opt(
        bool({
          description:
            'true: press Ctrl-C first and wait for the prompt, with no note about the stopped command',
        }),
      ),
      notify: notify('Default: false.'),
      wait: opt(
        num({
          description: `Most seconds to wait for output to settle (default 3, max ${MAX_WAIT})`,
        }),
      ),
      user_asked: USER_ASKED,
    },
    { open: true },
  ),
  execute: async ({ id, input, interrupt, notify, wait, user_asked }, api) => {
    const t = terminalInfo(id);
    checkInCharge(t, String(api.conversationId), user_asked);
    if (t.status === 'exited')
      throw new Error(
        'The terminal has exited. terminal_start with its name opens it again.',
      );
    if (interrupt) await interruptTerminal(id);
    if (notify) void notifyWhenDone(id, String(api.conversationId));
    if (input) writeTerminal(id, input);
    await settle(id, seconds(wait, 3), 500);
    return report(id, 50);
  },
});

const terminalStop = defineTool({
  name: 'terminal_stop',
  description: `Close a terminal when you are done with it, and it leaves the sidebar. Everything it started gets SIGTERM to shut down cleanly, the shell gets SIGHUP once they are gone, and whatever still runs after ${STOP_GRACE_MS / 1000} seconds gets SIGKILL. Returns its last lines. To restart what runs in it, use terminal_start with its name instead; to stop only the command, terminal_send with \`interrupt\`.`,
  parameters: obj(
    {
      id: str({ description: 'The terminal id' }),
      user_asked: USER_ASKED,
    },
    { open: true },
  ),
  execute: async ({ id, user_asked }, api) => {
    const t = terminalInfo(id);
    checkInCharge(t, String(api.conversationId), user_asked);
    const { title } = t;
    const last = tail(id, 20);
    await removeTerminal(id);
    return {
      output: [
        {
          type: 'text' as const,
          text: `Closed terminal ${id} "${title}". Its last lines:\n\n${last || '(no output)'}`,
        },
      ],
    };
  },
});

// The hub reads its child sessions' terminals but types into none (docs/hub.md).
export const HubTerminalTools = defineExtension({
  name: 'hub-terminal-tools',
  tools: [terminalRead],
});

export const TerminalTools = defineExtension({
  name: 'terminal-tools',
  tools: [terminalStart, terminalRead, terminalSend, terminalStop],
});
