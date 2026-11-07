import {
  createEffect,
  createMemo,
  createSignal,
  onSettled,
  untrack,
} from 'solid-js';

// Pi Durable saves a partial reply every ~100 ms, so text lands in chunks of
// a few words. Revealing each chunk over the next frames reads as typing.
// The backlog drains in about DRAIN_MS, so the reveal speeds up when the
// model writes fast and never falls far behind; MAX_CHAR_MS sets the slowest
// pace. The numbers are assistant-ui's `useSmooth`.
const DRAIN_MS = 250;
const MAX_CHAR_MS = 5;
// More text than one save brings is a catch-up, such as a session opened
// mid-reply that its live copy then extends: it shows at once.
const JUMP_CHARS = 400;

/**
 * The part of `text` to show: all of it on mount or after a catch-up, so
 * history and switching sessions stay still, then text added later types in.
 * A tab in the background gets no frames and catches up at once when it's
 * back.
 */
export function createSmoothText(text: () => string) {
  const [revealed, setRevealed] = createSignal(untrack(text).length, {
    name: 'revealedChars',
  });
  let frame: number | undefined;
  let last = 0;
  let previous = untrack(text).length;
  let jumped = false;

  const tick = (now: number) => {
    frame = undefined;
    const at = untrack(revealed);
    const left = untrack(text).length - at;
    if (left <= 0) return;
    const perChar = Math.min(MAX_CHAR_MS, DRAIN_MS / left);
    const n = Math.min(left, Math.floor((now - last) / perChar));
    if (n > 0) {
      // Keeps the leftover time, so the pace doesn't depend on frame rate.
      last += n * perChar;
      setRevealed(at + n);
    }
    if (n < left) frame = requestAnimationFrame(tick);
  };

  createEffect(
    () => text().length,
    (length) => {
      jumped = length - previous > JUMP_CHARS;
      previous = length;
      if (jumped) {
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = undefined;
        setRevealed(length);
        return;
      }
      if (frame !== undefined || length <= untrack(revealed)) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    },
  );
  onSettled(() => () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
  });

  const shown = createMemo(() => text().slice(0, revealed()), {
    name: 'smoothText',
  });
  return {
    text: shown,
    // Whether the last growth was a catch-up, for anything else that animates.
    jumped: () => jumped,
  };
}
