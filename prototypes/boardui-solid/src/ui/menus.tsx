// Ports of BoardUI's dropdown/dropdown.tsx, dropdown/menu-styles.ts and
// select/select.tsx (MIT). React Aria's Popover, Dialog, and ListBox became the
// native `popover` attribute: the browser gives light dismiss, Escape, the top
// layer, and focus return for free. Placement is a small function below, and
// arrow keys move between rows.
import type { JSX } from '@solidjs/web';
import {
  For,
  Show,
  createContext,
  createSignal,
  createUniqueId,
  useContext,
} from 'solid-js';

import { ChevronDownSmall } from './chevrons';
import { cx } from './cx';
import { Glyph, type IconComponent } from './icon';

/* ------------------------------------------------------------ menu styles */

export const MENU_POPOVER_SURFACE = [
  'bui-pop m-0 max-w-[calc(100vw-32px)] overflow-y-auto',
  'rounded-2xl border border-border-button-default bg-background-primary-default p-2.5 shadow-dropdown text-text-primary',
].join(' ');
export const MENU_POPOVER_WIDTH = 'w-[266px]';
export const MENU_ITEM = [
  'flex w-full cursor-pointer items-center gap-2 rounded-2lg p-2 text-start',
  'text-text-primary outline-none transition-colors',
].join(' ');
export const MENU_ITEM_ACTIVE = 'bg-dropdown-item-hover-background';
export const MENU_ITEM_INTERACTIVE =
  'hover:bg-dropdown-item-hover-background focus-visible:bg-dropdown-item-hover-background';

/* -------------------------------------------------------------- placement */

export type Placement =
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'top-end'
  | 'right-end';

/** Puts a top-layer panel next to its trigger, flipping when it won't fit. */
export function place(
  trigger: HTMLElement,
  panel: HTMLElement,
  placement: Placement = 'bottom-start',
  offset = 4,
) {
  const t = trigger.getBoundingClientRect();
  // offset sizes, since the entrance scale shrinks the bounding box.
  const p = { width: panel.offsetWidth, height: panel.offsetHeight };
  const margin = 8;
  const [side, align] = placement.split('-') as [
    'bottom' | 'top' | 'right',
    'start' | 'end',
  ];
  let top: number;
  let left: number;
  if (side === 'right') {
    left = t.right + offset;
    top = align === 'end' ? t.bottom - p.height : t.top;
    if (left + p.width > innerWidth - margin) left = t.left - offset - p.width;
  } else {
    const below = t.bottom + offset;
    const above = t.top - offset - p.height;
    const fitsBelow = below + p.height <= innerHeight - margin;
    const fitsAbove = above >= margin;
    top =
      side === 'top'
        ? fitsAbove || !fitsBelow
          ? above
          : below
        : fitsBelow || !fitsAbove
          ? below
          : above;
    left = align === 'end' ? t.right - p.width : t.left;
    panel.style.transformOrigin = `${align === 'end' ? 'right' : 'left'} ${top < t.top ? 'bottom' : 'top'}`;
  }
  panel.style.left = `${Math.max(margin, Math.min(left, innerWidth - p.width - margin))}px`;
  panel.style.top = `${Math.max(margin, Math.min(top, innerHeight - p.height - margin))}px`;
}

/** Arrow keys, Home and End move focus between the rows of a menu or list. */
export function moveFocus(
  e: KeyboardEvent,
  container: HTMLElement,
  selector: string,
) {
  const rows = [...container.querySelectorAll<HTMLElement>(selector)].filter(
    (r) => !r.hasAttribute('disabled'),
  );
  const at = rows.indexOf(document.activeElement as HTMLElement);
  let next = -1;
  if (e.key === 'ArrowDown') next = (at + 1) % rows.length;
  else if (e.key === 'ArrowUp') next = (at - 1 + rows.length) % rows.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = rows.length - 1;
  if (next < 0) return;
  e.preventDefault();
  rows[next]?.focus();
}

/** Wires a popover panel to its trigger: placement on open, and an open
 * signal for the trigger's chevron. */
function createPopover(
  placement: () => Placement | undefined,
  focusSelector: string,
) {
  const id = createUniqueId();
  const [open, setOpen] = createSignal(false);
  let trigger!: HTMLButtonElement;
  let panel!: HTMLDivElement;
  const reposition = () => place(trigger, panel, placement());
  return {
    id,
    open,
    triggerRef: (el: HTMLButtonElement) => (trigger = el),
    panelRef: (el: HTMLDivElement) => (panel = el),
    close: () => panel.hidePopover(),
    onToggle: (e: ToggleEvent) => {
      const isOpen = e.newState === 'open';
      setOpen(isOpen);
      if (isOpen) {
        reposition();
        addEventListener('scroll', reposition, true);
        addEventListener('resize', reposition);
        panel.querySelector<HTMLElement>(focusSelector)?.focus();
      } else {
        removeEventListener('scroll', reposition, true);
        removeEventListener('resize', reposition);
      }
    },
  };
}

/* --------------------------------------------------------------- Dropdown */

const DropdownContext = createContext<{ close: () => void }>();

