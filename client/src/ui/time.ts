import { createEffect, createMemo, createSignal } from 'solid-js';

const units: [string, number][] = [
  ['d', 86_400_000],
  ['h', 3_600_000],
  ['m', 60_000],
];

// Shared by every label; without it "now" stays "now" until the data changes.
const [now, setNow] = createSignal(Date.now(), { name: 'clock' });
setInterval(() => setNow(Date.now()), 30_000);

/** Reactive: the time, updated every second, for running timers. */
const [tick, setTick] = createSignal(Date.now(), { name: 'tick' });
setInterval(() => setTick(Date.now()), 1000);
export { tick };

/** Reactive: milliseconds since `timestamp`, updated every second. */
export function elapsed(timestamp: number) {
  return Math.max(0, tick() - timestamp);
}

/** Reactive: re-reads as time passes. */
export function timeAgo(timestamp: number) {
  const diff = now() - timestamp;
  for (const [unit, ms] of units) {
    if (diff >= ms) return `${Math.floor(diff / ms)}${unit}`;
  }
  return 'now';
}

/** Reactive: like `timeAgo`, but a date once a month old: "Sep 3", "Sep 2025". */
export function age(timestamp: number) {
  if (now() - timestamp < 30 * 86_400_000) return timeAgo(timestamp);
  const date = new Date(timestamp);
  return date.toLocaleDateString(
    [],
    date.getFullYear() === new Date(now()).getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', year: 'numeric' },
  );
}

/** Reactive: "2h 10m", "3d 4h", "<1m" until `timestamp`; "now" once past. */
export function timeUntil(timestamp: number) {
  const diff = timestamp - now();
  if (diff <= 0) return 'now';
  const parts: string[] = [];
  let rest = diff;
  for (const [unit, ms] of units) {
    if (rest < ms && !parts.length) continue;
    parts.push(`${Math.floor(rest / ms)}${unit}`);
    rest %= ms;
    if (parts.length === 2) break;
  }
  return parts.join(' ') || '<1m';
}

/** Time of day; earlier days add the date. */
export function clockTime(timestamp: number) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

/**
 * Reactive: the time, ticking every `ms` while `on()` holds, for live
 * stopwatches. Off, it keeps the last value and costs nothing.
 */
export function createStopwatch(on: () => boolean, ms = 1000) {
  const [time, setTime] = createSignal(Date.now(), { name: 'stopwatch' });
  // A memo, so an `on` that reruns with the same answer (a streaming
  // message) doesn't restart the interval before it ever fires. No write
  // when it starts: that would rerun every reader a second time in the same
  // frame. Callers clamp at 0.
  const running = createMemo(on, { name: 'stopwatchOn' });
  createEffect(running, (running) => {
    if (!running) return;
    const id = setInterval(() => setTime(Date.now()), ms);
    return () => clearInterval(id);
  });
  return time;
}

/** How long, as every timer, countdown, and duration shows it: "42s", "3m 07s", "1h 05m". */
export function formatDuration(ms: number) {
  // Never "0s": anything that happened took some time.
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** A duration in its largest unit, for tight spots like a sidebar row: "42s", "3m", "1h". */
export function formatShort(ms: number) {
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

/**
 * A live timer like `formatDuration`, or nothing for the first 10s: most steps
 * end by then, and a count only helps once a wait gets long.
 */
export function formatLive(ms: number) {
  return ms < 10_000 ? undefined : formatDuration(ms);
}
