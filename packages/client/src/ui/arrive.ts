import { createEffect } from 'solid-js';

/**
 * Marks text the fast model just wrote (a session title, a commit message):
 * it fades in tinted with the accent, then settles to its own colour. Without
 * it the swap is instant and easy to miss. Colour and opacity only, so it
 * stays under reduced motion.
 */
export function arrive(el: HTMLElement) {
  el.animate(
    [
      { opacity: 0, color: 'var(--color-accent)' },
      { opacity: 1, color: 'var(--color-accent)', offset: 0.2 },
      {},
    ],
    { duration: 1200, easing: 'ease-out' },
  );
}

/**
 * A ref that plays `arrive` when `text` changes while `key` stays the same,
 * so mounting and switching sessions stay still.
 */
export function createArrival(
  text: () => string | undefined,
  key: () => string = () => '',
) {
  let el: HTMLElement | undefined;
  let last: { key: string; text: string | undefined } | undefined;
  createEffect(
    () => ({ key: key(), text: text() }),
    (now) => {
      if (
        el?.isConnected &&
        last?.key === now.key &&
        last.text &&
        now.text &&
        last.text !== now.text
      )
        arrive(el);
      last = now;
    },
  );
  return (next: HTMLElement) => {
    el = next;
  };
}
