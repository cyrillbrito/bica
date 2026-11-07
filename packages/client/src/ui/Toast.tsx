import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  createStore,
  flush,
  onSettled,
} from 'solid-js';

import { Button } from './Button';
import { CloseIcon } from './icons';
import { errorText } from './errors';

// Short messages for actions with nothing else to show for them (a copy from
// a menu that has already closed), and background work you want to hear back
// from (toast.promise). Up to three stack at the top; the ones behind peek
// out and fan into a list on hover, focus, or a tap. After affectUI's Toaster.

export type ToastKind = 'default' | 'success' | 'error' | 'info' | 'loading';
type Message = string | { title: string; description?: string };

export type ToastOptions = {
  /** Pass an existing id to update that toast in place; its timer restarts. */
  id?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  /** Milliseconds on screen; `Infinity` keeps it until dismissed. */
  duration?: number;
};

type Item = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  action?: ToastOptions['action'];
  duration: number;
  /** Bumps on every update in place, so the text rolls in again. */
  version: number;
  height: number;
  leaving?: 'fade' | 'left' | 'right' | 'up';
};

const MAX = 3;
const GAP = 8;
// Behind the front toast: how far each one peeks out, and how much smaller.
const PEEK = 8;
const SHRINK = 0.05;
const LEAVE_MS = 200;
const DURATION: Record<ToastKind, number> = {
  default: 2500,
  success: 2500,
  info: 4000,
  error: 6000,
  loading: Infinity,
};

const [state, setState] = createStore<{ items: Item[] }>({ items: [] });
let next = 0;

// Timers pause while the stack is open or the tab is hidden, so nothing
// vanishes mid-read. Each remembers how much time it had left.
const timers = new Map<
  string,
  { left: number; at: number; handle?: ReturnType<typeof setTimeout> }
>();
let paused = false;

function arm(id: string, ms: number) {
  const old = timers.get(id);
  clearTimeout(old?.handle);
  if (ms === Infinity) return void timers.delete(id);
  const t: {
    left: number;
    at: number;
    handle?: ReturnType<typeof setTimeout>;
  } = { left: ms, at: Date.now() };
  if (!paused) t.handle = setTimeout(() => dismiss(id), ms);
  timers.set(id, t);
}

function pause(on: boolean) {
  if (on === paused) return;
  paused = on;
  for (const [id, t] of timers) {
    if (on) {
      clearTimeout(t.handle);
      t.left -= Date.now() - t.at;
    } else {
      t.at = Date.now();
      t.handle = setTimeout(() => dismiss(id), Math.max(t.left, 800));
    }
  }
}

function show(kind: ToastKind, message: Message, options: ToastOptions = {}) {
  const m = typeof message === 'string' ? { title: message } : message;
  const fields = {
    kind,
    title: m.title,
    description: options.description ?? m.description,
    action: options.action,
    duration: options.duration ?? DURATION[kind],
  };
  const front = state.items.find((t) => !t.leaving);
  // The same message again ("Copied" twice) refreshes the front one instead
  // of stacking a copy behind it.
  const id =
    options.id ??
    (front && front.title === m.title && front.kind === kind
      ? front.id
      : undefined);
  const existing = id && state.items.find((t) => t.id === id && !t.leaving);
  if (existing) {
    setState((s) => {
      const t = s.items.find((x) => x.id === id)!;
      Object.assign(t, fields);
      t.version++;
    });
    flush();
    arm(id, fields.duration);
    return id;
  }
  const fresh: Item = {
    ...fields,
    // An id still on its way out can't be reused: the list is keyed by it.
    id: id && !state.items.some((t) => t.id === id) ? id : `t${++next}`,
    version: 0,
    height: 0,
  };
  // Beyond three, the oldest goes.
  const older = state.items.filter((t) => !t.leaving).slice(MAX - 1);
  setState((s) => {
    s.items.unshift(fresh);
  });
  flush();
  for (const t of older) dismiss(t.id);
  arm(fresh.id, fresh.duration);
  return fresh.id;
}

