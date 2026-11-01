import { mkdirSync, writeFileSync } from 'node:fs';
import { constants } from 'node:os';
import { resolve } from 'node:path';
import type { Op } from '@earendil-works/chord/delta';

import type {
  TerminalInfo,
  TerminalOutput,
  WorkspaceRef,
} from '@bica/shared/protocol';
import { getProject } from '../projects/projects';
import { dataPath } from '../storage';

/**
 * Shells and long-running processes (dev servers, game servers) in a
 * workspace, visible to the user and to agents. They live in this process:
 * a server restart ends them. Output is kept as one string, capped.
 */

// Output kept per terminal; past MAX it drops back to KEEP, at a line start.
const MAX = 1_000_000;
const KEEP = 500_000;
// Batch pty data so a chatty process doesn't send a message per byte.
const FLUSH_MS = 16;

interface Sink {
  snapshot: (value: TerminalOutput | null) => void;
  changes: (ops: readonly Op[]) => void;
}

interface Terminal {
  info: TerminalInfo;
  pty: Bun.Subprocess | null;
  // Bumped on restart: the browser clears its screen.
  run: number;
  // Characters dropped from the front of output so far.
  start: number;
  output: string;
  pending: string;
  timer: ReturnType<typeof setTimeout> | null;
  sinks: Set<Sink>;
  // Settles when the process exits.
  exited: PromiseWithResolvers<void>;
  // Waiters for new output (agent reads).
  wake: Set<() => void>;
  // Commands finished so far, however they ended: waits compare it.
  finished: number;
  // Notes for the running command's end: its exit code, or null if the
  // shell ended. Stopping the command on purpose drops them.
  done: Set<(code: number | null) => void>;
  // The start of a command mark split across pty reads.
  carry: string;
}

const terminals = new Map<string, Terminal>();
const listeners = new Set<(list: TerminalInfo[]) => void>();

function list() {
  return [...terminals.values()].map((t) => t.info);
}

function announce() {
  const value = list();
  for (const listener of listeners) listener(value);
}

export async function watchTerminals(listener: (list: TerminalInfo[]) => void) {
  listeners.add(listener);
  listener(list());
  return () => void listeners.delete(listener);
}

export async function watchTerminal(id: string, sink: Sink) {
  const t = terminals.get(id);
  if (!t) {
    sink.snapshot(null);
    return () => {};
  }
  sink.snapshot(view(t));
  t.sinks.add(sink);
  return () => void t.sinks.delete(sink);
}

function view(t: Terminal): TerminalOutput {
  return {
    run: t.run,
    start: t.start,
    output: t.output,
  };
}

function flush(t: Terminal) {
  if (t.timer) clearTimeout(t.timer);
  t.timer = null;
  const chunk = t.pending;
  if (!chunk) return;
  t.pending = '';
  t.output += chunk;
  if (t.output.length > MAX) {
    const cut = t.output.indexOf('\n', t.output.length - KEEP);
    const keep = cut === -1 ? t.output.length - KEEP : cut + 1;
    t.start += keep;
    t.output = t.output.slice(keep);
    for (const sink of t.sinks) sink.snapshot(view(t));
  } else {
    const ops: Op[] = [['a', ['output'], chunk]];
    for (const sink of t.sinks) sink.changes(ops);
  }
  for (const wake of t.wake) wake();
}

function shell() {
  return process.env.SHELL || '/bin/bash';
}

// Shell integration, as VS Code and Ghostty do it: zsh loads this .zshenv
// first, which puts the user's ZDOTDIR back (so their own files load as
// usual) and adds hooks that mark each command's start and end with its
// exit code (OSC 133). Terminals draw nothing for the marks. Other shells
// run without marks.
// ponytail: zsh only; bash 3.2 on macOS has no preexec hook.
const ZSHENV = `if [[ -n $BICA_ZDOTDIR ]]; then ZDOTDIR=$BICA_ZDOTDIR; else unset ZDOTDIR; fi
unset BICA_ZDOTDIR
[[ -f \${ZDOTDIR:-$HOME}/.zshenv ]] && source \${ZDOTDIR:-$HOME}/.zshenv
if [[ -o interactive ]]; then
  _bica_precmd() { local ret=$?; print -n "\\e]133;D;$ret\\a" }
  _bica_preexec() { print -n "\\e]133;C\\a" }
  precmd_functions=(_bica_precmd $precmd_functions)
  preexec_functions=(_bica_preexec $preexec_functions)
fi
`;

let zdotdir: string | undefined;
function integration(): Record<string, string> {
  if (!shell().endsWith('/zsh')) return {};
  if (!zdotdir) {
    zdotdir = resolve(dataPath('shell', 'zsh'));
    mkdirSync(zdotdir, { recursive: true });
    writeFileSync(`${zdotdir}/.zshenv`, ZSHENV);
  }
  return {
    ZDOTDIR: zdotdir,
    ...(process.env.ZDOTDIR ? { BICA_ZDOTDIR: process.env.ZDOTDIR } : {}),
  };
}

// oxlint-disable-next-line no-control-regex
const MARK = /\x1b\]133;([CD])(?:;(\d+))?\x07/g;

