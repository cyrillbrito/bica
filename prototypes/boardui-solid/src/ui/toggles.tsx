// Ports of BoardUI's checkbox/checkbox.tsx, checkbox-glyph.tsx and
// switch/switch.tsx (MIT). React Aria's state render props became a visually
// hidden native input (`peer`), so hover, focus, and disabled come from CSS.
import type { JSX } from '@solidjs/web';
import { Show, createEffect, createSignal } from 'solid-js';

import { cx } from './cx';

/* --------------------------------------------------------------- Checkbox */

const checkboxSizes = {
  md: { box: 'size-4', label: 'text-body-medium', gap: 'gap-2' },
  sm: { box: 'size-3.5', label: 'text-body-2-medium', gap: 'gap-1.5' },
};

export function Checkbox(props: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  'aria-label'?: string;
  class?: string;
  children?: JSX.Element;
}) {
  const [checked, setChecked] = createSignal(() => props.checked ?? false);
  const s = () => checkboxSizes[props.size ?? 'md'];
  const marked = () => checked() || props.indeterminate;
  let input!: HTMLInputElement;
  // `indeterminate` is a DOM property with no attribute, so JSX can't set it.
  createEffect(
    () => !!props.indeterminate,
    (on) => {
      input.indeterminate = on;
    },
  );
  return (
    <label
      class={cx(
        'group inline-flex items-center select-none',
        s().gap,
        props.disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        props.class,
      )}
    >
      <input
        type="checkbox"
        class="peer sr-only"
        ref={(el) => (input = el)}
        checked={checked()}
        disabled={props.disabled}
        aria-label={props['aria-label']}
        onChange={(e) => {
          setChecked(e.currentTarget.checked);
          props.onChange?.(e.currentTarget.checked);
        }}
      />
      <span
        aria-hidden="true"
        class={cx(
          'flex shrink-0 items-center justify-center rounded-sm',
          'transition-[background-color,border-color,box-shadow] duration-150 ease',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-border-focus-ring peer-focus-visible:ring-offset-2',
          s().box,
          marked()
            ? 'bg-linear-to-b shadow-checkbox-selected from-accent-500 to-accent-600 group-hover:from-accent-400 group-hover:to-accent-500'
            : 'border bg-background-primary-default shadow-xs border-border-checkbox-default group-hover:border-border-checkbox-hover',
          props.disabled &&
            'opacity-50 group-hover:border-border-checkbox-default',
        )}
      >
        <svg viewBox="0 0 16 16" fill="none" class={s().box}>
          <Show
            when={props.indeterminate}
            fallback={
              <Show when={checked()}>
                <path
                  d="M4 7.7002L6.64645 10.3466C6.84171 10.5419 7.15829 10.5419 7.35355 10.3466L12 5.7002"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  pathLength={1}
                  class="animate-check-draw"
                />
              </Show>
            }
          >
            <path
              d="M4.5 8H8H11.5"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
            />
          </Show>
        </svg>
      </span>
      <Show when={props.children}>
        <span class={cx(s().label, 'text-text-primary')}>{props.children}</span>
      </Show>
    </label>
  );
}

/* ----------------------------------------------------------------- Switch */

const switchSizes = {
  sm: {
    track: 'h-4 w-7',
    onShadow:
      'shadow-[inset_0_1px_0_0_rgb(255_255_255/0.25),inset_0_0_0_0.5px_var(--color-accent-500)]',
    thumb: 'size-3',
    offset: 'start-0.5 top-0.5',
    travel: 'translate-x-3',
    chip: 'size-[5px] border-[0.25px] shadow-[0_2px_2px_0_rgb(0_0_0/0.03)]',
  },
  md: {
    track: 'h-6 w-[42px]',
    onShadow:
      'shadow-[inset_0_1.5px_0_0_rgb(255_255_255/0.25),inset_0_0_0_0.75px_var(--color-accent-500)]',
    thumb: 'size-[18px]',
    offset: 'start-[3px] top-[3px]',
    travel: 'translate-x-[18px]',
    chip: 'size-[7.5px] border-[0.375px] shadow-[0_3px_3px_0_rgb(0_0_0/0.03)]',
  },
  lg: {
    track: 'h-8 w-14',
    onShadow: 'shadow-checkbox-selected',
    thumb: 'size-6',
    offset: 'start-1 top-1',
    travel: 'translate-x-6',
    chip: 'size-[10px] border-[0.5px] shadow-[0_4px_4px_0_rgb(0_0_0/0.03)]',
  },
};

export function Switch(props: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  'aria-label'?: string;
  class?: string;
  children?: JSX.Element;
}) {
  const [on, setOn] = createSignal(() => props.checked ?? false);
  const s = () => switchSizes[props.size ?? 'md'];
  return (
    <label
      class={cx(
        'group inline-flex items-center gap-2 select-none',
        props.disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        props.class,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        class="peer sr-only"
        checked={on()}
        disabled={props.disabled}
        aria-label={props['aria-label']}
        onChange={(e) => {
          setOn(e.currentTarget.checked);
          props.onChange?.(e.currentTarget.checked);
        }}
      />
      <span
        aria-hidden="true"
        class={cx(
          'relative shrink-0 rounded-full transition-colors duration-200 ease',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-border-focus-ring peer-focus-visible:ring-offset-2',
          s().track,
          on()
            ? cx('bg-linear-to-b from-accent-500 to-accent-600', s().onShadow)
            : 'bg-background-tertiary-default',
          props.disabled && 'opacity-50',
        )}
      >
        <span
          class={cx(
            'absolute flex items-center justify-center rounded-full',
            'bg-linear-to-b from-control-indicator-background from-[43.837%] to-control-indicator-background-subtle',
            'shadow-[0_3px_3px_0_rgb(0_0_0/0.03),0_0.75px_0_0_rgb(0_0_0/0.05)]',
            'transition-transform duration-200 ease',
            s().thumb,
            s().offset,
            on() && s().travel,
          )}
        >
          <span
            class={cx(
              'rounded-full border-solid bg-linear-to-t from-[43.837%]',
              s().chip,
              on()
                ? 'border-accent-600 from-switch-on-chip-start to-switch-on-chip-end'
                : 'border-border-button-default/50 from-switch-off-chip-start to-switch-off-chip-end',
            )}
          />
        </span>
      </span>
      <Show when={props.children}>
        <span class="text-body-medium text-text-primary">{props.children}</span>
      </Show>
    </label>
  );
}
