import { For, createMemo, onSettled, untrack } from 'solid-js';

/**
 * A number whose changed digits roll in place, like a counter ticking. Up
 * rolls in from below, down from above, and the box glides to its new
 * width. Only the characters that changed move; the first value just shows.
 * Tabular figures keep the digits still. Instant under reduced motion.
 */
export function RollingNumber(props: {
  value: number;
  /** Turns the number into text, e.g. `(n) => `${n}%``. Default: as is. */
  format?: (n: number) => string;
  class?: string;
}) {
  const text = createMemo(() =>
    props.format ? props.format(props.value) : String(props.value),
  );
  // Keyed by place from the right plus the character, so a digit keeps its
  // node (and stays still) unless it changed.
  const chars = createMemo(() => {
    const t = text();
    return t.split('').map((ch, i) => ({ ch, key: `${t.length - i}:${ch}` }));
  });
  let last = untrack(() => props.value);
  const from = createMemo(() => {
    const up = props.value >= last;
    last = props.value;
    return up ? '60%' : '-60%';
  });

  // Nothing rolls on the first paint, and the width snaps until then.
  let ready = false;
  let outer: HTMLSpanElement;
  let inner: HTMLSpanElement;
  onSettled(() => {
    const fit = () => (outer.style.width = `${inner.offsetWidth}px`);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(inner);
    const id = requestAnimationFrame(() => (ready = true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(id);
    };
  });

  return (
    <span
      ref={(el) => (outer = el)}
      class={[
        'relative inline-block overflow-hidden align-bottom whitespace-nowrap tabular-nums morph',
        props.class,
      ]}
      style={{ '--roll-from': from() }}
    >
      <span class="sr-only">{text()}</span>
      <span
        ref={(el) => (inner = el)}
        class="inline-flex w-max"
        aria-hidden="true"
      >
        <For each={chars()} keyed={(c) => c.key}>
          {(c) => <span class={ready ? 'roll-in' : undefined}>{c().ch}</span>}
        </For>
      </span>
    </span>
  );
}