function dismiss(id?: string, way: Item['leaving'] = 'fade') {
  if (id === undefined) {
    for (const t of state.items) dismiss(t.id);
    return;
  }
  clearTimeout(timers.get(id)?.handle);
  timers.delete(id);
  setState((s) => {
    const t = s.items.find((x) => x.id === id);
    if (t && !t.leaving) t.leaving = way;
  });
  setTimeout(
    () =>
      setState((s) => {
        s.items = s.items.filter((x) => x.id !== id);
      }),
    LEAVE_MS,
  );
}

type Settle<T> = Message | ((value: T) => Message);
function settle<T>(m: Settle<T>, v: T) {
  return typeof m === 'function' ? m(v) : m;
}

/** Shows a short message. Returns its id, for updating or dismissing it. */
export function toast(message: Message, options?: ToastOptions) {
  return show('default', message, options);
}

/** A spinner that turns into a check or a cross when the work ends. */
function promise<T>(
  work: Promise<T> | (() => Promise<T>),
  messages: {
    loading: Message;
    success: Settle<T>;
    error: Settle<unknown>;
  },
  options?: ToastOptions,
): Promise<T> {
  const id = show('loading', messages.loading, options);
  const p = typeof work === 'function' ? work() : work;
  p.then(
    (v) => show('success', settle(messages.success, v), { id }),
    (e: unknown) => show('error', settle(messages.error, e), { id }),
  );
  return p;
}

/** A failure. Takes a message, or whatever was thrown. */
function fail(m: unknown, o?: ToastOptions) {
  const message =
    typeof m === 'string' ||
    (typeof m === 'object' && m !== null && 'title' in m)
      ? (m as Message)
      : errorText(m);
  return show('error', message, o);
}

function kind(k: ToastKind) {
  return function (m: Message, o?: ToastOptions) {
    return show(k, m, o);
  };
}

toast.success = kind('success');
toast.error = fail;
toast.info = kind('info');
toast.loading = kind('loading');
toast.promise = promise;
/** Closes one toast, or all of them without an id. */
toast.dismiss = dismiss;

/** Mounted once in App. */
export default function Toaster() {
  const [hover, setHover] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const [tapped, setTapped] = createSignal(false);
  const [hidden, setHidden] = createSignal(false);
  const live = createMemo(() => state.items.filter((t) => !t.leaving));
  const open = createMemo(
    () => live().length > 1 && (hover() || focused() || tapped()),
  );
  createEffect(
    () => open() || hidden(),
    (p) => pause(p),
  );
  // The stack closes again once only one toast is left.
  createEffect(
    () => live().length,
    (n) => {
      if (n < 2) setTapped(false);
    },
  );
  onSettled(() => {
    const vis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  });

  // Where each live toast sits; a leaving one keeps its last place.
  const last = new Map<string, { i: number; y: number }>();
  const layout = createMemo(() => {
    const out = new Map<string, { i: number; y: number }>();
    let y = 0;
    live().forEach((t, i) => {
      out.set(t.id, { i, y });
      y += t.height + GAP;
    });
    for (const [id, p] of out) last.set(id, p);
    return out;
  });
  const frontHeight = () => live()[0]?.height ?? 0;
  const stackHeight = () => {
    const n = live().length;
    if (!n) return 0;
    return open()
      ? live().reduce((h, t) => h + t.height, 0) + GAP * (n - 1)
      : frontHeight() + PEEK * (n - 1);
  };

  const newest = createMemo(() => live()[0]);

  return (
    <section
      aria-label="Notifications"
      class="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 z-50 w-[min(356px,calc(100vw-1.5rem))] -translate-x-1/2"
    >
      {/* Read out once per new or changed message; errors interrupt. */}
      <div class="sr-only" role="status">
        <Show when={newest()?.kind !== 'error' && newest()}>
          {(t) => (
            <>
              {t().title}. {t().description}
            </>
          )}
        </Show>
      </div>
      <div class="sr-only" role="alert">
        <Show when={newest()?.kind === 'error' && newest()}>
          {(t) => (
            <>
              {t().title}. {t().description}
            </>
          )}
        </Show>
      </div>
      <ol
        class="relative duration-200 ease-out motion-safe:transition-[height]"
        style={{
          height: `${stackHeight()}px`,
          'pointer-events': live().length ? 'auto' : 'none',
        }}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
        onFocusIn={() => setFocused(true)}
        onFocusOut={(e) =>
          !e.currentTarget.contains(e.relatedTarget as Node) &&
          setFocused(false)
        }
      >
        <For each={state.items} keyed={(t) => t.id}>
          {(t) => (
            <Card
              item={t()}
              pos={
                (t().leaving ? last.get(t().id) : layout().get(t().id)) ?? {
                  i: 0,
                  y: 0,
                }
              }
              open={open()}
              frontHeight={frontHeight()}
              count={live().length}
              onTap={() => setTapped((v) => !v)}
            />
          )}
        </For>
      </ol>
    </section>
  );
}