/** Follows the command marks: is a command running, and how did the last end. */
function marks(t: Terminal, text: string) {
  const s = t.carry + text;
  let changed = false;
  for (const [, kind, code] of s.matchAll(MARK)) {
    changed = true;
    if (kind === 'C') {
      t.info = { ...t.info, busy: true };
      continue;
    }
    // The first prompt also marks an end, with no command before it.
    const ended = t.info.busy === true;
    const exit = Number(code ?? 0);
    t.info = {
      ...t.info,
      busy: false,
      lastExit: ended ? exit : t.info.lastExit,
    };
    if (ended) finish(t, exit);
  }
  const esc = s.lastIndexOf('\x1b');
  t.carry =
    esc !== -1 && !s.includes('\x07', esc) && s.length - esc < 32
      ? s.slice(esc)
      : '';
  if (changed) announce();
}

function finish(t: Terminal, code: number | null) {
  t.finished++;
  for (const done of t.done) done(code);
  t.done.clear();
}

function spawn(t: Terminal, cols = 100, rows = 30) {
  const { command, cwd } = t.info;
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    ...integration(),
  } as Record<string, string>;
  const decoder = new TextDecoder();
  const p = Bun.spawn([shell(), '-l'], {
    cwd,
    env,
    terminal: {
      cols,
      rows,
      data(_terminal, data) {
        const text = decoder.decode(data, { stream: true });
        t.pending += text;
        if (text.includes('\x1b') || t.carry) marks(t, text);
        t.timer ??= setTimeout(() => flush(t), FLUSH_MS);
      },
    },
    onExit(proc, exitCode, signal) {
      if (t.pty !== proc) return;
      t.pending += decoder.decode();
      flush(t);
      proc.terminal?.close();
      t.pty = null;
      const code =
        exitCode ??
        (signal
          ? 128 +
            (typeof signal === 'number' ? signal : constants.signals[signal])
          : 1);
      t.pending = `\r\n\x1b[2m[exited with code ${code}]\x1b[0m\r\n`;
      flush(t);
      t.info = { ...t.info, status: 'exited', exitCode: code, busy: null };
      t.exited.resolve();
      finish(t, null);
      announce();
    },
  });
  t.pty = p;
  t.exited = Promise.withResolvers();
  t.carry = '';
  t.info = {
    ...t.info,
    status: 'running',
    exitCode: null,
    busy: null,
    lastExit: null,
  };
  // Typed ahead: the shell reads it once it is ready.
  if (command) p.terminal!.write(`${command}\n`);
}

/** Opens a shell in a workspace, which runs `command` first if given; its id. */
export async function createTerminal(
  ref: WorkspaceRef,
  options: { command?: string; title?: string; startedBy?: string } = {},
) {
  const project = await getProject(ref.projectId);
  if (!project.workspaces.some((w) => w.path === ref.cwd))
    throw new Error(`${ref.cwd} is not a workspace of ${project.name}`);
  const command = options.command?.trim() || null;
  let id: string;
  do id = Math.random().toString(36).slice(2, 8);
  while (terminals.has(id));
  const t: Terminal = {
    info: {
      id,
      projectId: ref.projectId,
      cwd: ref.cwd,
      title:
        options.title?.trim() ||
        command?.slice(0, 60) ||
        shell().split('/').pop()!,
      command,
      status: 'running',
      exitCode: null,
      busy: null,
      lastExit: null,
      startedBy: options.startedBy ?? null,
      parent: options.startedBy ?? null,
      createdAt: Date.now(),
    },
    pty: null,
    run: 0,
    start: 0,
    output: '',
    pending: '',
    timer: null,
    sinks: new Set(),
    exited: Promise.withResolvers(),
    wake: new Set(),
    finished: 0,
    done: new Set(),
    carry: '',
  };
  terminals.set(id, t);
  spawn(t);
  announce();
  return id;
}

function get(id: string) {
  const t = terminals.get(id);
  if (!t) throw new Error(`No terminal ${id}`);
  return t;
}

export function writeTerminal(id: string, data: string) {
  const t = get(id);
  if (!t.pty) throw new Error('The terminal has exited');
  t.pty.terminal!.write(data);
}

/**
 * Ctrl-C, then up to 3 s for the prompt. On purpose, so no note says the
 * command ended; a wait on it still ends.
 */
export async function interruptTerminal(id: string) {
  const t = get(id);
  if (!t.pty) throw new Error('The terminal has exited');
  t.done.clear();
  if (t.info.busy === false) return;
  const prompt = waitFor(id, 3000, {});
  t.pty.terminal!.write('\x03');
  await prompt;
}

export function resizeTerminal(id: string, cols: number, rows: number) {
  const t = get(id);
  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    cols < 2 ||
    rows < 2
  )
    throw new Error('Expected a size in whole columns and rows');
  t.pty?.terminal?.resize(Math.min(cols, 500), Math.min(rows, 200));
}

