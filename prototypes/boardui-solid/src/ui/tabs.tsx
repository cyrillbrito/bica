// Ports of BoardUI's tabs/tabs.tsx (underline) and tabs/pill-tab.tsx (MIT).
// React Aria's Tabs collection became a data-driven list with the ARIA tabs
// keyboard pattern done by hand: arrows move and select, Home and End jump,
// and only the selected tab is in the Tab order.
import { For, Show, createEffect, createSignal, onSettled } from 'solid-js';

import { cx } from './cx';
import { Glyph, type IconComponent } from './icon';

export type TabItem = {
  id: string;
  label: string;
  icon?: IconComponent;
  count?: number;
  disabled?: boolean;
};

type Box = { left: number; top: number; width: number; height: number };

/** Measures the selected tab so an indicator can glide under it. The
 * ResizeObserver keeps it right when fonts load or the row reflows. */
function createIndicator(selected: () => string) {
  let list!: HTMLElement;
  const [box, setBox] = createSignal<Box | null>(null);
  const measure = () => {
    const el = list.querySelector<HTMLElement>('[aria-selected=true]');
    if (el)
      setBox({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
  };
  onSettled(() => {
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  });
  // Re-measure after the DOM has the new aria-selected.
  createEffect(selected, () => queueMicrotask(measure), { defer: true });
  return { ref: (el: HTMLElement) => (list = el), box };
}

function onTabKey(
  e: KeyboardEvent,
  items: TabItem[],
  selected: string,
  select: (id: string) => void,
) {
  const enabled = items.filter((t) => !t.disabled);
  const at = enabled.findIndex((t) => t.id === selected);
  let next = -1;
  if (e.key === 'ArrowRight') next = (at + 1) % enabled.length;
  else if (e.key === 'ArrowLeft')
    next = (at - 1 + enabled.length) % enabled.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = enabled.length - 1;
  if (next < 0) return;
  e.preventDefault();
  select(enabled[next].id);
  const list = e.currentTarget as HTMLElement;
  requestAnimationFrame(() =>
    list.querySelector<HTMLElement>('[aria-selected=true]')?.focus(),
  );
}

export function Tabs(props: {
  items: TabItem[];
  selected: string;
  onSelect: (id: string) => void;
  'aria-label': string;
  class?: string;
}) {
  const indicator = createIndicator(() => props.selected);
  return (
    <div class={cx('relative w-full', props.class)}>
      <div
        ref={indicator.ref}
        role="tablist"
        aria-label={props['aria-label']}
        onKeyDown={(e) =>
          onTabKey(e, props.items, props.selected, props.onSelect)
        }
        class="flex w-full items-center gap-1 overflow-x-auto border-b border-separator-border [scrollbar-width:none]"
      >
        <For each={props.items}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab.id === props.selected ? 'true' : 'false'}
              tabindex={tab.id === props.selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => props.onSelect(tab.id)}
              class={cx(
                'relative inline-flex cursor-pointer items-center gap-2.5 px-2.5 py-2 whitespace-nowrap',
                'outline-none transition-colors duration-150 ease',
                'focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                tab.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <span
                class={cx(
                  'inline-flex items-center gap-1.5',
                  tab.id === props.selected
                    ? 'text-body-medium text-accent-600'
                    : 'text-body-regular text-text-primary',
                )}
              >
                <Glyph of={tab.icon} class="size-4 shrink-0" />
                {tab.label}
              </span>
              <Show when={tab.count != null}>
                <span
                  class={cx(
                    'inline-flex items-center justify-center rounded-sm px-1 py-px text-caption-1-medium whitespace-nowrap',
                    tab.id === props.selected
                      ? 'bg-tab-count-selected-background text-accent-600'
                      : 'bg-black/10 text-text-primary opacity-50 dark:bg-white/15',
                  )}
                >
                  {tab.count}
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>
      <Show when={indicator.box()}>
        {(box) => (
          <span
            aria-hidden="true"
            class="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-accent-600 transition-[transform,width] duration-200 ease"
            style={{
              transform: `translateX(${box().left}px)`,
              width: `${box().width}px`,
            }}
          />
        )}
      </Show>
    </div>
  );
}

const pill = {
  radius: { blue: 'rounded-full', gray: 'rounded-2lg' },
  thumb: {
    blue: 'bg-pill-tab-blue-selected-background',
    gray: 'bg-background-tertiary-default',
  },
  hover: {
    blue: 'bg-pill-tab-blue-hover-background',
    gray: 'bg-background-primary-hover',
  },
  selectedIcon: {
    blue: 'text-accent-500',
    gray: 'text-foreground-icon-primary',
  },
  selectedLabel: { blue: 'text-accent-500', gray: 'text-text-primary' },
};

export function PillTabs(props: {
  items: TabItem[];
  selected: string;
  onSelect: (id: string) => void;
  variant?: 'blue' | 'gray';
  'aria-label': string;
  class?: string;
}) {
  const variant = () => props.variant ?? 'blue';
  const indicator = createIndicator(() => props.selected);
  return (
    <div
      ref={indicator.ref}
      role="tablist"
      aria-label={props['aria-label']}
      onKeyDown={(e) =>
        onTabKey(e, props.items, props.selected, props.onSelect)
      }
      class={cx('relative inline-flex items-center gap-1', props.class)}
    >
      <Show when={indicator.box()}>
        {(box) => (
          <span
            aria-hidden="true"
            class={cx(
              'pointer-events-none absolute left-0 top-0',
              'transition-[transform,width,height] duration-300 [transition-timing-function:cubic-bezier(0.34,1.2,0.64,1)]',
              pill.radius[variant()],
              pill.thumb[variant()],
            )}
            style={{
              transform: `translate(${box().left}px, ${box().top}px)`,
              width: `${box().width}px`,
              height: `${box().height}px`,
            }}
          />
        )}
      </Show>
      <For each={props.items}>
        {(tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab.id === props.selected ? 'true' : 'false'}
            tabindex={tab.id === props.selected ? 0 : -1}
            onClick={() => props.onSelect(tab.id)}
            class={cx(
              'group relative z-10 flex shrink-0 cursor-pointer items-center gap-1 px-2 py-[5px]',
              pill.radius[variant()],
              'outline-none transition-colors duration-150 ease focus-visible:ring-2 focus-visible:ring-border-focus-ring',
            )}
          >
            <span
              aria-hidden="true"
              class={cx(
                'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 ease-out',
                pill.radius[variant()],
                pill.hover[variant()],
                tab.id !== props.selected && 'group-hover:opacity-100',
              )}
            />
            <Glyph
              of={tab.icon}
              class={cx(
                'relative z-10 size-5 shrink-0',
                tab.id === props.selected
                  ? pill.selectedIcon[variant()]
                  : 'text-foreground-icon-secondary',
              )}
            />
            <span
              class={cx(
                'relative z-10 text-body-medium whitespace-nowrap',
                tab.id === props.selected
                  ? pill.selectedLabel[variant()]
                  : 'text-text-secondary',
              )}
            >
              {tab.label}
            </span>
          </button>
        )}
      </For>
    </div>
  );
}
