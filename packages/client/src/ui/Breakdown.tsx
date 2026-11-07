import type { JSX } from '@solidjs/web';
import { For, Show, createMemo, createSignal } from 'solid-js';

import { createFlip } from './flip';
import { RollingNumber } from './RollingNumber';
import { Segmented, segmentClass } from './Segmented';

export interface BreakdownItem {
  id: string;
  label: string;
  value: number;
}

// Each part keeps its shade by where it first showed up, so a part that
// moves in the ranking keeps its color.
const SHADES = [
  'bg-accent',
  'bg-accent/60',
  'bg-accent/30',
  'bg-fg/45',
  'bg-fg/20',
];

/**
 * One total split into its parts, after affectUI's Compact Breakdown: the
 * total rolls, the bar glides to new widths, and the ranked rows slide to
 * their new places when `option` changes. Pointing at a part dims the rest
 * and rolls the big number to it. The bar is decorative; the list says it all.
 */
export function Breakdown(props: {
  title: string;
  items: BreakdownItem[];
  format: (n: number) => string;
  totalLabel: string;
  /** A switch in the head, e.g. periods or a measure; left out: none. */
  options?: { id: string; label: string }[];
  option?: string;
  onOption?: (id: string) => void;
  /** The line under the card; default: the largest part. */
  footer?: JSX.Element;
  /** More inside the card, under the rows (a sparkline). */
  children?: JSX.Element;
  class?: string;
}) {
  const [hot, setHot] = createSignal<string | null>(null, {
    name: 'breakdownHot',
  });
  const total = () => props.items.reduce((n, i) => n + i.value, 0);
  const ranked = createMemo(
    () => [...props.items].sort((a, b) => b.value - a.value),
    { name: 'breakdownRanked' },
  );
  // First-seen order, for stable shades and bar places.
  const order: string[] = [];
  const placed = createMemo(
    () => {
      for (const i of ranked()) if (!order.includes(i.id)) order.push(i.id);
      return [...props.items].sort(
        (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
      );
    },
    { name: 'breakdownPlaced' },
  );
  const shade = (id: string) => SHADES[order.indexOf(id) % SHADES.length]!;
  const hotItem = () => props.items.find((i) => i.id === hot());
  const share = (n: number) => {
    const t = total();
    if (!t) return '0%';
    const p = (n / t) * 100;
    return `${p > 0 && p < 1 ? '<1' : Math.round(p)}%`;
  };

  // Rows slide from where they were to their new rank.
  let list: HTMLUListElement | undefined = undefined;
  createFlip(
    () => list,
    () =>
      ranked()
        .map((i) => i.id)
        .join(),
  );

  return (
    <div
      class={['relative flex flex-col', props.class]}
      role="group"
      aria-label={props.title}
    >
      <div class="rounded-sheet border border-line bg-surface px-3.5 pt-2.5 pb-2">
        <div class="flex min-h-7 items-center gap-2.5">
          <h3 class="min-w-0 flex-1 truncate font-medium">{props.title}</h3>
          <Show when={props.options}>
            {(options) => (
              <Segmented>
                <For each={options()}>
                  {(o) => (
                    <button
                      type="button"
                      class={segmentClass}
                      data-on={props.option === o.id || undefined}
                      aria-pressed={props.option === o.id ? 'true' : 'false'}
                      onClick={() => props.onOption?.(o.id)}
                    >
                      {o.label}
                    </button>
                  )}
                </For>
              </Segmented>
            )}
          </Show>
        </div>
        <div class="mt-2" aria-hidden="true">
          <RollingNumber
            value={hotItem()?.value ?? total()}
            format={props.format}
            class="text-display font-semibold"
          />
          <p class="truncate text-meta text-muted tabular-nums">
            <For each={[hotItem()?.label ?? props.totalLabel]}>
              {(label) => (
                <span class="appear inline-block">
                  {label}
                  <Show when={hotItem()}>
                    {(i) => <> · {share(i().value)}</>}
                  </Show>
                </span>
              )}
            </For>
          </p>
        </div>
        <p class="sr-only">
          {props.totalLabel}: {props.format(total())}
        </p>
        <div
          class="mt-2.5 flex h-2 gap-0.5"
          data-hot={hot() ? '' : undefined}
          aria-hidden="true"
        >
          <For each={placed()} keyed={(i) => i.id}>
            {(i) => (
              <span
                class={[
                  'h-full min-w-0.5 rounded-cell transition-[opacity,scale] duration-200 first:rounded-l-full last:rounded-r-full motion-safe:transition-[width,opacity,scale] motion-safe:duration-300 motion-safe:ease-out',
                  shade(i().id),
                  hot() && hot() !== i().id && 'opacity-25',
                  hot() === i().id && 'motion-safe:scale-y-150',
                ]}
                style={{
                  width: `${total() ? (i().value / total()) * 100 : 0}%`,
                }}
                onPointerEnter={() => setHot(i().id)}
                onPointerLeave={() => setHot(null)}
              />
            )}
          </For>
        </div>
        <ul
          ref={(el) => (list = el)}
          class="mt-1.5 flex flex-col"
          onPointerLeave={() => setHot(null)}
        >
          <For each={ranked()} keyed={(i) => i.id}>
            {(i) => (
              <li
                data-flip={i().id}
                tabindex="0"
                class={[
                  '-mx-2 flex h-8 items-center gap-2.5 rounded-lg px-2 outline-offset-0 transition-[background-color,opacity] duration-150 touch:h-10',
                  hot() === i().id && 'bg-hover',
                  hot() && hot() !== i().id && 'opacity-45',
                ]}
                onPointerEnter={() => setHot(i().id)}
                onFocus={() => setHot(i().id)}
                onBlur={() => setHot(null)}
              >
                <span class={['size-2 shrink-0 rounded-cell', shade(i().id)]} />
                <span class="min-w-0 flex-1 truncate">{i().label}</span>
                <RollingNumber
                  value={i().value}
                  format={props.format}
                  class="font-medium"
                />
                <span class="w-9 shrink-0 text-right text-meta text-muted tabular-nums max-[22rem]:hidden">
                  {share(i().value)}
                </span>
              </li>
            )}
          </For>
        </ul>
        <Show when={props.children}>
          <div class="mt-1.5 border-t border-line pt-2.5 pb-1">
            {props.children}
          </div>
        </Show>
      </div>
      <div class="flex min-h-8 items-center px-3 pt-1 text-meta text-muted">
        <Show
          when={props.footer}
          fallback={
            <Show when={ranked()[0]}>
              {(top) => (
                <span class="truncate">
                  Largest: <span class="text-fg">{top().label}</span>
                </span>
              )}
            </Show>
          }
        >
          {props.footer}
        </Show>
      </div>
    </div>
  );
}
