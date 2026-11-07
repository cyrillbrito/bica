import { For, Show, createMemo } from 'solid-js';

import { RollingNumber } from './RollingNumber';

// Past this many parts a segment stands for several, or they'd vanish.
const MAX = 24;
const R = 12.5;
const C = 16;

function point(deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(C + R * Math.cos(a)).toFixed(2)} ${(C + R * Math.sin(a)).toFixed(2)}`;
}

/**
 * A ring of one segment per part, the done ones filled, with a number in the
 * middle (affectUI's Project Card). `hot` lifts one segment, for a row the
 * pointer is on elsewhere; `onHot` reports the segment under the pointer.
 * Newly done segments fill one after another.
 */
export function ProgressRing(props: {
  total: number;
  done: number;
  // The number in the middle; default: what's left.
  value?: number;
  hot?: number;
  onHot?: (index: number | undefined) => void;
  label: string;
  class?: string;
}) {
  const count = () => Math.min(Math.max(props.total, 1), MAX);
  // Round caps need room between segments; many thin ones get square ends.
  const round = () => count() <= 12;
  const segments = createMemo(() => {
    const n = count();
    if (n === 1) return [{ d: '', i: 0 }];
    const step = 360 / n;
    const gap = round() ? Math.min(20, step * 0.5) : Math.min(4, step * 0.3);
    return Array.from({ length: n }, (_, i) => {
      const from = i * step + gap / 2;
      const to = (i + 1) * step - gap / 2;
      return {
        d: `M ${point(from)} A ${R} ${R} 0 0 1 ${point(to)}`,
        i,
      };
    });
  });
  // Scaled when one segment stands for several parts.
  const filled = () =>
    props.total <= MAX
      ? props.done
      : Math.round((props.done / props.total) * MAX);
  const hot = () =>
    props.hot === undefined
      ? undefined
      : props.total <= MAX
        ? props.hot
        : Math.floor((props.hot / props.total) * MAX);

  return (
    <span
      class={['relative grid size-8 shrink-0 place-items-center', props.class]}
      role="img"
      aria-label={props.label}
      title={props.label}
    >
      <svg
        viewBox="0 0 32 32"
        class="absolute inset-0 size-8 overflow-visible"
        fill="none"
        aria-hidden="true"
        onPointerLeave={() => props.onHot?.(undefined)}
      >
        <For each={segments()}>
          {(s) => {
            const on = () => s.i < filled();
            const lit = () => hot() === s.i;
            const cls = () => [
              'transition-[stroke,stroke-width,opacity] duration-300 ease-out',
              on() ? 'stroke-fg' : 'stroke-line-strong',
              lit() && 'stroke-[4.5]',
              hot() !== undefined && !lit() && 'opacity-40',
            ];
            return (
              <Show
                when={s.d}
                fallback={
                  <circle cx={C} cy={C} r={R} stroke-width="3" class={cls()} />
                }
              >
                <path
                  d={s.d}
                  stroke-width="3"
                  stroke-linecap={round() ? 'round' : 'butt'}
                  class={cls()}
                  style={{ 'transition-delay': on() ? `${s.i * 40}ms` : '0ms' }}
                  onPointerEnter={() =>
                    props.onHot?.(
                      props.total <= MAX
                        ? s.i
                        : Math.floor((s.i / MAX) * props.total),
                    )
                  }
                />
              </Show>
            );
          }}
        </For>
      </svg>
      <RollingNumber
        value={props.value ?? props.total - props.done}
        class="relative text-meta leading-none font-semibold"
      />
    </span>
  );
}
