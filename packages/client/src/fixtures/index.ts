// Development only: `?data=worst` (or demo, empty, one, huge) swaps the app's
// data for test data, to see how screens hold up. It stands in where topics
// are read (`useTopic`), so it never reaches the server or the device cache,
// and commands are held back while it's on, except reads it can answer
// (step details, files and diffs). `?data=live` shows the switch with
// real data. The mode is per tab and survives navigation and reloads.
import { createSignal, untrack } from 'solid-js';

import type {
  Call,
  Calls,
  FileText,
  SessionSummary,
  Topic,
} from '@bica/shared/protocol';
import { chat, type Chat, type Turn } from './conversation';
import { MODES, datasets, type Dataset, type Mode } from './data';
import { fixtureDiff, gitFixtures } from './git';
import {
  fixtureAccounts,
  fixtureCatalog,
  fixturePlanUsage,
  fixtureSettings,
} from './usage';

export { MODES, type Mode };

export const MODE_LABELS: Record<Mode, string> = {
  demo: 'Demo',
  worst: 'Worst case',
  empty: 'Empty',
  one: 'One',
  huge: '1,000 rows',
};

/** Opens the home page fresh on this test data; undefined turns it off. */
export function openWithTestData(next: Mode | undefined) {
  if (next) location.assign(`/?data=${next}`);
  else {
    exitFixtures();
    location.assign('/');
  }
}

const KEY = 'bica.data';

function initial() {
  if (!import.meta.env.DEV) return null;
  const param = new URLSearchParams(location.search).get('data');
  if (param !== null) sessionStorage.setItem(KEY, param);
  return sessionStorage.getItem(KEY);
}

function toMode(value: string | null) {
  return MODES.find((m) => m === value);
}

const start = initial();
// Whether the switch shows: any `?data=` turns it on for this tab.
const [enabled, setEnabled] = createSignal(start !== null, {
  name: 'fixtureEnabled',
});
const [mode, setModeSignal] = createSignal<Mode | undefined>(toMode(start), {
  name: 'fixtureMode',
});
export { enabled, mode };

/** Undefined: live data, with the switch still shown. */
export function setMode(next: Mode | undefined) {
  sessionStorage.setItem(KEY, next ?? 'live');
  setModeSignal(next);
}

/** Back to live data, and the switch goes away. */
export function exitFixtures() {
  sessionStorage.removeItem(KEY);
  const url = new URL(location.href);
  url.searchParams.delete('data');
  history.replaceState(history.state, '', url);
  setModeSignal(undefined);
  setEnabled(false);
}

const built = new Map<Mode, Dataset>();
const extras = new Map<string, unknown>();
// Built once, so every read sees the same object and nothing re-runs.
function cached<T>(m: Mode, key: string, make: () => T) {
  if (!extras.has(`${m}:${key}`)) extras.set(`${m}:${key}`, make());
  return extras.get(`${m}:${key}`) as T;
}
function dataset(m: Mode) {
  if (!built.has(m)) built.set(m, datasets[m]());
  return built.get(m)!;
}
function gitOf(m: Mode) {
  return cached(m, 'git', () => gitFixtures(dataset(m).git ?? {}));
}

// Demo only: the session list moves on its own, a step every 6s, so status
// changes and rows gliding to new places can be seen. A session turns
// running, a new one appears at the top, asks, finishes, and is archived.
const [step, setStep] = createSignal(0, { name: 'fixtureStep' });
let stepping = false;
const STEPS = 6;
function story(base: SessionSummary[]): SessionSummary[] {
  if (!stepping) {
    stepping = true;
    setInterval(() => setStep((n) => (n + 1) % STEPS), 6000);
  }
  const n = step();
  const at = Date.now();
  const list = base.map((s) =>
    s.title !== 'Resize columns'
      ? s
      : n === 1 || n === 2
        ? {
            ...s,
            status: 'running' as const,
            runningSince: at - (n - 1) * 6000 - 4000,
          }
        : n === 3
          ? { ...s, status: 'waiting' as const, runningSince: null }
          : s,
  );
  if (n < 2 || n > 4) return list;
  const first = base[0]!;
  const added: SessionSummary = {
    ...first,
    id: 'fixture-story',
    title: 'Write release notes',
    createdAt: at,
    updatedAt: at,
    status: n === 4 ? 'done' : 'running',
    runningSince: n === 4 ? null : at - (n - 2) * 6000 - 2000,
  };
  return [added, ...list];
}

// Built on first open: the huge data has thousands of sessions.
const chats = new Map<string, Chat | null>();
function chatOf(m: Mode, id: string) {
  const key = `${m}:${id}`;
  if (chats.has(key)) return chats.get(key)!;
  const data = dataset(m);
  const s = data.sessions.find((s) => s.id === id);
  const given = data.chats?.[id];
  const result = !s
    ? null
    : chat(id, given?.turns ?? fallback(s.title, s.status), {
        start: s.createdAt,
        ...(s.status === 'running' && {
          live: [{ think: 'Working on it.' }],
        }),
        ...(s.status === 'retrying' && {
          retry:
            '429 rate_limit_error: This request would exceed the rate limit for your organization of 4,000,000 input tokens per minute.',
        }),
        ...given,
      });
  chats.set(key, result);
  return result;
}