function Card(props: {
  item: Item;
  pos: { i: number; y: number };
  open: boolean;
  frontHeight: number;
  count: number;
  onTap: () => void;
}) {
  // Enters from the top edge a frame after it's placed above it.
  const [entered, setEntered] = createSignal(false);
  const [drag, setDrag] = createSignal<{ x: number; y: number } | null>(null);
  let body: HTMLDivElement;

  onSettled(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
    const ro = new ResizeObserver(() => {
      const h = body.offsetHeight;
      setState((s) => {
        const t = s.items.find((x) => x.id === props.item.id);
        if (t && t.height !== h) t.height = h;
      });
    });
    ro.observe(body);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  });

  const behind = () => !props.open && props.pos.i > 0;
  const transform = () => {
    const { i, y } = props.pos;
    if (!entered()) return 'translateY(-100%)';
    const out = props.item.leaving === 'fade' ? -6 : 0;
    if (props.open) return `translateY(${y + out}px)`;
    return `translateY(${i * PEEK + out}px) scale(${1 - i * SHRINK})`;
  };
  const swipe = () => {
    const way = props.item.leaving;
    if (way === 'left') return 'translateX(-110%)';
    if (way === 'right') return 'translateX(110%)';
    if (way === 'up') return 'translateY(-120%)';
    const d = drag();
    return d ? `translate(${d.x}px, ${d.y}px)` : 'none';
  };

  // Swipe sideways or up to dismiss; a short swipe springs back. Starts
  // after a few pixels, so taps on the buttons still land.
  let start: { x: number; y: number; t: number; id: number } | undefined;
  let moved = false;
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || props.item.leaving) return;
    start = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    moved = false;
  };
  const move = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!moved) {
      if (Math.hypot(dx, dy) < 6) return;
      moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    // Down pulls against a rubber band: there is nowhere to go.
    setDrag({ x: dx, y: dy < 0 ? dy : dy * 0.2 });
  };
  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const d = drag();
    const ms = Math.max(1, Date.now() - start.t);
    start = undefined;
    setDrag(null);
    if (!moved) {
      if (!(e.target as Element).closest('button') && props.count > 1)
        props.onTap();
      return;
    }
    if (!d) return;
    const fast = Math.hypot(d.x, d.y) / ms > 0.5;
    if (Math.abs(d.x) > 80 || (fast && Math.abs(d.x) > Math.abs(d.y)))
      dismiss(props.item.id, d.x < 0 ? 'left' : 'right');
    else if (d.y < -30 || (fast && d.y < 0)) dismiss(props.item.id, 'up');
  };

  return (
    <li
      tabindex="0"
      aria-label={props.item.title}
      class={[
        'absolute inset-x-0 top-0 origin-bottom outline-none',
        'transition-[opacity] motion-safe:transition-[transform,opacity,height]',
        'duration-300 ease-out data-leaving:duration-200',
        'touch-none select-none',
      ]}
      data-leaving={props.item.leaving}
      style={{
        transform: transform(),
        opacity: entered() && !props.item.leaving ? 1 : 0,
        // Behind the front one, all take its height so they peek out evenly.
        height: !props.item.height
          ? undefined
          : `${props.open || props.pos.i === 0 || !props.frontHeight ? props.item.height : props.frontHeight}px`,
        'z-index': props.count - props.pos.i,
        'pointer-events': props.item.leaving ? 'none' : undefined,
      }}
      onKeyDown={(e) => e.key === 'Escape' && dismiss(props.item.id)}
    >
      <div
        class={[
          'group/toast relative h-full',
          drag()
            ? 'transition-none'
            : 'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-spring',
        ]}
        style={{ transform: swipe() }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          start = undefined;
          setDrag(null);
        }}
      >
        <div class="h-full overflow-hidden rounded-card border border-line bg-surface shadow-menu in-focus-visible:outline-2 in-focus-visible:outline-accent">
          <div
            ref={(el) => (body = el)}
            class={[
              'flex items-start gap-2.5 py-2.5 pr-2.5 pl-3 transition-opacity duration-200',
              behind() && 'opacity-0',
            ]}
          >
            <Show when={props.item.kind !== 'default'}>
              <StatusIcon kind={props.item.kind} />
            </Show>
            <Show when={props.item.version + 1} keyed>
              {(v) => (
                <div
                  class={[
                    'w-full min-w-0 flex-1 [--roll-from:4px]',
                    v > 1 && 'roll-in',
                  ]}
                >
                  <div class="font-medium break-words text-fg">
                    {props.item.title}
                  </div>
                  <Show when={props.item.description}>
                    <div class="text-meta break-words text-muted">
                      {props.item.description}
                    </div>
                  </Show>
                </div>
              )}
            </Show>
            <Show when={props.item.action}>
              {(a) => (
                <Button
                  size="sm"
                  variant="soft"
                  class="-my-0.5 self-center"
                  onClick={() => {
                    a().onClick();
                    dismiss(props.item.id);
                  }}
                >
                  {a().label}
                </Button>
              )}
            </Show>
          </div>
        </div>
        <Show when={!behind()}>
          <CloseButton onClick={() => dismiss(props.item.id)} />
        </Show>
      </div>
    </li>
  );
}

