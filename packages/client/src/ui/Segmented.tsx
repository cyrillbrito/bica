import type { JSX } from '@solidjs/web';
import { onSettled } from 'solid-js';

import { RollingNumber } from './RollingNumber';

/**
 * A row of mutually exclusive options; the current one carries `data-on`.
 * A raised thumb glides to it, stretching a little on the way, and sinks
 * while pressed. Options are plain buttons or links with `segmentClass`, so
 * each caller keeps its own semantics (`aria-pressed`, `href`).
 */
export function Segmented(props: { children: JSX.Element; class?: string }) {
  let track: HTMLDivElement;
  let thumb: HTMLSpanElement;

  onSettled(() => {
    let placed = false;
    const place = () => {
      const on = track.querySelector<HTMLElement>(':scope > [data-on]');
      if (!on || !on.offsetWidth) {
        thumb.style.opacity = '0';
        placed = false;
        return;
      }
      const left = on.offsetLeft;
      const right = track.clientWidth - left - on.offsetWidth;
      const prev = parseFloat(thumb.style.left);
      if (!placed) {
        // Lands without moving the first time, and after being hidden.
        thumb.style.transition = 'none';
        thumb.dataset.dir = '';
      } else if (left !== prev) {
        thumb.dataset.dir = left > prev ? 'right' : 'left';
      }
      thumb.style.left = `${left}px`;
      thumb.style.right = `${right}px`;
      thumb.style.opacity = '1';
      if (!placed) {
        void thumb.offsetWidth;
        thumb.style.transition = '';
        placed = true;
        track.dataset.ready = '';
      }
    };
    place();
    const mo = new MutationObserver(place);
    mo.observe(track, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-on'],
    });
    // Labels, counts and fonts change widths; place again a frame later.
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    });
    ro.observe(track);
    return () => {
      mo.disconnect();
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  });

  return (
    <div
      ref={(el) => (track = el)}
      class={[
        'group/seg relative flex shrink-0 rounded-lg bg-active p-0.5 text-meta',
        props.class,
      ]}
    >
      <span
        ref={(el) => (thumb = el)}
        aria-hidden="true"
        class="glide pointer-events-none absolute inset-y-0.5 left-0 right-full rounded-md bg-thumb opacity-0 shadow-thumb group-has-[>[data-on]:active]/seg:motion-safe:scale-97"
      />
      {props.children}
    </div>
  );
}

// Until the thumb has landed, the picked option paints its own fill, so the
// first paint is right even before any script measures.
export const segmentClass =
  'group/segment relative inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-0.5 text-fg/65 transition-colors hover:text-fg data-on:bg-thumb data-on:text-fg group-data-ready/seg:data-on:bg-transparent touch:px-3 touch:py-1.5';

/** A small count after a segment's label, e.g. how many files changed. */
export function SegmentCount(props: { value: number }) {
  return (
    <span class="rounded-full bg-hover px-1.5 font-medium text-muted group-data-on/segment:text-fg">
      <RollingNumber value={props.value} />
    </span>
  );
}