// A short exchange that matches the session's status.
function fallback(title: string, status: string): Turn[] {
  const prompt: Turn = { user: title || 'Hi' };
  if (status === 'running' || status === 'retrying') return [prompt];
  if (status === 'error')
    return [prompt, { agent: [], error: '500 Internal server error' }];
  if (status === 'waiting')
    return [
      prompt,
      {
        agent: [
          {
            tool: 'ask',
            args: {
              questions: [
                {
                  header: 'Approach',
                  question: 'Which way should I take?',
                  options: [
                    { label: 'The small fix (Recommended)' },
                    { label: 'The full rewrite' },
                  ],
                },
              ],
            },
          },
        ],
      },
    ];
  return [
    prompt,
    {
      agent: [
        { think: 'Looking at the code first.', ms: 1_500 },
        { tool: 'read', args: { path: 'README.md' } },
      ],
    },
    { agent: [{ say: 'Done. The change is small and the tests pass.' }] },
  ];
}

/** Reactive: the test value for a topic, or undefined to use the live one. */
export function fixture(topic: Topic, params: unknown) {
  if (!import.meta.env.DEV) return undefined;
  const m = mode();
  if (!m) return undefined;
  const data = dataset(m);
  const p = params as { id?: string; cwd?: string };
  // Models, providers and plan usage only in the modes that have sessions
  // to use them; the others stay live.
  if (m === 'demo' || m === 'worst') {
    const worst = m === 'worst';
    if (topic === 'models')
      return { value: cached(m, 'models', () => fixtureCatalog(worst)) };
    if (topic === 'settings')
      return { value: cached(m, 'settings', fixtureSettings) };
    if (topic === 'accounts')
      return { value: cached(m, 'accounts', () => fixtureAccounts(worst)) };
    if (topic === 'plan.usage')
      return { value: cached(m, 'plan', () => fixturePlanUsage(worst)) };
  }
  switch (topic) {
    case 'sessions':
      return { value: m === 'demo' ? story(data.sessions) : data.sessions };
    case 'projects':
      return { value: data.projects };
    case 'terminals':
      return { value: data.terminals };
    case 'conversation': {
      const talk = data.conversations?.views.get(p.id!);
      // A getter: the live transcript changes on its own timer.
      if (talk)
        return {
          get value() {
            return talk.value;
          },
        };
      return { value: chatOf(m, p.id!)?.view ?? null };
    }
    case 'git.status': {
      // A getter: staging and committing on test data change it.
      const git = gitOf(m);
      return {
        get value() {
          return git.repos()[p.cwd!] ?? null;
        },
      };
    }
    case 'files':
      return { value: data.files?.[p.cwd!] ?? [] };
    // Terminal output isn't test data: an empty screen.
    case 'terminal':
      return { value: null };
    // Models, accounts, and plan usage stay live in the other modes.
    default:
      return undefined;
  }
}

/** Reactive: files kept open on this device, which aren't a topic. */
export function fixtureKept() {
  const m = import.meta.env.DEV ? mode() : undefined;
  return m && dataset(m).kept;
}

/** Not reactive: whether test data is on, for code that writes. */
export function testing() {
  return !!(import.meta.env.DEV && untrack(mode));
}

// Reads that change nothing go through when the test data has no answer;
// everything else is refused on test data.
const READS: ReadonlySet<Call> = new Set(['fs.dirs', 'file.read', 'git.diff']);

function text(t: string | undefined): FileText {
  return t === undefined ? { text: null, reason: 'missing' } : { text: t };
}

/**
 * Undefined: send the command. Otherwise its answer from the test data, or
 * a promise that never settles: the command is held back and logged. The
 * live test transcripts act out prompts, compactions, and pruning.
 */
export function testAnswer<C extends Call>(
  call: C,
  args: Calls[C]['args'],
): Promise<Calls[C]['result']> | undefined {
  const m = import.meta.env.DEV ? untrack(mode) : undefined;
  if (!m) return undefined;
  const a = args as { id?: string; key?: string; cwd?: string; path?: string };
  const file =
    a.cwd && a.path ? dataset(m).texts?.[`${a.cwd}/${a.path}`] : undefined;
  // Staging, committing, and pushing play out on the test git status, and
  // changes with no file contents in the test data get made-up diffs.
  if (!file) {
    const git = gitOf(m);
    const played = READS.has(call)
      ? fixtureDiff(git, call, a as Record<string, unknown>)
      : untrack(() => git.play(call, a as Record<string, unknown>));
    if (played) return played as Promise<never>;
  }
  const live = dataset(m).conversations;
  const talk = a.id ? live?.views.get(a.id) : undefined;
  // Answered, so whatever waits on a send moves on.
  if (call === 'session.submit') {
    talk?.submit?.((args as { prompt: string }).prompt);
    if (!talk?.submit)
      console.info(`[test data] ${call} not sent: ?data=${m} is on`);
    return Promise.resolve(null);
  }
  const play =
    call === 'session.compact'
      ? talk?.compact
      : call === 'session.cleanup'
        ? talk?.prune
        : undefined;
  if (play) return play().then(() => null as never);
  const answer =
    call === 'session.detail'
      ? talk
        ? talk.detail(a.key!)
        : chatOf(m, a.id!)?.detail(a.key!)
      : call === 'file.read' && file
        ? text(file.new)
        : call === 'git.diff' && file
          ? { old: text(file.old), new: text(file.new) }
          : undefined;
  if (answer !== undefined) return Promise.resolve(answer as never);
  if (READS.has(call)) return undefined;
  // Never settling, not failing: many commands are fire and forget (marking
  // a session read on open), and a rejection there is an uncaught error.
  console.info(`[test data] ${call} not sent: ?data=${m} is on`);
  return new Promise(() => {});
}