function CloseButton(props: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Dismiss"
      aria-label="Dismiss notification"
      class="absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-muted opacity-0 shadow-menu transition-[opacity,color] group-hover/toast:opacity-100 group-focus-within/toast:opacity-100 hover:text-fg touch:size-6 touch:opacity-100 [&_svg]:size-3 before:absolute before:-inset-2"
      onClick={() => props.onClick()}
    >
      <CloseIcon />
    </button>
  );
}

/** A spinning arc that closes into a ring as a check, cross or dot draws in. */
function StatusIcon(props: { kind: ToastKind }) {
  const tone = () =>
    props.kind === 'success'
      ? 'text-running'
      : props.kind === 'error'
        ? 'text-danger'
        : props.kind === 'info'
          ? 'text-fg'
          : 'text-muted';
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      class={[
        'mt-0.5 size-4 shrink-0 fill-none stroke-current stroke-2 transition-colors duration-300 [stroke-linecap:round] [stroke-linejoin:round]',
        tone(),
      ]}
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        pathLength="1"
        class={[
          'origin-center transition-[stroke-dasharray,stroke-opacity] duration-500 ease-out [transform-box:fill-box]',
          props.kind === 'loading'
            ? 'animate-spin [stroke-dasharray:0.28_0.72]'
            : '[stroke-dasharray:1_0] [stroke-opacity:0.3]',
        ]}
      />
      <Show when={props.kind === 'success'}>
        <path d="M7.5 12.5l3 3 6-6.5" pathLength="1" class="draw" />
      </Show>
      <Show when={props.kind === 'error'}>
        <path d="M9 9l6 6M15 9l-6 6" pathLength="1" class="draw" />
      </Show>
      <Show when={props.kind === 'info'}>
        <path d="M12 11v5M12 8h.01" />
      </Show>
    </svg>
  );
}