export function Dropdown(props: {
  /** Content of the trigger button, styled entirely through `triggerClass`. */
  trigger: JSX.Element;
  triggerClass?: string;
  triggerLabel?: string;
  'aria-label': string;
  placement?: Placement;
  class?: string;
  children: JSX.Element;
}) {
  const pop = createPopover(
    () => props.placement,
    '[role=menuitem]:not([disabled])',
  );
  return (
    <>
      <button
        ref={pop.triggerRef}
        type="button"
        popovertarget={pop.id}
        aria-haspopup="menu"
        aria-expanded={pop.open() ? 'true' : 'false'}
        aria-label={props.triggerLabel}
        data-open={pop.open() || undefined}
        class={cx(
          'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
          props.triggerClass,
        )}
      >
        {props.trigger}
      </button>
      <div
        ref={pop.panelRef}
        id={pop.id}
        popover="auto"
        role="menu"
        aria-label={props['aria-label']}
        onToggle={pop.onToggle}
        onKeyDown={(e) => moveFocus(e, e.currentTarget, '[role=menuitem]')}
        class={cx(MENU_POPOVER_WIDTH, MENU_POPOVER_SURFACE, props.class)}
      >
        <DropdownContext value={{ close: pop.close }}>
          <div class="flex flex-col gap-1">{props.children}</div>
        </DropdownContext>
      </div>
    </>
  );
}

export function DropdownGroup(props: {
  label?: string;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <div
      role="group"
      class={cx(
        'flex w-full flex-col gap-1.5',
        props.label && 'pt-1',
        props.class,
      )}
    >
      <Show when={props.label}>
        <span class="ps-2 text-body-medium text-text-secondary">
          {props.label}
        </span>
      </Show>
      <div class="flex w-full flex-col gap-1">{props.children}</div>
    </div>
  );
}

export function DropdownItem(props: {
  selected?: boolean;
  onSelect?: () => void;
  icon?: IconComponent;
  /** Trailing content, such as a shortcut. */
  end?: JSX.Element;
  disabled?: boolean;
  class?: string;
  children: JSX.Element;
}) {
  const menu = useContext(DropdownContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={props.disabled}
      aria-current={props.selected && 'true'}
      onClick={() => {
        props.onSelect?.();
        menu.close();
      }}
      class={cx(
        MENU_ITEM,
        'text-body-medium',
        props.selected ? MENU_ITEM_ACTIVE : MENU_ITEM_INTERACTIVE,
        props.disabled && 'cursor-not-allowed text-text-tertiary',
        props.class,
      )}
    >
      <Glyph
        of={props.icon}
        class="size-5 shrink-0 text-foreground-icon-secondary"
      />
      <span class="min-w-0 flex-1 truncate">{props.children}</span>
      {props.end}
    </button>
  );
}

export function DropdownDivider(props: { class?: string }) {
  return (
    <div
      role="separator"
      class={cx(
        '-mx-2.5 my-1.5 h-px shrink-0 bg-border-button-default',
        props.class,
      )}
    />
  );
}

/* ----------------------------------------------------------------- Select */

export type SelectOption = {
  id: string;
  label: string;
  icon?: IconComponent;
  leading?: JSX.Element;
  disabled?: boolean;
};

export function Select(props: {
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
  'aria-label': string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  class?: string;
  triggerClass?: string;
}) {
  const pop = createPopover(() => 'bottom-start', '[aria-selected=true]');
  const current = () => props.options.find((o) => o.id === props.value);
  const sm = () => props.size === 'sm';
  return (
    <div class={cx('group flex flex-col', props.class)}>
      <button
        ref={pop.triggerRef}
        type="button"
        popovertarget={pop.id}
        aria-haspopup="listbox"
        aria-expanded={pop.open() ? 'true' : 'false'}
        aria-label={props['aria-label']}
        disabled={props.disabled}
        class={cx(
          'flex w-full cursor-pointer items-center justify-between rounded-2lg',
          'border border-border-button-default bg-background-primary-default shadow-xs',
          'text-text-primary',
          'transition-[background-color,border-color,box-shadow,padding,font-size] duration-200 ease',
          'hover:bg-background-primary-hover hover:border-border-button-hover',
          'outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-border-focus-ring',
          'disabled:cursor-not-allowed disabled:bg-background-primary-disabled disabled:text-text-tertiary disabled:shadow-none',
          sm()
            ? 'gap-1 px-[7px] py-1 text-body-2-medium'
            : 'gap-1.5 px-2.5 py-2 text-body-medium',
          props.triggerClass,
        )}
      >
        <span
          class={cx(
            'flex min-w-0 items-center truncate',
            sm() ? 'gap-1' : 'gap-[5px]',
          )}
        >
          {current()?.leading}
          <Glyph
            of={current()?.icon}
            class="size-4 shrink-0 text-foreground-icon-secondary"
          />
          {current()?.label}
        </span>
        <ChevronDownSmall
          class={cx(
            'shrink-0 text-text-secondary transition-transform duration-200 ease',
            sm() ? 'size-3.5' : 'size-4',
            pop.open() && 'rotate-180',
          )}
        />
      </button>
      <div
        ref={pop.panelRef}
        id={pop.id}
        popover="auto"
        role="listbox"
        aria-label={props['aria-label']}
        onToggle={pop.onToggle}
        onKeyDown={(e) => moveFocus(e, e.currentTarget, '[role=option]')}
        class={cx(MENU_POPOVER_WIDTH, MENU_POPOVER_SURFACE, 'p-2')}
      >
        <div class="flex max-h-[240px] w-full flex-col gap-1 overflow-auto outline-none">
          <For each={props.options}>
            {(option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.id === props.value ? 'true' : 'false'}
                disabled={option.disabled}
                onClick={() => {
                  props.onChange(option.id);
                  pop.close();
                }}
                class={cx(
                  MENU_ITEM,
                  sm() ? 'px-2 py-1.5 text-body-2-medium' : 'text-body-medium',
                  option.id === props.value
                    ? MENU_ITEM_ACTIVE
                    : MENU_ITEM_INTERACTIVE,
                  option.disabled && 'cursor-not-allowed text-text-tertiary',
                )}
              >
                {option.leading}
                <Glyph
                  of={option.icon}
                  class="size-5 shrink-0 text-foreground-icon-secondary"
                />
                <span class="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
