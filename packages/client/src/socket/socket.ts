// The browser end of the one WebSocket. Views ask for topics and read
// signals; only this module touches the socket.
import { applyImmutable } from '@earendil-works/chord/delta';
import {
  createMemo,
  createSignal,
  onCleanup,
  runWithOwner,
  type Accessor,
} from 'solid-js';

import {
  type Call,
  type Calls,
  type ClientMessage,
  type EntriesHeld,
  type ServerMessage,
  type Topic,
  type Topics,
} from '@bica/shared/protocol';
import { readTopic, saveTopic } from './topic-cache';
import { fixture, testAnswer } from '../fixtures';

interface Entry {
  topic: Topic;
  params: unknown;
  key: string;
  refs: number;
  sub: number;
  n: number;
  value: Accessor<unknown>;
  set: (value: unknown) => void;
  // Settles with the first snapshot, or fails if the server refuses the topic.
  first: PromiseWithResolvers<unknown>;
  // Settles once the copy saved on this device, if any, is in `value`.
  loaded: Promise<void>;
  // A snapshot has come since the last subscribe: `value` is current, not
  // a saved or left-behind copy. `ready` settles when it turns true.
  live: boolean;
  ready: PromiseWithResolvers<unknown>;
}

// The value before the first snapshot; `undefined` can be a real value.
const UNSET = Symbol('unset');

// Topics no view uses any more keep their value, unsubscribed, so going
// back shows it at once while the live value loads. This many at most.
const KEEP = 12;
// A terminal's output is gone once its shell is, so it isn't saved.
// Presence carries nothing.
const UNSAVED: ReadonlySet<Topic> = new Set(['terminal']);

interface Pending {
  message: ClientMessage;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

let ws: WebSocket | undefined;
let retries = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;
const entries = new Map<string, Entry>();
const bySub = new Map<number, Entry>();
const pending = new Map<string, Pending>();

function connect() {
  clearTimeout(retryTimer);
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${scheme}://${location.host}/ws`);
  ws = socket;
  socket.onopen = () => {
    retries = 0;
    // A new connection starts from fresh snapshots and re-sends unanswered
    // requests; their request ids keep the server from acting twice.
    for (const entry of entries.values()) if (entry.refs) open(entry);
    for (const { message } of pending.values()) send(message);
  };
  socket.onmessage = (event) => receive(JSON.parse(event.data));
  socket.onclose = () => {
    if (ws !== socket) return;
    ws = undefined;
    bySub.clear();
    retryTimer = setTimeout(connect, Math.min(250 * 2 ** retries++, 5000));
  };
}

function ensureConnected() {
  if (!ws) connect();
}

// Phones drop sockets in the background; come back without waiting.
// Leaving or hiding the page is the last moment to save what's open.
function saveOpen() {
  for (const entry of entries.values()) if (entry.refs) save(entry);
}
addEventListener('pagehide', saveOpen);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveOpen();
  if (
    document.visibilityState === 'visible' &&
    !ws &&
    [...entries.values()].some((e) => e.refs)
  )
    connect();
});

function send(message: ClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function receive(message: ServerMessage) {
  if (message.type === 'reply') {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.ok) request?.resolve(message.value);
    else request?.reject(new Error(message.error));
    return;
  }
  const entry = bySub.get(message.sub);
  if (!entry) return;
  if (message.type === 'snapshot') {
    const value = message.kept
      ? withKept(entry.value(), message.value, message.kept)
      : message.value;
    entry.n = message.n;
    entry.live = true;
    entry.set(value);
    entry.ready.resolve(value);
    entry.first.resolve(value);
    saveSoon(entry);
  } else if (message.type === 'changes') {
    // A gap means our copy is wrong: drop it and start over.
    if (message.n !== entry.n + 1) return reopen(entry);
    entry.n = message.n;
    entry.set(applyImmutable(entry.value(), message.ops));
    saveSoon(entry);
  } else {
    console.error(`[socket] ${entry.key}:`, message.error);
    // Before any data, the view can't render: let its error boundary show it.
    if (entry.value() === UNSET) entry.first.reject(new Error(message.error));
    entry.ready.reject(new Error(message.error));
  }
}

function open(entry: Entry) {
  bySub.delete(entry.sub);
  const sub = (entry.sub = nextId++);
  entry.n = -1;
  entry.live = false;
  entry.ready = Promise.withResolvers();
  // Only live reads wait on it.
  entry.ready.promise.catch(() => {});
  bySub.set(sub, entry);
  // A conversation waits for its saved copy, to tell the server what it has.
  const ready = entry.topic === 'conversation' ? entry.loaded : undefined;
  const subscribe = () => {
    if (entry.sub !== sub) return;
    send({
      type: 'subscribe',
      sub,
      topic: entry.topic,
      params: entry.params,
      have: held(entry),
    });
  };
  if (ready) void ready.then(subscribe);
  else subscribe();
}

function close(entry: Entry) {
  bySub.delete(entry.sub);
  send({ type: 'unsubscribe', sub: entry.sub });
  entry.sub = 0;
}

type View = { entries: readonly { id: number }[] };

function held(entry: Entry): EntriesHeld | undefined {
  const value = entry.value();
  if (entry.topic !== 'conversation' || !value || value === UNSET) return;
  const list = (value as View).entries;
  if (!list.length) return;
  return { first: list[0]!.id, last: list.at(-1)!.id, count: list.length };
}

// The server left out the first `kept` entries, which this copy already has.
function withKept(old: unknown, value: unknown, kept: number) {
  const have = (old as View).entries.slice(0, kept);
  return { ...(value as View), entries: [...have, ...(value as View).entries] };
}

