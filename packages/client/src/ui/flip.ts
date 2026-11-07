import { createEffect } from 'solid-js';

import { reducedMotion } from './motion';

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * Rows that glide to their new place when a list changes, after affectUI's
 * Agent Inbox (FLIP with WAAPI). Every element under `root()` with a
 * `data-flip` key is measured each time `track()` changes; one that moved
 * slides from where it was, and one that's new after the first paint fades
 * in. Tops are taken within the scrolled content, so scrolling moves
 * nothing. Give leaves keys, not their containers, or moves add up.
 * While `paused()`, and once more after, rows are only measured: a drag
 * animates the list itself.
 */
export function createFlip(
  root: () => HTMLElement | undefined,
  track: () => unknown,
  paused: () => boolean = () => false,
) {
  let tops = new Map<string, number>();
  let first = true;
  let wasPaused = false;
  createEffect(
    () => [track(), paused()] as const,
    ([, isPaused]) => {
      const el = root();
      if (!el) return;
      const base = el.getBoundingClientRect().top - el.scrollTop;
      const next = new Map<string, number>();
      const still = first || reducedMotion() || isPaused || wasPaused;
      wasPaused = isPaused;
      for (const row of el.querySelectorAll<HTMLElement>('[data-flip]')) {
        const key = row.dataset.flip!;
        // Hidden rows (a closed <details>) have no place, and a drag's
        // placeholder copies the rows' keys.
        if (!row.offsetParent || row.closest('[data-dnd-placeholder]'))
          continue;
        const top = row.getBoundingClientRect().top - base;
        next.set(key, top);
        if (still) continue;
        const was = tops.get(key);
        if (was === undefined)
          row.animate([{ opacity: 0, translate: '0 -4px' }, {}], {
            duration: 220,
            easing: EASE,
            delay: 60,
            fill: 'backwards',
          });
        else if (Math.abs(was - top) > 0.5)
          row.animate(
            [{ translate: `0 ${was - top}px` }, { translate: '0 0' }],
            {
              duration: 300,
              easing: EASE,
            },
          );
      }
      tops = next;
      first = false;
    },
  );
}