// Every process on the pty's tty, not just the shell's process group: an
// interactive shell puts each `cmd &` job in a group of its own.
function signal(p: Bun.Subprocess, name: NodeJS.Signals, tty: string | null) {
  if (tty) Bun.spawnSync(['pkill', `-${name.slice(3)}`, '-t', tty]);
  try {
    process.kill(-p.pid, name);
  } catch {
    p.kill(name);
  }
}

function ttyOf(pid: number) {
  const ps = Bun.spawnSync(['ps', '-o', 'tty=', '-p', String(pid)]);
  const tty = ps.stdout.toString().trim();
  return /^[\w/]+$/.test(tty) && !tty.startsWith('?') ? tty : null;
}

/**
 * SIGHUP, as closing a terminal window sends, then SIGKILL if it won't go.
 * An interactive shell ignores SIGTERM.
 */
export async function stopTerminal(id: string) {
  const t = get(id);
  const p = t.pty;
  if (!p) return;
  const tty = ttyOf(p.pid);
  signal(p, 'SIGHUP', tty);
  const timeout = setTimeout(() => signal(p, 'SIGKILL', tty), 3000);
  await t.exited.promise;
  clearTimeout(timeout);
}

/**
 * A fresh shell in place, which runs the first command again, or `command`
 * instead. A restart is on purpose: no note says the old command ended.
 */
export async function restartTerminal(
  id: string,
  next?: { command?: string; startedBy?: string },
) {
  const t = get(id);
  t.done.clear();
  await stopTerminal(id);
  if (next)
    t.info = {
      ...t.info,
      command: next.command?.trim() || null,
      startedBy: next.startedBy ?? t.info.startedBy,
      parent: next.startedBy ?? t.info.parent,
    };
  t.run++;
  t.start = 0;
  t.output = '';
  for (const sink of t.sinks) sink.snapshot(view(t));
  spawn(t);
  announce();
}

export async function removeTerminal(id: string) {
  const t = terminals.get(id);
  if (!t) return;
  // Closed on purpose: no note says its command ended.
  t.done.clear();
  await stopTerminal(id);
  terminals.delete(id);
  for (const sink of t.sinks) sink.snapshot(null);
  announce();
}

/** Takes it from its session for good: archiving that session leaves it open. */
export function detachTerminal(id: string) {
  const t = get(id);
  if (!t.info.parent) return;
  t.info = { ...t.info, parent: null };
  announce();
}

// ---------- for agents: plain text ----------

export function terminalInfo(id: string) {
  return get(id).info;
}

export function terminalsIn(cwd: string) {
  return list().filter((t) => t.cwd === cwd);
}

export const allTerminals = list;

/**
 * Settles when the command now running (or the next one, at a prompt)
 * finishes: its exit code, or null if the shell ends first. Shells without
 * command marks only settle when they end.
 */
export function commandDone(id: string) {
  const t = get(id);
  return new Promise<number | null>((resolve) => {
    if (!t.pty) resolve(null);
    else t.done.add(resolve);
  });
}

/** Output as text: no colors, and only the last state of redrawn lines. */
function plain(output: string) {
  return Bun.stripANSI(output)
    .split('\n')
    .map((line) => {
      const parts = line.replace(/\r$/, '').split('\r');
      return parts.findLast((p) => p) ?? '';
    })
    .join('\n');
}

/**
 * The last `lines` lines of output, as text. Runs of blank lines count as
 * one: screen clears (Vite's, for one) leave dozens.
 */
export function tail(id: string, lines = 100) {
  const all = plain(get(id).output)
    .trimEnd()
    .split('\n')
    .filter((line, i, a) => line.trim() || (i > 0 && a[i - 1]!.trim()));
  const shown = all.slice(-lines).join('\n');
  return all.length > lines
    ? `[${all.length - lines} earlier lines not shown]\n${shown}`
    : shown;
}

/**
 * Waits up to `ms` for the running command to end (however it ends), the
 * shell to exit, `until` to show up in new output, or `signal`. Without
 * `until`, a terminal at its prompt returns at once.
 */
export async function waitFor(
  id: string,
  ms: number,
  { until, signal }: { until?: string; signal?: AbortSignal },
) {
  const t = get(id);
  if (!t.pty || (!until && t.info.busy === false) || signal?.aborted) return;
  const from = t.start + t.output.length;
  const finished = t.finished;
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(deadline);
      t.wake.delete(check);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    // The end mark comes as output, so every end shows up here.
    const check = () => {
      const fresh = t.output.slice(Math.max(0, from - t.start));
      if (t.finished > finished || (until && plain(fresh).includes(until)))
        done();
    };
    const deadline = setTimeout(done, ms);
    t.wake.add(check);
    signal?.addEventListener('abort', done);
    void t.exited.promise.then(done);
  });
}

export async function settle(id: string, ms: number, quiet = 1500) {
  const t = get(id);
  await new Promise<void>((resolve) => {
    let idle: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      clearTimeout(deadline);
      clearTimeout(idle);
      t.wake.delete(wake);
      resolve();
    };
    const wake = () => {
      clearTimeout(idle);
      idle = setTimeout(done, quiet);
    };
    const deadline = setTimeout(done, ms);
    t.wake.add(wake);
    void t.exited.promise.then(done);
  });
}