function save(entry: Entry) {
  clearTimeout(saving.get(entry));
  saving.delete(entry);
  const value = entry.value();
  if (value !== UNSET && !UNSAVED.has(entry.topic))
    void saveTopic(entry.key, value);
}

// What arrives is saved within a few seconds, so a slow load is never
// repeated, even if the page dies without warning, as phones' do. At most
// once per interval while a run streams.
const SAVE_MS = 3000;
const saving = new Map<Entry, ReturnType<typeof setTimeout>>();

function saveSoon(entry: Entry) {
  if (saving.has(entry) || UNSAVED.has(entry.topic)) return;
  saving.set(
    entry,
    setTimeout(() => save(entry), SAVE_MS),
  );
}

function reopen(entry: Entry) {
  close(entry);
  open(entry);
}

function acquire(topic: Topic, params: unknown) {
  const key = `${topic}:${JSON.stringify(params)}`;
  let entry = entries.get(key);
  if (!entry) {
    // The copy outlives the view that asked first; it belongs to no owner.
    const [value, set] = runWithOwner(null, () =>
      createSignal<unknown>(UNSET, { name: key }),
    );
    const first = Promise.withResolvers<unknown>();
    // Read by every view of the topic; this one only silences the
    // unhandled-rejection warning when none is left.
    first.promise.catch(() => {});
    entry = {
      topic,
      params,
      key,
      refs: 0,
      sub: 0,
      n: -1,
      value,
      // Wrapped so a value is never mistaken for an updater.
      set: (v) => set(() => v),
      first,
      loaded: Promise.resolve(),
      live: false,
      ready: Promise.withResolvers(),
    };
    const e = entry;
    e.loaded = UNSAVED.has(topic)
      ? Promise.resolve()
      : readTopic(key).then((saved) => {
          // The live value may have landed first; it wins.
          if (saved !== undefined && e.value() === UNSET) e.set(saved);
        });
    entries.set(key, entry);
  }
  if (entry.refs++ === 0) {
    ensureConnected();
    open(entry);
  }
  return entry;
}

function release(entry: Entry) {
  if (--entry.refs > 0) return;
  close(entry);
  entries.delete(entry.key);
  // Never loaded, or refused: nothing worth keeping.
  if (entry.value() === UNSET) return;
  save(entry);
  // Last in the map is the most recently left.
  entries.set(entry.key, entry);
  const kept = [...entries.values()].filter((e) => !e.refs);
  for (const old of kept.slice(0, Math.max(0, kept.length - KEEP)))
    entries.delete(old.key);
}

/**
 * The live value of a topic, kept current. Pending until the first
 * snapshot (the nearest `<Loading>` waits for it), and again while new
 * `params` load. Subscribes while the calling scope lives.
 */
export function useTopic<T extends Topic>(
  topic: T,
  params: () => Topics[T]['params'],
): Accessor<Topics[T]['value']> {
  const entry = useEntry(topic, params);
  return createMemo(
    () => {
      const e = entry();
      const value = e.value();
      return value === UNSET ? e.first.promise : value;
    },
    { name: `topic:${topic}:value` },
  ) as Accessor<Topics[T]['value']>;
}

/**
 * Like `useTopic`, but undefined until the first snapshot instead of
 * pending, so nothing waits for it: the parts that read it appear when it
 * lands. For a page whose frame comes from other data (the session page).
 */
export function useTopicWhenReady<T extends Topic>(
  topic: T,
  params: () => Topics[T]['params'],
): Accessor<Topics[T]['value'] | undefined> {
  const entry = useEntry(topic, params);
  return createMemo(
    () => {
      const value = entry().value();
      return value === UNSET ? undefined : value;
    },
    { name: `topic:${topic}:ready` },
  ) as Accessor<Topics[T]['value'] | undefined>;
}

/**
 * Like `useTopic`, but pending until the server's own first snapshot: never
 * the copy saved on this device. For reads that must not show old data.
 * A reconnect doesn't pend it again: it keeps the last live value until
 * the next snapshot replaces it.
 */
export function useLiveTopic<T extends Topic>(
  topic: T,
  params: () => Topics[T]['params'],
): Accessor<Topics[T]['value']> {
  const entry = useEntry(topic, params);
  return createMemo(
    () => {
      const e = entry();
      const value = e.value();
      return e.live ? value : e.ready.promise;
    },
    { name: `topic:${topic}:live` },
  ) as Accessor<Topics[T]['value']>;
}

function useEntry(topic: Topic, params: () => unknown) {
  return createMemo(
    (): Pick<Entry, 'value' | 'first' | 'live' | 'ready'> => {
      const p = params();
      // Dev only: test data stands in without subscribing (lib/fixtures).
      const test = fixture(topic, p);
      if (test) {
        const first = Promise.withResolvers<unknown>();
        first.resolve(test.value);
        return { value: () => test.value, first, live: true, ready: first };
      }
      const e = acquire(topic, p);
      onCleanup(() => release(e));
      return e;
    },
    { name: `topic:${topic}` },
  );
}

/** One request, one reply. Waits through reconnects instead of failing. */
export function request<C extends Call>(
  call: C,
  args: Calls[C]['args'],
): Promise<Calls[C]['result']> {
  const test = testAnswer(call, args);
  if (test) return test;
  ensureConnected();
  // Unique, so a request re-sent after a reconnect is recognized.
  const message: ClientMessage = {
    type: 'request',
    id: requestId(),
    call,
    args,
  };
  return new Promise((resolve, reject) => {
    pending.set(message.id, {
      message,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    send(message);
  });
}

/** An id for a command, so a re-sent one is recognized. */
export function requestId() {
  // crypto.randomUUID needs a secure context; a LAN address is not one.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
